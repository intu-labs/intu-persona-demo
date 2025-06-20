/**
 * Control Module
 *
 * Handles the complete reasoning pipeline:
 * 1. User query → LLM
 * 2. Parse LLM response for MCP operations
 * 3. Execute MCP operations
 * 4. Feed results back to LLM
 * 5. Generate final response
 */

import * as llmAdapter from "../llm/llm-adapter.js";
import {
  connect,
  getResource,
  listResources,
  listTools,
  getConnectionInfo,
  callTool,
} from "./clean-client.js";
import {
  formatResourcePath,
  processContextResponse,
} from "./resource-helpers.js";
import { logger } from "../utils/logger.js";

// Define the message types for LLM
type MessageRole = "system" | "user" | "assistant";

interface Message {
  role: MessageRole;
  content: string;
}

/**
 * Pattern to match MCP operations in LLM output
 * Updated to match both simple [MCP:resource-name] and complex [MCP:tool-name:param="value"] formats
 */
// Pattern to match MCP operations in text (handles both MCP and MCF typos)
const MCP_OPERATION_PATTERN = /\[MC[PF]:([\w-]+)(?::([^\]]+))?\]/g;

/**
 * Interface for MCP operation with parameters
 */
interface McpOperation {
  name: string; // Name of the resource or tool
  params?: Record<string, string>; // Optional parameters for the operation
  fullMatch: string; // The full matched text for replacement
}

/**
 * Extract MCP operation tags from LLM output
 */
function extractMcpOperations(text: string): McpOperation[] {
  const operations: McpOperation[] = [];
  let match;

  // Reset the regex state
  MCP_OPERATION_PATTERN.lastIndex = 0;

  while ((match = MCP_OPERATION_PATTERN.exec(text)) !== null) {
    const name = match[1];
    const paramString = match[2];
    const fullMatch = match[0];

    const operation: McpOperation = {
      name,
      fullMatch,
    };

    // Parse parameters if they exist
    if (paramString) {
      const params: Record<string, string> = {};
      const paramMatches = paramString.matchAll(
        /(\w+)=(?:"([^"]+)"|([^,\s]+))/g
      );
      for (const paramMatch of paramMatches) {
        const key = paramMatch[1];
        let value = paramMatch[2] !== undefined ? paramMatch[2] : paramMatch[3];
        // Remove leading/trailing quotes if present
        if (typeof value === "string") {
          value = value.replace(/^"+|"+$/g, "");
        }
        params[key] = value;
      }
      operation.params = params;
    }
    operations.push(operation);
  }
  return operations;
}

/**
 * Clean up raw response from LLM by removing MCP tags but preserving markdown formatting
 */
function cleanupResponse(text: string): string {
  // Remove all MCP tags and search operations - both the simple and complex patterns
  const withoutMcpTags = text
    .replace(/\[MC[PF]:([\w-]+)(?::([^\]]+))?\]/g, "") // Standard MCP/MCF tags
    .replace(/\[search-products:(?:[^\]]+)\]/g, "") // Search product tags with params
    .replace(/\[[\w-]+:[^\]]+\]/g, ""); // Any other remaining bracketed tags

  // Remove "ASSISTANT THINKING:" and similar development prompts
  const withoutThinking = withoutMcpTags.replace(
    /ASSISTANT THINKING:[\s\S]*?(?=ASSISTANT:|$)/gi,
    ""
  );

  // Remove any "ASSISTANT:" prefixes
  const withoutAssistantPrefix = withoutThinking.replace(
    /^ASSISTANT:\s*/gim,
    ""
  );

  // Minimal cleanup to ensure basic markdown works properly
  let cleanedText = withoutAssistantPrefix;

  // Fix potential issues with markdown lists (ensure proper spacing)
  cleanedText = cleanedText
    // Ensure proper spacing for bullet lists
    .replace(/^(\s*)\*(\s*)/gm, "$1* $2")
    // Ensure proper spacing for numbered lists
    .replace(/^(\s*)\d+\.(\s*)/gm, "$1$&$2")
    // Add proper spacing for headers
    .replace(/^(\s*)#+(\s*)/gm, "$1$& ");

  // Remove excessive blank lines
  cleanedText = cleanedText.replace(/\n{3,}/g, "\n\n");

  return cleanedText.trim();
}

