/**
 * Meshy3D API Service
 * Handles 3D model generation from images using Meshy.ai API
 */

import axios, { AxiosInstance } from "axios";
import { logger } from "../utils/logger.js";

interface MeshyCreateTaskResponse {
  result?: string;
  id?: string;
}

interface MeshyStatusResponse {
  status: "PROCESSING" | "SUCCEEDED" | "FAILED";
  progress?: number;
  model_urls?: {
    glb?: string;
  };
  model_url?: string;
  task_error?: {
    message?: string;
  } | string;
}

export class Meshy3DService {
  private apiKey: string;
  private apiUrl: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = process.env.MESHY_API_KEY || "";
    this.apiUrl = process.env.MESHY_API_URL || "https://api.meshy.ai";

    if (!this.apiKey) {
      logger.warn("Meshy3D API key not configured. 3D model generation will not work.");
    }

    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 60000,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Load image and convert to base64 data URI
   */
  private async loadImageAsDataUri(imageUrl: string): Promise<string> {
    try {
      // If it's already a data URI, clean it up and return
      if (imageUrl.startsWith("data:")) {
        // Remove any newlines, carriage returns, or extra whitespace
        const cleaned = imageUrl.replace(/\n/g, "").replace(/\r/g, "").replace(/\s+/g, "");
        
        // Validate the format
        if (!cleaned.match(/^data:image\/[^;]+;base64,[A-Za-z0-9+/=]+$/)) {
          throw new Error(`Invalid data URI format: ${imageUrl.substring(0, 100)}...`);
        }
        
        logger.info(`Using existing data URI (cleaned): ${cleaned.length} characters`);
        return cleaned;
      }

      let imageBytes: Buffer;

      // If it's a local path (starts with /tmp/ or tmp/)
      if (imageUrl.startsWith("/tmp/") || imageUrl.startsWith("tmp/")) {
        const fs = await import("fs/promises");
        const path = await import("path");
        const imagePath = path.join(process.cwd(), imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl);
        imageBytes = await fs.readFile(imagePath);
        logger.info(`Loaded image from ${imagePath}: ${imageBytes.length} bytes`);
      }
      // If it's a URL served by the backend (localhost with /tmp/)
      else if (imageUrl.includes("/tmp/") && (imageUrl.startsWith("http://localhost") || imageUrl.startsWith("http://127.0.0.1"))) {
        // Extract the path and read from local filesystem
        const urlPath = new URL(imageUrl).pathname;
        const fs = await import("fs/promises");
        const path = await import("path");
        const imagePath = path.join(process.cwd(), urlPath.startsWith("/") ? urlPath.slice(1) : urlPath);
        imageBytes = await fs.readFile(imagePath);
        logger.info(`Loaded image from local server path ${imagePath}: ${imageBytes.length} bytes`);
      }
      // If it's an external URL, download it
      else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 30000,
        });
        imageBytes = Buffer.from(response.data);
        logger.info(`Downloaded image from ${imageUrl}: ${imageBytes.length} bytes`);
      } else {
        throw new Error(`Invalid image URL format: ${imageUrl.substring(0, 100)}...`);
      }

      // Detect MIME type from image bytes or use default
      let mimeType = "image/jpeg";
      if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47) {
        mimeType = "image/png";
      } else if (imageBytes[0] === 0xFF && imageBytes[1] === 0xD8) {
        mimeType = "image/jpeg";
      } else if (imageBytes[0] === 0x47 && imageBytes[1] === 0x49 && imageBytes[2] === 0x46) {
        mimeType = "image/gif";
      } else if (imageBytes[0] === 0x52 && imageBytes[1] === 0x49 && imageBytes[2] === 0x46 && imageBytes[8] === 0x57 && imageBytes[9] === 0x45 && imageBytes[10] === 0x42 && imageBytes[11] === 0x50) {
        mimeType = "image/webp";
      }

      const base64 = imageBytes.toString("base64");
      return `data:${mimeType};base64,${base64}`;
    } catch (error: any) {
      logger.error("Error loading image", error, { imageUrl: imageUrl.substring(0, 100) });
      throw new Error(`Failed to load image: ${error.message}`);
    }
  }

  /**
   * Create a 3D model generation task
   * @param imageUrl URL or path to the image
   * @returns Task ID from Meshy
   */
  async createTask(imageUrl: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Meshy3D API key not configured");
    }

    try {
      // Load and encode image as base64
      const imageDataUri = await this.loadImageAsDataUri(imageUrl);

      // Create image-to-3d task with Meshy.ai v1 API
      const createPayload = {
        image_url: imageDataUri,
        enable_pbr: true,
      };

      logger.info("Creating 3D model task via Meshy.ai...");

      const response = await this.client.post<MeshyCreateTaskResponse>(
        "/v1/image-to-3d",
        createPayload
      );

      if (response.status !== 200 && response.status !== 201 && response.status !== 202) {
        throw new Error(`Failed to create 3D task: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      const taskId = response.data.result || response.data.id;

      if (!taskId) {
        throw new Error(`No task ID returned from Meshy.ai API: ${JSON.stringify(response.data)}`);
      }

      logger.info(`Created 3D task ${taskId}`);
      return taskId;
    } catch (error: any) {
      logger.error("Error creating Meshy3D task", error);
      if (error.response) {
        throw new Error(`Meshy3D API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Check the status of a 3D model generation task
   * @param taskId Task ID from Meshy
   * @returns Status information including model URL if ready
   */
  async checkStatus(taskId: string): Promise<MeshyStatusResponse> {
    if (!this.apiKey) {
      throw new Error("Meshy3D API key not configured");
    }

    try {
      const response = await this.client.get<MeshyStatusResponse>(
        `/v1/image-to-3d/${taskId}`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to check task status: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error("Error checking Meshy3D status", error, { taskId });
      if (error.response) {
        throw new Error(`Meshy3D API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Download GLB file from Meshy URL
   * @param glbUrl URL to the GLB file
   * @returns Buffer containing the GLB file data
   */
  async downloadGLB(glbUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(glbUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download GLB: ${response.status}`);
      }

      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error("Error downloading GLB", error, { glbUrl });
      throw new Error(`Failed to download GLB: ${error.message}`);
    }
  }
}

export const meshy3dService = new Meshy3DService();

