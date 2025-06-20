import mongoose from "mongoose";
import crypto from "crypto";
import fetch from "node-fetch";
import { logger } from "../utils/logger.js";
import NFTCache, { INFTCache } from "../models/nftCache.js";
import { imageGenerator, FullImageResult } from "./imageGenerator.js";
import { IpfsService, IpfsUploadResult } from "./ipfsService.js";

// Persona parameter definitions from PRD
const PERSONA_PARAMETERS = {
  gender: ["Male", "Female", "Non-binary", "Alien"],
  confidence: [1, 2, 3, 4, 5],
  sarcasm: [1, 2, 3, 4, 5],
  charm: [1, 2, 3, 4, 5],
  morality: [1, 2, 3, 4, 5],
  appearance: [
    "Elegant",
    "Humble",
    "Militant",
    "Bohemian",
    "Fashionable",
    "Homeless",
    "Hipster",
    "Athletic",
  ],
  region: [
    "North America",
    "Latin America",
    "Western Europe",
    "Eastern Europe",
    "Indian",
    "Arab",
    "Africa",
    "Asian",
    "Pacific Islander/South East Asia",
    "Moon",
  ],
  education: [1, 2, 3, 4, 5],
};

export interface PersonaParameters {
  gender: string;
  confidence: number;
  sarcasm: number;
  charm: number;
  morality: number;
  appearance: string;
  region: string;
  education: number;
}

export interface GeneratedPersona extends PersonaParameters {
  name: string;
  accessory: string;
  systemPrompt: string;
  hash: string;
  evmAddress: string;
  runpodImageUrl?: string;
  ipfsImageUrl?: string;
  metadataIpfsUrl?: string;
}

const ipfsService = new IpfsService();

/**
 * Generate random persona parameters
 */
function generateRandomBasePersona(): PersonaParameters {
  return {
    gender:
      PERSONA_PARAMETERS.gender[
        Math.floor(Math.random() * PERSONA_PARAMETERS.gender.length)
      ],
    confidence:
      PERSONA_PARAMETERS.confidence[
        Math.floor(Math.random() * PERSONA_PARAMETERS.confidence.length)
      ],
    sarcasm:
      PERSONA_PARAMETERS.sarcasm[
        Math.floor(Math.random() * PERSONA_PARAMETERS.sarcasm.length)
      ],
    charm:
      PERSONA_PARAMETERS.charm[
        Math.floor(Math.random() * PERSONA_PARAMETERS.charm.length)
      ],
    morality:
      PERSONA_PARAMETERS.morality[
        Math.floor(Math.random() * PERSONA_PARAMETERS.morality.length)
      ],
    appearance:
      PERSONA_PARAMETERS.appearance[
        Math.floor(Math.random() * PERSONA_PARAMETERS.appearance.length)
      ],
    region:
      PERSONA_PARAMETERS.region[
        Math.floor(Math.random() * PERSONA_PARAMETERS.region.length)
      ],
    education:
      PERSONA_PARAMETERS.education[
        Math.floor(Math.random() * PERSONA_PARAMETERS.education.length)
      ],
  };
}

/**
 * Create a hash of persona parameters for duplicate checking
 */
