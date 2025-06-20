import ChatSession, { IChatSession, IMessage } from "../models/chatSession.js";
import mongoose from "mongoose";

export class ConversationService {
  private controller?: any;

  constructor(controller?: any) {
    this.controller = controller;
  }

  /**
   * Clean encrypted data by removing any extra JSON serialization quotes
   */
  private cleanEncryptedData(data: string): string {
    let cleaned = data;

    // Remove multiple layers of quotes if present
    while (
      cleaned.startsWith('"') &&
      cleaned.endsWith('"') &&
      cleaned.length > 2
    ) {
      const unquoted = cleaned.slice(1, -1);
      // Only remove quotes if it doesn't break the data structure
      if (unquoted.length > 0 && !unquoted.includes('{"')) {
        cleaned = unquoted;
        //console.log(
        //  "[CONVERSATION] Removed a layer of quotes from encrypted data"
        //);
      } else {
        break;
      }
    }

    return cleaned;
  }

  /**
   * Generate a persistent agent ID for encryption
   * Uses EVM address if available, otherwise a browser-persistent UUID
   */
  private getPersistentAgentId(userEvmAddress?: string): string {
    if (userEvmAddress) {
      // Use EVM address directly without prefix to ensure consistency
      return userEvmAddress;
    }

    // For anonymous users, use a consistent default
    return "anonymous-user-default";
  }

  /**
   * Encrypt content using the MCP encryptData tool
   */
  private async encryptContent(
    content: string,
    userEvmAddress?: string
  ): Promise<string> {
    if (!this.controller) {
      //console.log(
      //  "[CONVERSATION] No controller available for encryption, storing as plain text"
      //);
      return content;
    }

    try {
      const agentId = this.getPersistentAgentId(userEvmAddress);
      //console.log(`[CONVERSATION] Encrypting content for agent ${agentId}`);
      const result = await this.controller.callMcpTool("encryptData", {
        data: content,
        agentId: agentId,
      });

      if (
        result &&
        result.content &&
        result.content[0] &&
        result.content[0].text
      ) {
        let encryptedData = result.content[0].text;
        //console.log("[CONVERSATION] Content encrypted successfully");
        //console.log(
        //  "[CONVERSATION] Encrypted data type:",
        //  typeof encryptedData
        //);
        //console.log(
        //  "[CONVERSATION] Encrypted data length:",
        //  encryptedData.length
        //);

        // Clean any extra quotes that might be present from JSON serialization
        encryptedData = this.cleanEncryptedData(encryptedData);

        return encryptedData;
      } else {
        //console.warn(
        //  "[CONVERSATION] Encryption result format unexpected, storing as plain text"
        //);
        return content;
      }
    } catch (error) {
      //console.error(
      //  "[CONVERSATION] Error encrypting content, storing as plain text:",
      //  error
      //);
      return content;
    }
  }

  /**
   * Decrypt content using the MCP decryptData tool
   */
  private async decryptContent(
    encryptedContent: string,
    userEvmAddress?: string
  ): Promise<string> {
    if (!this.controller) {
      return encryptedContent;
    }

    try {
      const agentId = this.getPersistentAgentId(userEvmAddress);
      //console.log(`[CONVERSATION] Decrypting content for agent ${agentId}`);

      // Clean any extra quotes that might have been added during storage/retrieval
      let cleanEncryptedContent = this.cleanEncryptedData(encryptedContent);

      const result = await this.controller.callMcpTool("decryptData", {
        encryptedData: cleanEncryptedContent,
        agentId: agentId,
      });

      if (
        result &&
        result.content &&
        result.content[0] &&
        result.content[0].text
      ) {
        const parsedResult = JSON.parse(result.content[0].text);
        if (parsedResult.success && parsedResult.decryptedData) {
          //console.log("[CONVERSATION] Content decrypted successfully");
          return parsedResult.decryptedData;
        }
      }

      //console.warn(
      //  "[CONVERSATION] Decryption failed, returning encrypted content" +
      //    cleanEncryptedContent
      //);
      return encryptedContent;
    } catch (error) {
      //console.error("[CONVERSATION] Error decrypting content:", error);
      return encryptedContent;
    }
  }

