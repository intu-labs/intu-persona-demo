/**
 * Orchestrator
 *
 * Core orchestration layer focused on establishing and maintaining
 * connections to the MCP server and handling message passing.
 */

import { connect, listResources, getResource } from "./clean-client.js";
import { Controller } from "./control.js";
import { formatResourcePath } from "./resource-helpers.js";
import { ConversationService } from "../services/conversationService.js";

// Define the OrchestratorState type to include all needed states
export type OrchestratorState =
  | "idle"
  | "initializing"
  | "connecting"
  | "connected"
  | "ready"
  | "error";

// Helper function to check if a state is a connected state
function isConnectedState(state: OrchestratorState): boolean {
  return state === "connected" || state === "ready";
}

/**
 * Simple logger for orchestrator operations
 */
function logOrchestrator(msg: string, ...args: any[]) {
  console.log(`[Orchestrator ${new Date().toISOString()}] ${msg}`, ...args);
}

/**
 * Core orchestrator implementation
 */
export class AgentOrchestrator {
  private state: OrchestratorState = "idle";
  private connectionPromise: Promise<any> | null = null;
  private isConnecting: boolean = false;
  private connectionError: Error | null = null;
  private sessionMessages: Map<string, string[]> = new Map();
  private controller: Controller;
  private controllerInitialized: boolean = false;
  private personaData: any;
  private conversationService: ConversationService;
  private nftOwnershipCache: Map<string, { result: any; timestamp: number }> =
    new Map(); // Cache NFT ownership results
  private readonly NFT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Creates a new Orchestrator instance
   */
  constructor() {
    this.controller = new Controller();
    this.conversationService = new ConversationService(this.controller);
    this.state = "idle";
    logOrchestrator("Orchestrator created");
  }

  /**
   * Get current connection state
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Get connection error if any
   */
  getError(): Error | null {
    return this.connectionError;
  }

  /**
   * Get MCP connection info
   */
  getMcpInfo(): any {
    return {
      isConnected: this.state === "connected",
      lastConnectionTime: Date.now(),
      serverVersion: { name: "MCP Server", version: "1.0" },
    };
  }

