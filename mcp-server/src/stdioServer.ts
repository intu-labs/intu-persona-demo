import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mcpServer } from "./mcpServer.js";
import { logger } from "./utils/logger.js";

/**
 * Initialize an STDIO server for command-line tools and subprocess communication
 */
export const initializeStdioServer =
  async (): Promise<StdioServerTransport> => {
    logger.info("Initializing STDIO server");

    // Create STDIO transport (no server param)
    const transport = new StdioServerTransport();

    // Set up error and close logging if supported
    if ("onerror" in transport) {
      (transport as any).onerror = (error: any) => {
        logger.error("STDIO transport error:", error);
      };
    }
    if ("onclose" in transport) {
      (transport as any).onclose = () => {
        logger.info("STDIO transport closed");
      };
    }
    if ("onready" in transport) {
      (transport as any).onready = () => {
        logger.info("STDIO transport ready");
      };
    }

    // Connect MCP server to transport
    await mcpServer.connect(transport);

    logger.info("STDIO server initialized");
    return transport;
  };
