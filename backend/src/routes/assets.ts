import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import { uploadImageToStorage } from "../utils/storage.js";

const router = Router();

router.get("/:id/assets", async (req, res) => {
  try {
    const { id } = req.params;

    // Exclude image_url to avoid loading large data URLs in list view
    const { data, error } = await supabase
      .from("assets")
      .select("id, project_id, supplier_id, name, type, appearance, description, specifications, image_generated, selected_for_processing, meshy_id, model_url, created_at, updated_at")
      .eq("project_id", id)
      .order("created_at", { ascending: true })
      .limit(1000); // Add limit to prevent large result sets

    if (error) {
      logger.error("Error fetching assets", error, { projectId: id });
      // Check if it's a timeout error
      if (error.message?.includes("timeout") || error.message?.includes("canceling statement")) {
        return res.status(504).json({ 
          error: "Query timeout. Please try again.",
          message: error.message 
        });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/assets", error, { projectId: req.params.id });
    if (error.message?.includes("timeout") || error.message?.includes("canceling statement")) {
      return res.status(504).json({ 
        error: "Query timeout. Please try again.",
        message: error.message 
      });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /projects/:id/select-assets
 * Save which assets are selected for processing
 */
router.post("/:id/select-assets", async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { assetIds } = req.body;

    if (!Array.isArray(assetIds)) {
      return res.status(400).json({ error: "assetIds must be an array" });
    }

    logger.info("Saving selected assets", { projectId, selectedCount: assetIds.length });

    // First, mark all assets as not selected
    const { error: deselectError } = await supabase
      .from("assets")
      .update({ selected_for_processing: false })
      .eq("project_id", projectId);

    if (deselectError) {
      logger.error("Error deselecting all assets", deselectError, { projectId });
      return res.status(500).json({ error: deselectError.message });
    }

    // Then, mark selected assets
    if (assetIds.length > 0) {
      const { error: selectError } = await supabase
        .from("assets")
        .update({ selected_for_processing: true })
        .eq("project_id", projectId)
        .in("id", assetIds);

      if (selectError) {
        logger.error("Error selecting assets", selectError, { projectId, assetIds });
        return res.status(500).json({ error: selectError.message });
      }
    }

    logger.info("Asset selection saved successfully", { projectId, selectedCount: assetIds.length });
    res.json({ success: true, selectedCount: assetIds.length });
  } catch (error: any) {
    logger.error("Error in POST /projects/:id/select-assets", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /projects/:id/selected-assets
 * Get only the assets selected for processing
 */
router.get("/:id/selected-assets", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", id)
      .eq("selected_for_processing", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching selected assets:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    console.error("Error in GET /projects/:id/selected-assets:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /projects/:id/assets/:assetId
 * Get a single asset with image (for detail view)
 */
router.get("/:id/assets/:assetId", async (req, res) => {
  try {
    const { id: projectId, assetId } = req.params;

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .single();

    if (error) {
      logger.error("Error fetching asset", error, { projectId, assetId });
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Asset not found" });
      }
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.json(data);
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/assets/:assetId", error, { projectId: req.params.id, assetId: req.params.assetId });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /projects/:id/assets/:assetId/generate-3d
 * Generate a 3D model for an asset using Meshy3D API
 */
router.post("/:id/assets/:assetId/generate-3d", async (req, res) => {
  try {
    // Lazy import to avoid module loading issues
    const { meshy3dService } = await import("../services/meshy3dService.js");
    
    const { id: projectId, assetId } = req.params;

    logger.info("Generating 3D model for asset", { projectId, assetId });

    // Get the asset to find its image
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .single();

    if (assetError || !asset) {
      logger.error("Asset not found", assetError, { projectId, assetId });
      return res.status(404).json({ error: "Asset not found" });
    }

    if (!asset.image_url) {
      return res.status(400).json({ error: "Asset must have an image to generate 3D model" });
    }

    // Check if task already exists
    if (asset.meshy_id) {
      return res.status(400).json({ 
        error: "3D model generation already in progress",
        meshy_id: asset.meshy_id 
      });
    }

    // Create Meshy3D task
    const taskId = await meshy3dService.createTask(asset.image_url);

    // Update asset with meshy_id
    const { error: updateError } = await supabase
      .from("assets")
      .update({ meshy_id: taskId })
      .eq("id", assetId);

    if (updateError) {
      logger.error("Error updating asset with meshy_id", updateError, { assetId, taskId });
      return res.status(500).json({ error: "Failed to save task ID" });
    }

    logger.info("3D model generation task created", { assetId, taskId });
    res.json({ success: true, meshy_id: taskId });
  } catch (error: any) {
    logger.error("Error in POST /projects/:id/assets/:assetId/generate-3d", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /projects/:id/assets/:assetId/check-3d-status
 * Check the status of 3D model generation
 */
router.get("/:id/assets/:assetId/check-3d-status", async (req, res) => {
  try {
    // Lazy import to avoid module loading issues
    const { meshy3dService } = await import("../services/meshy3dService.js");
    
    const { id: projectId, assetId } = req.params;

    // Get the asset
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .single();

    if (assetError || !asset) {
      logger.error("Asset not found", assetError, { projectId, assetId });
      return res.status(404).json({ error: "Asset not found" });
    }

    if (!asset.meshy_id) {
      return res.status(400).json({ error: "No 3D model generation task found for this asset" });
    }

    // Check status with Meshy3D
    const status = await meshy3dService.checkStatus(asset.meshy_id);

    // If succeeded, download and upload GLB file
    if (status.status === "SUCCEEDED") {
      const glbUrl = status.model_urls?.glb || status.model_url;
      
      if (glbUrl && !asset.model_url) {
        try {
          // Download GLB file
          const glbBuffer = await meshy3dService.downloadGLB(glbUrl);
          
          // Upload to Supabase Storage
          const filename = `asset_${assetId}_model.glb`;
          let modelUrl: string;
          
          try {
            // Try with model/gltf+binary first (standard GLB MIME type)
            modelUrl = await uploadImageToStorage(
              projectId,
              filename,
              glbBuffer,
              "model/gltf+binary", // Standard GLB MIME type
              "models"
            );
          } catch (uploadError: any) {
            // If that fails, try application/octet-stream
            try {
              logger.warn("Failed with model/gltf+binary, trying application/octet-stream", { assetId });
              modelUrl = await uploadImageToStorage(
                projectId,
                filename,
                glbBuffer,
                "application/octet-stream",
                "models"
              );
            } catch (secondError: any) {
              // If both Supabase attempts fail, try local storage service
              try {
                logger.warn("Both Supabase upload attempts failed, trying local storage service", { 
                  assetId, 
                  firstError: uploadError.message,
                  secondError: secondError.message
                });
                
                // Upload to local storage service (localhost:3333)
                const storageServerUrl = process.env.STORAGE_SERVER_URL || "http://localhost:3333";
                const formData = new FormData();
                const blob = new Blob([glbBuffer], { type: "model/gltf+binary" });
                formData.append("file", blob, filename);

                const storageResponse = await fetch(`${storageServerUrl}/api/v1/tmp/upload`, {
                  method: "POST",
                  body: formData,
                });

                if (!storageResponse.ok) {
                  throw new Error(`Storage service upload failed: ${storageResponse.statusText}`);
                }

                const storageResult = await storageResponse.json() as { url: string };
                modelUrl = storageResult.url;
                
                logger.info("GLB file uploaded to local storage service", { assetId, modelUrl });
              } catch (storageError: any) {
                // If all upload methods fail, use Meshy URL as fallback and save it to database
                logger.warn("All upload attempts failed, using Meshy URL as fallback", { 
                  assetId, 
                  glbUrl,
                  firstError: uploadError.message,
                  secondError: secondError.message,
                  storageError: storageError.message
                });
                
                // Save Meshy URL to database as fallback
                const { error: updateError } = await supabase
                  .from("assets")
                  .update({ model_url: glbUrl })
                  .eq("id", assetId);

                if (updateError) {
                  logger.error("Error saving Meshy URL as fallback", updateError, { assetId });
                } else {
                  logger.info("Saved Meshy URL as fallback", { assetId, glbUrl });
                }

                return res.json({
                  status: "SUCCEEDED",
                  progress: 100,
                  model_url: glbUrl, // Return Meshy URL as fallback
                });
              }
            }
          }

          // Update asset with model_url
          const { error: updateError } = await supabase
            .from("assets")
            .update({ model_url: modelUrl })
            .eq("id", assetId);

          if (updateError) {
            logger.error("Error updating asset with model_url", updateError, { assetId });
            // Still return success with the uploaded URL
            return res.json({
              status: "SUCCEEDED",
              progress: 100,
              model_url: modelUrl,
            });
          }

          logger.info("3D model uploaded and saved", { assetId, modelUrl });
          return res.json({
            status: "SUCCEEDED",
            progress: 100,
            model_url: modelUrl,
          });
        } catch (downloadError: any) {
          logger.error("Error downloading/uploading GLB", downloadError, { assetId, glbUrl });
          
          // Save Meshy URL to database as fallback
          const { error: updateError } = await supabase
            .from("assets")
            .update({ model_url: glbUrl })
            .eq("id", assetId);

          if (updateError) {
            logger.error("Error saving Meshy URL as fallback", updateError, { assetId });
          } else {
            logger.info("Saved Meshy URL as fallback after download error", { assetId, glbUrl });
          }
          
          // Return success with Meshy URL as fallback
          return res.json({
            status: "SUCCEEDED",
            progress: 100,
            model_url: glbUrl,
          });
        }
      } else if (asset.model_url) {
        // Model already uploaded
        return res.json({
          status: "SUCCEEDED",
          progress: 100,
          model_url: asset.model_url,
        });
      }
    }

    // Return status
    res.json({
      status: status.status,
      progress: status.progress || 0,
      model_url: asset.model_url || null,
    });
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/assets/:assetId/check-3d-status", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