function createPersonaHash(persona: PersonaParameters): string {
  const hashInput = `${persona.gender}-${persona.confidence}-${persona.sarcasm}-${persona.charm}-${persona.morality}-${persona.appearance}-${persona.region}-${persona.education}`;
  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Check if a persona already exists based on its hash
 */
async function isPersonaDuplicate(hash: string): Promise<boolean> {
  try {
    const existing = await NFTCache.findOne({ "persona.hash": hash });
    return !!existing;
  } catch (error) {
    logger.error("Error checking persona duplicate:", error);
    throw error;
  }
}

/**
 * Call LLM (Ollama or OpenAI) to generate name and accessory
 */
async function generateNameAndAccessoryViaLLM(
  persona: PersonaParameters
): Promise<{ name: string; accessory: string }> {
  try {
    // Import the LLM adapter
    const { generateNameAndAccessory } = await import(
      "../services/llmAdapter.js"
    );

    return await generateNameAndAccessory(persona);
  } catch (error) {
    logger.error("Error generating name and accessory with LLM:", error);
    logger.error(
      `[PERSONA_GEN] FALLING BACK TO DEFAULT VALUES for ${persona.region} ${persona.gender}`
    );

    return {
      name: `${
        persona.gender === "Alien" ? "Zyx" : "Alex"
      } ${persona.region.replace(/\s+/g, "")}`,
      accessory: `${persona.appearance} Accessory`,
    };
  }
}

/**
 * Create system prompt template based on persona parameters
 */
function createSystemPrompt(
  persona: PersonaParameters & { name: string; accessory: string }
): string {
  const confidenceDesc = [
    "very timid",
    "somewhat timid",
    "balanced",
    "confident",
    "very confident",
  ][persona.confidence - 1];
  const sarcasmDesc = [
    "never sarcastic",
    "rarely sarcastic",
    "occasionally sarcastic",
    "often sarcastic",
    "highly sarcastic",
  ][persona.sarcasm - 1];
  const charmDesc = [
    "not charming",
    "somewhat charming",
    "moderately charming",
    "quite charming",
    "extremely charming",
  ][persona.charm - 1];
  const moralityDesc = [
    "morally flexible",
    "pragmatic",
    "balanced ethics",
    "strong morals",
    "unwavering principles",
  ][persona.morality - 1];
  const educationDesc = [
    "basic education",
    "some education",
    "moderate education",
    "well-educated",
    "highly educated",
  ][persona.education - 1];

  return `You are ${
    persona.name
  }, an AI persona with a ${persona.appearance.toLowerCase()} appearance from ${
    persona.region
  }. You always carry your ${persona.accessory}.

Your personality traits:
- Confidence: ${confidenceDesc} (${persona.confidence}/5)
- Sarcasm: ${sarcasmDesc} (${persona.sarcasm}/5) 
- Charm: ${charmDesc} (${persona.charm}/5)
- Morality: ${moralityDesc} (${persona.morality}/5)
- Education: ${educationDesc} (${persona.education}/5)
- Gender: ${persona.gender}

You are an expert on INTU technology and can help users with questions about:
- INTU's unified execution layer for AI + Blockchain
- Policy engines for compliance
- Trusted operations across platforms
- Data privacy and encryption
- NFT-based identity systems

Always respond in character, embodying your personality traits while providing helpful, accurate information about INTU. Your responses should reflect your confidence level, use appropriate amounts of sarcasm, demonstrate your charm and moral compass, and show your education level through your communication style.`;
}

/**
 * Generates only the text attributes of a persona.
 */
async function generatePersonaTextAttributes(
  evmAddress: string,
  maxRetries: number = 10
): Promise<
  Omit<GeneratedPersona, "runpodImageUrl" | "ipfsImageUrl" | "metadataIpfsUrl">
> {
  logger.info(
    `Generating persona text attributes for EVM address: ${evmAddress}`
  );
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    const basePersona = generateRandomBasePersona();
    const hash = createPersonaHash(basePersona);
    const isDuplicate = await isPersonaDuplicate(hash);
    if (isDuplicate) {
      logger.debug(
        `Persona text attempt ${attempts} is duplicate, retrying...`
      );
      continue;
    }
    const { name, accessory } = await generateNameAndAccessoryViaLLM(
      basePersona
    );
    const systemPrompt = createSystemPrompt({
      ...basePersona,
      name,
      accessory,
    });
    const personaTextData = {
      ...basePersona,
      name,
      accessory,
      systemPrompt,
      hash,
      evmAddress: evmAddress,
    };
    logger.info(
      `Generated unique persona text attributes: ${name} (attempt ${attempts})`
    );
    return personaTextData;
  }
  throw new Error(
    `Failed to generate unique persona text after ${maxRetries} attempts`
  );
}

/**
 * Generate a complete persona with all attributes including image and IPFS metadata.
 */
