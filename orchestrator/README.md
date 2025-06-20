# Orchestrator - AI Intelligence Layer

> **The smart middleware that connects AI, blockchain, and your users**

The Orchestrator is the intelligence coordination layer for INTU Persona Demo. It bridges the gap between your frontend UI, the MCP server, and various AI providers, managing conversation flow, context, and providing a clean API for AI-powered Web3 interactions.

## 🎯 What It Does

### 🧠 **AI Coordination**
- **Multi-Provider Support**: Seamlessly works with Ollama (local), OpenAI, and Anthropic
- **Intelligent Routing**: Automatically selects the best AI provider based on configuration
- **Context Management**: Maintains conversation history and user session state
- **Streaming Responses**: Real-time AI responses with Server-Sent Events

### 🔌 **MCP Integration**
- **Protocol Bridge**: Translates between HTTP/REST and Model Context Protocol
- **Resource Discovery**: Automatically discovers and exposes MCP server capabilities
- **Tool Orchestration**: Executes persona generation, searches, and other MCP tools
- **Session Lifecycle**: Manages MCP sessions and connection health

### 🌐 **Frontend API**
- **RESTful Endpoints**: Clean HTTP API for easy frontend integration
- **TypeScript Support**: Full type definitions for robust development
- **Error Handling**: Graceful error management and client feedback
- **Health Monitoring**: Built-in health checks and status endpoints

## 🛠️ Available Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/health` | GET | Orchestrator status and health | - |
| `/message` | POST | Send chat message to AI | `sessionId`, `message` |
| `/resources` | GET | List available MCP resources | - |
| `/tools` | GET | List available MCP tools | - |
| `/test-llm` | POST | Test LLM connection | - |
| `/clear-session` | POST | Clear session history | `sessionId` |

## 🚀 Quick Start

### Prerequisites
- Node.js (v20+ recommended)
- Running MCP Server
- AI provider (Ollama, OpenAI, or Anthropic)

### Installation

```bash
# Clone the main repository
git clone https://github.com/intu-labs/intu-persona-demo.git
cd intu-persona-demo/orchestrator

# Install dependencies
pnpm install  # or npm install

# Configure environment
cp env.example .env
# Edit .env with your settings (see Configuration section)
```

### Running the Orchestrator

```bash
# Development mode with hot reload
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm start
```

The orchestrator will start on `http://localhost:3005` by default.

## ⚙️ Configuration

Create a `.env` file with the following settings:

### Required Settings
```bash
# MCP Server Connection
MCP_SERVER_URL=http://localhost:3000

# AI Provider (choose one)
OPENAI_API_KEY=your_openai_key_here
# OR
OLLAMA_HOST=http://localhost:11434
# OR
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### Optional Settings
```bash
# Server Configuration
PORT=3005
NODE_ENV=development

# AI Model Selection
OPENAI_MODEL=gpt-3.5-turbo
OLLAMA_MODEL=gemma2
ANTHROPIC_MODEL=claude-3-haiku-20240307

# Advanced
DEBUG=true
CORS_ORIGIN=*
```

## 🏗️ Architecture

```
Frontend UI
     ↓ HTTP/REST
┌─────────────────┐
│   Orchestrator  │
├─────────────────┤
│ • Session Mgmt  │
│ • AI Routing    │
│ • Error Handler │
│ • Type Safety   │
└─────────────────┘
     ↓ MCP Protocol
┌─────────────────┐
│   MCP Server    │
├─────────────────┤
│ • Persona Gen   │
│ • Data Storage  │
│ • IPFS/NFTs     │
└─────────────────┘
```

## 🧩 Integration Examples

### React/Next.js Frontend
```typescript
// api/chat.ts
export default async function handler(req, res) {
  const response = await fetch('http://localhost:3005/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: req.body.sessionId,
      message: req.body.message
    })
  });
  
  const data = await response.json();
  res.status(200).json(data);
}
```

### Vue.js Frontend
```javascript
// composables/useChat.js
export const useChat = () => {
  const sendMessage = async (sessionId, message) => {
    const response = await fetch('http://localhost:3005/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message })
    });
    return response.json();
  };
  
  return { sendMessage };
};
```

### Streaming Responses
```javascript
// Handle streaming AI responses
const eventSource = new EventSource(
  `http://localhost:3005/message/stream?sessionId=${sessionId}&message=${encodeURIComponent(message)}`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.content) {
    // Update UI with streaming content
    appendToChat(data.content);
  }
};
```

## 🔍 API Reference

### Send Message
```bash
POST /message
Content-Type: application/json

