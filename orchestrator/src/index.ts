/**
 * MCP Orchestrator Server
 *
 * Standalone server that maintains a connection to the MCP server
 * and provides API endpoints for clients to interact with it.
 */

import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AgentOrchestrator } from "./orchestrator/index.js";
import * as llmAdapter from "./llm/llm-adapter.js";
import { connectDatabase } from "./config/database.js";

// Load environment variables
dotenv.config();

// Helper function to detect LLM provider
function detectLLMProvider(): { provider: string; model: string } {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (openaiKey) {
    return {
      provider: "OpenAI",
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    };
  } else if (anthropicKey) {
    return {
      provider: "Anthropic",
      model: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
    };
  } else {
    return {
      provider: "Ollama (local)",
      model: process.env.OLLAMA_MODEL || "llama3",
    };
  }
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://ai.intu.xyz",
      "http://ai.intu.xyz",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:3005",
      "http://127.0.0.1:3005",
      "https://ai.intu.xyz:3005",
      "http://ai.intu.xyz:3005",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "X-Session-Id",
      "MCP-Session-Id",
    ],
    credentials: true,
  })
);
app.use(express.json());

// Add debugging middleware
app.use((req, res, next) => {
  console.log(
    `[SERVER] ${req.method} ${req.path} - Origin: ${req.get("Origin")}`
  );
  next();
});

// Handle preflight requests
app.options("*", (req, res) => {
  console.log(
    `[SERVER] OPTIONS request for ${req.path} from origin: ${req.get("Origin")}`
  );
  res.status(200).end();
});

// Initialize orchestrator
const orchestrator = new AgentOrchestrator();

const llmConfig = detectLLMProvider();

console.log("[SERVER] Starting MCP Orchestrator server...");
console.log(
  `[SERVER] MCP Server URL: ${
    process.env.MCP_SERVER_URL || "default (http://127.0.0.1:3000/mcp)"
  }`
);
console.log(
  `[SERVER] LLM Provider: ${llmConfig.provider} (${llmConfig.model})`
);
if (llmConfig.provider === "Ollama (local)") {
  console.log(
    `[SERVER] Ollama URL: ${
      process.env.OLLAMA_URL || "default (http://localhost:11434)"
    }`
  );
}
console.log(
  `[SERVER] MongoDB URI: ${
    process.env.MONGODB_URI || "default (mongodb://localhost:27017/mcp-chat)"
  }`
);
console.log(`[SERVER] Listening on port: ${PORT}`);

async function initializeConnections() {
  try {
    console.log("[SERVER] Connecting to MongoDB...");
    await connectDatabase();

    console.log("[SERVER] Connecting to MCP...");
    const success = await orchestrator.connect();
    console.log(`[SERVER] MCP connection ${success ? "successful" : "failed"}`);
  } catch (err) {
    console.error("[SERVER] Error during initialization:", err);
  }
}

initializeConnections();

// API Routes

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  const status = orchestrator.getState();
  const info = orchestrator.getMcpInfo();

  res.json({
    status,
    mcp: info,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Test LLM endpoint
app.post("/test-llm", async (req: Request, res: Response) => {
  try {
    const { prompt, stream = false } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Missing required field",
        requiredField: "prompt",
      });
    }

    console.log(
      `[SERVER] Testing LLM with prompt: ${prompt.substring(0, 50)}...`
    );

    // Create system and user messages
    const messages = [
      llmAdapter.createSystemMessage(
        "You are a helpful, intelligent assistant."
      ),
      llmAdapter.createUserMessage(prompt),
    ];

    // Handle streaming vs non-streaming
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const generator = llmAdapter.generateStream(messages);

      for await (const chunk of generator) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      const response = await llmAdapter.generate(messages);
      res.json({ response });
    }
  } catch (error) {
    console.error("[SERVER] Error testing LLM:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Message handling endpoint
app.post("/message", async (req, res) => {
  try {
    const { message, userEvmAddress, metadata, sessionId } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: "Missing required fields",
        requiredFields: ["sessionId", "message"],
      });
    }

    console.log("[SERVER] Processing message:", {
      sessionId,
      message,
      hasMetadata: !!metadata,
      hasPersona: !!metadata?.persona,
    });

    // Get response from orchestrator
    const response = await orchestrator.handleMessage(
      sessionId,
      message,
      userEvmAddress,
      metadata
    );

    res.json({ response });
  } catch (error) {
    console.error("[SERVER] Error processing message:", error);
    res.status(500).json({
      error: "Failed to process message",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Resources endpoint
app.get("/resources", async (req: Request, res: Response) => {
  try {
    const resources = await orchestrator.getAvailableResources();
    res.json({ resources });
  } catch (error) {
    console.error("[SERVER] Error listing resources:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Tools endpoint
app.get("/tools", async (req: Request, res: Response) => {
  try {
    const tools = await orchestrator.getAvailableTools();
    res.json({ tools });
  } catch (error) {
    console.error("[SERVER] Error listing tools:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Clear session endpoint
app.post("/clear-session", async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      error: "Missing required field",
      requiredField: "sessionId",
    });
  }

  try {
    await orchestrator.clearSession(sessionId);
    res.json({ success: true, message: `Session ${sessionId} cleared` });
  } catch (error) {
    console.error("[SERVER] Error clearing session:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Get conversation history endpoint
app.get("/conversations/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { userEvmAddress } = req.query;

  try {
    const history = await orchestrator.getConversationHistory(
      sessionId,
      userEvmAddress as string
    );
    res.json({ sessionId, messages: history });
  } catch (error) {
    console.error("[SERVER] Error getting conversation history:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Get all sessions endpoint
app.get("/sessions", async (req: Request, res: Response) => {
  try {
    const sessions = await orchestrator.getAllSessions();
    res.json({ sessions });
  } catch (error) {
    console.error("[SERVER] Error getting sessions:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(
    `[SERVER] MCP Orchestrator server running on http://localhost:${PORT}`
  );
});
