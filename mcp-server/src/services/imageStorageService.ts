import { Client as MinIOClient } from "minio";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

export interface ImageUploadResult {
  uri: string;
  filename: string;
  bucket: string;
  objectName: string;
}

export class ImageStorageService {
  private minioClient: MinIOClient;
  private bucketName: string;

  constructor() {
    this.minioClient = new MinIOClient({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT || "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    });
    this.bucketName = process.env.MINIO_BUCKET || "persona-images";
  }

  /**
   * Initialize storage (create bucket if needed)
   */
  async initialize(): Promise<void> {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName);
        logger.info(`[STORAGE] Created bucket: ${this.bucketName}`);
      }
    } catch (error) {
      logger.error("[STORAGE] Error initializing storage:", error);
      throw error;
    }
  }

  /**
   * Upload profile images for a user
   */
  async uploadProfileImages(
    evmAddress: string,
    images: Buffer[]
  ): Promise<ImageUploadResult[]> {
    logger.info(
      `[STORAGE] Uploading ${images.length} profile images for ${evmAddress}`
    );

    const results: ImageUploadResult[] = [];

    for (let i = 0; i < images.length; i++) {
      const filename = `profile-${i + 1}-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")}.png`;
      const objectName = `profile-images/${evmAddress}/${filename}`;

      try {
        await this.minioClient.putObject(
          this.bucketName,
          objectName,
          images[i],
          images[i].length,
          {
            "Content-Type": "image/png",
            "X-Amz-Meta-Type": "profile-image",
            "X-Amz-Meta-Evm-Address": evmAddress,
            "X-Amz-Meta-Created": new Date().toISOString(),
          }
        );

        const uri = await this.getImageUri(objectName);

        results.push({
          uri,
          filename,
          bucket: this.bucketName,
          objectName,
        });

        logger.debug(`[STORAGE] Uploaded profile image: ${objectName}`);
      } catch (error) {
        logger.error(`[STORAGE] Error uploading profile image ${i}:`, error);
        throw error;
      }
    }

    logger.info(
      `[STORAGE] Successfully uploaded ${results.length} profile images`
    );
    return results;
  }

  /**
   * Upload background images for a user
   */
  async uploadBackgroundImages(
    evmAddress: string,
    images: Buffer[]
  ): Promise<ImageUploadResult[]> {
    logger.info(
      `[STORAGE] Uploading ${images.length} background images for ${evmAddress}`
    );

    const results: ImageUploadResult[] = [];

    for (let i = 0; i < images.length; i++) {
      const filename = `background-${i + 1}-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")}.png`;
      const objectName = `background-images/${evmAddress}/${filename}`;

      try {
        await this.minioClient.putObject(
          this.bucketName,
          objectName,
          images[i],
          images[i].length,
          {
            "Content-Type": "image/png",
            "X-Amz-Meta-Type": "background-image",
            "X-Amz-Meta-Evm-Address": evmAddress,
            "X-Amz-Meta-Created": new Date().toISOString(),
          }
        );

        const uri = await this.getImageUri(objectName);

        results.push({
          uri,
          filename,
          bucket: this.bucketName,
          objectName,
        });

        logger.debug(`[STORAGE] Uploaded background image: ${objectName}`);
      } catch (error) {
        logger.error(`[STORAGE] Error uploading background image ${i}:`, error);
        throw error;
      }
    }

    logger.info(
      `[STORAGE] Successfully uploaded ${results.length} background images`
    );
    return results;
  }

  /**
   * Upload lifestyle images for a user
   */
  async uploadLifestyleImages(
    evmAddress: string,
    images: Buffer[]
  ): Promise<ImageUploadResult[]> {
    logger.info(
      `[STORAGE] Uploading ${images.length} lifestyle images for ${evmAddress}`
    );

    const results: ImageUploadResult[] = [];

    for (let i = 0; i < images.length; i++) {
      const filename = `lifestyle-${i + 1}-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")}.png`;
      const objectName = `lifestyle-images/${evmAddress}/${filename}`;

      try {
        await this.minioClient.putObject(
          this.bucketName,
          objectName,
          images[i],
          images[i].length,
          {
            "Content-Type": "image/png",
            "X-Amz-Meta-Type": "lifestyle-image",
            "X-Amz-Meta-Evm-Address": evmAddress,
            "X-Amz-Meta-Created": new Date().toISOString(),
          }
        );

        const uri = await this.getImageUri(objectName);

        results.push({
          uri,
          filename,
          bucket: this.bucketName,
          objectName,
        });

        logger.debug(`[STORAGE] Uploaded lifestyle image: ${objectName}`);
      } catch (error) {
        logger.error(`[STORAGE] Error uploading lifestyle image ${i}:`, error);
        throw error;
      }
    }

    logger.info(
      `[STORAGE] Successfully uploaded ${results.length} lifestyle images`
    );
    return results;
  }

  /**
   * Upload a single persona image
   */
  async uploadPersonaImage(
    evmAddress: string,
    imageBuffer: Buffer
  ): Promise<ImageUploadResult> {
    logger.info(`[STORAGE] Uploading persona image for ${evmAddress}`);

    const filename = `persona-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}.png`;
    // Store persona images in a specific top-level folder within the bucket for easier management
    const objectName = `persona-images/${evmAddress}/${filename}`;

    try {
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        imageBuffer,
        imageBuffer.length,
        {
          "Content-Type": "image/png",
          "X-Amz-Meta-Type": "persona-image", // Specific metadata type
          "X-Amz-Meta-Evm-Address": evmAddress,
          "X-Amz-Meta-Created": new Date().toISOString(),
        }
      );

      const uri = await this.getImageUri(objectName);

      const result: ImageUploadResult = {
        uri,
        filename,
        bucket: this.bucketName,
        objectName,
      };

      logger.debug(`[STORAGE] Uploaded persona image: ${objectName} to ${uri}`);
      return result;
    } catch (error) {
      logger.error(
        `[STORAGE] Error uploading persona image for ${evmAddress}:`,
        error
      );
      throw error; // Re-throw to be handled by the caller
    }
  }

  /**
   * Get a presigned URL for an image
   */
  async getImageUri(
    objectName: string,
    expiry: number = 24 * 60 * 60
  ): Promise<string> {
    try {
      const url = await this.minioClient.presignedGetObject(
        this.bucketName,
        objectName,
        expiry
      );
      return url;
    } catch (error) {
      logger.error("[STORAGE] Error generating presigned URL:", error);
      throw error;
    }
  }

  /**
   * Delete images for a user (cleanup after NFT minting)
   */
  async deleteUserImages(evmAddress: string): Promise<void> {
    logger.info(`[STORAGE] Deleting images for user: ${evmAddress}`);

    try {
      const prefixes = [
        `profile-images/${evmAddress}/`,
        `background-images/${evmAddress}/`,
        `lifestyle-images/${evmAddress}/`,
      ];

      for (const prefix of prefixes) {
        const objectsList = this.minioClient.listObjects(
          this.bucketName,
          prefix,
          true
        );
        const objectsToDelete: string[] = [];

        for await (const obj of objectsList) {
          if (obj.name) {
            objectsToDelete.push(obj.name);
          }
        }

        if (objectsToDelete.length > 0) {
          await this.minioClient.removeObjects(
            this.bucketName,
            objectsToDelete
          );
          logger.info(
            `[STORAGE] Deleted ${objectsToDelete.length} objects with prefix: ${prefix}`
          );
        }
      }

      logger.info(
        `[STORAGE] Successfully deleted all images for user: ${evmAddress}`
      );
    } catch (error) {
      logger.error("[STORAGE] Error deleting user images:", error);
      throw error;
    }
  }

  /**
   * Cleanup expired images (TTL-based cleanup)
   */
  async cleanupExpiredImages(maxAgeHours: number = 24): Promise<void> {
    logger.info(
      `[STORAGE] Starting cleanup of images older than ${maxAgeHours} hours`
    );

    try {
      const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const objectsList = this.minioClient.listObjects(
        this.bucketName,
        "",
        true
      );
      const objectsToDelete: string[] = [];

      for await (const obj of objectsList) {
        if (obj.name && obj.lastModified && obj.lastModified < cutoffDate) {
          objectsToDelete.push(obj.name);
        }
      }

      if (objectsToDelete.length > 0) {
        await this.minioClient.removeObjects(this.bucketName, objectsToDelete);
        logger.info(
          `[STORAGE] Cleaned up ${objectsToDelete.length} expired images`
        );
      } else {
        logger.info("[STORAGE] No expired images found");
      }
    } catch (error) {
      logger.error("[STORAGE] Error during cleanup:", error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalObjects: number;
    totalSize: number;
  }> {
    try {
      const objectsList = this.minioClient.listObjects(
        this.bucketName,
        "",
        true
      );
      let totalObjects = 0;
      let totalSize = 0;

      for await (const obj of objectsList) {
        totalObjects++;
        totalSize += obj.size || 0;
      }

      return { totalObjects, totalSize };
    } catch (error) {
      logger.error("[STORAGE] Error getting storage stats:", error);
      throw error;
    }
  }
}
