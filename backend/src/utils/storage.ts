/**
 * Supabase Storage utilities
 */

import { supabase } from "./supabase.js";
import { logger } from "./logger.js";
import { Buffer } from "buffer";
import fs from "fs/promises";
import path from "path";

const STORAGE_BUCKET = "project-files"; // Bucket name for project files

/**
 * Upload image data URL or buffer to Supabase Storage
 * @param projectId - Project ID
 * @param filename - Filename for the image
 * @param imageData - Either a data URL (data:image/png;base64,...) or a Buffer
 * @param contentType - MIME type (default: image/png)
 * @param subdirectory - Optional subdirectory (default: "videos")
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToStorage(
  projectId: string,
  filename: string,
  imageData: string | Buffer,
  contentType: string = "image/png",
  subdirectory: string = "videos"
): Promise<string> {
  try {
    let buffer: Buffer;

    // Handle data URL
    if (typeof imageData === "string" && imageData.startsWith("data:")) {
      const base64Data = imageData.split(",")[1];
      if (!base64Data) {
        throw new Error("Invalid data URL format");
      }
      buffer = Buffer.from(base64Data, "base64");
    } else if (imageData instanceof Buffer) {
      buffer = imageData;
    } else {
      throw new Error("Invalid image data format");
    }

    // Create path: {subdirectory}/{projectId}/{filename}
    const filePath = `${subdirectory}/${projectId}/${filename}`;

    // Try using Supabase client first (handles auth better)
    // The supabase client is already initialized with service role key
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      // If Supabase client fails, try REST API as fallback
      logger.warn("Supabase client upload failed, trying REST API", {
        error: uploadError.message,
        errorDetails: uploadError,
      });

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error("Missing Supabase credentials for storage upload");
      }

      // Try REST API with proper endpoint format
      // Supabase Storage API: POST /storage/v1/object/{bucket}/{path}
      // URL encode the path properly
      const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '/');
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          "apikey": supabaseServiceRoleKey,
          "Content-Type": contentType,
          "x-upsert": "true",
          "Cache-Control": "public, max-age=3600",
        },
        body: buffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        let errorMessage = `Upload failed with status ${uploadResponse.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        // Provide helpful error message if bucket doesn't exist
        if (errorMessage.includes("Bucket not found") || 
            errorMessage.includes("does not exist") ||
            errorMessage.includes("BucketNotFound")) {
          const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
          const dashboardUrl = projectRef 
            ? `https://supabase.com/dashboard/project/${projectRef}/storage/buckets`
            : "https://supabase.com/dashboard";
          
          throw new Error(
            `Storage bucket '${STORAGE_BUCKET}' does not exist.\n\n` +
            `Please create it manually:\n` +
            `1. Go to: ${dashboardUrl}\n` +
            `2. Click "New bucket"\n` +
            `3. Name it: ${STORAGE_BUCKET}\n` +
            `4. Set it to PUBLIC\n` +
            `5. Set file size limit to 10MB (optional)\n\n` +
            `After creating the bucket, restart the server.`
          );
        }

        // Both Supabase methods failed
        // For video generation, we MUST use Supabase Storage (Kie.ai can't access localhost)
        // So we throw an error instead of falling back to file system
        logger.error("Both Supabase Storage methods failed - cannot use file system fallback for video generation", {
          clientError: uploadError?.message,
          restError: errorMessage,
          restStatus: uploadResponse.status,
          restStatusText: uploadResponse.statusText,
          bucket: STORAGE_BUCKET,
          filePath: filePath,
        });
        
        // Provide detailed error message with troubleshooting steps
        throw new Error(
          `Failed to upload to Supabase Storage.\n\n` +
          `Client Error: ${uploadError?.message}\n` +
          `REST API Error: ${errorMessage} (Status: ${uploadResponse.status})\n\n` +
          `Troubleshooting:\n` +
          `1. Verify SUPABASE_SERVICE_ROLE_KEY is correct\n` +
          `2. Check storage bucket '${STORAGE_BUCKET}' exists and is public\n` +
          `3. Verify RLS policies allow service_role to INSERT\n` +
          `4. Check Supabase project status and storage quota\n\n` +
          `Note: File system fallback cannot be used for video generation as external services (Kie.ai) need publicly accessible URLs.`
        );
      }
    }

    // Get public URL using Supabase client
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl || `${process.env.SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filePath}`;

    logger.info("Image uploaded to Supabase Storage", {
      projectId,
      filename,
      path: filePath,
      url: publicUrl,
    });

    return publicUrl;
  } catch (error: any) {
    logger.error("Error in uploadImageToStorage", error);
    throw error;
  }
}

/**
 * Update bucket allowed MIME types
 * This can be called to add new MIME types to an existing bucket
 */