async function generateFullPersonaWithAssets(
  evmAddress: string,
  maxRetries: number = 10
): Promise<GeneratedPersona> {
  logger.info(
    `Generating full persona with assets for EVM address: ${evmAddress}`
  );
  const personaTextData = await generatePersonaTextAttributes(
    evmAddress,
    maxRetries
  );

  let runpodImageUrl: string | undefined = undefined;
  let ipfsImageUrl: string | undefined = undefined;
  let metadataIpfsUrl: string | undefined = undefined;

  // 1. Generate Image (RunPod + IPFS for image)
  logger.info(`[PERSONA_GEN] Generating image for: ${personaTextData.name}`);

  // Check if RunPod is configured
  const runpodApiKey = process.env.RUNPOD_API_KEY;
  const skipImageGeneration = !runpodApiKey;

  if (skipImageGeneration) {
    logger.warn(
      `[PERSONA_GEN] RunPod API key not configured, skipping image generation for ${personaTextData.name}`
    );
  } else {
    logger.info(
      `[PERSONA_GEN] About to call imageGenerator.generateImage with persona: ${JSON.stringify(
        personaTextData,
        null,
        2
      )}`
    );
    try {
      // Pass a temporary GeneratedPersona-like object to imageGenerator, as it expects `evmAddress`
      const tempPersonaForImageGen: GeneratedPersona = {
        ...personaTextData,
        // The following are placeholders or will be filled properly soon
        runpodImageUrl: undefined,
        ipfsImageUrl: undefined,
        metadataIpfsUrl: undefined,
      };
      logger.info(`[PERSONA_GEN] Calling imageGenerator.generateImage...`);
      const imageResult: FullImageResult = await imageGenerator.generateImage(
        tempPersonaForImageGen,
        {}
      );
      logger.info(
        `[PERSONA_GEN] Image generation result received: ${JSON.stringify(
          imageResult,
          null,
          2
        )}`
      );
      if (imageResult.success) {
        runpodImageUrl = imageResult.runpodImageUrl;
        ipfsImageUrl = imageResult.ipfsImageUrl;
        logger.info(
          `[PERSONA_GEN] Image generated successfully. RunPod: ${runpodImageUrl}, IPFS: ${ipfsImageUrl}`
        );
      } else {
        logger.error(
          `[PERSONA_GEN] Image generation failed for ${personaTextData.name}: ${imageResult.error}`
        );
        // Decide if we should throw or continue with a default image
        // For now, let's allow continuing, metadata will use a placeholder or omit image
      }
    } catch (imageError) {
      logger.error(
        `[PERSONA_GEN] Critical error during image generation for ${personaTextData.name}:`,
        imageError
      );
    }
  }

  // 2. Construct and Upload NFT Metadata to IPFS
  logger.info(
    `[PERSONA_GEN] Creating NFT metadata for: ${personaTextData.name}`
  );
  const nftMetadata = {
    name: personaTextData.name,
    description: `A unique AI-generated persona. ${personaTextData.systemPrompt.substring(
      0,
      150
    )}...`,
    image:
      ipfsImageUrl ||
      "ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku", // Default placeholder image CID
    attributes: [
      { trait_type: "Gender", value: personaTextData.gender },
      { trait_type: "Appearance", value: personaTextData.appearance },
      { trait_type: "Region", value: personaTextData.region },
      { trait_type: "Accessory", value: personaTextData.accessory },
      { trait_type: "Confidence", value: personaTextData.confidence },
      { trait_type: "Sarcasm", value: personaTextData.sarcasm },
      { trait_type: "Charm", value: personaTextData.charm },
      { trait_type: "Morality", value: personaTextData.morality },
      { trait_type: "Education", value: personaTextData.education },
    ],
    external_url: `https://intugame.com/persona/${personaTextData.hash}`, // Example external URL
    persona_details: { ...personaTextData }, // Include all text attributes
  };

  // 🐛 DEBUG: Log complete NFT metadata after persona and image generation
  console.log("🎭 PERSONA METADATA DEBUG:");
  console.log("=".repeat(50));
  console.log("Persona Name:", nftMetadata.name);
  console.log("Description:", nftMetadata.description);
  console.log("Image URL:", nftMetadata.image);
  console.log("Attributes:", JSON.stringify(nftMetadata.attributes, null, 2));
  console.log("External URL:", nftMetadata.external_url);
  console.log("RunPod Image URL:", runpodImageUrl);
  console.log("IPFS Image URL:", ipfsImageUrl);
  console.log("Complete Metadata Object:");
  console.log(JSON.stringify(nftMetadata, null, 2));
  console.log("=".repeat(50));

  try {
    const metadataFileName = `persona-${
      personaTextData.evmAddress
    }-${Date.now()}.json`;
    const metadataUploadResult: IpfsUploadResult = await ipfsService.uploadJson(
      nftMetadata,
      metadataFileName
    );
    metadataIpfsUrl = metadataUploadResult.ipfsUri;
    logger.info(
      `[PERSONA_GEN] NFT metadata uploaded to IPFS: ${metadataIpfsUrl}`
    );
  } catch (metadataError) {
    logger.error(
      `[PERSONA_GEN] Failed to upload NFT metadata to IPFS for ${personaTextData.name}:`,
      metadataError
    );
    // Decide if we should throw or let it be null
  }

  // Assemble the final GeneratedPersona object
  const finalPersona: GeneratedPersona = {
    ...personaTextData,
    runpodImageUrl,
    ipfsImageUrl,
    metadataIpfsUrl,
  };

  // 🐛 DEBUG: Log final persona object with all URLs
  console.log("🚀 FINAL PERSONA OBJECT DEBUG:");
  console.log("=".repeat(50));
  console.log("Persona Name:", finalPersona.name);
  console.log("EVM Address:", finalPersona.evmAddress);
  console.log("RunPod Image URL:", finalPersona.runpodImageUrl);
  console.log("IPFS Image URL:", finalPersona.ipfsImageUrl);
  console.log("Metadata IPFS URL:", finalPersona.metadataIpfsUrl);
  console.log(
    "System Prompt:",
    finalPersona.systemPrompt.substring(0, 100) + "..."
  );
  console.log("Complete Final Persona:");
  console.log(JSON.stringify(finalPersona, null, 2));
  console.log("=".repeat(50));

  logger.info(
    `[PERSONA_GEN] Fully generated persona with assets for ${evmAddress}: ${finalPersona.name}`
  );
  return finalPersona;
}

