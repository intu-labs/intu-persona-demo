/**
 * Simple logger utility for MCP Server
 */

const DEBUG = process.env.DEBUG === 'true';

export const logger = {
  info: (message: string, ...args: any[]): void => {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]): void => {
    if (DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]): void => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]): void => {
    console.error(`[ERROR] ${message}`, ...args);
  }
}; 