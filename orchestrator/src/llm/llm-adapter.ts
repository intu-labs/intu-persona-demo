/**
 * LLM Adapter
 *
 * Provider-agnostic adapter for interacting with language models.
 * Supports Ollama (local) and OpenAI (API) providers.
 */

import fetch from "node-fetch";
import OpenAI from "openai";

// Add proper type declaration for ReadableStream
declare global {
  interface ReadableStream {
    getReader(): {
      read(): Promise<{ done: boolean; value: Uint8Array }>;
      releaseLock(): void;
    };
  }
}

// LLM Provider Types
type LLMProvider = "ollama" | "anthropic" | "openai";

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

// Default configuration using Ollama
const defaultConfig: LLMConfig = {
  provider: "ollama",
  model: process.env.OLLAMA_MODEL || "llama3",
  apiUrl: process.env.OLLAMA_URL || "http://localhost:11434",
};

// Get the active configuration
function getConfig(): LLMConfig {
  // Auto-detect provider based on available API keys
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let provider: LLMProvider = "ollama"; // default
  let model = process.env.OLLAMA_MODEL || "llama3";

  // If OpenAI API key is present, use OpenAI
  if (openaiKey) {
    provider = "openai";
    model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
  }
  // If Anthropic API key is present, use Anthropic
  else if (anthropicKey) {
    provider = "anthropic";
    model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";
  }

  const apiUrl =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : provider === "anthropic"
      ? "https://api.anthropic.com"
      : process.env.OLLAMA_URL || "http://localhost:11434";

  return {
    ...defaultConfig,
    // Override with detected or environment-specified values
    provider: (process.env.LLM_PROVIDER as LLMProvider) || provider,
    model: process.env.LLM_MODEL || model,
    apiKey: process.env.LLM_API_KEY || openaiKey || anthropicKey,
    apiUrl: process.env.LLM_API_URL || apiUrl,
  };
}

/**
 * Create a system message
 */
export function createSystemMessage(content: string): Message {
  return { role: "system", content };
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): Message {
  return { role: "user", content };
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(content: string): Message {
  return { role: "assistant", content };
}

/**
 * Generate a response from the LLM
 */
export async function generate(messages: Message[]): Promise<string> {
  const config = getConfig();

  switch (config.provider) {
    case "ollama":
      return generateOllama(config, messages);
    case "anthropic":
      throw new Error("Anthropic provider not implemented yet");
    case "openai":
      return generateOpenAI(config, messages);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

/**
 * Generate a streaming response from the LLM
 */
export async function* generateStream(
  messages: Message[]
): AsyncGenerator<string> {
  const config = getConfig();

  switch (config.provider) {
    case "ollama":
      yield* generateOllamaStream(config, messages);
      break;
    case "anthropic":
      throw new Error("Anthropic streaming not implemented yet");
    case "openai":
      yield* generateOpenAIStream(config, messages);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

/**
 * Generate a response using OpenAI
 */
async function generateOpenAI(
  config: LLMConfig,
  messages: Message[]
): Promise<string> {
  try {
    console.log("🔧 OpenAI Request - Model:", config.model);
    console.log("🔧 OpenAI Request - Messages Count:", messages.length);
    console.log("🔧 OpenAI Request - Has API Key:", !!config.apiKey);

    if (!config.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const openai = new OpenAI({
      apiKey: config.apiKey,
    });

    console.log("🚀 Making OpenAI API call...");
    const response = await openai.chat.completions.create({
      model: config.model,
      messages:
        messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 2000,
    });

    console.log("✅ OpenAI API call successful");
    console.log("📊 OpenAI Response - Choices:", response.choices?.length);
    console.log("📊 OpenAI Response - Usage:", response.usage);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("❌ No content in OpenAI response:", response);
      throw new Error("No content received from OpenAI");
    }

    console.log("✅ OpenAI Content Length:", content.length);
    return content;
  } catch (error) {
    console.error("[LLM] Error generating with OpenAI:", error);
    if (error instanceof Error) {
      console.error("[LLM] Error details:", error.message);
      console.error("[LLM] Error stack:", error.stack);
    }
    throw error;
  }
}

/**
 * Generate a streaming response using OpenAI
 */
async function* generateOpenAIStream(
  config: LLMConfig,
  messages: Message[]
): AsyncGenerator<string> {
  try {
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const openai = new OpenAI({
      apiKey: config.apiKey,
    });

    const stream = await openai.chat.completions.create({
      model: config.model,
      messages:
        messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error("[LLM] Error generating stream with OpenAI:", error);
    throw error;
  }
}

/**
 * Generate a response using Ollama
 */
async function generateOllama(
  config: LLMConfig,
  messages: Message[]
): Promise<string> {
  try {
    const ollamaMessages = convertToOllamaMessages(messages);

    const response = await fetch(`${config.apiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { message: { content: string } };
    return data.message.content;
  } catch (error) {
    console.error("[LLM] Error generating with Ollama:", error);
    throw error;
  }
}

/**
 * Generate a streaming response using Ollama
 */
async function* generateOllamaStream(
  config: LLMConfig,
  messages: Message[]
): AsyncGenerator<string> {
  try {
    const ollamaMessages = convertToOllamaMessages(messages);

    const response = await fetch(`${config.apiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: ollamaMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    // Handle the stream using a simpler approach
    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Get the response as text and process it line by line
    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.trim() === "") {
        continue;
      }

      try {
        const chunk = JSON.parse(line);
        if (chunk.message?.content) {
          yield chunk.message.content;
        }
      } catch (parseError) {
        console.error("[LLM] Error parsing Ollama stream JSON:", parseError);
      }
    }
  } catch (error) {
    console.error("[LLM] Error generating stream with Ollama:", error);
    throw error;
  }
}

/**
 * Convert standard messages to Ollama format
 */
function convertToOllamaMessages(
  messages: Message[]
): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
