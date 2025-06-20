# MCP Server Core

A streamlined Model Context Protocol (MCP) server implementation for real-time AI agent communication. This server manages chat sessions, data storage, and communication with AI orchestrators.

## Features

- **Full MCP Protocol Compliance:** Based on the MCP TypeScript SDK
- **MongoDB Integration:** Store and retrieve chat/session data
- **Multi-Transport Support:** Streamable HTTP, SSE, and STDIO
- **Session Management:** Robust handling of session state
- **Extensible Architecture:** Easy to add new functionality
- **Plugin System:** Modular design for adding custom functionality

## Getting Started

### Prerequisites

- **Node.js** (LTS version, v16+ recommended)
- **MongoDB** (v4.4+ recommended)
- **TypeScript** knowledge for customization
- **JSON-RPC** understanding for debugging protocol issues

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mcp-server-core

# Install dependencies
npm install

# Create your .env file (see Configuration section)
cp env.example .env
```

### Configuration

Create a `.env` file in the root directory with the following variables:

```
# Required settings
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mcp-chat

# Optional settings
DEBUG=true               # Enable detailed logging
CORS_ORIGIN=*            # Set to specific origin in production
HOST=127.0.0.1           # Change to 0.0.0.0 to allow external access
USE_STDIO=false          # Set to true if using CLI integration
```

#### MongoDB Configuration Tips

- Ensure MongoDB is running before starting the server
- For production, use a MongoDB connection string with authentication
- Consider using MongoDB Atlas for hosted deployments
- Create appropriate indexes for frequently queried fields

### Running the Server

```bash
# Development mode with auto-restart
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production mode (run after build)
npm start

# Watch mode (auto-compile on changes)
npm run watch
```

## Communication Protocol

The MCP Server communicates with orchestrators and clients via the Model Context Protocol. Key endpoints:

- **`/mcp` (POST)**: Main JSON-RPC endpoint for MCP communication
- **`/mcp` (GET)**: SSE endpoint for streaming responses
- **`/` (GET)**: Health check endpoint

### Protocol Workflow

1. **Initialize**: Client sends `initialize` method to establish a session
2. **Resources**: Client requests resources using `resources/read` method
3. **Tools**: Client invokes tools using `tools/use` method
4. **Close**: Client may close the session with `close` method

### Session Management

The server supports both **stateful** and **stateless** session modes:

- **Stateful**: Server maintains session state across requests
- **Stateless**: Each request contains full session context

Sessions can be identified by:
- Query parameter: `?sessionId=xxxx`
- Header: `MCP-Session-Id: xxxx` or `X-Session-Id: xxxx`
- Request body: `{"params": {"sessionId": "xxxx"}}`

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Port to run the server on | `3000` | No |
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/mcp-chat` | Yes |
| `DEBUG` | Enable debug logging | `false` | No |
| `CORS_ORIGIN` | CORS allowed origins | `*` | No |
| `HOST` | Host to bind to | `127.0.0.1` | No |
| `USE_STDIO` | Enable STDIO transport | `false` | No |

## Directory Structure

```
mcp-server-core/
├── src/
│   ├── config/       # Configuration management
│   ├── models/       # MongoDB schemas and models
│   │   └── chatSession.ts  # Chat session data model
│   ├── utils/        # Utility functions
│   │   ├── logger.ts       # Logging utility
│   │   └── database.ts     # MongoDB connection
│   ├── services/     # Core services
│   │   └── search.ts       # Search functionality
│   ├── mcpServer.ts  # MCP protocol implementation
│   ├── index.ts      # Main entry point
│   └── stdioServer.ts # STDIO transport
├── dist/             # Compiled JavaScript
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── .env              # Environment variables (create from env.example)
```

## Best Practices

### Session Handling

- **Always preserve session IDs** between client requests
- Use the session ID returned from the initialize call
- Include session ID in all subsequent requests
- Handle reconnection gracefully if a session expires

### Resource URIs

- Use consistent URI formats in your application
- Follow the pattern: `resource-type://identifier`
- Examples:
  - `sessions://SESSION_ID` - Get a specific session
  - `sessions://all` - Get all sessions
  - `chats://user` - Get user chat history

### Error Handling

- Check for MongoDB connection before startup
- Implement proper error handling in client applications
- Watch for "Server not initialized" errors (send initialize first)
- Use the health check endpoint for availability monitoring

## Common Pitfalls to Avoid

1. **Multiple Initialize Calls**
   - Problem: Initializing the same session multiple times
   - Solution: Only initialize once per session, store the session ID

2. **Missing Session ID**
   - Problem: Requests failing due to missing session context
   - Solution: Always include the session ID in follow-up requests

3. **Race Conditions**
   - Problem: Making requests before initialization completes
   - Solution: Wait for initialization confirmation before other requests

4. **Transport Mismatch**
   - Problem: Using mixed transport types for the same session
   - Solution: Use consistent transport (HTTP or SSE) for a session

5. **MongoDB Connection Issues**
   - Problem: Server errors due to database connection problems
   - Solution: Ensure MongoDB is running and accessible

## Extending the Server

### Adding a New Resource

```typescript
// In mcpServer.ts
mcpServer.registerResource({
  uri: 'custom://{id}',
  description: 'Your custom resource',
  patterns: [
    new RegExp('^custom://([a-zA-Z0-9-]+)$')
  ],
  async handler({ uri, parameters }) {
    // Implement resource handling
    const docs = await getResource(uri);
    return formatResourceContent(docs, uri);
  }
});
registeredResources.add('custom');
```

