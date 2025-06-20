# INTU Persona Demo

> **Project Status (2025-05-29):**
>
> - **MCP server is running on port 3000, fully connected to MongoDB (persona-demo) and integrated with orchestrator.**
> - **MCP Client Fixed**: TypeScript SDK now uses correct high-level methods (client.listResources(), client.listTools(), etc.)
> - **MCP Resource Discovery**: ✅ **RESOLVED** - All 5 resources now discoverable in 3ms (personas, sessions, chats, expertise, nftCache)
> - **Database Seeded**: MongoDB populated with neutral personas and 52 comprehensive INTU expertise entries
> - **Connection**: Orchestrator connects instantly to MCP server with full resource and tool support
> - **Persona Generator Tool is complete and operational** - random generation, LLM integration, duplicate prevention, reroll system (3 max), NFT cache storage.
> - **INTU Expertise Database is complete** - 52 comprehensive entries covering all INTU features, specifications, and technical details.
> - Orchestrator successfully connects to MCP server with full tool support for persona generation.
> - UI/UX documentation, v0.dev prompt, and frontend scaffold (Zustand, no persistence) complete.
> - UI chat is wired to orchestrator via /api/chat proxy route.
> - **Next: End-to-end workflow testing, then Image Generator Tool (ComfyUI integration)** - proxy routes will be added as remaining MCP tools are implemented.

This is a demo PWA for INTU's unified execution layer, combining AI and blockchain. Users create, own, and interact with unique AI Agent personas as NFTs, with secure, compliant, and seamless operations. The UI is fully migrated to Zustand (no state persistence for privacy) and is ready for backend (MCP) integration.

> **Reference:**
>
> - [Project Plan](ref/project.md)
> - [Product Requirements Document (PRD)](ref/prd.md)

## Setup (Local Dev) And RUN!

1. Clone repo
2. Install dependencies (pnpm recommended)
3. `docker compose up -d`
4. **Infrastructure running:** `docker ps` to verify MongoDB, MinIO, Ollama containers
5. **MCP Server:** `cd mcp-server && pnpm i && pnpm run build && pnpm start` (runs on port 3000)
6. **Orchestrator:** `cd orchestrator && pnpm i && pnpm run dev` Configure and run orchestrator (connects to MCP)
7. **Frontend:** `cd ui && pnpm i && pnpm build && pnpm dev`
8. Configure env vars for endpoints, keys, etc.

## Features

- Unified SSO login (INTU)
- AI Agent chat (Ollama, local, OpenAI)
- **Persona generator** (complete with LLM name/accessory generation, reroll system)
- Persona image generator (ComfyUI, local) -
- NFT minting (custom ERC-721, Arbitrum Sepolia, IPFS)
- Data privacy/encryption (INTU)
- PWA/mobile-first UI (Next.js, Vite, TailwindCSS)
- **Frontend fully migrated to Zustand (no persistence), integrated with MCP backend**

## Current Status (2025-05-29)

### ✅ **Working Components:**

- **Infrastructure Services**: MongoDB, MinIO, Ollama, ComfyUI containers running
- **MCP Tools**: 4 tools available and functional (search, generatePersona, rerollPersona, generateProfileImage)
- **MCP Resources**: 5 resources available and discoverable in 3ms (personas, sessions, chats, expertise, nftCache)
- **Database**: Seeded with neutral personas (Dr. Indigo Bridge, etc.) and 52 INTU expertise entries
- **MCP Client**: Fixed to use correct TypeScript SDK high-level methods
- **Connection**: Orchestrator successfully connects to MCP server with instant resource discovery



### 📊 **System Status:**

```
✅ MCP Tools:     4/4 working (search, generatePersona, rerollPersona, generateProfileImage)
✅ MCP Resources: 5/5 working (personas, sessions, chats, expertise, nftCache) - 3ms discovery
✅ Infrastructure: 4/4 services running (MongoDB, MinIO, Ollama, ComfyUI)
✅ Database:      Seeded with personas and expertise data
✅ Connection:    Orchestrator ↔ MCP Server connected (instant, no hanging)
✅ Discovery:     All resources discoverable via listResources() endpoint
```

## Tech Stack

- Next.js, Vite, TailwindCSS
- Zustand
- Ollama (Gemma3)
- ComfyUI
- **MCP Server/Client/Orchestrator (tools working, debugging resources)**
- Ethers v5
- INTU SDK
- MinIO, IPFS
- Firebase SSO (basic analytics)




## Server stuff
after running the start script, if you need to make an update you gotta kill processes

 sudo lsof -i -P -n
kill xxxxxxx
