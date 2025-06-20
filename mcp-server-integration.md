---
sidebar_position: 2
---

# MCP Server Integration

The MCP (Model Context Protocol) Server is the foundational layer for AI + Web3 integration in INTU applications. It provides AI model management, data persistence, and secure blockchain interaction capabilities.

## What is MCP Server?

The MCP Server acts as an intelligent backend that:
- **Manages AI Models**: Integrates with multiple LLM providers (OpenAI, Ollama, Anthropic)
- **Handles Data Persistence**: Stores user sessions, personas, and application state
- **Provides Protocol Compliance**: Implements the Model Context Protocol standard
- **Enables AI Tools**: Exposes AI capabilities through standardized interfaces

## Core Components

### 🤖 AI Integration Layer
```javascript
// AI model providers supported
const providers = {
  openai: 'GPT-4, GPT-3.5, DALL-E',
  ollama: 'Local models (Llama, Mistral, etc.)',  
  anthropic: 'Claude 3, Claude 2',
  runpod: 'Custom GPU instances'
};
```

### 📊 Data Management
```javascript
// Available data resources
const resources = [
  'personas://{evmAddress}',    // User AI personas
  'sessions://{sessionId}',     // Chat sessions
  'chats://{identifier}',       // Conversation history
  'expertise://{topic}',        // Knowledge base
  'nftCache://{evmAddress}'     // NFT metadata
];
```

### 🛠️ Available Tools
```javascript
// AI tools exposed via MCP
const tools = [
  'search',              // Search across data
  'generatePersona',     // Create AI personas
  'rerollPersona',       // Regenerate personas
  'generateProfileImage' // Create persona images
];
```

## Quick Setup

### 1. Install Dependencies
```bash
npm install @intuweb3/mcp-server
# or
git clone https://github.com/intu-labs/intu-persona-demo.git
cd intu-persona-demo/mcp-server
npm install
```

### 2. Configure Environment
```bash
# Create .env file
cp env.example .env

# Required settings
MONGODB_URI=mongodb://localhost:27017/intu-ai
OPENAI_API_KEY=your_openai_key_here
RUNPOD_API_KEY=your_runpod_key_here
PINATA_JWT=your_pinata_jwt_here
```

### 3. Start the Server
```bash
# Development mode
npm run dev

# Production mode  
npm run build && npm start
```

The server will be available at `http://localhost:3000`

## Integration with INTU SDK

### Basic Setup
```javascript
import { ethers } from "ethers";
import { getVaults, createIntuAccount } from '@intuweb3/web-kit';
import { MCPClient } from '@intuweb3/mcp-client';

// Initialize INTU connection
const provider = new ethers.providers.Web3Provider(window.ethereum);
await provider.send("eth_requestAccounts", []);
const signer = await provider.getSigner();
const signerAddress = await signer.getAddress();

// Get user's INTU vaults
const userVaults = await getVaults(signerAddress, provider);

// Connect to MCP server
const mcpClient = new MCPClient({
  serverUrl: 'http://localhost:3000',
  userAddress: signerAddress,
  intuVaults: userVaults
});

await mcpClient.initialize();
```

### Create AI-Powered INTU Vault
```javascript
// Create new INTU vault with AI capabilities
const aiVault = await createIntuAccount(
  [signerAddress], // participants
  "AI Assistant Vault", // name
  1, // rotateThreshold (100%)
  1, // txThreshold (100%)  
  1, // adminThreshold (100%)
  signer
);

// Generate AI persona for the vault
const persona = await mcpClient.callTool({
  name: 'generatePersona',
  arguments: {
    evmAddress: aiVault.address
  }
});

console.log('AI Persona created:', persona.result);
```

## Advanced Features

### Multi-Party AI Decisions
```javascript
// Create vault requiring multiple approvals for AI actions
const collaborativeVault = await createIntuAccount(
  [alice, bob, charlie], // 3 participants
  "Collaborative AI Vault",
  2, // 67% required to rotate keys
  2, // 67% required for transactions
  2, // 67% required for admin actions
  signer
);

// AI actions require 2/3 approval
const aiDecision = await mcpClient.proposeAIAction({
  vaultAddress: collaborativeVault.address,
  action: 'executeSwap',
  parameters: {
    tokenA: 'USDC',
    tokenB: 'ETH', 
    amount: 1000
  }
});
```

### Persona-Driven Interactions
```javascript
// Create persona with specific traits
const tradingPersona = await mcpClient.callTool({
  name: 'generatePersona',
  arguments: {
    evmAddress: vaultAddress,
    traits: {
      expertise: 'defi-trading',
      riskTolerance: 'moderate',
      specialty: 'yield-farming'
    }
  }
});

// Persona makes decisions based on its traits
const recommendation = await mcpClient.callTool({
  name: 'getPersonaRecommendation',
  arguments: {
    evmAddress: vaultAddress,
    context: 'Should I provide liquidity to this new pool?',
    poolData: poolInformation
  }
});
```