### Adding a New Tool

```typescript
// In mcpServer.ts
mcpServer.registerTool({
  name: 'customTool',
  description: 'Your custom tool',
  parameters: z.object({
    param1: z.string().describe('Parameter description')
  }),
  async handler({ parameters }) {
    // Implement tool functionality
    return { result: 'Success' };
  }
});
registeredTools.add('customTool');
```

### Creating Plugins

The server includes a plugin system for modular extensions:

```typescript
// Sample plugin
const myPlugin = {
  onLoad: (mcpServer) => {
    // Register resources, tools, etc.
    console.log('Plugin loaded');
  },
  onUnload: (mcpServer) => {
    // Clean up resources
    console.log('Plugin unloaded');
  },
  onError: (error) => {
    // Handle errors
    console.error('Plugin error:', error);
  }
};

// Register plugin
registerPlugin('my-plugin', myPlugin);
```

## Performance Optimization

- **MongoDB Indexing**: Create indexes for frequently queried fields
- **Connection Pooling**: Use connection pooling for MongoDB in production
- **Caching**: Implement caching for frequent resource requests
- **Load Balancing**: Deploy multiple instances behind a load balancer
- **Memory Management**: Monitor memory usage for long-running sessions

## Troubleshooting

### Server Won't Start

- Check if MongoDB is running: `mongosh` or `mongo`
- Verify .env file exists with correct MONGODB_URI
- Check for port conflicts (another service using PORT)
- Ensure Node.js version is compatible (v16+)

### Client Connection Issues

- Verify correct endpoint URLs
- Check CORS settings if connecting from a browser
- Ensure proper headers are set (Content-Type, etc.)
- Check network connectivity and firewall settings

### MongoDB Errors

- Verify credentials in connection string
- Check database and collection permissions
- Ensure MongoDB version is compatible (4.4+)
- Check for disk space issues

## Integration with AI Orchestrators

To connect this MCP Server with an AI orchestrator:

1. Configure the orchestrator to use the MCP protocol
2. Point the orchestrator to the `/mcp` endpoint
3. Ensure the orchestrator handles sessions correctly
4. Set up proper error handling and reconnection logic

## License

This project is licensed under the ISC License.

## 🛠️ Extending: Adding Custom Resources & Tools

**This server is designed to be extended!**

Projects are expected to add their own resources and tools to fit their use case. All extension should be done in `src/mcpServer.ts`.

### Adding a Custom Resource
```typescript
// In src/mcpServer.ts, inside initializeMcpServer()
mcpServer.registerResource({
  uri: 'myresource://{id}',
  description: 'Describe your resource',
  patterns: [
    new RegExp('^myresource://([a-zA-Z0-9-]+)$')
  ],
  async handler({ uri, parameters }) {
    // Your resource logic here
    const data = await getResource(uri); // or your own DB/query logic
    return formatResourceContent(data, uri);
  }
});
registeredResources.add('myresource');
```

### Adding a Custom Tool
```typescript
// In src/mcpServer.ts, inside initializeMcpServer()
mcpServer.registerTool({
  name: 'myTool',
  description: 'Describe your tool',
  parameters: z.object({
    param1: z.string().describe('Parameter description')
  }),
  async handler({ parameters }) {
    // Your tool logic here
    return { result: 'Success' };
  }
});
registeredTools.add('myTool');
```

**Best Practices:**
- Use clear, unique URIs for resources (e.g., `myresource://{id}`)
- Use Zod schemas for tool parameters for type safety
- Add your resource/tool to the `registeredResources`/`registeredTools` sets for tracking
- Log key actions for debugging
- Keep business logic modular (use `src/services/` for complex logic)

## �� Type Definitions

After you run `npm run build`, all TypeScript type definitions (`.d.ts` files) are generated in the `dist/` directory.
- **How to use:**
  - If you are importing this server's code in your own TypeScript project, import types from `dist/`.
  - If you are only using the HTTP API, you do not need the type definitions.
- **Custom types:**
  - You can extend or override types by adding your own `.d.ts` files in your project.

## ❓ Best Practices

- Always preserve and use session IDs between client requests.
- Use the session ID returned from the `initialize` call for all subsequent requests.
- Use consistent resource URI formats (e.g., `resource-type://identifier`).
- Handle errors and reconnections gracefully.
- For strict TypeScript, use type assertions for SDK properties if needed.
- Keep business logic modular (use `src/services/` for complex logic).
- Log key actions for debugging and troubleshooting.

## 📝 Support & Contribution

- For internal teams: reach out via Slack or the main project channel.
- For external users: open an issue or contact the maintainer.
- If you extend or improve this export, please document your changes and share them back so the whole team benefits.

## 📤 Exporting & Using This Server

**Before exporting or sharing this server:**
- **Delete the `dist/` and `node_modules/` directories.**
- Only include the source code, configuration files, and documentation.

**For each consuming project or team:**
1. Copy the entire export folder to your project.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to generate the compiled JS and type definitions in `dist/`.
4. Configure your `.env` file as needed.
5. Start the server with `npm run dev` (development) or `npm start` (production).

**This ensures a clean, reproducible setup for every team and avoids dependency or build conflicts.** 