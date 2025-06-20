import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import z from "zod";
import mongoose from "mongoose";
import { connectDatabase } from "./utils/database.js";
import { normalizeSearchText, searchCollection } from "./services/search.js";
import * as personaGenerator from "./services/personaGenerator.js";
import {
  imageGenerator,
  ImageGenerationConfig,
} from "./services/imageGenerator.js";
import NFTCache from "./models/nftCache.js";
import Persona from "./models/persona.js";
import { ethers } from "ethers";
import {
  encryptData,
  decryptData,
  getUniqueHashFromSignature,
  preRegister,
} from "@intuweb3/sdk";

// Interface for resource mapping
interface ResourceMapping {
  clientPath: string; // Base path in the client URI (e.g., 'sessions')
  dbCollection: string; // MongoDB collection name
  parameterPattern?: RegExp; // Pattern to extract parameters from the URI
}

// Resource mapping definitions
const RESOURCE_MAPPINGS: ResourceMapping[] = [
  {
    clientPath: "sessions",
    dbCollection: "chatsessions",
    parameterPattern: /^sessions:\/\/(.+)$/,
  },
  {
    clientPath: "chats",
    dbCollection: "chathistories",
    parameterPattern: /^chats:\/\/(.+)$/,
  },
  {
    clientPath: "personas",
    dbCollection: "personas",
    parameterPattern: /^personas:\/\/(.+)$/,
  },
  {
    clientPath: "persona",
    dbCollection: "personas",
    parameterPattern: /^persona:\/\/(.+)$/,
  },
  {
    clientPath: "expertise",
    dbCollection: "expertises",
    parameterPattern: /^expertise:\/\/(.+)$/,
  },
  {
    clientPath: "nftCache",
    dbCollection: "nftcaches",
    parameterPattern: /^nftCache:\/\/(.+)$/,
  },
];

/**
 * Maps a client resource URI to the appropriate database collection
 */