export async function updateBucketMimeTypes(): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.warn("Missing Supabase credentials. Cannot update bucket MIME types.");
      return;
    }

    const apiUrl = `${supabaseUrl}/storage/v1/bucket/${STORAGE_BUCKET}`;
    
    // Update bucket to allow GLB MIME types
    const updateResponse = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "apikey": supabaseServiceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allowed_mime_types: [
          "image/png", 
          "image/jpeg", 
          "image/jpg", 
          "image/webp", 
          "image/gif", 
          "model/gltf+binary", 
          "model/gltf+json", 
          "application/octet-stream"
        ],
      }),
    });

    if (updateResponse.ok) {
      logger.info(`Bucket MIME types updated successfully: ${STORAGE_BUCKET}`);
    } else {
      const errorData = await updateResponse.json().catch(() => ({ message: updateResponse.statusText })) as { message?: string; error?: string };
      logger.warn("Cannot update bucket MIME types automatically.", {
        bucketName: STORAGE_BUCKET,
        status: updateResponse.status,
        error: errorData.message || errorData.error || "Unknown error",
      });
    }
  } catch (error: any) {
    logger.warn("Error updating bucket MIME types", {
      error: error.message,
      bucketName: STORAGE_BUCKET,
    });
  }
}

/**
 * Check if storage bucket exists, create if not
 * Uses REST API with service role key to bypass RLS restrictions
 */
export async function ensureStorageBucket(): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.warn("Missing Supabase credentials. Cannot create storage bucket.");
      return;
    }

    // Use REST API directly with service role key to bypass RLS
    const apiUrl = `${supabaseUrl}/storage/v1/bucket`;
    
    // First, check if bucket exists
    const listResponse = await fetch(`${apiUrl}?id=${STORAGE_BUCKET}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "apikey": supabaseServiceRoleKey,
      },
    });

    if (listResponse.ok) {
      const bucket = await listResponse.json() as { name?: string } | null;
      if (bucket && bucket.name === STORAGE_BUCKET) {
        logger.info(`Storage bucket exists: ${STORAGE_BUCKET}`);
        return;
      }
    }

    // Bucket doesn't exist, create it
    logger.info(`Storage bucket '${STORAGE_BUCKET}' not found. Attempting to create...`);
    
    const createResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "apikey": supabaseServiceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: STORAGE_BUCKET,
        name: STORAGE_BUCKET,
        public: true,
        file_size_limit: 10485760, // 10MB
        allowed_mime_types: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "model/gltf+binary", "model/gltf+json", "application/octet-stream"],
      }),
    });

    if (createResponse.ok) {
      logger.info(`Storage bucket created successfully: ${STORAGE_BUCKET}`);
    } else {
      const errorData = await createResponse.json().catch(() => ({ message: createResponse.statusText })) as { message?: string; error?: string };
      logger.warn("Cannot create storage bucket automatically.", {
        bucketName: STORAGE_BUCKET,
        status: createResponse.status,
        error: errorData.message || errorData.error || "Unknown error",
      });
      logger.info("Please create the bucket manually in Supabase Dashboard:");
      logger.info("1. Go to Supabase Dashboard > Storage");
      logger.info(`2. Click 'New bucket' and name it: ${STORAGE_BUCKET}`);
      logger.info("3. Set it to PUBLIC");
      logger.info("4. Set file size limit to 10MB (optional)");
    }
  } catch (error: any) {
    logger.warn("Error checking/creating storage bucket", {
      error: error.message,
      bucketName: STORAGE_BUCKET,
    });
    logger.info("The server will continue, but image uploads will fail until the bucket is created.");
    // Don't throw - allow server to start, uploads will handle the error
  }
}

