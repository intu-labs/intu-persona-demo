import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { logger } from "../utils/logger.js";
import { ImageStorageService } from "./imageStorageService.js";
import { ProfilePromptBuilder } from "./promptEngineering/profilePromptBuilder.js";
import { GeneratedPersona } from "./personaGenerator.js";
import { IpfsService, IpfsUploadResult } from "./ipfsService.js";

export interface ImageGenerationConfig {
  width?: number;
  height?: number;
  steps?: number;
  denoise?: number;
  sampler?: string;
  noiseSeed?: number;
  batchSize?: number;
  loraName?: string;
  loraStrength?: number;
  outputPrefix?: string;
  promptOverride?: string;
}

export interface FullImageResult {
  success: boolean;
  runpodImageUrl?: string;
  ipfsImageUrl?: string;
  error?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  images: any[];
  error?: string;
}

export interface ImageGenerationQueue {
  evmAddress: string;
  persona: GeneratedPersona;
  imageType: "profile" | "background" | "lifestyle";
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

const DEFAULT_CONFIG: ImageGenerationConfig = {
  width: 512,
  height: 768,
  steps: 20,
  denoise: 1.0,
  sampler: "euler",
  noiseSeed: Math.floor(Math.random() * 1000000000000000),
  batchSize: 1,
  loraName: "Kodak Motion Picture Film style v1.safetensors",
  loraStrength: 1.0,
  outputPrefix: "persona",
};

// Embedded workflow template to avoid path issues
const PERSONA_WORKFLOW_TEMPLATE = {
  "6": {
    inputs: {
      text: "{{PROMPT}}",
      clip: ["39", 0],
    },
    class_type: "CLIPTextEncode",
    _meta: {
      title: "CLIP Text Encode (Positive Prompt)",
    },
  },
  "8": {
    inputs: {
      samples: ["13", 0],
      vae: ["10", 0],
    },
    class_type: "VAEDecode",
    _meta: {
      title: "VAE Decode",
    },
  },
  "9": {
    inputs: {
      filename_prefix: "{{OUTPUT_PREFIX}}",
      images: ["8", 0],
    },
    class_type: "SaveImage",
    _meta: {
      title: "Save Image",
    },
  },
  "10": {
    inputs: {
      vae_name: "flux_vae.safetensors",
    },
    class_type: "VAELoader",
    _meta: {
      title: "Load VAE",
    },
  },
  "13": {
    inputs: {
      noise: ["25", 0],
      guider: ["22", 0],
      sampler: ["16", 0],
      sigmas: ["17", 0],
      latent_image: ["27", 0],
    },
    class_type: "SamplerCustomAdvanced",
    _meta: {
      title: "SamplerCustomAdvanced",
    },
  },
  "16": {
    inputs: {
      sampler_name: "euler",
    },
    class_type: "KSamplerSelect",
    _meta: {
      title: "KSamplerSelect",
    },
  },
  "17": {
    inputs: {
      scheduler: "simple",
      steps: 20,
      denoise: 1,
      model: ["30", 0],
    },
    class_type: "BasicScheduler",
    _meta: {
      title: "BasicScheduler",
    },
  },
  "22": {
    inputs: {
      model: ["30", 0],
      conditioning: ["26", 0],
    },
    class_type: "BasicGuider",
    _meta: {
      title: "BasicGuider",
    },
  },
  "25": {
    inputs: {
      noise_seed: "12",
    },
    class_type: "RandomNoise",
    _meta: {
      title: "RandomNoise",
    },
  },
  "26": {
    inputs: {
      guidance: 3.5,
      conditioning: ["6", 0],
    },
    class_type: "FluxGuidance",
    _meta: {
      title: "FluxGuidance",
    },
  },
  "27": {
    inputs: {
      width: "512",
      height: "768",
      batch_size: "1",
    },
    class_type: "EmptySD3LatentImage",
    _meta: {
      title: "EmptySD3LatentImage",
    },
  },
  "30": {
    inputs: {
      max_shift: 1.15,
      base_shift: 0.5,
      width: "512",
      height: "768",
      model: ["43", 0],
    },
    class_type: "ModelSamplingFlux",
    _meta: {
      title: "ModelSamplingFlux",
    },
  },
  "39": {
    inputs: {
      clip_name1: "clip_l.safetensors",
      clip_name2: "t5xxl_fp8_e4m3fn.safetensors",
      type: "flux",
    },
    class_type: "DualCLIPLoader",
    _meta: {
      title: "DualCLIP Loader",
    },
  },

  "43": {
    inputs: {
      model_path: "svdq-int4-flux.1-dev",
      cache_threshold: 0.12,
      attention: "nunchaku-fp16",
      cpu_offload: "enable",
      device_id: 0,
      data_type: "bfloat16",
    },
    class_type: "NunchakuFluxDiTLoader",
    _meta: {
      title: "Nunchaku Flux DiT Loader",
    },
  },
};

export class ImageGenerator {
  private readonly runpodApiUrl =
    process.env.RUNPOD_API_URL || "https://api.runpod.ai/v2/zmnfofu5rdi3zm/run";
  private readonly runpodStatusUrlBase =
    process.env.RUNPOD_STATUS_URL_BASE ||
    "https://api.runpod.ai/v2/zmnfofu5rdi3zm/status";
  private readonly runpodApiKey =
    process.env.RUNPOD_API_KEY || "YOUR_RUNPOD_API_KEY_HERE";
  private storageService: ImageStorageService;
  private profilePromptBuilder: ProfilePromptBuilder;
  private workflowCache: Map<string, any> = new Map();
  private generationQueue: Map<string, ImageGenerationQueue> = new Map();
  private ipfsService: IpfsService;

