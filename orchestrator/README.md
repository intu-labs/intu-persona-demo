# MCP Orchestrator Export

A robust, portable orchestration layer for Model Context Protocol (MCP) projects. Designed for easy integration with modern UI stacks (Next.js, Vite, etc.) and AI-driven backends.

---

## 🚀 Quick Start

1. **Copy the Export**
   - Copy the entire `export-orchestrator` folder into your project root.

2. **Install Dependencies**
   ```bash
   cd export-orchestrator
   npm install
   ```

3. **Configure Environment**
   - Copy `env.example` to `.env` and edit as needed.
   ```bash
   cp env.example .env
   # Edit .env for your MCP server, LLM, etc.
   ```

4. **Build the Orchestrator**
   ```bash
   npm run build
   # Outputs to dist/ (includes .js and .d.ts type definitions)
   ```

5. **Run in Development**
   ```bash
   npm run dev
   # Or for production:
   npm start
   ```

---

## 🏗️ Architecture

- **src/index.ts**: Express server entry point
- **src/orchestrator/**: Core orchestration logic (MCP client, control, helpers)
- **src/llm/**: LLM provider adapter (Ollama by default)
- **dist/**: Compiled JS and type definitions after build

---

## 🧩 Integration Guide (UI/Next.js/Vite)

- **API-first**: The orchestrator exposes HTTP endpoints (see below). Your UI can call these endpoints directly (e.g., via fetch/Axios/SWR).
- **Recommended**: Run the orchestrator as a separate process (microservice) alongside your UI.
- **TypeScript**: Type definitions are included in `dist/` for use in your UI/backend code.

**Example (Next.js API route):**
```typescript
// pages/api/chat.ts
export default async function handler(req, res) {
  const response = await fetch('http://localhost:3005/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'abc', message: req.body.message })
  });
  const data = await response.json();
  res.status(200).json(data);
}
```

---

## 📦 Type Definitions

- **Where?** After `npm run build`, all `.d.ts` files are in `dist/`.
- **How to use:**
  - If importing orchestrator code in your own TS project, point to `dist/`.
  - If using only the HTTP API, you don't need the types.
- **Custom types:** Extend or override by adding `.d.ts` files in your own project.

---

## ⚙️ Build & Run

- **Development:**
  ```bash
  npm run dev
  # Hot-reloads with ts-node
  ```
- **Production:**
  ```bash
  npm run build
  npm start
  # Runs compiled JS from dist/
  ```

---

## 🌍 Environment Requirements

- **Node.js:** v20.x or v23.x (tested; v18 may work but is not recommended)
- **MCP SDK:** ^1.10.2 (included in dependencies)
- **LLM:** Ollama (default), or configure for OpenAI/Anthropic
- **.env:** See `env.example` for all required variables

---

## 🔌 API Endpoints

- `GET /health` — Orchestrator status
- `POST /test-llm` — Test LLM connection
- `POST /message` — Send a message (sessionId, message)
- `GET /resources` — List MCP resources
- `GET /tools` — List MCP tools
- `POST /clear-session` — Clear session history

See the code for request/response formats.

---

## 🛠️ Troubleshooting

**Common Issues:**
- **Build fails:** Ensure Node.js is v20+ and run `npm install` before `npm run build`.
- **TypeScript errors:** Types are included; if you see errors, check your tsconfig and ensure you're importing from `dist/`.
- **ESM/CJS issues:** This export is ESM-first. If you use CJS, adjust your imports accordingly.
- **MCP server connection:** Check `.env` and logs for MCP server URL and status.
- **LLM not responding:** Ensure Ollama or your LLM provider is running and accessible.
- **Resources not discoverable:** ✅ **RESOLVED** - Ensure your MCP server has both ResourceTemplates (for dynamic URIs) AND concrete resource registrations (for discovery). ResourceTemplates with `{ list: undefined }` are not discoverable via `listResources()`.

**Debugging tips:**
- Use `npm run dev` for verbose logs.
- Check network requests from your UI to the orchestrator.
- Use `/health` endpoint to verify orchestrator status.
- **Resource Discovery**: The `/resources` endpoint should return all concrete resources in milliseconds. If hanging, check for hardcoded resource expectations in orchestrator code.

---

## 🎉 Recent Fixes (2025-05-29)

**MCP Resource Discovery Issue - RESOLVED:**
- **Problem**: Orchestrator was hardcoded to expect specific resources from a different project (`persona://parameters`, `policies://all`)
- **Symptoms**: `/resources` endpoint hung for 30+ seconds, eventually timing out
- **Root Cause**: `waitForResourceContent()` method was blocking initialization waiting for non-existent resources
- **Solution**: 
  1. **Made orchestrator generic** - removed hardcoded resource expectations
  2. **Added concrete resource registrations** to MCP server alongside ResourceTemplates
  3. **Updated controller initialization** to be project-agnostic
- **Result**: All 5 resources now discoverable in 3ms, instant connection, no hanging
- **Key Insight**: Use **hybrid approach** - ResourceTemplates for dynamic URIs + concrete registrations for discovery

---

## 🧑‍💻 TypeScript & MCP SDK Integration Notes (Updated 2025-05-29)

**MCP SDK High-Level vs Low-Level Methods:**

This orchestrator now uses the **correct high-level TypeScript MCP SDK methods** for reliable operation:

- ✅ **`client.listResources()`** - List available MCP resources  
- ✅ **`client.listTools()`** - List available MCP tools
- ✅ **`client.callTool()`** - Execute MCP tools
- ✅ **`client.readResource()`** - Read MCP resource content

**What We Fixed:**
- **Before**: Used low-level `client.request()` method with manual schema validation
- **After**: Use high-level SDK methods that handle protocol details internally
- **Why**: The low-level approach caused ZodError validation issues ("Invalid literal value, expected 'resources/list'")

**Implementation in clean-client.ts:**
```typescript
// ✅ CORRECT - High-level SDK methods
const response = await client.listResources();
const tools = await client.listTools();
const result = await client.callTool({ name: toolName, arguments: args });

// ❌ INCORRECT - Low-level approach (caused errors)
// const response = await client.request({ method: 'resources/list' }, ResourceListRequestSchema);
```

**Why do we still use `(client as any)` for some properties?**

- The MCP SDK's TypeScript type definitions don't always match the actual runtime API
- Properties like `client.resources`, `client.tools` may not be present in the type definitions but exist at runtime
- Using `(client as any)` ensures robust builds while accessing the correct runtime methods
- This is the professional way to handle third-party libraries with incomplete type definitions

**Future SDK Updates:**
- If the SDK improves its TypeScript definitions, the type assertions can be gradually removed
- Always prefer the high-level methods (`listResources()`, `listTools()`, etc.) over low-level `request()` calls
- This pattern ensures compatibility across SDK versions and reduces protocol-level errors

---

## 🧑‍💻 Extending & Customizing

- **Add new endpoints:** Edit `src/index.ts`.
- **Change persona/system prompt:** Edit `src/orchestrator/control.ts`.
- **Add LLM providers:** Extend `src/llm/llm-adapter.ts`.
- **Add MCP tools/resources:** Update your MCP server and orchestrator logic as needed.

---

## ❓ FAQ & Best Practices

- **Q: Do I need to run npm run build?**
  - A: Yes, always build before running in production or importing types.
- **Q: Can I use this as a library?**
  - A: Yes, import from `dist/` and use the type definitions.
- **Q: What Node.js version is required?**
  - A: v20.x or v23.x recommended.
- **Q: How do I debug MCP/LLM issues?**
  - A: Use `/health` and `/test-llm` endpoints, check logs, and verify your `.env`.
- **Q: Why are tools working but resources failing?**
  - A: This is often a transport initialization issue. Check MCP server logs for "Server not initialized" errors.

---

## 📝 Development & Contribution

- **Internal use:** If you need to extend or patch the orchestrator, fork and edit the code in `src/`.
- **Type definitions:** Always run `npm run build` to update `.d.ts` files.
- **Testing:** Add tests as needed for your use case.
- **MCP Integration:** Always use high-level SDK methods for better reliability and error handling.

---

## 📬 Support

- For internal teams: reach out via Slack or the main project channel.
- For external users: open an issue or contact the maintainer.

---

**This orchestrator export is designed for real-world, production-grade integration with proper MCP SDK usage patterns. The recent fixes ensure reliable TypeScript integration with the MCP protocol.** 
