import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * Get all suppliers for a project
 */
router.get("/:id/suppliers", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching suppliers", { projectId: id });

    // Get all assets for this project with their suppliers
    logger.db("SELECT", "assets", { projectId: id });
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, name, supplier_id")
      .eq("project_id", id)
      .not("supplier_id", "is", null);

    if (assetsError) {
      logger.error("Error fetching assets", assetsError, { projectId: id });
      return res.status(500).json({ error: assetsError.message });
    }

    if (!assets || assets.length === 0) {
      logger.info("No assets found for project", { projectId: id });
      return res.json([]);
    }

    // Get unique supplier IDs
    const supplierIds = [...new Set(assets.map(a => a.supplier_id).filter(Boolean))];

    if (supplierIds.length === 0) {
      logger.info("No suppliers linked to assets", { projectId: id });
      return res.json([]);
    }

    // Fetch suppliers
    logger.db("SELECT", "suppliers", { projectId: id, supplierIds });
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*")
      .in("id", supplierIds)
      .order("created_at", { ascending: true });

    if (suppliersError) {
      logger.error("Error fetching suppliers", suppliersError, { projectId: id });
      return res.status(500).json({ error: suppliersError.message });
    }

    // Map suppliers to their linked assets
    const suppliersWithAssets = (suppliers || []).map((supplier: any) => {
      const linkedAssets = assets
        .filter(a => a.supplier_id === supplier.id)
        .map(a => ({ id: a.id, name: a.name }));
      
      return {
        ...supplier,
        asset_suppliers: linkedAssets.map(asset => ({
          asset_id: asset.id,
          assets: asset,
        })),
      };
    });

    logger.info("Suppliers fetched successfully", { 
      projectId: id, 
      count: suppliersWithAssets.length 
    });
    res.json(suppliersWithAssets);
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/suppliers", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all generated files for a project
 */
router.get("/:id/generated-files", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching generated files", { projectId: id });

    logger.db("SELECT", "generated_files", { projectId: id });
    const { data, error } = await supabase
      .from("generated_files")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Error fetching generated files", error, { projectId: id });
      return res.status(500).json({ error: error.message });
    }

    logger.info("Generated files fetched successfully", { 
      projectId: id, 
      count: data?.length || 0 
    });
    res.json(data || []);
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/generated-files", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get TCO calculations for a project
 */
router.get("/:id/tco", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching TCO calculations", { projectId: id });

    // Try to get TCO calculations - handle case where created_at might not exist
    logger.db("SELECT", "tco_calculations", { projectId: id });
    let query = supabase
      .from("tco_calculations")
      .select("*")
      .eq("project_id", id);

    // Try ordering by created_at if it exists, otherwise just get the first one
    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      if (error.code === "PGRST116" || error.code === "42703") {
        // Table doesn't exist or column doesn't exist - return null
        logger.warn("TCO calculations not found or table doesn't exist", { 
          projectId: id, 
          errorCode: error.code 
        });
        return res.json(null);
      }
      logger.error("Error fetching TCO calculations", error, { projectId: id });
      return res.status(500).json({ error: error.message });
    }

    logger.info("TCO calculations fetched successfully", { projectId: id, hasData: !!data });
    res.json(data);
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/tco", error, { projectId: req.params.id });
    // Return null on any error to prevent frontend crashes
    res.json(null);
  }
});

export default router;