// Exported function, now calls the internal orchestrator
export async function generatePersona(
  evmAddress: string,
  maxRetries: number = 10
): Promise<GeneratedPersona> {
  return generateFullPersonaWithAssets(evmAddress, maxRetries);
}

/**
 * Store generated persona in NFT cache
 */
export async function storePersonaInCache(
  evmAddress: string,
  persona: GeneratedPersona
): Promise<string> {
  try {
    const existing = await NFTCache.findOne({ evmAddress, status: "pending" });
    if (existing) {
      existing.persona = persona;
      (existing as any).generatedImageUrl = persona.runpodImageUrl;
      (existing as any).ipfsImageUrl = persona.ipfsImageUrl;
      (existing as any).metadataIpfsUrl = persona.metadataIpfsUrl;
      existing.updatedAt = new Date();
      await existing.save();
      logger.info(
        `Updated existing persona cache for ${evmAddress} with all asset URLs.`
      );
      return existing._id.toString();
    } else {
      const cacheEntry = new NFTCache({
        evmAddress,
        persona,
        generatedImageUrl: persona.runpodImageUrl,
        ipfsImageUrl: persona.ipfsImageUrl,
        metadataIpfsUrl: persona.metadataIpfsUrl,
        profileImages: [],
        backgroundImages: [],
        status: "pending",
        rerollCount: 0,
      });
      await cacheEntry.save();
      logger.info(
        `Created new persona cache for ${evmAddress} with all asset URLs.`
      );
      return cacheEntry._id.toString();
    }
  } catch (error) {
    logger.error("Error storing persona in cache:", error);
    throw error;
  }
}

/**
 * Reroll persona with attempt tracking (max 3 rerolls)
 */
export async function rerollPersona(
  evmAddress: string
): Promise<{ persona: GeneratedPersona; rerollsRemaining: number }> {
  try {
    const cacheEntry = await NFTCache.findOne({
      evmAddress,
      status: "pending",
    });
    if (!cacheEntry) {
      throw new Error(
        "No pending persona found for reroll. Generate a persona first."
      );
    }
    const currentRerollCount = (cacheEntry as any).rerollCount || 0;
    if (currentRerollCount >= 3) {
      throw new Error("Maximum rerolls (3) reached. Cannot reroll further.");
    }

    // Generate new full persona with assets
    const newFullPersona = await generateFullPersonaWithAssets(evmAddress, 10);

    // Update cache entry
    cacheEntry.persona = newFullPersona;
    (cacheEntry as any).generatedImageUrl = newFullPersona.runpodImageUrl;
    (cacheEntry as any).ipfsImageUrl = newFullPersona.ipfsImageUrl;
    (cacheEntry as any).metadataIpfsUrl = newFullPersona.metadataIpfsUrl;
    (cacheEntry as any).rerollCount = currentRerollCount + 1;
    cacheEntry.updatedAt = new Date();
    await cacheEntry.save();

    const rerollsRemaining = 3 - (currentRerollCount + 1);
    logger.info(
      `Rerolled persona for ${evmAddress}: ${newFullPersona.name} (${rerollsRemaining} rerolls remaining), with new assets.`
    );

    return {
      persona: newFullPersona,
      rerollsRemaining,
    };
  } catch (error) {
    logger.error("Error rerolling persona:", error);
    throw error;
  }
}

/**
 * Get reroll count for a user
 */
export async function getRerollCount(
  evmAddress: string
): Promise<{ currentRerolls: number; rerollsRemaining: number }> {
  try {
    const cacheEntry = await NFTCache.findOne({
      evmAddress,
      status: "pending",
    });
    const currentRerolls = (cacheEntry as any)?.rerollCount || 0;
    const rerollsRemaining = Math.max(0, 3 - currentRerolls);

    return {
      currentRerolls,
      rerollsRemaining,
    };
  } catch (error) {
    logger.error("Error getting reroll count:", error);
    throw error;
  }
}

/**
 * Get persona from cache by EVM address
 */
export async function getPersonaFromCache(
  evmAddress: string
): Promise<GeneratedPersona | null> {
  try {
    const cacheEntry = await NFTCache.findOne({
      evmAddress,
      status: "pending",
    });
    if (!cacheEntry?.persona) {
      return null;
    }

    // Ensure all expected fields are present, including new IPFS/RunPod URLs
    // The persona object in the cache should now be a full GeneratedPersona
    const persona = cacheEntry.persona as GeneratedPersona;
    return persona;
  } catch (error) {
    logger.error("Error getting persona from cache:", error);
    throw error;
  }
}
