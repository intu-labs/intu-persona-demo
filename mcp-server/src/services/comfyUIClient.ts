import fetch from "node-fetch";
import { logger } from "../utils/logger.js";

export interface ComfyUIWorkflowParams {
  prompt: string;
  width: number;
  height: number;
  seed: number;
  loraName: string;
  loraStrength: number;
  batchSize: number;
  outputPrefix: string;
}

export interface ComfyUIResponse {
  promptId: string;
  number: number;
  nodeErrors?: Record<string, any>;
}

export interface ComfyUIImage {
  filename: string;
  subfolder: string;
  type: string;
}

export interface ComfyUIHistoryItem {
  prompt: any[];
  outputs: Record<string, { images: ComfyUIImage[] }>;
  status: {
    status_str: string;
    completed: boolean;
    messages: any[];
  };
}

export class ComfyUIClient {
  private baseUrl: string;
  private timeout: number;

  constructor(
    baseUrl: string = "http://localhost:8188",
    timeout: number = 300000
  ) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Check if ComfyUI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/system_stats`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.debug("ComfyUI not available:", error);
      return false;
    }
  }

  /**
   * Execute a workflow with parameters
   */
  async executeWorkflow(
    workflow: any,
    params: Partial<ComfyUIWorkflowParams>
  ): Promise<ComfyUIResponse> {
    logger.info(`[COMFYUI] Executing workflow with params:`, {
      prompt: params.prompt
        ? params.prompt.substring(0, 100) + "..."
        : undefined,
      width: params.width,
      height: params.height,
      seed: params.seed,
      loraName: params.loraName,
      batchSize: params.batchSize,
    });

    try {
      // Replace template variables in workflow
      const processedWorkflow = this.replaceWorkflowVariables(workflow, params);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: processedWorkflow,
          client_id: `mcp-server-${Date.now()}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ComfyUI API error (${response.status}): ${errorText}`);
      }

      const result = (await response.json()) as ComfyUIResponse;
      logger.info(
        `[COMFYUI] Workflow queued with prompt ID: ${result.promptId}`
      );

      return result;
    } catch (error) {
      logger.error("[COMFYUI] Error executing workflow:", error);
      throw error;
    }
  }

  /**
   * Wait for workflow completion and get results
   */
  async waitForCompletion(
    promptId: string,
    maxWaitTime: number = 300000
  ): Promise<ComfyUIHistoryItem> {
    logger.info(`[COMFYUI] Waiting for completion of prompt ID: ${promptId}`);

    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const history = await this.getHistory(promptId);
        if (history) {
          if (history.status.completed) {
            logger.info(`[COMFYUI] Workflow completed: ${promptId}`);
            return history;
          } else if (history.status.status_str === "error") {
            throw new Error(
              `Workflow failed: ${JSON.stringify(history.status.messages)}`
            );
          }
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        logger.error(`[COMFYUI] Error polling for completion:`, error);
        throw error;
      }
    }

    throw new Error(`Workflow timed out after ${maxWaitTime}ms`);
  }

  /**
   * Get workflow history/status
   */
  async getHistory(promptId: string): Promise<ComfyUIHistoryItem | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl}/history/${promptId}`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Prompt not found yet
        }
        throw new Error(
          `History API error (${response.status}): ${await response.text()}`
        );
      }

      const data = (await response.json()) as Record<
        string,
        ComfyUIHistoryItem
      >;
      return data[promptId] || null;
    } catch (error) {
      logger.error("[COMFYUI] Error getting history:", error);
      throw error;
    }
  }

  /**
   * Download generated image
   */
  async downloadImage(image: ComfyUIImage): Promise<Buffer> {
    try {
      const url = `${this.baseUrl}/view?filename=${encodeURIComponent(
        image.filename
      )}&subfolder=${encodeURIComponent(
        image.subfolder
      )}&type=${encodeURIComponent(image.type)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Image download error (${response.status}): ${await response.text()}`
        );
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      logger.error("[COMFYUI] Error downloading image:", error);
      throw error;
    }
  }

  /**
   * Execute workflow and wait for completion
   */
  async generateImages(
    workflow: any,
    params: Partial<ComfyUIWorkflowParams>
  ): Promise<Buffer[]> {
    logger.info(
      `[COMFYUI] Starting image generation with ${
        params.batchSize || "default"
      } images`
    );

    // Execute workflow
    const execution = await this.executeWorkflow(workflow, params);

    // Wait for completion
    const history = await this.waitForCompletion(execution.promptId);

    // Extract images from outputs
    const images: Buffer[] = [];
    for (const nodeId in history.outputs) {
      const nodeOutput = history.outputs[nodeId];
      if (nodeOutput.images) {
        for (const image of nodeOutput.images) {
          const imageBuffer = await this.downloadImage(image);
          images.push(imageBuffer);
        }
      }
    }

    logger.info(`[COMFYUI] Generated ${images.length} images successfully`);
    return images;
  }

  /**
   * Replace template variables in workflow JSON
   */
  private replaceWorkflowVariables(
    workflow: any,
    params: Partial<ComfyUIWorkflowParams>
  ): any {
    let workflowStr = JSON.stringify(workflow);

    if (params.prompt)
      workflowStr = workflowStr.replace(/\{\{PROMPT\}\}/g, params.prompt);
    if (params.width)
      workflowStr = workflowStr.replace(
        /\{\{WIDTH\}\}/g,
        params.width.toString()
      );
    if (params.height)
      workflowStr = workflowStr.replace(
        /\{\{HEIGHT\}\}/g,
        params.height.toString()
      );
    if (params.seed)
      workflowStr = workflowStr.replace(
        /\{\{SEED\}\}/g,
        params.seed.toString()
      );
    if (params.loraName)
      workflowStr = workflowStr.replace(/\{\{LORA_NAME\}\}/g, params.loraName);
    if (params.loraStrength)
      workflowStr = workflowStr.replace(
        /\{\{LORA_STRENGTH\}\}/g,
        params.loraStrength.toString()
      );
    if (params.batchSize)
      workflowStr = workflowStr.replace(
        /\{\{BATCH_SIZE\}\}/g,
        params.batchSize.toString()
      );
    if (params.outputPrefix)
      workflowStr = workflowStr.replace(
        /\{\{OUTPUT_PREFIX\}\}/g,
        params.outputPrefix
      );
    // Add more replacements here if new {{PLACEHOLDERS}} are introduced and params extended

    return JSON.parse(workflowStr);
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    queue_running: any[];
    queue_pending: any[];
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl}/queue`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Queue API error (${response.status}): ${await response.text()}`
        );
      }

      const data = (await response.json()) as {
        queue_running: any[];
        queue_pending: any[];
      };
      return data;
    } catch (error) {
      logger.error("[COMFYUI] Error getting queue status:", error);
      throw error;
    }
  }
}
