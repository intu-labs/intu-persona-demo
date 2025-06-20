# INTU Persona Demo

> **Where AI Meets Web3: Create, Own, and Interact with Your Digital Persona**

INTU Persona Demo showcases the seamless integration of AI and blockchain technology, enabling users to create unique AI-powered personas as NFTs that live on the blockchain while providing intelligent conversational experiences.

## 🚀 What You Can Do

### 🔐 **Seamless Authentication**
- **Single Sign-On (SSO)**: Login with your preferred provider
- **Automatic EVM Account**: Get a blockchain account created automatically
- **Secure & Compliant**: Built with INTU's unified execution layer

### 🎭 **Create Your Digital Persona**
- **AI-Generated Personalities**: Create unique personas with distinct traits, appearances, and characteristics
- **NFT Ownership**: Your persona becomes an NFT on Arbitrum Sepolia, permanently owned by your account
- **Customizable Traits**: Gender, appearance, region, personality traits (confidence, sarcasm, charm, morality)
- **Smart Reroll System**: Don't like your persona? Reroll up to 3 times to get the perfect match

### 💬 **Intelligent Chat Experience**
- **AI-Powered Conversations**: Chat with your persona using advanced AI models (Ollama local, OpenAI)
- **Contextual Understanding**: Your persona remembers conversations and maintains consistent personality
- **Real-time Responses**: Fast, responsive chat interface with streaming support

### 💰 **Blockchain Transactions in Chat**
- **Direct Transaction Capability**: Send blockchain transactions directly from the chat interface
- **EVM Integration**: Full Ethereum Virtual Machine compatibility
- **Secure Execution**: All transactions processed through INTU's secure infrastructure

## 🏗️ Architecture

This demo is built with three core components:

### 📡 [MCP Server](./mcp-server/)
**The Data & AI Hub**
- Model Context Protocol (MCP) compliant server
- Manages persona generation, chat sessions, and NFT metadata
- Integrates with MongoDB for data persistence
- Provides AI-powered persona creation with LLM integration
- Handles image generation via RunPod/ComfyUI
- IPFS integration for decentralized storage

### 🎼 [Orchestrator](./orchestrator/)
**The Intelligence Layer**
- Coordinates between UI, MCP server, and AI providers
- Manages conversation flow and context
- Supports multiple LLM providers (Ollama, OpenAI, Anthropic)
- Handles session management and real-time communication
- Provides RESTful API for frontend integration

### 🎨 Frontend UI
**The User Experience**
- Modern PWA built with Next.js, Vite, and TailwindCSS
- Mobile-first responsive design
- Real-time chat interface with streaming responses
- Zustand state management (privacy-focused, no persistence)
- Integrated wallet functionality for blockchain interactions

## 🛠️ Tech Stack

**Frontend**
- Next.js, Vite, TailwindCSS
- Zustand for state management
- TypeScript for type safety

**Backend**
- Node.js with TypeScript
- Model Context Protocol (MCP)
- MongoDB for data persistence
- MinIO for object storage

**AI & Image Generation**
- Ollama (Gemma3) for local AI
- OpenAI API support
- RunPod/ComfyUI for image generation
- IPFS for decentralized storage

**Blockchain**
- Ethers.js v5 for Ethereum interaction
- INTU SDK for unified execution
- Arbitrum Sepolia testnet
- Custom ERC-721 for persona NFTs

## 🚀 Quick Start

### Prerequisites
- Node.js (v20+ recommended)
- Docker and Docker Compose
- MongoDB
- (Optional) Ollama for local AI

### Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/intu-labs/intu-persona-demo.git
   cd intu-persona-demo
   pnpm install  # or npm install
   ```

2. **Start Infrastructure**
   ```bash
   docker compose up -d
   # Starts MongoDB, MinIO, Ollama containers
   ```

3. **Configure Environment**
   ```bash
   # Configure MCP Server
   cd mcp-server
   cp env.example .env
   # Edit .env with your API keys and settings
   
   # Configure Orchestrator
   cd ../orchestrator
   cp env.example .env
   # Edit .env for your LLM provider settings
   ```

4. **Start Services**
   ```bash
   # Terminal 1: MCP Server
   cd mcp-server
   pnpm run build && pnpm start
   
   # Terminal 2: Orchestrator
   cd orchestrator
   pnpm run dev
   
   # Terminal 3: Frontend
   cd ui
   pnpm run dev
   ```

5. **Access the Demo**
   - Frontend: http://localhost:5173
   - Orchestrator API: http://localhost:3005
   - MCP Server: http://localhost:3000

## 🔧 Configuration

### Environment Variables

**MCP Server (.env)**
```bash
MONGODB_URI=mongodb://localhost:27017/persona-demo
RUNPOD_API_KEY=your_runpod_key_here
OPENAI_API_KEY=your_openai_key_here
PINATA_JWT=your_pinata_jwt_here
```

**Orchestrator (.env)**
```bash
MCP_SERVER_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_key_here
OLLAMA_HOST=http://localhost:11434
```

## 🎯 Use Cases

- **Digital Identity**: Create persistent AI personas that represent you across applications
- **NFT Collections**: Build collections of unique AI-generated characters
- **Conversational AI**: Interact with personalized AI agents that maintain consistent personalities
- **Web3 Integration**: Demonstrate seamless blockchain integration in AI applications
- **Developer Showcase**: Exhibit Model Context Protocol (MCP) capabilities

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines and feel free to submit issues or pull requests.

## 📖 Documentation

- [MCP Server Documentation](./mcp-server/README.md)
- [Orchestrator Documentation](./orchestrator/README.md)
- [INTU Documentation](https://docs.intu.com) _(coming soon)_

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [INTU Website](https://intu.com)
- [INTU Labs](https://intu-labs.com)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

**Built with ❤️ by the INTU team**