  constructor() {
    this.storageService = new ImageStorageService();
    this.profilePromptBuilder = new ProfilePromptBuilder();
    this.ipfsService = new IpfsService();

    if (
      !this.runpodApiKey ||
      this.runpodApiKey === "YOUR_RUNPOD_API_KEY_HERE"
    ) {
      logger.warn(
        "[IMAGE_GEN] RunPod API Key is not configured or using example key. Image generation will be skipped. Set RUNPOD_API_KEY environment variable to your actual RunPod API key."
      );
    } else {
      logger.info(
        "[IMAGE_GEN] RunPod API Key configured successfully. Image generation enabled."
      );
      logger.info(
        `[IMAGE_GEN] Using RunPod API key: ${this.runpodApiKey.substring(
          0,
          8
        )}...`
      );
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info(
        "[IMAGE_GEN] Using embedded workflow template (no file loading required)"
      );
      const ipfsAvailable = await this.ipfsService.isAvailable();
      if (!ipfsAvailable) {
        logger.warn(
          "[IMAGE_GEN] IPFS service is not available. Uploads to IPFS will fail."
        );
      } else {
        logger.info("[IMAGE_GEN] IPFS service is available.");
      }
      logger.info(
        "[IMAGE_GEN] Image generator initialized successfully (RunPod mode for persona images, IPFS uploads enabled)."
      );
    } catch (error) {
      logger.error("[IMAGE_GEN] Error initializing image generator:", error);
      throw error;
    }
  }

