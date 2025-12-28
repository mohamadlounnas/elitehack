import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.get("/:id/assets", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching assets:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    console.error("Error in GET /projects/:id/assets:", error);
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

export default router;