  /**
   * Store a user message in the database
   */
  async storeUserMessage(
    sessionId: string,
    message: string,
    userEvmAddress?: string
  ): Promise<void> {
    try {
      const encryptedMessage = await this.encryptContent(
        message,
        userEvmAddress
      );
      //console.log(
      //  "[CONVERSATION] About to store encrypted message type:",
      //  typeof encryptedMessage
      //);
      //console.log(
      //  "[CONVERSATION] About to store encrypted message length:",
      //  encryptedMessage.length
      //);

      const messageData: Partial<IMessage> = {
        role: "user",
        content: encryptedMessage,
        timestamp: new Date(),
      };

      await this.addMessageToSession(sessionId, messageData);
      //console.log(
      //  `[CONVERSATION] Stored user message for session ${sessionId}`
      //);
    } catch (error) {
      //console.error("[CONVERSATION] Error storing user message:", error);
      throw error;
    }
  }

  /**
   * Store an assistant response in the database
   */
  async storeAssistantMessage(
    sessionId: string,
    response: string,
    userEvmAddress?: string
  ): Promise<void> {
    try {
      const encryptedResponse = await this.encryptContent(
        response,
        userEvmAddress
      );
      const messageData: Partial<IMessage> = {
        role: "assistant",
        content: encryptedResponse,
        timestamp: new Date(),
      };

      await this.addMessageToSession(sessionId, messageData);
      //console.log(
      //  `[CONVERSATION] Stored assistant response for session ${sessionId}`
      //);
    } catch (error) {
      //console.error("[CONVERSATION] Error storing assistant message:", error);
      throw error;
    }
  }

  /**
   * Add a message to a session (creates session if it doesn't exist)
   */
  private async addMessageToSession(
    sessionId: string,
    messageData: Partial<IMessage>
  ): Promise<void> {
    try {
      if (!mongoose.connection.readyState) {
        throw new Error("Database not connected");
      }

      let session = await ChatSession.findOne({ sessionId });

      if (!session) {
        session = new ChatSession({
          sessionId,
          messages: [],
          metadata: {},
        });
        //console.log(`[CONVERSATION] Created new session ${sessionId}`);
      }

      //console.log("[CONVERSATION] About to push message data:", {
      //  type: typeof messageData.content,
      //  length: messageData.content?.length,
      //  hasQuotes:
      //    messageData.content?.startsWith('"') &&
      //    messageData.content?.endsWith('"'),
      //});

      session.messages.push(messageData as IMessage);

      //console.log(
      //  "[CONVERSATION] Message pushed, about to save. Last message content:",
      //  {
      //    type: typeof session.messages[session.messages.length - 1].content,
      //    length: session.messages[session.messages.length - 1].content.length,
      //    hasQuotes:
      //      session.messages[session.messages.length - 1].content.startsWith(
      //        '"'
      //      ) &&
      //      session.messages[session.messages.length - 1].content.endsWith('"'),
      //  }
      //);

      await session.save();

      // Check what was actually saved
      const savedSession = await ChatSession.findOne({ sessionId });
      if (savedSession && savedSession.messages.length > 0) {
        const lastMessage =
          savedSession.messages[savedSession.messages.length - 1];
        //console.log("[CONVERSATION] After save, content in DB:", {
        //  type: typeof lastMessage.content,
        //  length: lastMessage.content.length,
        //  hasQuotes:
        //    lastMessage.content.startsWith('"') &&
        //    lastMessage.content.endsWith('"'),
        //});
      }
    } catch (error) {
      console.error("[CONVERSATION] Error adding message to session:", error);
      throw error;
    }
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(
    sessionId: string,
    userEvmAddress?: string
  ): Promise<IMessage[]> {
    try {
      const session = await ChatSession.findOne({ sessionId });
      if (!session) {
        return [];
      }

      // Decrypt messages before returning
      const decryptedMessages = await Promise.all(
        session.messages.map(async (message) => {
          //console.log(
          //  "[CONVERSATION] Raw message from DB type:",
          //  typeof message.content
          //);
          //console.log(
          //  "[CONVERSATION] Raw message from DB length:",
          //  message.content.length
          //);

          const decryptedContent = await this.decryptContent(
            message.content,
            userEvmAddress
          );

          return {
            ...message.toObject(),
            content: decryptedContent,
          };
        })
      );

      return decryptedMessages;
    } catch (error) {
      console.error(
        "[CONVERSATION] Error getting conversation history:",
        error
      );
      throw error;
    }
  }

  /**
   * Clear conversation history for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    try {
      await ChatSession.deleteOne({ sessionId });
      //console.log(`[CONVERSATION] Cleared session ${sessionId}`);
    } catch (error) {
      //console.error("[CONVERSATION] Error clearing session:", error);
      throw error;
    }
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<IChatSession[]> {
    try {
      return await ChatSession.find().sort({ updateDate: -1 });
    } catch (error) {
      console.error("[CONVERSATION] Error getting all sessions:", error);
      throw error;
    }
  }
}