  async generateImage(
    personaDetails: GeneratedPersona,
    configOverrides: ImageGenerationConfig = {}
  ): Promise<FullImageResult> {
    logger.info(
      `[IMAGE_GEN] Starting generateImage for persona: ${personaDetails.name}`
    );

    const prompt =
      configOverrides.promptOverride ||
      this.generatePersonaPrompt(personaDetails);
    const evmAddress =
      (personaDetails as any).evmAddress || "unknown_evm_address";

    const finalConfig = { ...DEFAULT_CONFIG, ...configOverrides };
    const workflowName = "persona_image_svdq.json";

    logger.info(
      `[IMAGE_GEN] Preparing RunPod SVDQ image for ${evmAddress} with prompt: "${prompt.substring(
        0,
        100
      )}..."`
    );
    logger.info(
      `[IMAGE_GEN] Using effective config for RunPod SVDQ:`,
      finalConfig
    );
    logger.info(
      `[IMAGE_GEN] RunPod API Key configured: ${
        this.runpodApiKey !== "YOUR_RUNPOD_API_KEY_HERE"
      }`
    );
    logger.info(`[IMAGE_GEN] RunPod API URL: ${this.runpodApiUrl}`);

    let runpodImageUrl: string | undefined = undefined;

    try {
      logger.info(
        `[IMAGE_GEN] Using embedded workflow template: ${workflowName}`
      );
      const workflowTemplateObject = PERSONA_WORKFLOW_TEMPLATE;
      logger.info(`[IMAGE_GEN] Workflow template loaded successfully`);

      // Use template replacement instead of direct node modification
      logger.info(`[IMAGE_GEN] Processing workflow template with values`);
      let workflowTemplateString = JSON.stringify(workflowTemplateObject);

      // Replace template placeholders with actual values
      const templateReplacements = {
        "{{PROMPT}}": prompt,
        "{{OUTPUT_PREFIX}}": finalConfig.outputPrefix || "persona",
        //"{{SEED}}": String(finalConfig.noiseSeed),
        //"{{WIDTH}}": finalConfig.width,
        //"{{HEIGHT}}": finalConfig.height,
        //"{{BATCH_SIZE}}": finalConfig.batchSize,
        //"{{LORA_NAME}}": finalConfig.loraName || "none",
        //"{{LORA_STRENGTH}}": finalConfig.loraStrength || 1,
      };

      // Log the replacements being made
      logger.info(`[IMAGE_GEN] Template replacements:`);
      for (const [placeholder, value] of Object.entries(templateReplacements)) {
        logger.info(`  ${placeholder} -> ${value}`);
        workflowTemplateString = workflowTemplateString.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          String(value)
        );
      }

      const processedWorkflow = JSON.parse(workflowTemplateString);
      const runpodPayload = {
        input: {
          workflow: processedWorkflow,
        },
      };

      logger.info(
        `[IMAGE_GEN] Submitting SVDQ workflow to RunPod for ${evmAddress}.`
      );

      const jobId = await this.submitJobToRunPod(runpodPayload);
      if (!jobId) {
        throw new Error("Failed to submit job to RunPod or get Job ID.");
      }

      logger.info(
        `[IMAGE_GEN] RunPod Job submitted with ID: ${jobId} for ${evmAddress}`
      );
      const runpodResult = await this.pollRunPodForResult(jobId);

      logger.info(
        `[IMAGE_GEN] RunPod result for ${evmAddress} (Job ID ${jobId}):`,
        runpodResult
      );
      if (!runpodResult.success || !runpodResult.imageUrl) {
        throw new Error(
          runpodResult.error ||
            "RunPod job did not return a successful image URL."
        );
      }
      runpodImageUrl = runpodResult.imageUrl;

      logger.info(
        `[IMAGE_GEN] Downloading image from RunPod URL: ${runpodImageUrl} for IPFS upload.`
      );
      const imageResponse = await fetch(runpodImageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download image from RunPod: ${imageResponse.statusText}`
        );
      }
      const imageBuffer = await imageResponse.buffer();

      logger.info(
        `[IMAGE_GEN] Uploading image buffer to IPFS for ${evmAddress}.`
      );
      const ipfsFilename = `persona-${evmAddress}-${Date.now()}.png`;
      const ipfsUpload: IpfsUploadResult = await this.ipfsService.uploadBuffer(
        imageBuffer,
        ipfsFilename
      );
      logger.info(
        `[IMAGE_GEN] Image uploaded to IPFS for ${evmAddress}. IPFS URI: ${ipfsUpload.ipfsUri}`
      );

      // 🐛 DEBUG: Log image generation result
      console.log("🖼️ IMAGE GENERATION RESULT DEBUG:");
      console.log("=".repeat(50));
      console.log("Persona Name:", personaDetails.name);
      console.log("EVM Address:", evmAddress);
      console.log("Generated Prompt:", prompt.substring(0, 200) + "...");
      console.log("RunPod Image URL:", runpodImageUrl);
      console.log("IPFS Image URL:", ipfsUpload.ipfsUri);
      console.log("Image Config Used:", JSON.stringify(finalConfig, null, 2));
      console.log("=".repeat(50));

      return {
        success: true,
        runpodImageUrl: runpodImageUrl,
        ipfsImageUrl: ipfsUpload.ipfsUri,
      };
    } catch (error) {
      logger.error(
        `[IMAGE_GEN] Error in full image generation process for ${evmAddress}:`,
        error
      );
      return {
        success: false,
        runpodImageUrl: runpodImageUrl,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async submitJobToRunPod(payload: any): Promise<string | null> {
    logger.info(`[IMAGE_GEN] Submitting job to RunPod API...`);
    logger.info(`[IMAGE_GEN] API URL: ${this.runpodApiUrl}`);
    logger.info(
      `[IMAGE_GEN] Payload size: ${JSON.stringify(payload).length} characters`
    );

    const requestConfig = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.runpodApiKey}`,
      },
      body: JSON.stringify(payload),
    };

