# MCP Server - AI & Web3 Data Hub

> **The intelligent backend powering AI personas and blockchain integration**

The MCP (Model Context Protocol) Server is the core data and AI orchestration layer for INTU Persona Demo. It manages persona generation, chat sessions, NFT metadata, and provides seamless integration between AI models and blockchain functionality.

## 🎯 What It Does

### 🤖 **AI-Powered Persona Generation**
- **Intelligent Character Creation**: Uses LLM integration to generate unique names, accessories, and personality traits
- **Image Generation**: Connects to RunPod/ComfyUI for AI-generated persona images
- **Smart Deduplication**: Prevents duplicate personas using cryptographic hashing
- **Reroll System**: Allows users to regenerate personas (up to 3 times)

### 🗄️ **Data Management**
- **MongoDB Integration**: Stores personas, chat sessions, and user data
- **IPFS Storage**: Handles decentralized storage for images and metadata
- **Session Management**: Maintains conversation context and user state
- **NFT Metadata**: Generates and manages ERC-721 compliant metadata

### 🔌 **Protocol Compliance**
- **MCP Standard**: Full Model Context Protocol implementation
- **Multi-Transport**: Supports HTTP, SSE, and STDIO communication
- **Resource Discovery**: Exposes personas, sessions, chats, expertise, and NFT cache
- **Tool Integration**: Provides search, generation, and reroll capabilities

## 🛠️ Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `search` | Search through personas and expertise data | `query`, `limit` |
| `generatePersona` | Create a new AI persona with image and metadata | `evmAddress` |
| `rerollPersona` | Regenerate persona (up to 3 times) | `evmAddress` |
| `generateProfileImage` | Generate additional profile images | `evmAddress`, `config` |

## 📋 Available Resources

| Resource | URI Pattern | Description |
|----------|-------------|-------------|
| **Personas** | `personas://{evmAddress}` | Individual user personas |
| **Sessions** | `sessions://{sessionId}` | Chat session data |
| **Chats** | `chats://{identifier}` | Chat history and context |
| **Expertise** | `expertise://{topic}` | INTU platform knowledge base |
| **NFT Cache** | `nftCache://{evmAddress}` | NFT metadata and status |

## 🚀 Quick Start

### Prerequisites
- Node.js (v20+ recommended)
- MongoDB (local or cloud)
- TypeScript familiarity

### Installation

```bash
# Clone the main repository
git clone https://github.com/intu-labs/intu-persona-demo.git
cd intu-persona-demo/mcp-server

# Install dependencies
pnpm install  # or npm install

# Configure environment
cp env.example .env
# Edit .env with your settings (see Configuration section)
```

### Running the Server

```bash
# Development mode with hot reload
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm start

# Watch mode (auto-compile TypeScript)
pnpm run watch
```

The server will start on `http://localhost:3000` by default.

## ⚙️ Configuration

Create a `.env` file with the following settings:

### Required Settings
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/persona-demo

# AI Services (choose one or both)
OPENAI_API_KEY=your_openai_key_here
RUNPOD_API_KEY=your_runpod_key_here

# Storage
PINATA_JWT=your_pinata_jwt_for_ipfs
```

### Optional Settings
```bash
# Server Configuration
PORT=3000
NODE_ENV=development
HOST=127.0.0.1

# AI Models
OPENAI_MODEL=gpt-3.5-turbo
OLLAMA_HOST=http://localhost:11434

# Debugging
DEBUG=true
```

## 🔗 API Endpoints

### MCP Protocol Endpoints
- `POST /mcp` - Main JSON-RPC endpoint for MCP communication
- `GET /mcp` - Server-Sent Events (SSE) for streaming responses
- `GET /health` - Health check and server status

### Example MCP Request
```javascript
// Initialize connection
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "persona-demo-client",
      "version": "1.0.0"
    }
  }
}

// Generate a persona
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "generatePersona",
    "arguments": {
      "evmAddress": "0x1234...5678"
    }
  }
}
```

## 🏗️ Architecture

```
MCP Server
├── 🎭 Persona Generation
│   ├── LLM Integration (OpenAI/Ollama)
│   ├── Image Generation (RunPod/ComfyUI)
│   └── Metadata Creation
├── 💾 Data Layer
│   ├── MongoDB (Personas, Sessions, Cache)
│   ├── IPFS (Images, Metadata)
│   └── MinIO (Object Storage)
├── 🔌 Protocol Layer
│   ├── MCP Compliance
│   ├── Resource Management
│   └── Tool Execution
└── 🌐 Transport Layer
    ├── HTTP/REST
    ├── Server-Sent Events
    └── STDIO (CLI support)
```

## 🧩 Integration Guide

### For Frontend Developers
The MCP server exposes resources and tools through the standardized MCP protocol. Use the orchestrator as a middleware layer, or connect directly:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Connect to MCP server
const client = new Client(
  { name: "persona-client", version: "1.0.0" },
  { capabilities: {} }
);

// List available resources
const resources = await client.listResources();

// Generate a persona
const result = await client.callTool({
  name: "generatePersona",
  arguments: { evmAddress: "0x..." }
});
```

### For Backend Developers
Extend the server by adding new tools or resources:

```typescript
// Add a new tool
mcpServer.addTool({
  name: "customTool",
  description: "Your custom functionality",
  inputSchema: {
    type: "object",
    properties: {
      // Define parameters
    }
  }
}, async (params) => {
  // Implementation
  return { success: true, data: "result" };
});
```

## 🔍 Monitoring & Debugging

### Health Check
```bash
curl http://localhost:3000/health
```

### Common Issues
- **MongoDB Connection**: Ensure MongoDB is running and accessible
- **API Keys**: Verify OpenAI/RunPod keys are valid and have sufficient credits
- **IPFS Issues**: Check Pinata JWT token and network connectivity
- **Memory Usage**: Monitor for large image processing tasks

### Logging
The server provides detailed logging for debugging:
```bash
# Enable debug logging
DEBUG=true pnpm start

# View logs by category
DEBUG=mcp:* pnpm start          # MCP protocol logs
DEBUG=persona:* pnpm start      # Persona generation logs
DEBUG=db:* pnpm start           # Database logs
```

## 🚀 Performance

### Optimizations
- **Connection Pooling**: MongoDB connections are pooled for efficiency
- **Image Caching**: Generated images are cached to avoid regeneration
- **Async Processing**: Non-blocking operations for persona generation
- **Resource Discovery**: Fast resource enumeration (< 5ms typical)

### Scaling Considerations
- **Horizontal Scaling**: Multiple MCP server instances can run behind a load balancer
- **Database Sharding**: Consider MongoDB sharding for high user volumes
- **CDN Integration**: Serve images through CDN for global performance
- **Background Jobs**: Implement job queues for intensive AI processing

## 📚 Protocol Reference

This server implements the [Model Context Protocol](https://modelcontextprotocol.io) specification. Key concepts:

- **Resources**: Data that can be read (personas, sessions, etc.)
- **Tools**: Actions that can be executed (generate, reroll, etc.)
- **Prompts**: Template messages for AI interaction
- **Sampling**: AI model interaction patterns

## 🤝 Contributing

We welcome contributions! Areas where you can help:

- **New AI Providers**: Add support for additional LLM services
- **Storage Backends**: Implement alternative storage solutions
- **Performance**: Optimize database queries and caching
- **Features**: Add new persona generation capabilities

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Part of the [INTU Persona Demo](../) ecosystem** 