/**
 * LLM Adapter for MCP Server
 *
 * Provider-agnostic adapter for interacting with language models.
 * Supports Ollama (local) and OpenAI (API) providers.
 */

import fetch from "node-fetch";
import OpenAI from "openai";
import { logger } from "../utils/logger.js";

// LLM Provider Types
type LLMProvider = "ollama" | "openai";

// Message types
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// Configuration for the LLM adapter
interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  apiUrl?: string;
}

// Get the active configuration
function getConfig(): LLMConfig {
  // Auto-detect provider based on available API keys
  const openaiKey = process.env.OPENAI_API_KEY;

  let provider: LLMProvider = "ollama"; // default
  let model = process.env.OLLAMA_MODEL || "llama3.2";

  // If OpenAI API key is present, use OpenAI
  if (openaiKey) {
    provider = "openai";
    model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
  }

  return {
    provider,
    model,
    apiKey: openaiKey,
    apiUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  };
}

/**
 * Generate a response from the LLM
 */
export async function generateNameAndAccessory(
  persona: any
): Promise<{ name: string; accessory: string }> {
  const config = getConfig();

  logger.info(
    `[LLM_ADAPTER] Using provider: ${config.provider} (${config.model})`
  );

  switch (config.provider) {
    case "ollama":
      return generateWithOllama(config, persona);
    case "openai":
      return generateWithOpenAI(config, persona);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

/**
 * Generate name and accessory using OpenAI
 */
async function generateWithOpenAI(
  config: LLMConfig,
  persona: any
): Promise<{ name: string; accessory: string }> {
  try {
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const openai = new OpenAI({
      apiKey: config.apiKey,
    });

    const prompt = `Generate a unique name and accessory for an AI persona with these characteristics:
- Gender: ${persona.gender}
- Confidence: ${persona.confidence}/5
- Sarcasm: ${persona.sarcasm}/5
- Charm: ${persona.charm}/5
- Morality: ${persona.morality}/5
- Appearance: ${persona.appearance}
- Region: ${persona.region}
- Education: ${persona.education}/5

Requirements:
- The name should be fitting for someone from ${persona.region}
- The accessory should reflect their ${persona.appearance} appearance and personality
- Be creative and unique
- Respond in this exact JSON format: {"name": "First Last", "accessory": "Descriptive Accessory"}`;

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "You are a creative character generator. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    logger.info(`[LLM_ADAPTER] OpenAI raw response: ${content}`);

    // Handle potential markdown code blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    logger.info(`[LLM_ADAPTER] Cleaned JSON content: ${jsonContent}`);

    const result = JSON.parse(jsonContent);
    logger.info(`[LLM_ADAPTER] Parsed result: ${JSON.stringify(result)}`);

    return {
      name: result.name || "Unknown Persona",
      accessory: result.accessory || "Simple Accessory",
    };
  } catch (error) {
    logger.error("[LLM_ADAPTER] Error generating with OpenAI:", error);
    throw error;
  }
}

/**
 * Generate name and accessory using Ollama
 */
async function generateWithOllama(
  config: LLMConfig,
  persona: any
): Promise<{ name: string; accessory: string }> {
  try {
    const prompt = `Generate a unique name and accessory for an AI persona with these characteristics:
- Gender: ${persona.gender}
- Confidence: ${persona.confidence}/5
- Sarcasm: ${persona.sarcasm}/5
- Charm: ${persona.charm}/5
- Morality: ${persona.morality}/5
- Appearance: ${persona.appearance}
- Region: ${persona.region}
- Education: ${persona.education}/5

Requirements:
- The name should be fitting for someone from ${persona.region}
- The accessory should reflect their ${persona.appearance} appearance and personality
- Be creative and unique
- Respond in this exact JSON format: {"name": "First Last", "accessory": "Descriptive Accessory"}`;

    logger.info(
      `[LLM_ADAPTER] Calling Ollama with model: ${config.model}, URL: ${config.apiUrl}`
    );

    const response = await fetch(`${config.apiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "You are a creative character generator. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `[LLM_ADAPTER] Ollama API error (${response.status}): ${errorText}`
      );
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { message: { content: string } };
    logger.info(`[LLM_ADAPTER] Ollama raw response: ${data.message.content}`);

    // Handle markdown code blocks in response
    let jsonContent = data.message.content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    logger.info(`[LLM_ADAPTER] Cleaned JSON content: ${jsonContent}`);

    const result = JSON.parse(jsonContent);
    logger.info(`[LLM_ADAPTER] Parsed result: ${JSON.stringify(result)}`);

    return {
      name: result.name || "Unknown Persona",
      accessory: result.accessory || "Simple Accessory",
    };
  } catch (error) {
    logger.error("[LLM_ADAPTER] Error generating with Ollama:", error);
    throw error;
  }
}