    logger.info(`[IMAGE_GEN] Making POST request to RunPod...`);
    const response = await fetch(this.runpodApiUrl, requestConfig);

    logger.info(`[IMAGE_GEN] RunPod response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `[IMAGE_GEN] RunPod job submission error (${response.status}): ${errorText}`,
        { payload: JSON.stringify(payload).substring(0, 500) }
      );
      throw new Error(
        `RunPod job submission error (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as any;
    logger.info(`[IMAGE_GEN] RunPod job submission initial response:`, data);
    const jobId = data.id || null;
    logger.info(`[IMAGE_GEN] Extracted job ID: ${jobId}`);
    return jobId;
  }

  private async pollRunPodForResult(
    jobId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    logger.info(`[IMAGE_GEN] Starting to poll RunPod for job ${jobId}...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.sleep(intervalMs);
      try {
        const statusUrl = `${this.runpodStatusUrlBase}/${jobId}`;
        const statusResponse = await fetch(statusUrl, {
          headers: {
            Authorization: `Bearer ${this.runpodApiKey}`,
          },
        });

        if (!statusResponse.ok) {
          if (statusResponse.status === 404) {
            logger.warn(
              `[IMAGE_GEN] RunPod job ${jobId} not found (404) on attempt ${attempt}. It might still be initializing or was cleaned up.`
            );
            if (attempt < 5) continue;
            throw new Error(`RunPod job ${jobId} not found (404).`);
          }
          throw new Error(
            `RunPod status check failed (${
              statusResponse.status
            }): ${await statusResponse.text()}`
          );
        }

        const statusData = (await statusResponse.json()) as any;
        logger.info(
          `[IMAGE_GEN] RunPod poll attempt ${attempt} for ${jobId}: Status = ${statusData.status}`
        );

        if (statusData.status === "COMPLETED") {
          if (statusData.output) {
            let imageUrl: string | undefined = undefined;
            if (typeof statusData.output.imageUrl === "string") {
              imageUrl = statusData.output.imageUrl;
            } else if (
              Array.isArray(statusData.output.images) &&
              statusData.output.images.length > 0
            ) {
              const firstImageOutput =
                statusData.output.images[statusData.output.images.length - 1];
              if (typeof firstImageOutput.url === "string")
                imageUrl = firstImageOutput.url;
              else if (typeof firstImageOutput.data === "string")
                imageUrl = firstImageOutput.data;
              else if (firstImageOutput.filename) {
                logger.warn(
                  `[IMAGE_GEN] RunPod job ${jobId} COMPLETED but image output is a filename (${firstImageOutput.filename}), not a direct URL. Ensure your RunPod worker returns a full public URL.`
                );
              }
            } else if (
              typeof statusData.output === "string" &&
              (statusData.output.startsWith("http://") ||
                statusData.output.startsWith("https://"))
            ) {
              imageUrl = statusData.output;
            }

            if (imageUrl) {
              logger.info(
                `[IMAGE_GEN] RunPod SVDQ image generated successfully for ${jobId}: ${imageUrl}`
              );
              return {
                success: true,
                imageUrl: imageUrl,
              };
            } else {
              logger.error(
                `[IMAGE_GEN] RunPod job ${jobId} COMPLETED but no usable image URL found in output. Output:`,
                statusData.output
              );
              throw new Error(
                "RunPod job completed but no usable image URL found in output."
              );
            }
          } else {
            logger.error(
              `[IMAGE_GEN] RunPod job ${jobId} COMPLETED but no output field found. Status data:`,
              statusData
            );
            throw new Error("RunPod job completed but no output data found.");
          }
        } else if (statusData.status === "FAILED") {
          logger.error(
            `[IMAGE_GEN] RunPod job ${jobId} FAILED. Error:`,
            statusData.error || statusData
          );
          throw new Error(
            `RunPod job ${jobId} failed: ${JSON.stringify(
              statusData.error || statusData.status
            )}`
          );
        } else if (
          statusData.status === "IN_QUEUE" ||
          statusData.status === "IN_PROGRESS" ||
          statusData.status === "CANCELLED"
        ) {
          if (attempt === maxAttempts) {
            logger.warn(
              `[IMAGE_GEN] RunPod job ${jobId} timed out while in status: ${statusData.status}`
            );
            throw new Error(
              `RunPod job ${jobId} did not complete within ${maxAttempts} attempts (last status: ${statusData.status}).`
            );
          }
        } else {
          logger.warn(
            `[IMAGE_GEN] RunPod job ${jobId}: Unknown or unhandled status: ${statusData.status}. Full data:`,
            statusData
          );
          if (attempt === maxAttempts) {
            throw new Error(
              `RunPod job ${jobId} ended with unhandled status ${statusData.status} after ${maxAttempts} attempts.`
            );
          }
        }
      } catch (error: any) {
        logger.error(
          `[IMAGE_GEN] Error on RunPod poll attempt ${attempt} for ${jobId}:`,
          error.message
        );
        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }
    throw new Error(
      `RunPod job ${jobId} polling loop exited unexpectedly after ${maxAttempts} attempts.`
    );
  }

  async generateProfileImages(
    evmAddress: string,
    persona: GeneratedPersona
  ): Promise<ImageGenerationResult> {
    logger.warn(
      "[IMAGE_GEN] generateProfileImages is not currently configured for RunPod SVDQ. It may use local ComfyUI/storage if previously set up."
    );
    return {
      success: false,
      images: [],
      error:
        "generateProfileImages with RunPod SVDQ not implemented in this pass.",
    };
  }

  getQueueStatus(evmAddress?: string): ImageGenerationQueue[] {
    const allQueues = Array.from(this.generationQueue.values());
    if (evmAddress) {
      return allQueues.filter((queue) => queue.evmAddress === evmAddress);
    }
    return allQueues;
  }

  async isComfyUIAvailable(): Promise<boolean> {
    if (!this.runpodApiKey || this.runpodApiKey === "YOUR_RUNPOD_API_KEY_HERE")
      return false;
    try {
      const response = await fetch(
        this.runpodApiUrl.replace("/run", "/health"),
        {
          headers: { Authorization: `Bearer ${this.runpodApiKey}` },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getComfyUIQueueStatus(): Promise<{
    queue_running: any[];
    queue_pending: any[];
  }> {
    logger.warn(
      "[IMAGE_GEN] getComfyUIQueueStatus is for local ComfyUI, not applicable to RunPod endpoint directly."
    );
    return { queue_running: [], queue_pending: [] };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  generatePersonaPrompt(personaData: any): string {
    const name = personaData.name || "Character";
    const gender = personaData.gender || "person";
    const appearance = personaData.appearance || "average looking";
    const region = personaData.region || "an undisclosed location";
    const accessory = personaData.accessory || "no specific accessory";

    let prompt = `High-quality digital painting of ${name}, a ${appearance.toLowerCase()} ${gender.toLowerCase()}`;
    if (
      region &&
      region.toLowerCase() !== "unknown" &&
      region.toLowerCase() !== "none"
    ) {
      if (region === "Moon") {
        prompt += ` from the Moon, depicted with subtle futuristic astronautical elements or a lunar landscape background`;
      } else {
        prompt += ` from ${region}, subtly incorporating ${region.toLowerCase()} cultural aesthetics or background details`;
      }
    }
    if (
      accessory &&
      accessory.toLowerCase() !== "unknown" &&
      accessory.toLowerCase() !== "none"
    ) {
      prompt += `, wearing a distinctive ${accessory.toLowerCase()}`;
    }
    prompt +=
      ". Style: photorealistic with a touch of Kodak film grain, cinematic lighting, sharp focus, vibrant yet natural colors, detailed character design.";
    prompt += " Shot: Close-up portrait or medium shot.";
    logger.info(
      `[IMAGE_GEN] Generated persona prompt: "${prompt.substring(0, 200)}..."`
    );
    return prompt;
  }

  private async loadWorkflows(): Promise<void> {
    try {
      const workflowsDir = path.join(
        process.cwd(),
        "..",
        "comfyui-custom",
        "Workflows"
      );
      logger.info(
        `[IMAGE_GEN] Attempting to load workflows from: ${workflowsDir}`
      );
      try {
        const files = await fs.readdir(workflowsDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const filePath = path.join(workflowsDir, file);
            const content = await fs.readFile(filePath, "utf-8");
            const workflow = JSON.parse(content);
            this.workflowCache.set(file, workflow);
            logger.debug(`[IMAGE_GEN] Loaded workflow: ${file}`);
          }
        }
        logger.info(
          `[IMAGE_GEN] Loaded ${this.workflowCache.size} workflows from ${workflowsDir}`
        );
        if (
          this.workflowCache.size === 0 ||
          !this.workflowCache.has("persona_image_svdq.json")
        ) {
          logger.error(
            `[IMAGE_GEN] CRITICAL: 'persona_image_svdq.json' NOT found in ${workflowsDir}. Ensure it exists.`
          );
        }
      } catch (dirError: any) {
        if (dirError.code === "ENOENT") {
          logger.error(
            `[IMAGE_GEN] CRITICAL: Workflows directory NOT FOUND: ${workflowsDir}. Please ensure it exists and contains workflow JSON files (especially 'persona_image_svdq.json').`
          );
        } else {
          throw dirError;
        }
      }
    } catch (error) {
      logger.error("[IMAGE_GEN] Error loading workflows:", error);
      throw error;
    }
  }

  private async getWorkflow(filename: string): Promise<any> {
    if (!this.workflowCache.has(filename)) {
      logger.warn(
        `[IMAGE_GEN] Workflow ${filename} not in cache. Attempting to reload all workflows.`
      );
      await this.loadWorkflows();
      if (!this.workflowCache.has(filename)) {
        throw new Error(
          `Workflow ${filename} not found after reload. Check path and ensure it was loaded during initialization. Expected in: ../comfyui-custom/Workflows/`
        );
      }
    }
    return JSON.parse(JSON.stringify(this.workflowCache.get(filename)));
  }

  private generateRandomSeed(): number {
    return Math.floor(Math.random() * 1000000000000000);
  }

  private updateQueueStatus(
    queueId: string,
    status: ImageGenerationQueue["status"],
    error?: string
  ): void {
    const queue = this.generationQueue.get(queueId);
    if (queue) {
      queue.status = status;
      if (status === "completed" || status === "failed") {
        queue.completedAt = new Date();
      }
      if (error) {
        queue.error = error;
      }
      this.generationQueue.set(queueId, queue);
    }
  }

  cleanupQueue(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000;
    for (const [queueId, queue] of this.generationQueue.entries()) {
      if (now - queue.createdAt.getTime() > maxAge) {
        this.generationQueue.delete(queueId);
      }
    }
  }

  async getStorageStats(): Promise<{
    totalObjects: number;
    totalSize: number;
  }> {
    if (
      this.storageService &&
      typeof this.storageService.getStorageStats === "function"
    ) {
      try {
        return await this.storageService.getStorageStats();
      } catch (err) {
        logger.warn(
          "[IMAGE_GEN] Failed to get storage stats, MinIO might not be configured for this mode."
        );
        return { totalObjects: 0, totalSize: 0 };
      }
    }
    return { totalObjects: 0, totalSize: 0 };
  }
}

export const imageGenerator = new ImageGenerator();