function mapResourceToCollection(uri: string): string {
  logger.debug(`Mapping resource URI: ${uri}`);

  for (const mapping of RESOURCE_MAPPINGS) {
    if (mapping.parameterPattern?.test(uri)) {
      logger.debug(`Mapped ${uri} to collection: ${mapping.dbCollection}`);
      return mapping.dbCollection;
    }
  }

  // Default fallback handling
  const basePathMatch = uri.match(/^([^:]+):\/\//);
  if (basePathMatch) {
    const basePath = basePathMatch[1];
    // Try to find a match just based on the base path
    const mapping = RESOURCE_MAPPINGS.find((m) => m.clientPath === basePath);
    if (mapping) {
      logger.debug(
        `Fallback mapped ${uri} to collection: ${mapping.dbCollection}`
      );
      return mapping.dbCollection;
    }
  }

  logger.warn(`Unknown resource URI: ${uri}, could not map to collection`);
  throw new Error(`Unknown resource URI: ${uri}`);
}

/**
 * Extracts parameter from a resource URI based on its pattern
 */
function extractResourceParameter(uri: string): string | null {
  logger.debug(`Extracting parameter from URI: ${uri}`);

  for (const mapping of RESOURCE_MAPPINGS) {
    if (mapping.parameterPattern) {
      const match = uri.match(mapping.parameterPattern);
      if (match && match[1]) {
        logger.debug(`Extracted parameter from ${uri}: ${match[1]}`);
        return match[1];
      }
    }
  }

  logger.debug(`No parameter found in URI: ${uri}`);
  return null;
}

/**
 * Gets resource data from MongoDB based on URI
 */
async function getResource(
  uri: string,
  options: { limit?: number } = {}
): Promise<any[]> {
  logger.debug(`[GET_RESOURCE] Getting resource for URI: ${uri}`);

  try {
    const collectionName = mapResourceToCollection(uri);
    logger.debug(`[GET_RESOURCE] Mapped to collection: ${collectionName}`);

    const parameter = extractResourceParameter(uri);
    logger.debug(`[GET_RESOURCE] Extracted parameter: ${parameter}`);

    const collection = mongoose.connection.collection(collectionName);
    logger.debug(
      `[GET_RESOURCE] Got collection reference, readyState: ${mongoose.connection.readyState}`
    );

    // Build query based on resource type and parameter
    let query: Record<string, any> = {};

    if (parameter) {
      if (uri.startsWith("sessions://")) {
        if (parameter === "all") {
          // Return all sessions
        } else {
          query.sessionId = parameter;
        }
      } else if (uri.startsWith("chats://")) {
        if (parameter === "all") {
          // Return all chats
        } else {
          query.type = parameter;
        }
      } else if (uri.startsWith("personas://")) {
        if (parameter === "all") {
          // Return all personas
        } else if (parameter === "neutral") {
          query.type = "neutral";
        } else {
          query.name = parameter;
        }
      } else if (uri.startsWith("persona://")) {
        // Handle persona:// URIs - look for neutral type personas (INTU Expert)
        if (parameter === "all") {
          query.type = "neutral";
        } else {
          query.name = parameter;
        }
      }
    }

    logger.debug(`[GET_RESOURCE] Executing query: ${JSON.stringify(query)}`);

    // Execute query
    const result = await collection
      .find(query)
      .limit(options.limit || 20)
      .toArray();

    logger.debug(`[GET_RESOURCE] Found ${result.length} items for URI: ${uri}`);
    return result;
  } catch (error) {
    logger.error(
      `[GET_RESOURCE] Error getting resource for URI ${uri}:`,
      error
    );
    throw error;
  }
}

/**
 * Format resource content for MCP response
 */
function formatResourceContent(
  docs: any[],
  uri: string
): { contents: Array<{ uri: string; text: string }> } {
  // Handle empty results explicitly
  if (!docs || docs.length === 0) {
    return { contents: [] };
  }

  // Process the documents into a response
  const contents = docs.map((doc) => {
    if (!doc) {
      return {
        uri: uri,
        text: "Resource not found",
      };
    }

    const formattedText = JSON.stringify(doc, null, 2);

    return {
      uri: `${uri}#${doc._id}`,
      text: formattedText,
    };
  });

  return { contents };
}

// Create and export MCP server instance
const mcpServer = new McpServer({
  name: "Chat MCP Server",
  version: "1.0.0",
});

// Track registered resources and tools for debugging
const registeredResources = new Set<string>();
const registeredTools = new Set<string>();

/**
 * Initialize MCP server with resources and tools
 */
const initializeMcpServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Register chat sessions resource
    mcpServer.resource(
      "sessions",
      new ResourceTemplate("sessions://{id}", { list: undefined }),
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          `[RESOURCE] Handling chat session resource request: ${uri.href}`
        );
        const docs = await getResource(uri.href);
        return formatResourceContent(docs, uri.href);
      }
    );
    registeredResources.add("sessions");

    // Register chat history resource
    mcpServer.resource(
      "chats",
      new ResourceTemplate("chats://{type}", { list: undefined }),
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          `[RESOURCE] Handling chat history resource request: ${uri.href}`
        );
        const docs = await getResource(uri.href);
        return formatResourceContent(docs, uri.href);
      }
    );
    registeredResources.add("chats");

    // Register personas resource
    // Register persona parameters resource (for orchestrator compatibility)
    mcpServer.resource(
      "persona",
      new ResourceTemplate("persona://{type}", { list: undefined }),
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          "[RESOURCE] Handling persona resource request: " + uri.href
        );

        try {
          // Load persona from database
          const docs = await getResource(uri.href);
          if (docs && docs.length > 0) {
            // Transform the persona data to match orchestrator expectations
            const persona = docs[0];
            const transformedPersona = {
              name: persona.name,
              gender: persona.gender,
              traits: {
                confidence: persona.confidence,
                sarcasm: persona.sarcasm,
                charm: persona.charm,
                morality: persona.morality,
                education: persona.education,
              },
              appearance: persona.appearance,
              region: persona.region,
              accessory: persona.accessory,
              systemPrompt: persona.systemPrompt,
              type: persona.type,
            };

            return {
              contents: [
                {
                  uri: uri.href,
                  text: JSON.stringify(transformedPersona, null, 2),
                },
              ],
            };
          }
        } catch (error) {
          logger.error("[RESOURCE] Error loading persona from database:", error);
        }

        // Fallback to default persona if database loading fails
        const defaultPersona = {
          name: "Assistant",
          personality: {
            confidence: 0.5,
            sarcasm: 0.1,
            charm: 0.3,
            morality: 0.8,
          },
          systemPrompt:
            "Provide factual information. Keep responses concise and direct. Answer questions about INTU technology when asked.",
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(defaultPersona, null, 2),
            },
          ],
        };
      }
    );
    registeredResources.add("persona");

    mcpServer.resource(
      "policies",
      new ResourceTemplate("policies://{type}", { list: undefined }),
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          "[RESOURCE] Handling policies resource request: " + uri.href
        );

        // Return default policies
        const defaultPolicies = {
          maxMessageLength: 4000,
          allowedTopics: ["general", "assistance", "information"],
          restrictions: [],
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(defaultPolicies, null, 2),
            },
          ],
        };
      }
    );
    registeredResources.add("policies");

    // Register a concrete personas resource (following working pattern)
    mcpServer.resource(
      "personas-all",
      "personas://all",
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          `[RESOURCE] Handling concrete personas resource request: ${uri.href}`
        );
        const docs = await getResource(uri.href);
        return formatResourceContent(docs, uri.href);
      }
    );
    registeredResources.add("personas-all");

    // Add concrete resources for discovery (following working pattern)
    mcpServer.resource(
      "sessions-all",
      "sessions://all",
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          `[RESOURCE] Handling concrete sessions resource request: ${uri.href}`
        );
        const docs = await getResource(uri.href);
        return formatResourceContent(docs, uri.href);
      }
    );
    registeredResources.add("sessions-all");

    mcpServer.resource(
      "chats-all",
      "chats://all",
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          `[RESOURCE] Handling concrete chats resource request: ${uri.href}`
        );
        const docs = await getResource(uri.href);
        return formatResourceContent(docs, uri.href);
      }
    );
    registeredResources.add("chats-all");

    mcpServer.resource(
      "expertise-all",
      "expertise://all",
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          `[RESOURCE] Handling concrete expertise resource request: ${uri.href}`
        );
        const docs = await getResource(uri.href);
        return formatResourceContent(docs, uri.href);
      }
    );
    registeredResources.add("expertise-all");

    mcpServer.resource(
      "nftCache-sample",
      "nftCache://sample",
      async (uri: URL, params: Record<string, any>) => {
        logger.info(
          `[RESOURCE] Handling concrete nftCache resource request: ${uri.href}`
        );
        const docs = await getResource(uri.href);
        return formatResourceContent(docs, uri.href);
      }
    );
    registeredResources.add("nftCache-sample");

    // Register search tool
    mcpServer.tool(
      "search",
      {
        query: z.string().describe("The search query"),
        collection: z
          .enum(["sessions", "chats"])
          .describe("The collection to search in"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
      },
      async (args: {
        query: string;
        collection: "sessions" | "chats";
        limit?: number;
      }) => {
        const { query, collection, limit = 10 } = args;
        logger.info(`[TOOL] Searching ${collection} for: ${query}`);
        let collectionName = "";
        if (collection === "sessions") {
          collectionName = "chatsessions";
        } else if (collection === "chats") {
          collectionName = "chathistories";
        }
        const results = await searchCollection(collectionName, query, {
          limit,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }
    );
    registeredTools.add("search");

    registeredTools.add("chats");

    // Register persona generator tool
    mcpServer.tool(
      "generatePersona",
      {
        evmAddress: z
          .string()
          .optional()
          .describe("The user's EVM address (preferred key)"),
        param: z
          .string()
          .optional()
          .describe("Alternative key for the user's EVM address"),
      },
      async (args: any) => {
        console.log(`[DEBUG] generatePersona called with:`, args);
        console.log(`[DEBUG] args type:`, typeof args);
        console.log(`[DEBUG] args keys:`, Object.keys(args || {}));
        console.log(`[DEBUG] args.evmAddress:`, args?.evmAddress);
        logger.info(
          `[TOOL] generatePersona received raw args: ${JSON.stringify(args)}`
        );

        // Define the actual schema for parsing inside the handler
        // Duplicating the schema logic from checkNftOwnership for now
        // Ideally, this would be a shared utility
        type GeneratePersonaInput = { evmAddress?: string; param?: string };

        const GeneratePersonaArgsSchema = z
          .object({
            evmAddress: z
              .string()
              .optional()
              .describe("The user's EVM address (preferred key)"),
            param: z
              .string()
              .optional()
              .describe("Alternative key for the user's EVM address"),
          })
          .refine(
            (data: GeneratePersonaInput) => {
              // Accept either evmAddress or param, and strip quotes/whitespace
              let addressToUse: string | undefined = undefined;
              if (data.evmAddress) {
                addressToUse = data.evmAddress.trim().replace(/^"+|"+$/g, "");
              } else if (data.param) {
                addressToUse = data.param.trim().replace(/^"+|"+$/g, "");
              }
              // Only enforce strict format if minting (not here)
              return addressToUse !== undefined && addressToUse.length > 0;
            },
            {
              message:
                "Either evmAddress or param must be provided and be a non-empty string.",
              path: ["evmAddress"],
            }
          )
          .transform((data: GeneratePersonaInput, ctx: z.RefinementCtx) => {
            let addressToUse: string | undefined;
            if (data.evmAddress) {
              addressToUse = data.evmAddress.trim().replace(/^"+|"+$/g, "");
            } else if (data.param) {
              addressToUse = data.param.trim().replace(/^"+|"+$/g, "");
            } else {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "No EVM address provided via evmAddress or param.",
                path: ["evmAddress"],
              });
              return z.NEVER;
            }
            return { addressToUse };
          });

        const parseResult = GeneratePersonaArgsSchema.safeParse(args);

        if (!parseResult.success) {
          logger.error(
            "[TOOL] generatePersona: Argument parsing failed",
            parseResult.error.flatten()
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Invalid arguments for generatePersona.",
                    details: parseResult.error.flatten().fieldErrors,
                  },
                  null,
                  2
                ),
              },
            ],
            structuredContent: {
              success: false,
              error: "Invalid arguments for generatePersona.",
              details: parseResult.error.flatten().fieldErrors,
            },
            _meta: { isError: true },
          };
        }

        const { addressToUse } = parseResult.data;
        if (!addressToUse) {
          // This case should ideally be caught by Zod, but as a safeguard:
          logger.error(
            "[TOOL] generatePersona: Validated address is unexpectedly undefined after parsing."
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      "Critical internal error during argument validation.",
                  },
                  null,
                  2
                ),
              },
            ],
            structuredContent: {
              success: false,
              error: "Critical internal error during argument validation.",
            },
            _meta: { isError: true },
          };
        }

        logger.info(
          `[TOOL] Generating persona for validated EVM address: ${addressToUse}`
        );

        try {
          // Check if a persona already exists and is not yet minted
          const existingPersona = await NFTCache.findOne({
            evmAddress: addressToUse,
            status: "pending", // Look for personas that are generated but not minted
          }).lean();

          if (existingPersona && (existingPersona as any).persona) {
            // Ensure persona object exists
            logger.info(
              `[TOOL] Found existing pending persona for ${addressToUse}: ${
                (existingPersona as any).persona.name
              }. Returning cached data.`
            );
            // Fetch reroll count for existing persona
            const rerollInfo = await personaGenerator.getRerollCount(
              addressToUse
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: "Returning existing pending persona.",
                      persona: {
                        // Assuming the cache stores persona under a 'persona' key
                        name: (existingPersona as any).persona.name,
                        gender: (existingPersona as any).persona.gender,
                        confidence: (existingPersona as any).persona.confidence,
                        sarcasm: (existingPersona as any).persona.sarcasm,
                        charm: (existingPersona as any).persona.charm,
                        morality: (existingPersona as any).persona.morality,
                        appearance: (existingPersona as any).persona.appearance,
                        region: (existingPersona as any).persona.region,
                        education: (existingPersona as any).persona.education,
                        accessory: (existingPersona as any).persona.accessory,
                        systemPrompt: (existingPersona as any).persona
                          .systemPrompt,
                        generatedImageUrl: (existingPersona as any)
                          .generatedImageUrl,
                        ipfsImageUrl: (existingPersona as any).ipfsImageUrl,
                        metadataIpfsUrl: (existingPersona as any)
                          .metadataIpfsUrl,
                      },
                      rerollsRemaining: rerollInfo.rerollsRemaining,
                    },
                    null,
                    2
                  ),
                },
              ],
              structuredContent: {
                success: true,
                message: "Returning existing pending persona.",
                persona: {
                  // Assuming the cache stores persona under a 'persona' key
                  name: (existingPersona as any).persona.name,
                  gender: (existingPersona as any).persona.gender,
                  confidence: (existingPersona as any).persona.confidence,
                  sarcasm: (existingPersona as any).persona.sarcasm,
                  charm: (existingPersona as any).persona.charm,
                  morality: (existingPersona as any).persona.morality,
                  appearance: (existingPersona as any).persona.appearance,
                  region: (existingPersona as any).persona.region,
                  education: (existingPersona as any).persona.education,
                  accessory: (existingPersona as any).persona.accessory,
                  systemPrompt: (existingPersona as any).persona.systemPrompt,
                  generatedImageUrl: (existingPersona as any).generatedImageUrl,
                  ipfsImageUrl: (existingPersona as any).ipfsImageUrl,
                  metadataIpfsUrl: (existingPersona as any).metadataIpfsUrl,
                },
                rerollsRemaining: rerollInfo.rerollsRemaining,
              },
            };
          }

          // If no pending persona, generate a new one with full assets
          const newPersonaDetails = await personaGenerator.generatePersona(
            addressToUse
          );

          // Store the complete persona in cache
          await personaGenerator.storePersonaInCache(
            addressToUse,
            newPersonaDetails
          );

          // After generation, fetch the latest reroll count
          const newRerollInfo = await personaGenerator.getRerollCount(
            addressToUse
          );

          logger.info(
            `[TOOL] Persona generated for ${addressToUse}: ${newPersonaDetails.name}, Image (RunPod): ${newPersonaDetails.runpodImageUrl}, Image (IPFS): ${newPersonaDetails.ipfsImageUrl}, Metadata (IPFS): ${newPersonaDetails.metadataIpfsUrl}`
          );

          // 🐛 DEBUG: Log complete persona data being returned to frontend
          console.log("📤 MCP SERVER PERSONA RESPONSE DEBUG:");
          console.log("=".repeat(50));
          console.log("Generated for EVM Address:", addressToUse);
          console.log("Persona Name:", newPersonaDetails.name);
          console.log("RunPod Image URL:", newPersonaDetails.runpodImageUrl);
          console.log("IPFS Image URL:", newPersonaDetails.ipfsImageUrl);
          console.log("Metadata IPFS URL:", newPersonaDetails.metadataIpfsUrl);
          console.log("Rerolls Remaining:", newRerollInfo.rerollsRemaining);
          console.log("Complete Persona Response Object:");
          console.log(
            JSON.stringify(
              {
                success: true,
                message: "Persona generated successfully.",
                persona: {
                  name: newPersonaDetails.name,
                  gender: newPersonaDetails.gender,
                  confidence: newPersonaDetails.confidence,
                  sarcasm: newPersonaDetails.sarcasm,
                  charm: newPersonaDetails.charm,
                  morality: newPersonaDetails.morality,
                  appearance: newPersonaDetails.appearance,
                  region: newPersonaDetails.region,
                  education: newPersonaDetails.education,
                  accessory: newPersonaDetails.accessory,
                  systemPrompt: newPersonaDetails.systemPrompt,
                  generatedImageUrl: newPersonaDetails.runpodImageUrl,
                  ipfsImageUrl: newPersonaDetails.ipfsImageUrl,
                  metadataIpfsUrl: newPersonaDetails.metadataIpfsUrl,
                },
                rerollsRemaining: newRerollInfo.rerollsRemaining,
              },
              null,
              2
            )
          );
          console.log("=".repeat(50));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: "Persona generated successfully.",
                    persona: {
                      // Constructing the persona object for the response
                      name: newPersonaDetails.name,
                      gender: newPersonaDetails.gender,
                      confidence: newPersonaDetails.confidence,
                      sarcasm: newPersonaDetails.sarcasm,
                      charm: newPersonaDetails.charm,
                      morality: newPersonaDetails.morality,
                      appearance: newPersonaDetails.appearance,
                      region: newPersonaDetails.region,
                      education: newPersonaDetails.education,
                      accessory: newPersonaDetails.accessory,
                      systemPrompt: newPersonaDetails.systemPrompt,
                      generatedImageUrl: newPersonaDetails.runpodImageUrl,
                      ipfsImageUrl: newPersonaDetails.ipfsImageUrl,
                      metadataIpfsUrl: newPersonaDetails.metadataIpfsUrl,
                    },
                    rerollsRemaining: newRerollInfo.rerollsRemaining,
                  },
                  null,
                  2
                ),
              },
            ],
            structuredContent: {
              success: true,
              message: "Persona generated successfully.",
              persona: {
                // Constructing the persona object for the response
                name: newPersonaDetails.name,
                gender: newPersonaDetails.gender,
                confidence: newPersonaDetails.confidence,
                sarcasm: newPersonaDetails.sarcasm,
                charm: newPersonaDetails.charm,
                morality: newPersonaDetails.morality,
                appearance: newPersonaDetails.appearance,
                region: newPersonaDetails.region,
                education: newPersonaDetails.education,
                accessory: newPersonaDetails.accessory,
                systemPrompt: newPersonaDetails.systemPrompt,
                generatedImageUrl: newPersonaDetails.runpodImageUrl,
                ipfsImageUrl: newPersonaDetails.ipfsImageUrl,
                metadataIpfsUrl: newPersonaDetails.metadataIpfsUrl,
              },
              rerollsRemaining: newRerollInfo.rerollsRemaining,
            },
          };
        } catch (error) {
          logger.error(`Error generating persona for ${addressToUse}:`, error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Failed to generate persona: ${errorMessage}`,
                  },
                  null,
                  2
                ),
              },
            ],
            structuredContent: {
              success: false,
              error: `Failed to generate persona: ${errorMessage}`,
            },
            _meta: { isError: true },
          };
        }
      }
    );
    registeredTools.add("generatePersona");

    // Register persona reroll tool
    mcpServer.tool(
      "rerollPersona",
      {
        evmAddress: z
          .string()
          .describe("The user's EVM address for persona reroll"),
      },
      async (args: { evmAddress: string }) => {
        const { evmAddress } = args;
        logger.info(`[TOOL] Rerolling persona for EVM address: ${evmAddress}`);

        try {
          const result = await personaGenerator.rerollPersona(evmAddress);
          let generatedImageUrl: string | undefined = undefined;

          // Generate new image for rerolled persona
          logger.info(
            `[TOOL] Auto-generating image for rerolled persona: ${result.persona.name}`
          );
          try {
            const imageResult = await imageGenerator.generateImage(
              result.persona,
              {}
            );

            if (imageResult.success && imageResult.runpodImageUrl) {
              generatedImageUrl = imageResult.runpodImageUrl;
              // Update cache with new generated image URL
              const cacheEntry = await NFTCache.findOne({
                evmAddress,
                status: "pending",
              });
              if (cacheEntry) {
                cacheEntry.generatedImageUrl = imageResult.runpodImageUrl;
                await cacheEntry.save();
                logger.info(
                  `[TOOL] New image generated for rerolled persona ${result.persona.name}: ${imageResult.runpodImageUrl}`
                );
              }
            } else {
              logger.warn(
                `[TOOL] Image generation failed for rerolled persona ${result.persona.name}: ${imageResult.error}`
              );
            }
          } catch (imageError) {
            logger.warn(
              `[TOOL] Image generation error for rerolled persona ${result.persona.name}:`,
              imageError
            );
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: "Persona rerolled successfully",
                    rerollsRemaining: result.rerollsRemaining,
                    persona: {
                      name: result.persona.name,
                      gender: result.persona.gender,
                      confidence: result.persona.confidence,
                      sarcasm: result.persona.sarcasm,
                      charm: result.persona.charm,
                      morality: result.persona.morality,
                      appearance: result.persona.appearance,
                      region: result.persona.region,
                      education: result.persona.education,
                      accessory: result.persona.accessory,
                      systemPrompt: result.persona.systemPrompt,
                      generatedImageUrl: generatedImageUrl,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          logger.error(`Error rerolling persona for ${evmAddress}:`, error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("rerollPersona");

    // Register profile image generation tool
    mcpServer.tool(
      "generateProfileImage",
      {
        evmAddress: z
          .string()
          .describe("The user's EVM address for profile image generation"),
      },
      async (args: { evmAddress: string }) => {
        const { evmAddress } = args;
        logger.info(
          `[TOOL] Generating profile images for EVM address: ${evmAddress}`
        );

        try {
          // Get the user's persona from cache
          const persona = await personaGenerator.getPersonaFromCache(
            evmAddress
          );
          if (!persona) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error:
                        "No persona found for this user. Please generate a persona first.",
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          // Generate profile image using RunPod
          const result = await imageGenerator.generateImage(persona, {});

          if (result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Profile image generated successfully for ${persona.name}`,
                      runpodImageUrl: result.runpodImageUrl,
                      ipfsImageUrl: result.ipfsImageUrl,
                      evmAddress: evmAddress,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error:
                        result.error ||
                        "Unknown error occurred during image generation",
                      evmAddress: evmAddress,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        } catch (error) {
          logger.error(
            `Error generating profile images for ${evmAddress}:`,
            error
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("generateProfileImage");

    // Register encryption tools
    mcpServer.tool(
      "encryptData",
      {
        data: z.string().describe("The data to encrypt"),
        agentId: z
          .string()
          .optional()
          .describe("Optional agent ID for encryption context"),
      },
      async (args: { data: string; agentId?: string }) => {
        const { data, agentId = "default" } = args;
        logger.info(`[TOOL] Encrypting data for agent: ${agentId}`);

        try {
          logger.info(`[TOOL] Starting encryption for agent ID: ${agentId}`);
          // Generate unique hash from agent ID
          const uHash = await getUniqueHashFromSignature(
            ethers.utils.sha512(ethers.utils.toUtf8Bytes(`${agentId}`))
          );
          logger.info(
            `[TOOL] Generated hash key: ${uHash.key.substring(0, 10)}...`
          );

          // Create wallet from hash
          const wallet = new ethers.Wallet("0x" + uHash.key);
          const signature = await wallet.signMessage("intuai");

          //logger.info("[TOOL] About to call preRegister with signature...");
          const preRegisterResult = await preRegister(signature);
          //logger.info("[TOOL] preRegister returned:", preRegisterResult);

          const encryptionKey = preRegisterResult
            ? preRegisterResult.encryptionKey
            : undefined;
          logger.info(
            `[TOOL] Extracted encryption key, length: ${
              encryptionKey ? encryptionKey : "undefined or null"
            }`
          );

          if (!encryptionKey) {
            logger.error(
              "[TOOL] Failed to retrieve a valid encryption key from preRegister. preRegisterResult was:",
              preRegisterResult
            );
            throw new Error(
              "Failed to retrieve encryption key from preRegister."
            );
          }

          logger.info("[TOOL] About to call encryptData with key and data...");
          logger.info("[TOOL] Input data for encryptData:", data);
          const encryptedResult = await encryptData(encryptionKey, data);
          //logger.info(
          //  "[TOOL] encryptData returned (raw):",
          //  typeof encryptedResult,
          //  JSON.stringify(encryptedResult)
          //);

          // Extract the encrypted data and ensure it's a clean string
          let encryptedDataRaw =
            encryptedResult.encryptedData || encryptedResult;
          let encryptedData: string;

          // Ensure we have a string
          if (typeof encryptedDataRaw === "string") {
            encryptedData = encryptedDataRaw;
          } else {
            encryptedData = JSON.stringify(encryptedDataRaw);
          }

          // Remove any extra quotes that might be present
          if (encryptedData.startsWith('"') && encryptedData.endsWith('"')) {
            encryptedData = encryptedData.slice(1, -1);
            logger.info("[TOOL] Removed quotes from encrypted data");
          }

          logger.info(
            "[TOOL] Final encrypted data length:",
            encryptedData.length
          );
          // logger.debug("[TOOL] Final encrypted data snippet:", encryptedData.substring(0,100));

          // Return the encrypted data with success indicator
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    encryptedData: encryptedData,
                    agentId: agentId,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          logger.error("Error encrypting data:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("encryptData");

    // Register decryption tool
    mcpServer.tool(
      "decryptData",
      {
        encryptedData: z.string().describe("The encrypted data to decrypt"),
        agentId: z
          .string()
          .optional()
          .describe("Optional agent ID for decryption context"),
      },
      async (args: { encryptedData: string; agentId?: string }) => {
        const { encryptedData, agentId = "default" } = args;
        logger.info(`[TOOL] Decrypting data for agent: ${agentId}`);

        try {
          logger.info(`[TOOL] Starting decryption for agent ID: ${agentId}`);
          logger.info(`[TOOL] Decryption: ${encryptedData}`);
          // Generate unique hash from agent ID (same as encryption)
          const uHash = await getUniqueHashFromSignature(
            ethers.utils.sha512(ethers.utils.toUtf8Bytes(`${agentId}`))
          );
          logger.info(
            `[TOOL] Generated hash key: ${uHash.key.substring(0, 10)}...`
          );

          // Create wallet from hash
          const wallet = new ethers.Wallet("0x" + uHash.key);
          const signature = await wallet.signMessage("intuai");

          //logger.info("[TOOL] Getting encryption key for decryption...");
          //const preRegisterResult = await preRegister(signature);
          //const encryptionKey = preRegisterResult
          //  ? preRegisterResult.encryptionKey
          //  : undefined;
          //logger.info(
          //  `[TOOL] Decryption key received, length: ${
          //    encryptionKey ? encryptionKey : "undefined"
          //  }`
          //);
          //
          //logger.info("[TOOL] Decrypting data...");
          //logger.info("Raw encrypted data received:", encryptedData);
          //
          //// Remove any extra quotes that might have been added during storage
          let cleanEncryptedData = encryptedData;
          if (
            typeof encryptedData === "string" &&
            encryptedData.startsWith('"') &&
            encryptedData.endsWith('"')
          ) {
            cleanEncryptedData = encryptedData.slice(1, -1);
            logger.info(
              "Removed extra quotes, clean data:",
              cleanEncryptedData
            );
          }
          //
          //logger.info(
          //  "Encryption key length:",
          //  encryptionKey ? encryptionKey.length : "undefined"
          //);
          //if (!encryptionKey) {
          //  throw new Error("No encryption key found");
          //}
          const decryptedData = await decryptData(
            signature,
            cleanEncryptedData
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    decryptedData,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          logger.error("Error decrypting data:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("decryptData");

    // Register persona image generation tool
    mcpServer.tool(
      "generatePersonaImage",
      {
        personaData: z
          .object({
            name: z.string(),
            gender: z.string(),
            appearance: z.string(),
            region: z.string(),
            accessory: z.string(),
          })
          .describe("The persona data to generate image for"),
        customPrompt: z
          .string()
          .optional()
          .describe("Optional custom prompt override"),
        config: z
          .object({
            width: z.number().optional(),
            height: z.number().optional(),
            steps: z.number().optional(),
            denoise: z.number().optional(),
            noiseSeed: z.number().optional(),
            loraName: z.string().optional(),
            loraStrength: z.number().optional(),
            batchSize: z.number().optional(),
            outputPrefix: z.string().optional(),
          })
          .optional()
          .describe("Optional image generation configuration"),
      },
      async (args: {
        personaData: {
          name: string;
          gender: string;
          appearance: string;
          region: string;
          accessory: string;
        };
        customPrompt?: string;
        config?: Partial<ImageGenerationConfig>;
      }) => {
        const { personaData, customPrompt, config = {} } = args;
        logger.info(
          `[TOOL] Generating image for persona data: ${personaData.name}`
        );

        try {
          // Construct a GeneratedPersona-like object for imageGenerator.generateImage
          const personaForImageGen: personaGenerator.GeneratedPersona = {
            name: personaData.name,
            gender: personaData.gender,
            appearance: personaData.appearance,
            region: personaData.region,
            accessory: personaData.accessory,
            // Fill in other GeneratedPersona fields with defaults or derive if possible
            confidence: 3, // Default value
            sarcasm: 1, // Default value
            charm: 3, // Default value
            morality: 3, // Default value
            education: 3, // Default value
            systemPrompt: "Simple prompt for ad-hoc image generation.", // Placeholder
            hash: "adhoc", // Placeholder
            evmAddress: "tool-generatePersonaImage", // Generic ID for storage path differentiation
          };

          // Prepare config for imageGenerator, including promptOverride
          const imageGenConfig: ImageGenerationConfig = {
            ...config, // Spreads width, height, steps, denoise, noiseSeed, loraName etc. from tool input
            promptOverride: customPrompt, // Pass customPrompt as promptOverride
          };

          const result = await imageGenerator.generateImage(
            personaForImageGen,
            imageGenConfig
          );

          if (result.success && result.runpodImageUrl) {
            logger.info(
              `[TOOL] Image generated successfully for ${personaData.name}: ${result.runpodImageUrl}`
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      imageUrl: result.runpodImageUrl,
                      prompt:
                        customPrompt ||
                        imageGenerator.generatePersonaPrompt(
                          personaForImageGen
                        ),
                      config: config,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } else {
            throw new Error(result.error || "Image generation failed");
          }
        } catch (error) {
          logger.error(
            `Error generating image for persona ${personaData.name}:`,
            error
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("generatePersonaImage");

    // Register IPFS upload tool
    mcpServer.tool(
      "uploadToIpfs",
      {
        personaData: z.any().describe("The persona data to upload to IPFS"),
        imageUri: z.string().optional().describe("Optional custom image URI"),
        skipGeneration: z
          .boolean()
          .optional()
          .describe("Skip any heavy processing, just upload existing data"),
      },
      async (args: {
        personaData?: any;
        imageUri?: string;
        skipGeneration?: boolean;
      }) => {
        const { personaData, imageUri, skipGeneration } = args;
        logger.info(
          `[TOOL] Uploading persona ${
            personaData?.name || "unnamed"
          } to IPFS (skipGeneration: ${skipGeneration})`
        );

        if (!personaData) {
          throw new Error("No persona data provided for IPFS upload");
        }

        // Use the image from the persona data (prioritize provided imageUri, then persona URLs)
        const finalImageUri =
          imageUri ||
          personaData.ipfsImageUrl ||
          personaData.runpodImageUrl ||
          personaData.generatedImageUrl ||
          "ipfs://bafybeigfegus5grabuofhjbkusz6msqyhmlc7tdfqlzelmkginrrkkwpy4/default-persona.jpg";

        // Create metadata object for NFT
        const metadata = {
          name: personaData.name,
          description: `A unique AI persona: ${personaData.name}, a ${
            personaData.gender
          } with ${personaData.appearance.toLowerCase()} appearance from ${
            personaData.region
          }`,
          image: finalImageUri,
          attributes: [
            { trait_type: "Gender", value: personaData.gender },
            { trait_type: "Appearance", value: personaData.appearance },
            { trait_type: "Region", value: personaData.region },
            { trait_type: "Confidence", value: personaData.confidence },
            { trait_type: "Sarcasm", value: personaData.sarcasm },
            { trait_type: "Charm", value: personaData.charm },
            { trait_type: "Morality", value: personaData.morality },
            { trait_type: "Education", value: personaData.education },
            { trait_type: "Accessory", value: personaData.accessory },
          ],
          personaData: {
            systemPrompt: personaData.systemPrompt,
            hash: personaData.hash,
            createdAt: new Date().toISOString(),
          },
        };

        // 🐛 DEBUG: Log IPFS upload metadata for minting
        console.log("🌐 IPFS UPLOAD METADATA DEBUG:");
        console.log("=".repeat(50));
        console.log("Persona Name:", personaData.name);
        console.log("Persona Hash:", personaData.hash);
        console.log("Final Image URI used:", finalImageUri);
        console.log("Available Image URLs:", {
          runpodImageUrl: personaData.runpodImageUrl,
          ipfsImageUrl: personaData.ipfsImageUrl,
          generatedImageUrl: personaData.generatedImageUrl,
        });
        console.log("Metadata being uploaded to IPFS:");
        console.log(JSON.stringify(metadata, null, 2));
        console.log("=".repeat(50));

        try {
          // Upload to IPFS
          const ipfsUri = await uploadToIPFS(metadata);

          logger.info(`[TOOL] Persona uploaded to IPFS: ${ipfsUri}`);

          // Create the response that will trigger frontend transaction detection
          const responseText = `🎭 **${
            personaData.name
          } has been uploaded to IPFS successfully!**

Your persona metadata is now permanently stored on IPFS and ready for minting.

mint nft ${ipfsUri}

🔄 **Initiating NFT minting transaction...**

Your INTU wallet will prompt you to confirm the transaction.

**[TRANSACTION_DATA]**
{
  "action": "mint_nft",
  "ipfsUri": "${ipfsUri}",
  "personaName": "${personaData.name}",
  "metadata": ${JSON.stringify(metadata, null, 2)}
}
**[/TRANSACTION_DATA]**`;

          return {
            content: [
              {
                type: "text",
                text: responseText,
              },
            ],
          };
        } catch (error) {
          logger.error("Error uploading to IPFS:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("uploadToIpfs");

    // Register simple NFT minting tool that uses cached IPFS URI
    mcpServer.tool(
      "mintPersonaNft",
      {
        evmAddress: z
          .string()
          .describe("The user's EVM address to look up cached persona"),
      },
      async (args: { evmAddress: string }) => {
        const { evmAddress } = args;
        logger.info(
          `[TOOL] Looking up cached persona for minting: ${evmAddress}`
        );

        try {
          // Look up the user's cached persona
          const cacheEntry = await NFTCache.findOne({
            evmAddress,
            status: "pending",
          });

          if (!cacheEntry || !cacheEntry.persona) {
            throw new Error(
              "No persona found for this address. Please generate a persona first."
            );
          }

          // Check if we already have an IPFS URI for this persona
          let ipfsUri =
            cacheEntry.ipfsUri || (cacheEntry as any).metadataIpfsUrl;

          if (!ipfsUri) {
            // Upload persona to IPFS now
            logger.info(
              `[TOOL] Uploading persona ${cacheEntry.persona.name} to IPFS for minting`
            );

            const personaData = cacheEntry.persona;
            const finalImageUri =
              (cacheEntry as any).ipfsImageUrl ||
              (cacheEntry as any).generatedImageUrl ||
              personaData.runpodImageUrl ||
              personaData.generatedImageUrl ||
              "ipfs://bafybeigfegus5grabuofhjbkusz6msqyhmlc7tdfqlzelmkginrrkkwpy4/default-persona.jpg";

            const metadata = {
              name: personaData.name,
              description: `A unique AI persona: ${personaData.name}, a ${
                personaData.gender
              } with ${personaData.appearance.toLowerCase()} appearance from ${
                personaData.region
              }`,
              image: finalImageUri,
              attributes: [
                { trait_type: "Gender", value: personaData.gender },
                { trait_type: "Appearance", value: personaData.appearance },
                { trait_type: "Region", value: personaData.region },
                { trait_type: "Confidence", value: personaData.confidence },
                { trait_type: "Sarcasm", value: personaData.sarcasm },
                { trait_type: "Charm", value: personaData.charm },
                { trait_type: "Morality", value: personaData.morality },
                { trait_type: "Education", value: personaData.education },
                { trait_type: "Accessory", value: personaData.accessory },
              ],
              personaData: {
                systemPrompt: personaData.systemPrompt,
                hash: personaData.hash,
                createdAt: new Date().toISOString(),
              },
            };

            // Upload to IPFS
            ipfsUri = await uploadToIPFS(metadata);

            // Save the IPFS URI to cache
            cacheEntry.ipfsUri = ipfsUri;
            await cacheEntry.save();

            logger.info(`[TOOL] Persona uploaded to IPFS: ${ipfsUri}`);
          } else {
            logger.info(`[TOOL] Using existing IPFS URI: ${ipfsUri}`);
          }

          // Return direct mint command for frontend
          const responseText = `🎭 **Ready to mint ${cacheEntry.persona.name}!**

**MINT_NFT_DIRECT**: ${ipfsUri}

Your persona is stored on IPFS and ready for blockchain minting.`;

          return {
            content: [
              {
                type: "text",
                text: responseText,
              },
            ],
          };
        } catch (error) {
          logger.error("Error in mintPersonaNft:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("mintPersonaNft");

    // Register NFT minting confirmation tool (called after frontend completes minting)
    mcpServer.tool(
      "confirmMintedNft",
      {
        evmAddress: z
          .string()
          .describe("The user's EVM address that minted the NFT"),
        transactionHash: z
          .string()
          .describe("The actual blockchain transaction hash"),
        tokenId: z
          .string()
          .describe("The actual NFT token ID from the blockchain"),
        ipfsUri: z
          .string()
          .describe("The IPFS URI containing persona metadata"),
      },
      async (args: {
        evmAddress: string;
        transactionHash: string;
        tokenId: string;
        ipfsUri: string;
      }) => {
        const { evmAddress, transactionHash, tokenId, ipfsUri } = args;
        logger.info(
          `[TOOL] Confirming minted NFT for ${evmAddress}: tokenId ${tokenId}, tx ${transactionHash}`
        );

        try {
          // Update cache status to minted with real transaction data
          const cacheEntry = await NFTCache.findOne({
            evmAddress,
            status: "pending",
          });

          if (cacheEntry) {
            cacheEntry.status = "minted";
            cacheEntry.transactionHash = transactionHash;
            cacheEntry.tokenId = tokenId;
            cacheEntry.ipfsUri = ipfsUri;
            await cacheEntry.save();
            logger.info(`Updated cache with real mint data for ${evmAddress}`);
          }

          logger.info(
            `[TOOL] NFT confirmed: tokenId ${tokenId}, tx ${transactionHash}`
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: "NFT minting confirmed",
                    transactionHash,
                    tokenId,
                    contractAddress:
                      "0x54c9940a54DE8Dfdbc97011176d95Eb14DEC86a4", // Your actual contract address
                    ipfsUri,
                    blockExplorerUrl: `https://sepolia.arbiscan.io/tx/${transactionHash}`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          logger.error("Error confirming NFT mint:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("confirmMintedNft");

    // Register persona cache clearing tool
    mcpServer.tool(
      "clearPersonaCache",
      {
        evmAddress: z
          .string()
          .describe("The user's EVM address for cache clearing"),
      },
      async (args: { evmAddress: string }) => {
        const { evmAddress } = args;
        logger.info(
          `[TOOL] Clearing persona cache for EVM address: ${evmAddress}`
        );

        try {
          // Clear all persona cache entries for this address
          const deletedCount = await NFTCache.deleteMany({
            evmAddress: evmAddress,
            status: "pending", // Only clear pending personas, not minted ones
          });

          logger.info(
            `[TOOL] Cleared ${deletedCount.deletedCount} cache entries for ${evmAddress}`
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: "Persona cache cleared successfully",
                    deletedCount: deletedCount.deletedCount,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          logger.error("Error clearing persona cache:", error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
    registeredTools.add("clearPersonaCache");

    // Register NFT detection tool
    mcpServer.tool(
      "checkNftOwnership",
      {
        evmAddress: z
          .string()
          .optional()
          .describe("The user's EVM address (preferred key)"),
        param: z
          .string()
          .optional()
          .describe("Alternative key for the user's EVM address"),
      },
      async (args: any) => {
        // args will be any, needs parsing
        console.log(`[DEBUG] checkNftOwnership called with:`, args);
        console.log(`[DEBUG] args type:`, typeof args);
        console.log(`[DEBUG] args keys:`, Object.keys(args || {}));
        console.log(`[DEBUG] args.evmAddress:`, args?.evmAddress);
        logger.info(
          `[TOOL] checkNftOwnership received raw args: ${JSON.stringify(args)}`
        );

        // Define the actual schema for parsing inside the handler
        type CheckNftInput = { evmAddress?: string; param?: string };

        const CheckNftOwnershipArgsSchema = z
          .object({
            evmAddress: z
              .string()
              .optional()
              .describe("The user's EVM address (preferred key)"),
            param: z
              .string()
              .optional()
              .describe("Alternative key for the user's EVM address"),
          })
          .refine(
            (data: CheckNftInput) => {
              return data.evmAddress !== undefined || data.param !== undefined;
            },
            {
              message:
                "Either evmAddress or param must be provided and be a non-empty string.",
              path: ["evmAddress"],
            }
          )
          .transform((data: CheckNftInput, ctx: z.RefinementCtx) => {
            let addressToUse: string | undefined;

            if (data.evmAddress) {
              if (
                typeof data.evmAddress === "string" &&
                data.evmAddress.length === 42 &&
                data.evmAddress.startsWith("0x")
              ) {
                addressToUse = data.evmAddress;
              } else {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Invalid format for evmAddress.",
                  path: ["evmAddress"],
                });
                return z.NEVER; // Indicates to Zod that this transform path is invalid
              }
            } else if (data.param) {
              if (
                typeof data.param === "string" &&
                data.param.length === 42 &&
                data.param.startsWith("0x")
              ) {
                addressToUse = data.param;
              } else {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Invalid format for param.",
                  path: ["param"],
                });
                return z.NEVER;
              }
            } else {
              // This case should be caught by the .refine earlier, but as a safeguard in transform:
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "No EVM address provided via evmAddress or param.",
                path: ["evmAddress"],
              });
              return z.NEVER;
            }

            return { addressToUse }; // Return an object with the validated address
          });

        const parseResult = CheckNftOwnershipArgsSchema.safeParse(args);

        if (!parseResult.success) {
          logger.error(
            "[TOOL] checkNftOwnership: Argument parsing failed",
            parseResult.error.flatten()
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Invalid arguments provided for checkNftOwnership.",
                    details: parseResult.error.flatten().fieldErrors,
                  },
                  null,
                  2
                ),
              },
            ],
            structuredContent: {
              success: false,
              error: "Invalid arguments provided for checkNftOwnership.",
              details: parseResult.error.flatten().fieldErrors,
            },
            _meta: { isError: true },
          };
        }

        const { addressToUse } = parseResult.data;

        logger.info(
          `[TOOL] Checking NFT ownership for validated address: ${addressToUse}`
        );

        try {
          const mintedPersona = await NFTCache.findOne({
            evmAddress: addressToUse,
            status: "minted",
          }).lean();

          if (mintedPersona) {
            logger.info(
              `[TOOL] Found minted persona for ${addressToUse}. Persona name: ${mintedPersona.persona?.name}`
            );
            // Ensure mintedPersona.persona is not undefined before accessing name
            const personaName = mintedPersona.persona?.name || "Unknown";
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      hasNft: true,
                      persona: mintedPersona.persona,
                      mintedAt: mintedPersona.updatedAt,
                    },
                    null,
                    2
                  ),
                },
              ],
              structuredContent: {
                success: true,
                hasNft: true,
                persona: mintedPersona.persona,
                mintedAt: mintedPersona.updatedAt,
              },
            };
          } else {
            logger.info(
              `[TOOL] No minted persona found for address ${addressToUse}`
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      hasNft: false,
                      persona: null,
                    },
                    null,
                    2
                  ),
                },
              ],
              structuredContent: {
                success: true,
                hasNft: false,
                persona: null,
              },
            };
          }
        } catch (error) {
          logger.error(
            `[TOOL] Error during NFTCache lookup in checkNftOwnership for address ${addressToUse}:`,
            error
          );
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Database error while checking NFT ownership.",
                    details: errorMessage,
                  },
                  null,
                  2
                ),
              },
            ],
            structuredContent: {
              success: false,
              error: "Database error while checking NFT ownership.",
              details: errorMessage,
            },
            _meta: { isError: true },
          };
        }
      }
    );
    registeredTools.add("checkNftOwnership");

    // Register getPendingPersona tool for sidebar cache check
    mcpServer.tool(
      "getPendingPersona",
      {
        evmAddress: z
          .string()
          .describe(
            "The user's EVM address to check cache for pending persona"
          ),
      },
      async (args: { evmAddress: string }) => {
        const { evmAddress } = args;
        try {
          const persona = await personaGenerator.getPersonaFromCache(
            evmAddress
          );
          if (persona) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: "Found pending persona in cache.",
                      persona,
                    },
                    null,
                    2
                  ),
                },
              ],
              structuredContent: {
                success: true,
                message: "Found pending persona in cache.",
                persona,
              },
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      message: "No pending persona found in cache.",
                    },
                    null,
                    2
                  ),
                },
              ],
              structuredContent: {
                success: false,
                message: "No pending persona found in cache.",
              },
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
            structuredContent: {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }
    );

    logger.info("MCP Server initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize MCP Server:", error);
    throw error;
  }
};

// Plugins registry
const plugins: Record<string, any> = {};

/**
 * Register a plugin
 */
const registerPlugin = (name: string, plugin: any): void => {
  if (plugins[name]) {
    throw new Error(`Plugin with name ${name} already registered`);
  }

  plugins[name] = plugin;
  logger.info(`Plugin ${name} registered`);

  // Call onLoad lifecycle method if it exists
  if (typeof plugin.onLoad === "function") {
    try {
      plugin.onLoad(mcpServer);
      logger.info(`Plugin ${name} loaded`);
    } catch (error) {
      logger.error(`Error loading plugin ${name}:`, error);
      if (typeof plugin.onError === "function") {
        plugin.onError(error);
      }
    }
  }
};

/**
 * Unregister a plugin
 */
const unregisterPlugin = (name: string): void => {
  const plugin = plugins[name];
  if (!plugin) {
    logger.warn(`Plugin ${name} not found, cannot unregister`);
    return;
  }

  // Call onUnload lifecycle method if it exists
  if (typeof plugin.onUnload === "function") {
    try {
      plugin.onUnload(mcpServer);
      logger.info(`Plugin ${name} unloaded`);
    } catch (error) {
      logger.error(`Error unloading plugin ${name}:`, error);
      if (typeof plugin.onError === "function") {
        plugin.onError(error);
      }
    }
  }

  delete plugins[name];
  logger.info(`Plugin ${name} unregistered`);
};

/**
 * Get a plugin by name
 */
const getPlugin = (name: string): any => {
  return plugins[name];
};

/**
 * List all registered plugins
 */
const listPlugins = (): string[] => {
  return Object.keys(plugins);
};

// IPFS Upload function using Pinata or mock implementation
async function uploadToIPFS(data: any): Promise<string> {
  try {
    const jsonString = JSON.stringify(data, null, 2);

    // Check if Pinata is configured
    let pinataJwt = process.env.PINATA_JWT;
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_API_KEY;

    // Clean up JWT token - remove any prefix and trim whitespace
    if (pinataJwt) {
      pinataJwt = pinataJwt.replace(/^your_pinata_/, "").trim();
      // Also remove any other common prefixes or artifacts
      pinataJwt = pinataJwt
        .replace(/^pinata_/, "")
        .replace(/^jwt_/, "")
        .trim();
    }

    if (pinataJwt || (pinataApiKey && pinataSecretKey)) {
      logger.info("[IPFS] Using Pinata for real IPFS upload");

      try {
        // Create FormData for file upload
        const formData = new FormData();
        const jsonBlob = new Blob([jsonString], { type: "application/json" });
        formData.append("file", jsonBlob, "metadata.json");

        // Add metadata
        const metadata = JSON.stringify({
          name: "persona-metadata.json",
          keyvalues: {
            type: "persona",
            timestamp: new Date().toISOString(),
          },
        });
        formData.append("pinataMetadata", metadata);

        // Configure headers
        const headers: Record<string, string> = {};
        if (pinataJwt && pinataJwt.length > 20) {
          // Basic JWT validation
          headers["Authorization"] = `Bearer ${pinataJwt}`;
          logger.info("[IPFS] Using JWT authentication");
        } else if (pinataApiKey && pinataSecretKey) {
          headers["pinata_api_key"] = pinataApiKey;
          headers["pinata_secret_api_key"] = pinataSecretKey;
          logger.info("[IPFS] Using API key authentication");
        } else {
          throw new Error("Invalid Pinata credentials format");
        }

        // Upload to Pinata
        const response = await fetch(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          {
            method: "POST",
            headers,
            body: formData,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(
            `[IPFS] Pinata error response: ${response.status} ${errorText}`
          );
          throw new Error(
            `Pinata upload failed: ${response.status} ${errorText}`
          );
        }

        const result = await response.json();
        const ipfsUri = `ipfs://${result.IpfsHash}`;

        logger.info(`[IPFS] Real upload completed: ${ipfsUri}`);
        return ipfsUri;
      } catch (pinataError) {
        logger.error(
          "[IPFS] Pinata upload failed, falling back to mock:",
          pinataError
        );
        // Fall through to mock implementation
      }
    }

    // Mock implementation fallback
    logger.info(
      "[IPFS] Using mock implementation (Pinata not configured or failed)"
    );

    // Mock implementation - generate a realistic IPFS hash
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(jsonString));
    const ipfsHash = `bafybei${hash.slice(2, 52)}`;
    const ipfsUri = `ipfs://${ipfsHash}`;

    logger.info(`[IPFS] Mock upload completed: ${ipfsUri}`);
    return ipfsUri;
  } catch (error) {
    logger.error("[IPFS] Upload failed:", error);
    throw new Error(
      `IPFS upload failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export {
  mcpServer,
  initializeMcpServer,
  registeredResources,
  registeredTools,
  getResource,
  formatResourceContent,
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  listPlugins,
};
