import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";

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

    // Try to get TCO calculations
    logger.db("SELECT", "tco_calculations", { projectId: id });
    
    // Use maybeSingle() to handle cases where no record exists gracefully
    // Don't use order() to avoid potential column issues - just get the first one
    const { data, error } = await supabase
      .from("tco_calculations")
      .select("*")
      .eq("project_id", id)
      .limit(1)
      .maybeSingle();

    if (error) {
      // Handle specific Supabase error codes
      if (error.code === "PGRST116") {
        // No rows found - this is normal, not an error
        logger.info("No TCO calculations found for project", { projectId: id });
        return res.json(null);
      }
      
      if (error.code === "42703") {
        // Column doesn't exist - log warning but return null
        logger.warn("TCO calculations table schema issue", { 
          projectId: id, 
          errorCode: error.code,
          errorMessage: error.message 
        });
        return res.json(null);
      }

      // Extract error details properly for logging
      const errorDetails = {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      };
      
      logger.error("Error fetching TCO calculations", new Error(JSON.stringify(errorDetails)), { 
        projectId: id,
        errorCode: error.code,
        errorMessage: error.message 
      });
      
      // Return null instead of error to prevent frontend crashes
      // The frontend should handle null gracefully
      return res.json(null);
    }

    logger.info("TCO calculations fetched successfully", { projectId: id, hasData: !!data });
    res.json(data);
  } catch (error: any) {
    // Extract error details for better logging
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'object' 
        ? JSON.stringify(error) 
        : String(error);
    
    logger.error("Error in GET /projects/:id/tco", new Error(errorMessage), { 
      projectId: req.params.id 
    });
    
    // Return null on any error to prevent frontend crashes
    res.json(null);
  }
});

/**
 * Get cost analysis PDF report for a project
 */
router.get("/:id/cost-analysis-pdf", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching cost analysis PDF", { projectId: id });

    // Get project to find PDF path
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("cost_analysis_pdf")
      .eq("id", id)
      .single();

    if (projectError || !project || !project.cost_analysis_pdf) {
      logger.warn("Cost analysis PDF not found", { projectId: id });
      return res.status(404).json({ error: "PDF report not found" });
    }

    // Construct file path
    const pdfPath = path.join(process.cwd(), project.cost_analysis_pdf);

    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      logger.warn("PDF file does not exist on filesystem", { projectId: id, path: pdfPath });
      return res.status(404).json({ error: "PDF file not found" });
    }

    // Read and send PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cost_analysis_report_${id}.pdf"`);
    res.send(pdfBuffer);

    logger.info("Cost analysis PDF served successfully", { projectId: id });
  } catch (error: any) {
    logger.error("Error serving cost analysis PDF", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get business plan Excel file for a project
 */
router.get("/:id/business-plan-excel", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching business plan Excel", { projectId: id });

    // Get project to find Excel path
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("business_plan_excel")
      .eq("id", id)
      .single();

    if (projectError || !project || !project.business_plan_excel) {
      logger.warn("Business plan Excel not found", { projectId: id });
      return res.status(404).json({ error: "Excel file not found" });
    }

    // Construct file path
    const excelPath = path.join(process.cwd(), project.business_plan_excel);

    // Check if file exists
    if (!fs.existsSync(excelPath)) {
      logger.warn("Excel file does not exist on filesystem", { projectId: id, path: excelPath });
      return res.status(404).json({ error: "Excel file not found" });
    }

    // Read and send Excel
    const excelBuffer = fs.readFileSync(excelPath);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="business_plan_${id}.xlsx"`);
    res.send(excelBuffer);

    logger.info("Business plan Excel served successfully", { projectId: id });
  } catch (error: any) {
    logger.error("Error serving business plan Excel", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

export default router;

