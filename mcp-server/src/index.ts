import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { logger } from './utils/logger.js';
import { connectDatabase } from './utils/database.js';
import config from './config/index.js';
import { mcpServer, initializeMcpServer, registeredResources, registeredTools } from './mcpServer.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import mongoose from 'mongoose';
import { initializeStdioServer } from './stdioServer.js';
import multer from 'multer';
import { uploadFile, getPresignedUrl } from './utils/minio.js';

// Initialize Express app
const app = express();

// CORS setup
app.use(cors()); // Allow all origins for dev

// Add OPTIONS handler for CORS preflight requests
app.options('*', (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Session-Id, MCP-Session-Id');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).end();
});

// Minimal logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  // Use the registered resources and tools sets for tracking
  const resourcesList = Array.from(registeredResources);
  const toolsList = Array.from(registeredTools);
  
  // Check database connection
  const dbConnected = !!mongoose.connection && mongoose.connection.readyState === 1;
  const dbStatus = dbConnected ? 'connected' : `not connected (state: ${mongoose.connection.readyState})`;
  
  res.json({ 
    status: 'ok',
    message: 'MCP Server for Chat Applications is running',
    version: '1.0.0',
    sdkVersion: '1.10.2',
    registeredResources: resourcesList,
    registeredTools: toolsList,
    resourceCount: resourcesList.length,
    toolCount: toolsList.length,
    dbStatus,
    dbConnected
  });
});

// Create HTTP server
const server = createServer(app);

// Initialize session tracking
const transports: Record<string, StreamableHTTPServerTransport> = {};
console.log(`[MCP][${new Date().toISOString()}] Transport store initialized`);

// POST /mcp for JSON-RPC messages
app.post('/mcp', async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Session-Id, MCP-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, MCP-Session-Id');
  
  // Set content type
  res.setHeader('Content-Type', 'application/json');
  
  // NOTE: We use manual body parsing instead of express.json() because
  // express.json() can interfere with JSON-RPC 2.0 message formatting,
  // which the MCP SDK expects to receive as raw JSON.
  let rawBody = '';
  req.on('data', chunk => { 
    rawBody += chunk.toString(); 
  });
  
  req.on('end', async () => {
    try {
      // Get or create session ID from URL param, header, or body
      let sessionId = req.query.sessionId as string;
      
      // Check for session ID in headers
      if (!sessionId) {
        sessionId = req.headers['mcp-session-id'] as string || 
                    req.headers['x-session-id'] as string;
      }
      
      // Extract from body if present
      if (!sessionId && rawBody) {
        try {
          const body = JSON.parse(rawBody);
          sessionId = body.params?.sessionId;
        } catch (e) {
          // Silently ignore if body isn't valid JSON
        }
      }
      
      // Create new session ID if not found
      if (!sessionId) {
        sessionId = randomUUID();
        logger.info(`[MCP] Created new session: ${sessionId}`);
        res.setHeader('MCP-Session-Id', sessionId);
      }
      
      // Check if we have a transport for this session
      let transport = transports[sessionId];
      
      // Create new transport if needed
      if (!transport) {
        logger.info(`[MCP] Creating new HTTP transport for session ${sessionId}`);
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId
        });
        transport.onclose = () => {
          logger.info(`[MCP] Transport closed for session ${sessionId}`);
          delete transports[sessionId];
        };
        await mcpServer.connect(transport);
        transports[sessionId] = transport;
      }
      
      // Use handleRequest (SDK 1.10.2+)
      const jsonRpcMessage = JSON.parse(rawBody);
      
      // Log the incoming request for debugging
      logger.info(`[MCP] Received JSON-RPC: ${jsonRpcMessage.method || 'unknown method'} (id: ${jsonRpcMessage.id})`);
      if (jsonRpcMessage.method) {
        logger.debug(`[MCP] Full request:`, JSON.stringify(jsonRpcMessage, null, 2));
      }
      
      await transport.handleRequest(req, res, jsonRpcMessage);
      
    } catch (error) {
      logger.error(`[MCP] Error handling request: ${error}`);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal Server Error',
          data: {
            message: error instanceof Error ? error.message : String(error)
          }
        },
        id: null
      });
    }
  });
});

// GET /mcp for SSE (Server-Sent Events)
// NOTE: This is a keepalive/heartbeat endpoint, not a full MCP-compliant SSE stream.
app.get('/mcp', (req, res) => {
  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Get or create session ID
  let sessionId = req.query.sessionId as string;
  if (!sessionId) {
    sessionId = randomUUID();
    logger.info(`[SSE] Created new session: ${sessionId}`);
  }
  
  // Initial keepalive
  res.write(`data: {"type":"connected","sessionId":"${sessionId}"}\n\n`);
  
  // Send an event every 30 seconds to keep the connection alive
  const keepaliveInterval = setInterval(() => {
    res.write(`data: {"type":"keepalive"}\n\n`);
  }, 30000);
  
  // Clean up when the connection is closed
  req.on('close', () => {
    clearInterval(keepaliveInterval);
    logger.info(`[SSE] Connection closed for session ${sessionId}`);
  });
});

const upload = multer();

// POST /upload-image
app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const bucket = 'profile-images';
    const objectName = `manual-upload/${Date.now()}_${file.originalname}`;
    await uploadFile(bucket, objectName, file.buffer, file.mimetype);
    const url = await getPresignedUrl(bucket, objectName, 3600);
    res.json({ url });
  } catch (err) {
    logger.error('Image upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Start the server
const startServer = async () => {
  try {
    // Initialize MCP server
    await initializeMcpServer();
    
    // Initialize STDIO server for CLI usage if needed
    if (process.env.USE_STDIO === 'true') {
      initializeStdioServer();
    }
    
    // Start HTTP server
    server.listen(config.port, () => {
      logger.info(`MCP Server listening on port ${config.port}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 
