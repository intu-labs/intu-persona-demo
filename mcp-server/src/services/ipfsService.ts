import fetch, { Response } from "node-fetch";
import FormData from "form-data";
import { logger } from "../utils/logger.js";

export interface IpfsUploadResult {
  cid: string; // This will be the IpfsHash from Pinata
  ipfsUri: string; // ipfs://<cid>
  publicGatewayUrl: string; // e.g., https://gateway.pinata.cloud/ipfs/<cid>
}

interface PinataPinResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

export class IpfsService {
  private readonly pinataJwt: string | undefined;
  private readonly pinataApiUrl = "https://api.pinata.cloud";
  private readonly pinataGatewayUrl = "https://gateway.pinata.cloud/ipfs";

  constructor() {
    this.pinataJwt = process.env.PINATA_JWT;
    if (!this.pinataJwt) {
      logger.warn(
        "[IPFS_PINATA] PINATA_JWT environment variable is not set. IPFS uploads via Pinata will fail."
      );
    }
  }

  private async handlePinataResponse(
    response: Response,
    operation: string
  ): Promise<PinataPinResponse> {
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        `[IPFS_PINATA] Pinata API error during ${operation} (${response.status}): ${errorBody}`
      );
      throw new Error(
        `Pinata API error (${response.status}) during ${operation}: ${response.statusText} - ${errorBody}`
      );
    }
    return (await response.json()) as PinataPinResponse;
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string
  ): Promise<IpfsUploadResult> {
    if (!this.pinataJwt) {
      throw new Error("Pinata JWT is not configured. Cannot upload buffer.");
    }

    const formData = new FormData();
    formData.append("file", buffer, { filename });

    // Optional: Pinata options for metadata or pinning behavior
    // const metadata = JSON.stringify({ name: filename, keyvalues: { uploadedBy: 'mcp-server' } });
    // formData.append('pinataMetadata', metadata);
    // const options = JSON.stringify({ cidVersion: 0 }); // or 1
    // formData.append('pinataOptions', options);

    try {
      logger.info(`[IPFS_PINATA] Uploading buffer for file: ${filename}`);
      const response = await fetch(
        `${this.pinataApiUrl}/pinning/pinFileToIPFS`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.pinataJwt}`,
            // FormData adds its own Content-Type with boundary
          },
          body: formData,
        }
      );

      const result = await this.handlePinataResponse(response, "file upload");
      const cid = result.IpfsHash;
      logger.info(
        `[IPFS_PINATA] Buffer successfully uploaded. CID: ${cid}, Filename: ${filename}`
      );
      return {
        cid,
        ipfsUri: `ipfs://${cid}`,
        publicGatewayUrl: `${
          this.pinataGatewayUrl
        }/${cid}?filename=${encodeURIComponent(filename)}`,
      };
    } catch (error) {
      logger.error(
        `[IPFS_PINATA] Error uploading buffer to Pinata for ${filename}:`,
        error
      );
      throw error;
    }
  }

  async uploadJson(
    jsonData: Record<string, any>,
    filename: string = "metadata.json" // Default filename for JSON metadata
  ): Promise<IpfsUploadResult> {
    if (!this.pinataJwt) {
      throw new Error("Pinata JWT is not configured. Cannot upload JSON.");
    }

    const payload = {
      pinataMetadata: {
        name: filename,
      },
      pinataContent: jsonData,
    };
    // Optional: Pinata options
    // const options = { cidVersion: 1 };
    // payload.pinataOptions = options;

    try {
      logger.info(`[IPFS_PINATA] Uploading JSON data for: ${filename}`);
      const response = await fetch(
        `${this.pinataApiUrl}/pinning/pinJSONToIPFS`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.pinataJwt}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await this.handlePinataResponse(response, "JSON upload");
      const cid = result.IpfsHash;
      logger.info(
        `[IPFS_PINATA] JSON data successfully uploaded. CID: ${cid}, Filename: ${filename}`
      );
      return {
        cid,
        ipfsUri: `ipfs://${cid}`,
        publicGatewayUrl: `${
          this.pinataGatewayUrl
        }/${cid}?filename=${encodeURIComponent(filename)}`,
      };
    } catch (error) {
      logger.error(
        `[IPFS_PINATA] Error uploading JSON to Pinata for ${filename}:`,
        error
      );
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.pinataJwt) {
      logger.warn(
        "[IPFS_PINATA] Pinata JWT not set, service considered unavailable."
      );
      return false;
    }
    try {
      logger.debug("[IPFS_PINATA] Testing Pinata authentication...");
      const response = await fetch(
        `${this.pinataApiUrl}/data/testAuthentication`,
        {
          headers: {
            Authorization: `Bearer ${this.pinataJwt}`,
          },
        }
      );
      if (response.ok) {
        const testResult: any = await response.json();
        logger.info(
          "[IPFS_PINATA] Pinata authentication successful:",
          testResult.message
        );
        return true;
      } else {
        const errorText = await response.text();
        logger.warn(
          `[IPFS_PINATA] Pinata authentication test failed (${response.status}): ${errorText}`
        );
        return false;
      }
    } catch (error) {
      logger.error(
        "[IPFS_PINATA] Error during Pinata authentication test:",
        error
      );
      return false;
    }
  }
}