## Security Integration

### Transaction Approval Workflow
```javascript
// AI proposes transaction
const aiProposal = await mcpClient.callTool({
  name: 'proposeTransaction',
  arguments: {
    vaultAddress: vaultAddress,
    to: '0x...',
    value: ethers.utils.parseEther('1.0'),
    data: '0x...',
    reasoning: 'Optimal yield opportunity detected'
  }
});

// Require INTU vault approval
const approvalRequired = await checkVaultApproval(vaultAddress, aiProposal);
if (approvalRequired) {
  // Notify vault participants
  await notifyVaultMembers(vaultAddress, aiProposal);
  
  // Wait for threshold approvals
  const approved = await waitForApprovals(vaultAddress, aiProposal);
  
  if (approved) {
    // Execute via INTU vault
    const result = await executeVaultTransaction(vaultAddress, aiProposal);
  }
}
```

### Data Encryption
```javascript
// Encrypt sensitive AI data
const encryptedPersona = await mcpClient.encryptData({
  data: personaData,
  vaultAddress: vaultAddress,
  accessLevel: 'vault-members-only'
});

// Store encrypted data on-chain
const metadataHash = await mcpClient.storeMetadata({
  data: encryptedPersona,
  storageType: 'ipfs'
});
```

## Configuration Options

### Environment Variables
```bash
# Server Configuration
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# Database
MONGODB_URI=mongodb://localhost:27017/intu-ai

# AI Providers
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4
ANTHROPIC_API_KEY=your_anthropic_key
OLLAMA_HOST=http://localhost:11434

# Image Generation
RUNPOD_API_KEY=your_runpod_key
COMFYUI_URL=http://localhost:8188

# Storage
PINATA_JWT=your_pinata_jwt
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=your_minio_key
MINIO_SECRET_KEY=your_minio_secret

# INTU Integration
INTU_WEBHOOK_URL=https://your-app.com/webhooks/intu
INTU_NETWORK=arbitrum-sepolia
```

### Custom Tools
```javascript
// Add custom AI tool
mcpServer.addTool({
  name: 'analyzePortfolio',
  description: 'Analyze user portfolio and suggest optimizations',
  inputSchema: {
    type: 'object',
    properties: {
      vaultAddress: { type: 'string' },
      analysisType: { type: 'string', enum: ['risk', 'yield', 'diversification'] }
    },
    required: ['vaultAddress']
  }
}, async (params) => {
  // Get vault data
  const vaultData = await getVaultData(params.vaultAddress);
  
  // Analyze with AI
  const analysis = await analyzeWithAI(vaultData, params.analysisType);
  
  // Return recommendations
  return {
    success: true,
    analysis: analysis,
    recommendations: analysis.recommendations
  };
});
```

## Monitoring & Debugging

### Health Checks
```bash
# Check server status
curl http://localhost:3000/health

# Verify MCP protocol
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### Logging
```javascript
// Enable debug logging
DEBUG=mcp:*,persona:*,ai:* npm start

// Monitor AI interactions
const aiLogger = new AILogger({
  level: 'info',
  includeSensitive: false,
  webhookUrl: process.env.MONITORING_WEBHOOK
});
```

### Performance Metrics
```javascript
// Monitor MCP server performance
const metrics = await mcpClient.getMetrics();
console.log('Average response time:', metrics.averageResponseTime);
console.log('Active connections:', metrics.activeConnections);
console.log('AI model usage:', metrics.modelUsage);
```

## Production Deployment

### Docker Setup
```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: intu-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: intu-mcp-server
  template:
    metadata:
      labels:
        app: intu-mcp-server
    spec:
      containers:
      - name: mcp-server
        image: intu/mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: intu-secrets
              key: mongodb-uri
```

## Troubleshooting

### Common Issues

**MCP Connection Failed**
```bash
# Check server logs
docker logs intu-mcp-server

# Verify network connectivity
curl -I http://localhost:3000/health
```

**AI Model Errors**
```bash
# Test OpenAI connection
curl -X POST http://localhost:3000/test-ai \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","model":"gpt-3.5-turbo"}'
```

**INTU Vault Issues**
```javascript
// Verify vault connection
const vaults = await getVaults(userAddress, provider);
console.log('Available vaults:', vaults.length);

// Check vault status
for (const vault of vaults) {
  const status = await vault.getStatus();
  console.log(`Vault ${vault.address}: ${status}`);
}
```

## Next Steps

1. **[Configure AI Orchestrator](./orchestrator.md)** - Set up the intelligence layer
2. **[Integrate Frontend](./frontend-integration.md)** - Connect INTU Web-Kit with AI
3. **[Explore Examples](./examples.md)** - See complete implementations

---

**Learn more about [INTU's AI capabilities](https://docs.intu.xyz/build/ai/overview) and [Web3 integration](https://docs.intu.xyz/build/sdk/start/).** 