/**
 * Convert string parameters to their appropriate types
 * (e.g., convert numeric strings to actual numbers)
 */
function convertParamTypes(
  params: Record<string, string> | undefined,
  toolName?: string
): Record<string, any> {
  if (!params) return {};

  const convertedParams: Record<string, any> = {};

  // Special handling for search-products to ensure query parameter is always present
  if (toolName === "search-products" && !params.query) {
    convertedParams.query = ""; // Set empty string as default
  }

  for (const [key, value] of Object.entries(params)) {
    // Try to convert numeric strings to numbers
    if (/^\d+$/.test(value)) {
      // Integer
      convertedParams[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      // Float
      convertedParams[key] = parseFloat(value);
    } else if (value === "true") {
      // Boolean true
      convertedParams[key] = true;
    } else if (value === "false") {
      // Boolean false
      convertedParams[key] = false;
    } else {
      // Keep as string
      convertedParams[key] = value;
    }
  }
  return convertedParams;
}

/**
 * The main control class that manages the LLM → MCP → LLM reasoning flow
 */
export class Controller {
  private history: Map<string, Message[]> = new Map();
  private availableResources: string[] = [];
  private availableTools: string[] = [];
  private systemPrompt: string | null = null;
  private initialized: boolean = false;
  private personaData: any = null;

  constructor() {
    this.systemPrompt = null;
    this.personaData = null;
    logger.debug("Control", "Controller initialized");
  }

  /**
   * Initialize the controller by fetching available resources and tools
   * and building the system prompt
   */
  async initialize(personaData: any): Promise<boolean> {
    if (this.initialized) {
      // If already initialized but persona data is provided, update the system prompt
      if (personaData) {
        this.personaData = personaData; // Store persona data
        this.systemPrompt = this.buildSystemPrompt(
          this.availableResources,
          this.availableTools,
          personaData
        );
        // Update all existing conversation system messages
        this.updateAllConversationSystemMessages();
      }
      return true;
    }

    try {
      logger.debug("Control", "Initializing controller with MCP connection");

      // Fetch available resources and tools from MCP
      this.availableResources = await this.getAvailableResources();
      this.availableTools = await this.getAvailableTools();

      logger.debug(
        "Control",
        `Found ${this.availableResources.length} resources and ${this.availableTools.length} tools`
      );
      logger.debug("Control", "Available tools:", this.availableTools);

      // Store persona data
      this.personaData = personaData;

      // Build the system prompt
      this.systemPrompt = this.buildSystemPrompt(
        this.availableResources,
        this.availableTools,
        this.personaData
      );

      this.initialized = true;
      logger.debug("Control", "Controller initialized successfully with MCP");
      return true;
    } catch (error) {
      logger.error("Control", "Error during MCP initialization:", error);
      logger.debug("Control", "Falling back to bypass mode");

      // Fallback to bypass mode
      this.availableResources = [];
      this.availableTools = [];

      // Store persona data
      this.personaData = personaData;

      this.systemPrompt = this.buildSystemPrompt(
        this.availableResources,
        this.availableTools,
        this.personaData
      );

      this.initialized = true;
      return true;
    }
  }

  private async getConversation(sessionId: string): Promise<Message[]> {
    if (!this.history.has(sessionId)) {
      // Create a new conversation with the system prompt
      this.history.set(sessionId, [this.createSystemMessage()]);
    }

    return this.history.get(sessionId)!;
  }

  /**
   * Create a system message with the configured prompt
   */
  private createSystemMessage(): Message {
    return {
      role: "system",
      content: this.systemPrompt || "You are a helpful AI assistant.",
    };
  }

  /**
   * Process a user message through the LLM reasoning pipeline
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
    userEvmAddress?: string
  ): Promise<string> {
    try {
      // Get conversation history
      const conversation = await this.getConversation(sessionId);

      // Add system message if we have persona data
      if (
        this.personaData &&
        !conversation.some((msg) => msg.role === "system")
      ) {
        conversation.unshift(this.createSystemMessage());
      }

      // Add user message to conversation
      conversation.push({ role: "user", content: userMessage });

      // Generate response
      const response = await llmAdapter.generate(conversation);

      // DEBUG: Log the system prompt and LLM response
      console.log("🧠 SYSTEM PROMPT:", this.systemPrompt);
      console.log("📝 USER MESSAGE:", userMessage);
      console.log("💬 CONVERSATION HISTORY:", conversation);
      console.log("🤖 LLM RESPONSE:", response);

      if (!response || response.trim() === "") {
        console.error("❌ LLM returned empty response!");
        return "I'm having trouble processing your request. Please try again.";
      }

      // Check if the response contains MCP operations
      const mcpOperations = extractMcpOperations(response);

      // DEBUG: Log extracted operations
      console.log("🔧 EXTRACTED MCP OPERATIONS:", mcpOperations);
      console.log("🔧 RESPONSE FOR EXTRACTION:", JSON.stringify(response));

      if (mcpOperations.length > 0) {
        console.log(
          `[Control] Found ${mcpOperations.length} MCP operations in response`
        );

        // Execute the MCP operations
        const operationResults = await this.executeMcpOperations(
          mcpOperations,
          sessionId,
          userEvmAddress
        );

        // Process the results and create a final response
        let finalResponse = response;

        // Replace MCP operation calls with their results
        for (let i = 0; i < mcpOperations.length; i++) {
          const operation = mcpOperations[i];
          const result = operationResults[i];

          if (result) {
            // Replace the MCP call with the result
            finalResponse = finalResponse.replace(
              operation.fullMatch,
              result.result
            );
          }
        }

        // Clean up any remaining MCP syntax
        finalResponse = cleanupResponse(finalResponse);

        // Add the final response to conversation history
        conversation.push({ role: "assistant", content: finalResponse });

        return finalResponse;
      } else {
        // No MCP operations, just return the response as-is
        conversation.push({ role: "assistant", content: response });
        return response;
      }
    } catch (error) {
      logger.error("Control", "Error processing message:", error);
      throw error;
    }
  }

  /**
   * Execute MCP operations extracted from LLM response
   */
  private async executeMcpOperations(
    operations: McpOperation[],
    sessionId: string,
    userEvmAddress?: string
  ): Promise<Array<{ operation: string; result: string }>> {
    const results: Array<{ operation: string; result: string }> = [];

    // Deduplicate operations by name to prevent redundant calls
    const uniqueOperations = new Map<string, McpOperation>();

    for (const op of operations) {
      const existing = uniqueOperations.get(op.name);

      // If this operation name exists, prefer the one with parameters
      if (!existing || (!existing.params && op.params)) {
        uniqueOperations.set(op.name, op);
      }
    }

    // Execute only the unique operations
    for (const op of uniqueOperations.values()) {
      try {
        console.log(`[Control] Executing operation: ${op.name}`);

        // Check if this is a resource operation
        if (this.availableResources.some((r) => r.includes(op.name))) {
          // Format the resource path properly
          const resourcePath = formatResourcePath(op.name);

          // Get the resource
          const resource = await getResource(resourcePath);

          // Extract text content if available
          let resultText = "No content available";
          if (resource && resource.contents && resource.contents.length > 0) {
            resultText = resource.contents.map((c: any) => c.text).join("\n\n");
          }

          results.push({
            operation: `Resource: ${op.name}`,
            result: resultText,
          });
        }
        // Check if this is a tool operation
        else if (this.availableTools.includes(op.name)) {
          // Convert parameters to their appropriate types
          let typedParams = convertParamTypes(op.params, op.name);

          // Substitute "user_address" placeholder with actual EVM address
          if (userEvmAddress && typedParams.evmAddress === "user_address") {
            typedParams.evmAddress = userEvmAddress;
            console.log(
              `🔧 Substituted user_address with ${userEvmAddress} for tool ${op.name}`
            );
          }

          // Special handling for uploadToIpfs tool - inject persona data from context
          if (op.name === "uploadToIpfs") {
            if (!typedParams.personaData && this.personaData) {
              typedParams.personaData = this.personaData;
              console.log(
                "🔄 Injected persona data for uploadToIpfs:",
                this.personaData.name
              );
            }

            console.log("🎯 uploadToIpfs params:", {
              hasPersonaData: !!typedParams.personaData,
              personaName: typedParams.personaData?.name,
              skipGeneration: typedParams.skipGeneration,
            });
          }

          // Call the tool
          const toolResult = await callTool(op.name, typedParams);

          // Process the result
          let resultText = JSON.stringify(toolResult, null, 2);

          // Special handling for persona-related tools
          if (
            (op.name === "generatePersona" ||
              op.name === "getPendingPersona") &&
            toolResult.structuredContent
          ) {
            const personaData = toolResult.structuredContent;
            if (personaData.success && personaData.persona) {
              // Store persona data in controller context
              this.personaData = personaData.persona;
              console.log("🎭 STORED PERSONA DATA:", this.personaData.name);

              // Return the raw tool result so chat interface can parse the JSON
              resultText = JSON.stringify(toolResult, null, 2);
            } else {
              resultText = `❌ Failed to get persona: ${
                personaData.message || "Unknown error"
              }`;
            }
          }

          // Special handling for search tools
          if (op.name.startsWith("search-") && toolResult.content) {
            resultText = processContextResponse(toolResult);
          }

          // Special handling for uploadToIpfs tool - extract the actual text response
          if (
            op.name === "uploadToIpfs" &&
            toolResult.content &&
            toolResult.content[0]
          ) {
            resultText = toolResult.content[0].text;
            console.log("🎯 UPLOAD IPFS RESPONSE EXTRACTED:", resultText);
          }

          results.push({
            operation: `Tool: ${op.name}`,
            result: resultText,
          });
        } else {
          results.push({
            operation: op.name,
            result: `Operation not available: ${op.name} is neither a valid resource nor a valid tool.`,
          });
        }
      } catch (error) {
        console.error(`[Control] Error executing operation ${op.name}:`, error);

        results.push({
          operation: op.name,
          result: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }

    return results;
  }

  /**
   * Clear the conversation history for a session
   */
  clearConversation(sessionId: string): void {
    if (this.history.has(sessionId)) {
      this.history.set(sessionId, [this.createSystemMessage()]);
    }
  }

  /**
   * Update system messages in all existing conversations with current system prompt
   */
  private updateAllConversationSystemMessages(): void {
    for (const [sessionId, conversation] of this.history.entries()) {
      if (conversation.length > 0 && conversation[0].role === "system") {
        // Update the first message (system message) with the new system prompt
        conversation[0].content =
          this.systemPrompt || "You are a helpful AI assistant.";
      }
    }
  }

  /**
   * Get available resources from the MCP server
   */
  async getAvailableResources(): Promise<string[]> {
    try {
      const resourcesResp = await listResources();

      const resources = resourcesResp.resources
        ?.map((r) => {
          if (r.uri) return r.uri;
          if (r.id) return r.id;
          if (r.name) return r.name;
          return null;
        })
        .filter(Boolean) as string[];

      return resources || [];
    } catch (error) {
      console.error("[Control] Error getting available resources:", error);
      return [];
    }
  }

  /**
   * Get available tools from the MCP server
   */
  async getAvailableTools(): Promise<string[]> {
    try {
      const toolsResp = await listTools();

      const tools = toolsResp.tools
        ?.map((t) => {
          if (t.name) return t.name;
          if (t.id) return t.id;
          return null;
        })
        .filter(Boolean) as string[];

      return tools || [];
    } catch (error) {
      console.error("[Control] Error getting available tools:", error);
      return [];
    }
  }

  /**
   * Call an MCP tool with proper error handling
   */
  async callMcpTool(name: string, args: any): Promise<any> {
    try {
      const result = await callTool(name, args);
      return result;
    } catch (error) {
      console.error(`[Control] Error calling MCP tool ${name}:`, error);
      throw error;
    }
  }
  /**
   * Build the system prompt based on available resources and tools
   */
  private buildSystemPrompt(
    resources: string[],
    tools: string[],
    personaData?: any
  ): string {
    // If we have persona data, create a persona-specific prompt
    if (personaData) {
      let prompt = `You are ${personaData.name}, a ${personaData.gender} from ${personaData.region}. 
Your appearance is ${personaData.appearance} and you wear ${personaData.accessory}.
Your personality traits:
- Confidence: ${personaData.confidence}/5
- Sarcasm: ${personaData.sarcasm}/5
- Charm: ${personaData.charm}/5
- Morality: ${personaData.morality}/5
- Education: ${personaData.education}/5

Respond in character as ${personaData.name}, maintaining your personality traits.
Be conversational and engaging, reflecting your unique personality.
Never mention being an AI assistant - you are ${personaData.name}.

You are an expert on INTU technology and can help users with questions about:
- INTU's unified execution layer for AI + Blockchain
- Policy engines for compliance
- Trusted operations across platforms
- Data privacy and encryption
- NFT-based identity systems

Always respond naturally in character. Only use special tools if the user specifically requests persona generation, minting, or other technical operations.`;

      return prompt;
    }

    // Default Dr. Indigo Bridge prompt - simplified for debugging
    let prompt = `You are Dr. Indigo Bridge, a helpful AI assistant that specializes in INTU technology and blockchain solutions.

CRITICAL: When you see persona requests, respond with ONLY the MCP tool call, nothing else:

Example:
User: "Get pending persona for EVM address: 0x5EB7d7C87dd40E044e8EDD1a0f52f3A788EaD7e6"
You: [MCP:getPendingPersona:evmAddress="0x5EB7d7C87dd40E044e8EDD1a0f52f3A788EaD7e6"]

User: "Generate persona for EVM address: 0x5EB7d7C87dd40E044e8EDD1a0f52f3A788EaD7e6"  
You: [MCP:generatePersona:evmAddress="0x5EB7d7C87dd40E044e8EDD1a0f52f3A788EaD7e6"]

For all other messages, respond normally as Dr. Indigo Bridge.

Available capabilities:`;

    // Add available resources
    if (resources.length > 0) {
      prompt += `\n\nRESOURCES: ${resources.join(", ")}`;
      prompt += `\nAccess format: [MCP:resource-name]`;
    }

    // Add available tools with special emphasis on persona generation
    if (tools.length > 0) {
      prompt += `\n\nTOOLS: ${tools.join(", ")}`;
      prompt += `\nCall format: [MCP:tool-name:param="value"]`;

      // Special instructions for persona generation
      if (tools.includes("generatePersona")) {
        prompt += `\n\nPERSONA RULES:
- For persona generation requests: respond with [MCP:generatePersona:evmAddress="address"] ONLY
- For pending persona check requests: respond with [MCP:getPendingPersona:evmAddress="address"] ONLY
- For regular chat: respond normally`;
      }
    }

    // Add specific usage instructions
    prompt += `\n\nUSAGE: Use tools only when specifically requested. For normal chat, respond directly.`;

    return prompt;
  }
}