{
  "sessionId": "user-123",
  "message": "Generate a new persona for address 0x1234..."
}

# Response
{
  "success": true,
  "response": "I'll create a unique persona for you...",
  "sessionId": "user-123",
  "messageId": "msg-456"
}
```

### Health Check
```bash
GET /health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "mcp": "connected",
    "llm": "available",
    "database": "connected"
  }
}
```

### List Resources
```bash
GET /resources

# Response
{
  "resources": [
    {
      "uri": "personas://user-123",
      "name": "User Personas",
      "description": "AI-generated personas for the user"
    },
    {
      "uri": "sessions://active",
      "name": "Active Sessions",
      "description": "Current chat sessions"
    }
  ]
}
```

## 🚀 Performance & Scaling

### Optimizations
- **Connection Pooling**: Reuses MCP connections for efficiency
- **Caching**: Caches AI model responses where appropriate
- **Async Processing**: Non-blocking operations for better throughput
- **Health Monitoring**: Proactive health checks and error recovery

### Production Deployment
```bash
# Build the application
pnpm run build

# Start with PM2 for production
pm2 start dist/index.js --name "persona-orchestrator"

# Or use Docker
docker build -t persona-orchestrator .
docker run -p 3005:3005 persona-orchestrator
```

### Load Balancing
```nginx
# nginx configuration
upstream orchestrator {
    server localhost:3005;
    server localhost:3006;  # Additional instances
    server localhost:3007;
}

server {
    listen 80;
    location / {
        proxy_pass http://orchestrator;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔧 Troubleshooting

### Common Issues

**MCP Connection Failed**
```bash
# Check MCP server status
curl http://localhost:3000/health

# Verify MCP_SERVER_URL in .env
echo $MCP_SERVER_URL
```

**AI Provider Issues**
```bash
# Test OpenAI connection
curl -X POST http://localhost:3005/test-llm

# Check Ollama status
curl http://localhost:11434/api/tags
```

**Resource Discovery Hanging**
- Ensure MCP server has concrete resource registrations
- Check for timeout settings in configuration
- Verify MCP server version compatibility

### Debug Logging
```bash
# Enable verbose logging
DEBUG=orchestrator:* pnpm run dev

# Category-specific logging
DEBUG=mcp:* pnpm run dev        # MCP communication
DEBUG=llm:* pnpm run dev        # AI provider logs
DEBUG=session:* pnpm run dev    # Session management
```

## 🤝 Contributing

We welcome contributions in these areas:

- **New AI Providers**: Add support for additional LLM services
- **Protocol Extensions**: Enhance MCP integration capabilities
- **Performance**: Optimize connection handling and caching
- **Features**: Add new orchestration capabilities

### Development Setup
```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type checking
pnpm run type-check

# Linting
pnpm run lint
```

## 📚 TypeScript Integration

The orchestrator provides full TypeScript support:

### Type Definitions
```typescript
// Import types from the built package
import type { 
  ChatMessage, 
  SessionInfo, 
  MCPResource,
  AIResponse 
} from './dist/types';

// Use in your frontend
const sendMessage = async (
  sessionId: string, 
  message: string
): Promise<AIResponse> => {
  // Implementation
};
```

### Custom Extensions
```typescript
// Extend the orchestrator in your own project
import { Orchestrator } from './dist/orchestrator';

class CustomOrchestrator extends Orchestrator {
  async customHandler(params: CustomParams) {
    // Your custom logic
  }
}
```

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Part of the [INTU Persona Demo](../) ecosystem** 