  /**
   * Wait for a resource's content to be available, with retries
   */
  private async waitForResourceContent(
    resourceUri: string,
    maxAttempts = 5
  ): Promise<any | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resourcesResp = await listResources();
        const resources =
          (resourcesResp.resources
            ?.map((r) => r.uri || r.id || r.name)
            .filter(Boolean) as string[]) || [];
        if (!resources.includes(resourceUri)) {
          await new Promise((res) =>
            setTimeout(res, Math.pow(2, attempt) * 1000)
          );
          continue;
        }
        const resource = await getResource(resourceUri);
        if (resource && resource.contents && resource.contents.length > 0) {
          return resource;
        }
      } catch (error) {
        // Optionally log error
      }
      await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
    }
    return null;
  }

  /**
   * Connect to the MCP server and initialize the controller
   */
  async connect(): Promise<boolean> {
    if (this.isConnecting) {
      logOrchestrator("Connection already in progress, waiting...");
      if (this.connectionPromise) {
        await this.connectionPromise;
      }
      return this.state === "connected" || this.state === "ready";
    }

    if (isConnectedState(this.state)) {
      logOrchestrator("Already connected to MCP server");
      return true;
    }

    this.isConnecting = true;
    this.state = "connecting";
    this.connectionError = null;

    this.connectionPromise = this._performConnection();

    try {
      await this.connectionPromise;
      return isConnectedState(this.state);
    } catch (error) {
      this.connectionError = error as Error;
      this.state = "error";
      logOrchestrator("Connection failed:", error);
      return false;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Internal method to perform the actual connection
   */
  private async _performConnection(): Promise<void> {
    try {
      logOrchestrator("Connecting to MCP server...");

      // Connect to the MCP server
      const connectionResult = await connect();
      logOrchestrator("MCP connection established");

      // Initialize the controller with MCP connection
      await this.controller.initialize(null); // Pass null for initial connection
      this.controllerInitialized = true;

      this.state = "connected";
      logOrchestrator("Successfully connected to MCP server");
    } catch (error) {
      logOrchestrator("Failed to connect to MCP server:", error);
      throw error;
    }
  }

  /**
   * Handle a message, with conversation encryption/decryption
   */
  async handleMessage(
    sessionId: string,
    message: string,
    userEvmAddressInput?: string | { address: string },
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!isConnectedState(this.state)) {
      const isReconnected = await this.connect();
      if (!isReconnected) {
        return "I'm unable to connect to the system right now. Please try again later.";
      }
    }

    try {
      logOrchestrator(
        `Handling message: "${message}", session: ${sessionId}, userEvmAddressInput: ${JSON.stringify(
          userEvmAddressInput
        )}, metadata: ${JSON.stringify(metadata)}`
      );

      // Handle system actions directly (bypass LLM for system operations)
      if (metadata?.action === "getPendingPersona") {
        logOrchestrator(
          "🔧 SYSTEM ACTION: Direct MCP call for getPendingPersona"
        );
        const userEvmAddress =
          typeof userEvmAddressInput === "object"
            ? userEvmAddressInput.address
            : userEvmAddressInput;

        try {
          const result = await this.controller.callMcpTool(
            "getPendingPersona",
            {
              evmAddress: metadata.evmAddress || userEvmAddress,
            }
          );
          logOrchestrator(
            "✅ SYSTEM ACTION: getPendingPersona result:",
            result
          );
          return JSON.stringify(result);
        } catch (error) {
          logOrchestrator("❌ SYSTEM ACTION: getPendingPersona error:", error);
          return JSON.stringify({
            success: false,
            error: "Failed to get pending persona",
          });
        }
      }

      if (metadata?.action === "clearPersonaCache") {
        logOrchestrator(
          "🔧 SYSTEM ACTION: Direct MCP call for clearPersonaCache"
        );
        const userEvmAddress =
          typeof userEvmAddressInput === "object"
            ? userEvmAddressInput.address
            : userEvmAddressInput;

        try {
          const result = await this.controller.callMcpTool(
            "clearPersonaCache",
            {
              evmAddress: metadata.evmAddress || userEvmAddress,
            }
          );
          logOrchestrator(
            "✅ SYSTEM ACTION: clearPersonaCache result:",
            result
          );
          return JSON.stringify(result);
        } catch (error) {
          logOrchestrator("❌ SYSTEM ACTION: clearPersonaCache error:", error);
          return JSON.stringify({
            success: false,
            error: "Failed to clear persona cache",
          });
        }
      }

      // Initialize controller with persona data if available
      if (metadata?.persona) {
        try {
          logOrchestrator(
            `Using persona data from metadata: ${metadata.persona.name}`
          );
          // Use the persona data directly from metadata - no need to load from MCP
          await this.controller.initialize(metadata.persona);
          this.controllerInitialized = true;
        } catch (error) {
          logOrchestrator("Error initializing with persona data:", error);
          // Fallback to no persona
          await this.controller.initialize(null);
          this.controllerInitialized = true;
        }
      }

      // Convert userEvmAddressInput to string if it's an object
      const userEvmAddress =
        typeof userEvmAddressInput === "object"
          ? userEvmAddressInput.address
          : userEvmAddressInput;

      // Get response from controller
      const response = await this.controller.processMessage(
        sessionId,
        message,
        userEvmAddress
      );

      return response;
    } catch (error) {
      logOrchestrator("Error processing message:", error);
      return "I encountered an error processing your message. Please try again.";
    }
  }

  /**
   * Clear conversation history for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    // Clear from memory
    this.sessionMessages.delete(sessionId);
    this.controller.clearConversation(sessionId);

    // Clear from MongoDB
    await this.conversationService.clearSession(sessionId);
  }

  /**
   * Get all available resources
   */
  async getAvailableResources(): Promise<string[]> {
    return this.controller.getAvailableResources();
  }
  /**
   * Get all available tools
   */
  async getAvailableTools(): Promise<string[]> {
    return this.controller.getAvailableTools();
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(
    sessionId: string,
    userEvmAddress?: string
  ): Promise<any[]> {
    return this.conversationService.getConversationHistory(
      sessionId,
      userEvmAddress
    );
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<any[]> {
    return this.conversationService.getAllSessions();
  }

  /**
   * Force a reconnection to MCP and reinitialize
   */
  async forceReconnect(): Promise<boolean> {
    this.state = "connecting"; // Use a valid state
    // Reset initialized flag
    this.controllerInitialized = false;
    return this.connect();
  }
}

// Export the orchestrator as the default export
export default AgentOrchestrator;
