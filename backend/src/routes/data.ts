import { Router } from "express";
import { supabase, supabaseQueryWithRetry } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import { fullReportGenerator } from "../services/fullReportGenerator.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// Initialize Gemini AI for realistic renders
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

const router = Router();

/**
 * Get all suppliers for a project
 */
router.get("/:id/suppliers", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching suppliers", { projectId: id });

    // Get all assets for this project
    logger.db("SELECT", "assets", { projectId: id });
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, name")
      .eq("project_id", id);

    if (assetsError) {
      logger.error("Error fetching assets", assetsError, { projectId: id });
      return res.status(500).json({ error: assetsError.message });
    }

    if (!assets || assets.length === 0) {
      logger.info("No assets found for project", { projectId: id });
      return res.json([]);
    }

    const assetIds = assets.map(a => a.id);

    // Get all supplier relationships from asset_suppliers junction table
    logger.db("SELECT", "asset_suppliers", { projectId: id, assetIds });
    const { data: assetSuppliers, error: assetSuppliersError } = await supabase
      .from("asset_suppliers")
      .select("supplier_id, asset_id")
      .in("asset_id", assetIds);

    if (assetSuppliersError) {
      logger.error("Error fetching asset_suppliers", assetSuppliersError, { projectId: id });
      return res.status(500).json({ error: assetSuppliersError.message });
    }

    if (!assetSuppliers || assetSuppliers.length === 0) {
      logger.info("No supplier relationships found", { projectId: id });
      return res.json([]);
    }

    // Get unique supplier IDs from the junction table
    const supplierIds = [...new Set(assetSuppliers.map((as: any) => as.supplier_id).filter(Boolean))];

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

    // Map suppliers to their linked assets using the junction table
    const suppliersWithAssets = (suppliers || []).map((supplier: any) => {
      const linkedAssetIds = assetSuppliers
        .filter((as: any) => as.supplier_id === supplier.id)
        .map((as: any) => as.asset_id);
      
      const linkedAssets = assets
        .filter(a => linkedAssetIds.includes(a.id))
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
    const { data, error } = await supabaseQueryWithRetry<any[]>(() =>
      supabase
        .from("generated_files")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: true })
    );

    if (error) {
      logger.error("Error fetching generated files", error, { projectId: id });
      return res.status(500).json({ error: error.message });
    }

    logger.info("Generated files fetched successfully", { 
      projectId: id, 
      count: Array.isArray(data) ? data.length : 0 
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
 * Generate reports (PDF and Excel) for a project
 */
router.post("/:id/generate-reports", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Starting report generation", { projectId: id });

    // Import cost analysis service dynamically to avoid circular deps
    const { costAnalysisService } = await import("../services/ai/costAnalysisService.js");

    // Run cost analysis which generates both PDF and Excel
    await costAnalysisService.analyzeCostsWithStream(id, (update) => {
      // Log progress but don't stream
      logger.debug("Report generation progress", { 
        projectId: id, 
        type: update.type, 
        progress: update.progress 
      });
    });

    // Reload project to get updated file paths
    const { data: project, error } = await supabase
      .from("projects")
      .select("cost_analysis_pdf, business_plan_excel")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    logger.info("Report generation complete", { projectId: id });
    res.json({
      success: true,
      cost_analysis_pdf: project?.cost_analysis_pdf,
      business_plan_excel: project?.business_plan_excel,
    });
  } catch (error: any) {
    logger.error("Error generating reports", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
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

/**
 * Generate and download Equipment Catalog PDF
 */
router.get("/:id/equipment-catalog", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Generating equipment catalog PDF", { projectId: id });

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, planning_data, primary_color, secondary_color, logo_url")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      logger.warn("Project not found for catalog generation", { projectId: id });
      return res.status(404).json({ error: "Project not found" });
    }

    // Fetch assets
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (assetsError) {
      logger.error("Error fetching assets for catalog", assetsError, { projectId: id });
      return res.status(500).json({ error: assetsError.message });
    }

    // Fetch suppliers with their asset relationships
    const assetIds = (assets || []).map(a => a.id);
    let suppliers: any[] = [];

    if (assetIds.length > 0) {
      // Get asset_suppliers junction data
      const { data: assetSuppliers, error: asError } = await supabase
        .from("asset_suppliers")
        .select("*")
        .in("asset_id", assetIds);

      if (!asError && assetSuppliers && assetSuppliers.length > 0) {
        const supplierIds = [...new Set(assetSuppliers.map((as: any) => as.supplier_id).filter(Boolean))];
        
        if (supplierIds.length > 0) {
          const { data: suppliersData, error: suppError } = await supabase
            .from("suppliers")
            .select("*")
            .in("id", supplierIds);

          if (!suppError && suppliersData) {
            // Attach asset_suppliers relationships to each supplier
            suppliers = suppliersData.map(s => ({
              ...s,
              asset_suppliers: assetSuppliers.filter((as: any) => as.supplier_id === s.id)
            }));
          }
        }
      }
    }

    // Import the catalog generator dynamically
    const { equipmentCatalogGenerator } = await import("../services/equipmentCatalogGenerator.js");

    // Generate catalog PDF
    const pdfBuffer = await equipmentCatalogGenerator.generateCatalog({
      projectName: project.name,
      factoryName: project.planning_data?.industrial_identity?.factory_name,
      assets: assets || [],
      suppliers,
      primaryColor: project.primary_color,
      secondaryColor: project.secondary_color,
      logoUrl: project.logo_url,
    });

    // Send PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="equipment_catalog_${id}.pdf"`);
    res.send(pdfBuffer);

    logger.info("Equipment catalog PDF generated successfully", { 
      projectId: id, 
      assetCount: assets?.length || 0,
      supplierCount: suppliers.length 
    });
  } catch (error: any) {
    logger.error("Error generating equipment catalog PDF", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export Planning Data as JSON
 */
router.get("/:id/export/planning", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, name, planning_data")
      .eq("id", id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="planning_data_${id}.json"`);
    res.json({
      project_id: project.id,
      project_name: project.name,
      exported_at: new Date().toISOString(),
      planning_data: project.planning_data || {}
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export Assets as CSV
 */
router.get("/:id/export/assets-csv", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: assets, error } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", id)
      .order("created_at");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Generate CSV
    const headers = ["Name", "Type", "Description", "Specifications", "Est. Cost (USD)", "Image URL", "Created At"];
    const rows = (assets || []).map(asset => [
      asset.name || "",
      asset.type || "",
      (asset.description || "").replace(/,/g, ";").replace(/\n/g, " "),
      JSON.stringify(asset.specifications || {}),
      asset.specifications?.estimated_cost_usd || "",
      asset.image_url || "",
      asset.created_at || ""
    ]);

    const csv = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="assets_${id}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export Assets as JSON
 */
router.get("/:id/export/assets-json", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: assets, error } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", id)
      .order("created_at");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="assets_${id}.json"`);
    res.json({
      project_id: id,
      exported_at: new Date().toISOString(),
      total_assets: assets?.length || 0,
      assets: assets || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export Suppliers as CSV
 */
router.get("/:id/export/suppliers-csv", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get suppliers linked to project assets
    const { data: assetSuppliers, error: asError } = await supabase
      .from("asset_suppliers")
      .select("supplier_id, assets!inner(project_id)")
      .eq("assets.project_id", id);

    const supplierIds = [...new Set((assetSuppliers || []).map(as => as.supplier_id))];
    
    if (supplierIds.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="suppliers_${id}.csv"`);
      return res.send("No suppliers found");
    }

    const { data: suppliers, error } = await supabase
      .from("suppliers")
      .select("*")
      .in("id", supplierIds);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Generate CSV
    const headers = ["Name", "Location", "Country", "Website", "Email", "Phone", "Rating", "Verified", "Certifications"];
    const rows = (suppliers || []).map(s => [
      s.name || "",
      s.location || "",
      s.country || "",
      s.website || "",
      s.email || "",
      s.phone || "",
      s.rating || "",
      s.verified ? "Yes" : "No",
      (s.certifications || []).join("; ")
    ]);

    const csv = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="suppliers_${id}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export Suppliers as JSON
 */
router.get("/:id/export/suppliers-json", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: assetSuppliers, error: asError } = await supabase
      .from("asset_suppliers")
      .select("supplier_id, assets!inner(project_id, name)")
      .eq("assets.project_id", id);

    const supplierIds = [...new Set((assetSuppliers || []).map(as => as.supplier_id))];
    
    if (supplierIds.length === 0) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="suppliers_${id}.json"`);
      return res.json({ project_id: id, suppliers: [] });
    }

    const { data: suppliers, error } = await supabase
      .from("suppliers")
      .select("*")
      .in("id", supplierIds);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="suppliers_${id}.json"`);
    res.json({
      project_id: id,
      exported_at: new Date().toISOString(),
      total_suppliers: suppliers?.length || 0,
      suppliers: suppliers || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export Chat/Requirements as JSON
 */
router.get("/:id/export/requirements", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: messages, error } = await supabase
      .from("project_messages")
      .select("*")
      .eq("project_id", id)
      .order("created_at");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Extract requirements from messages
    const requirements = (messages || []).filter(m => m.role === "user").map(m => ({
      timestamp: m.created_at,
      content: m.content,
      attachments: m.attachments || []
    }));

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="requirements_${id}.json"`);
    res.json({
      project_id: id,
      exported_at: new Date().toISOString(),
      total_messages: messages?.length || 0,
      user_requirements: requirements,
      full_conversation: messages || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export TCO/Financial Analysis as JSON
 */
router.get("/:id/export/financial", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: tco, error } = await supabase
      .from("tco_calculations")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(500).json({ error: error.message });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="financial_analysis_${id}.json"`);
    res.json({
      project_id: id,
      exported_at: new Date().toISOString(),
      tco_analysis: tco || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export Complete Project Data (All-in-One)
 */
router.get("/:id/export/complete", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch all project data
    const [projectRes, messagesRes, assetsRes, tcoRes, filesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("project_messages").select("*").eq("project_id", id).order("created_at"),
      supabase.from("assets").select("*").eq("project_id", id),
      supabase.from("tco_calculations").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
      supabase.from("generated_files").select("id, filename, file_type, metadata, created_at").eq("project_id", id),
    ]);

    // Get suppliers
    const assetIds = (assetsRes.data || []).map(a => a.id);
    let suppliers: any[] = [];
    if (assetIds.length > 0) {
      const { data: assetSuppliers } = await supabase
        .from("asset_suppliers")
        .select("supplier_id")
        .in("asset_id", assetIds);
      
      const supplierIds = [...new Set((assetSuppliers || []).map(as => as.supplier_id))];
      if (supplierIds.length > 0) {
        const { data: suppliersData } = await supabase
          .from("suppliers")
          .select("*")
          .in("id", supplierIds);
        suppliers = suppliersData || [];
      }
    }

    const completeExport = {
      export_info: {
        exported_at: new Date().toISOString(),
        format_version: "1.0",
        generator: "Elite Industrial Strategy AI"
      },
      project: projectRes.data,
      planning_data: projectRes.data?.planning_data || {},
      conversation: messagesRes.data || [],
      assets: assetsRes.data || [],
      suppliers: suppliers,
      financial_analysis: tcoRes.data?.[0] || null,
      generated_files: (filesRes.data || []).map(f => ({
        id: f.id,
        filename: f.filename,
        file_type: f.file_type,
        metadata: f.metadata,
        created_at: f.created_at
      }))
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="complete_project_${id}.json"`);
    res.json(completeExport);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate Full Industrial Report (SSE Streaming)
 * Streams progress updates during report generation
 */
router.get("/:id/generate-full-report/stream", async (req, res) => {
  const { id } = req.params;
  logger.info("Starting full report generation stream", { projectId: id });

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent("status", { message: "Starting report generation..." });

    const pdfPath = await fullReportGenerator.generateReport(id, (update) => {
      switch (update.type) {
        case "planning":
          sendEvent("planning", {
            message: update.message,
            progress: update.progress,
            total: update.total,
            tocItems: update.tocItems,
          });
          break;
        case "section":
          sendEvent("section", {
            section: update.section,
            progress: update.progress,
            total: update.total,
          });
          break;
        case "generating":
          sendEvent("generating", {
            message: update.message,
            progress: update.progress,
            total: update.total,
          });
          break;
        case "complete":
          sendEvent("complete", {
            message: update.message,
            progress: 100,
            total: 100,
          });
          break;
        case "error":
          sendEvent("error", {
            message: update.message,
          });
          break;
      }
    });

    // Send final completion with PDF path
    sendEvent("done", {
      success: true,
      pdfPath,
      downloadUrl: `/api/projects/${id}/full-report-pdf`,
    });

    logger.info("Full report generation stream completed", { projectId: id, pdfPath });
  } catch (error: any) {
    logger.error("Error in full report generation stream", error, { projectId: id });
    sendEvent("error", { message: error.message || "Failed to generate report" });
  } finally {
    res.end();
  }
});

/**
 * Generate Full Industrial Report (Non-streaming)
 * Returns the PDF path when complete
 */
router.post("/:id/generate-full-report", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Starting full report generation", { projectId: id });

    const pdfPath = await fullReportGenerator.generateReport(id);

    logger.info("Full report generated", { projectId: id, pdfPath });
    res.json({
      success: true,
      pdfPath,
      downloadUrl: `/api/projects/${id}/full-report-pdf`,
    });
  } catch (error: any) {
    logger.error("Error generating full report", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Download Full Report PDF
 */
router.get("/:id/full-report-pdf", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching full report PDF", { projectId: id });

    // Get project to find PDF path
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("full_report_pdf_url, name")
      .eq("id", id)
      .single();

    if (projectError || !project || !project.full_report_pdf_url) {
      logger.warn("Full report PDF not found", { projectId: id });
      return res.status(404).json({ error: "Full report PDF not found. Please generate it first." });
    }

    // Construct file path
    const pdfPath = path.join(process.cwd(), project.full_report_pdf_url);

    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      logger.warn("PDF file does not exist on filesystem", { projectId: id, path: pdfPath });
      return res.status(404).json({ error: "PDF file not found on server" });
    }

    // Read and send PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const filename = `full_industrial_report_${project.name?.replace(/[^a-z0-9]/gi, '_') || id}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

    logger.info("Full report PDF served successfully", { projectId: id });
  } catch (error: any) {
    logger.error("Error serving full report PDF", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate Realistic Factory Render (SSE Streaming)
 * Generates a photorealistic image based on the floor plan
 */
router.get("/:id/generate-realistic-render/stream", async (req, res) => {
  const { id } = req.params;
  logger.info("Starting realistic render generation", { projectId: id });

  // Setup SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    sendEvent("progress", { message: "Fetching project data..." });

    // Get project and planning data
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, planning_data")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found");
    }

    sendEvent("progress", { message: "Analyzing floor plan layout..." });

    // Get floor plan from generated files
    // First try by layout_type
    let floorPlanFile = null;
    
    const { data: byType } = await supabase
      .from("generated_files")
      .select("*")
      .eq("project_id", id)
      .eq("metadata->>layout_type", "floor_plan")
      .limit(1)
      .maybeSingle();

    if (byType) {
      floorPlanFile = byType;
    } else {
      // Try by filename
      const { data: byFilename } = await supabase
        .from("generated_files")
        .select("*")
        .eq("project_id", id)
        .ilike("filename", "%floor_plan%")
        .limit(1)
        .maybeSingle();
      
      if (byFilename) {
        floorPlanFile = byFilename;
      }
    }

    if (!floorPlanFile) {
      throw new Error("Floor plan not found. Please generate layouts first.");
    }

    sendEvent("progress", { message: "Preparing AI render prompt..." });

    // Extract planning data for context
    const planningData = project.planning_data as any;
    const identity = planningData?.industrial_identity;
    const facility = planningData?.facility_specifications;
    const productionLines = planningData?.production_lines || [];

    // Build comprehensive prompt for realistic rendering
    const factoryName = identity?.brand_name || identity?.company_name || project.name || "Factory";
    const industry = identity?.industry_sector || "manufacturing";
    const dimensions = facility?.dimensions 
      ? `${facility.dimensions.length}m x ${facility.dimensions.width}m` 
      : "large industrial";
    const totalArea = facility?.total_area || 5000;
    const zones = facility?.zones || [];
    
    const prompt = `Create a highly photorealistic architectural visualization of a modern ${industry} factory interior.

Factory Details:
- Name: ${factoryName}
- Industry: ${industry}
- Size: ${dimensions} (${totalArea} sqm total area)
- Production Lines: ${productionLines.length > 0 ? productionLines.map((l: any) => l.name || l.type).join(", ") : "automated production"}
- Zones: ${zones.length > 0 ? zones.map((z: any) => z.name || z.type).join(", ") : "production, storage, shipping"}

Visualization Requirements:
- Photorealistic interior view of the factory floor
- Modern industrial architecture with high ceilings and natural lighting
- Clean, organized workspace with visible production equipment
- Professional lighting with skylights and LED fixtures
- Safety markings and industrial flooring
- Workers in safety gear operating machinery (optional, small scale)
- Atmospheric perspective showing depth and scale
- Photo quality like a professional architectural photography shot
- Wide angle view showing the scale of the facility
- Modern, clean, state-of-the-art facility aesthetic

Style: Professional architectural visualization, photorealistic, magazine quality
Camera: Wide angle interior shot, eye-level perspective
Lighting: Natural daylight from skylights mixed with industrial LED lighting
Quality: Ultra high detail, 8K quality, photorealistic rendering

DO NOT include any text, labels, measurements, or 2D elements.
DO NOT mix 2D floor plan elements with 3D visualization.
Create a PURE photorealistic 3D interior visualization as if photographed by a professional camera.`;

    sendEvent("progress", { message: "Generating photorealistic render with AI..." });

    // Check if Gemini AI is configured
    if (!genAI) {
      throw new Error("Gemini AI is not configured. Please set GEMINI_API_KEY in environment variables.");
    }

    // Use Gemini 2.5 Flash Image model (same as imageGenerationService)
    const model = genAI.getGenerativeModel({
      model: "models/gemini-3-pro-image-preview",
    });

    sendEvent("progress", { message: "Rendering factory visualization..." });

    // Generate the image
    const result = await model.generateContent(prompt);
    const response = result.response;

    let imageUrl = "";

    // Extract image from response (same pattern as imageGenerationService)
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const candidate = candidates[0];
      const content = candidate.content;
      const parts = content.parts;

      if (parts && parts.length > 0) {
        for (const part of parts) {
          if ("inlineData" in part && part.inlineData) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || "image/png";
            imageUrl = `data:${mimeType};base64,${imageData}`;
            break;
          }
        }
      }
    }

    if (!imageUrl) {
      throw new Error("Failed to generate image. The AI model did not return an image. Please try again.");
    }

    sendEvent("progress", { message: "Finalizing render..." });

    // Optionally save the image to the project
    const { error: saveError } = await supabase
      .from("generated_files")
      .insert({
        project_id: id,
        filename: `realistic_render_${Date.now()}.png`,
        file_type: "image/png",
        file_path: imageUrl,
        metadata: {
          type: "realistic_render",
          layout_type: "realistic_factory_view",
          generated_at: new Date().toISOString(),
        },
      });

    if (saveError) {
      logger.warn("Failed to save realistic render", { projectId: id, error: saveError });
    }

    sendEvent("complete", { 
      imageUrl,
      message: "Realistic factory render generated successfully!"
    });

    logger.info("Realistic render generated successfully", { projectId: id });
  } catch (error: any) {
    logger.error("Error generating realistic render", error, { projectId: id });
    sendEvent("error", { message: error.message || "Failed to generate realistic view" });
  } finally {
    res.end();
  }
});

/**
 * POST /projects/:id/generate-3d-model
 * Generate a 3D model for the project using Meshy3D API from isometric layout
 */
router.post("/:id/generate-3d-model", async (req, res) => {
  try {
    // Lazy import to avoid module loading issues
    const { meshy3dService } = await import("../services/meshy3dService.js");
    
    const { id: projectId } = req.params;

    logger.info("Generating 3D model for project", { projectId });

    // Get the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      logger.error("Project not found", projectError, { projectId });
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if task already exists
    if (project.meshy_id) {
      return res.status(400).json({ 
        error: "3D model generation already in progress",
        meshy_id: project.meshy_id 
      });
    }

    // Get isometric layout from generated files
    const { data: isometricFile, error: fileError } = await supabase
      .from("generated_files")
      .select("*")
      .eq("project_id", projectId)
      .eq("metadata->>layout_type", "isometric")
      .limit(1)
      .maybeSingle();

    if (fileError || !isometricFile) {
      logger.error("Isometric layout not found", fileError, { projectId });
      return res.status(404).json({ error: "Isometric layout not found. Please generate layouts first." });
    }

    const imageUrl = isometricFile.file_path || isometricFile.storage_url;
    if (!imageUrl) {
      return res.status(400).json({ error: "Isometric layout image not available" });
    }

    // Create Meshy3D task
    const taskId = await meshy3dService.createTask(imageUrl);

    // Update project with meshy_id
    const { error: updateError } = await supabase
      .from("projects")
      .update({ meshy_id: taskId })
      .eq("id", projectId);

    if (updateError) {
      logger.error("Error updating project with meshy_id", updateError, { projectId, taskId });
      return res.status(500).json({ error: "Failed to save task ID" });
    }

    logger.info("3D model generation task created", { projectId, taskId });
    res.json({ success: true, meshy_id: taskId });
  } catch (error: any) {
    logger.error("Error in POST /projects/:id/generate-3d-model", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /projects/:id/check-3d-status
 * Check the status of 3D model generation for the project
 */
router.get("/:id/check-3d-status", async (req, res) => {
  try {
    // Lazy import to avoid module loading issues
    const { meshy3dService } = await import("../services/meshy3dService.js");
    
    const { id: projectId } = req.params;

    // Get the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      logger.error("Project not found", projectError, { projectId });
      return res.status(404).json({ error: "Project not found" });
    }

    if (!project.meshy_id) {
      return res.status(400).json({ error: "No 3D model generation task found for this project" });
    }

    // Check status with Meshy3D
    const status = await meshy3dService.checkStatus(project.meshy_id);

    // If succeeded, download and upload GLB file
    if (status.status === "SUCCEEDED") {
      const glbUrl = status.model_urls?.glb || status.model_url;
      
      if (glbUrl && !project.model_url) {
        try {
          // Download GLB file
          const glbBuffer = await meshy3dService.downloadGLB(glbUrl);
          
          // Upload to /tmp/upload API
          const filename = `project_${projectId}_model_${Date.now()}.glb`;
          let modelUrl: string;
          
          try {
            // Upload to local storage service using /tmp/upload API
            const storageServerUrl = process.env.STORAGE_SERVER_URL || "http://localhost:3333";
            const formData = new FormData();
            const blob = new Blob([glbBuffer], { type: "model/gltf+binary" });
            formData.append("file", blob, filename);

            const storageResponse = await fetch(`${storageServerUrl}/api/v1/tmp/upload`, {
              method: "POST",
              body: formData,
            });

            if (!storageResponse.ok) {
              const errorText = await storageResponse.text();
              throw new Error(`Storage service upload failed: ${storageResponse.statusText} - ${errorText}`);
            }

            const storageResult = await storageResponse.json() as { url?: string };
            
            if (!storageResult.url) {
              throw new Error("Upload API returned invalid response");
            }
            
            modelUrl = storageResult.url;
            
            logger.info("Project GLB file uploaded to tmp storage", { projectId, modelUrl });
          } catch (uploadError: any) {
            // If upload fails, use Meshy URL as fallback and save it to database
            logger.warn("Upload to tmp storage failed, using Meshy URL as fallback", { 
              projectId, 
              glbUrl,
              uploadError: uploadError.message
            });
            
            // Save Meshy URL to database as fallback
            const { error: updateError } = await supabase
              .from("projects")
              .update({ model_url: glbUrl })
              .eq("id", projectId);

            if (updateError) {
              logger.error("Error saving Meshy URL as fallback", updateError, { projectId });
            } else {
              logger.info("Saved Meshy URL as fallback", { projectId, glbUrl });
            }

            return res.json({
              status: "SUCCEEDED",
              progress: 100,
              model_url: glbUrl, // Return Meshy URL as fallback
            });
          }

          // Update project with model_url
          const { error: updateError } = await supabase
            .from("projects")
            .update({ model_url: modelUrl })
            .eq("id", projectId);

          if (updateError) {
            logger.error("Error updating project with model_url", updateError, { projectId });
            // Still return success with the uploaded URL
            return res.json({
              status: "SUCCEEDED",
              progress: 100,
              model_url: modelUrl,
            });
          }

          logger.info("Project 3D model uploaded and saved", { projectId, modelUrl });
          return res.json({
            status: "SUCCEEDED",
            progress: 100,
            model_url: modelUrl,
          });
        } catch (downloadError: any) {
          logger.error("Error downloading/uploading project GLB", downloadError, { projectId, glbUrl });
          
          // Save Meshy URL to database as fallback
          const { error: updateError } = await supabase
            .from("projects")
            .update({ model_url: glbUrl })
            .eq("id", projectId);

          if (updateError) {
            logger.error("Error saving Meshy URL as fallback", updateError, { projectId });
          } else {
            logger.info("Saved Meshy URL as fallback after download error", { projectId, glbUrl });
          }
          
          // Return success with Meshy URL as fallback
          return res.json({
            status: "SUCCEEDED",
            progress: 100,
            model_url: glbUrl,
          });
        }
      } else if (project.model_url) {
        // Model already uploaded
        return res.json({
          status: "SUCCEEDED",
          progress: 100,
          model_url: project.model_url,
        });
      }
    }

    // Return status
    res.json({
      status: status.status,
      progress: status.progress || 0,
      model_url: project.model_url || null,
    });
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/check-3d-status", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /projects/:id/floor-plan-dwg
 * Convert floor plan image to DWG/DXF format
 */
router.get("/:id/floor-plan-dwg", async (req, res) => {
  try {
    const { id: projectId } = req.params;
    logger.info("Converting floor plan to DWG", { projectId });

    // Get floor plan from generated files
    let floorPlanFile = null;
    
    const { data: byType } = await supabase
      .from("generated_files")
      .select("*")
      .eq("project_id", projectId)
      .or("metadata->>layout_type.eq.floor_plan,metadata->>layout_type.eq.factory_floor_plan")
      .limit(1)
      .maybeSingle();

    if (byType) {
      floorPlanFile = byType;
    } else {
      // Try by filename
      const { data: byFilename } = await supabase
        .from("generated_files")
        .select("*")
        .eq("project_id", projectId)
        .ilike("filename", "%floor_plan%")
        .limit(1)
        .maybeSingle();
      
      if (byFilename) {
        floorPlanFile = byFilename;
      }
    }

    if (!floorPlanFile) {
      return res.status(404).json({ error: "Floor plan not found. Please generate layouts first." });
    }

    const imageUrl = floorPlanFile.file_path || floorPlanFile.storage_url;
    if (!imageUrl) {
      return res.status(404).json({ error: "Floor plan image not available" });
    }

    // Import DXF converter
    const { createDXFZip } = await import("../services/dxfConverter.js");

    // Create temporary ZIP file with DXF and image
    const tempDir = path.join(process.cwd(), "tmp", "dxf");
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const zipFilename = `floor_plan_${projectId}_${Date.now()}.zip`;
    const zipPath = path.join(tempDir, zipFilename);

    // Create ZIP with DXF and image
    await createDXFZip(imageUrl, zipPath);

    // Read ZIP file and send it
    const zipBuffer = fs.readFileSync(zipPath);

    // Set headers for download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="floor_plan_${projectId}.zip"`);
    res.setHeader("Content-Length", zipBuffer.length.toString());

    res.send(zipBuffer);

    // Clean up temp file after a delay
    setTimeout(() => {
      fs.unlink(zipPath, (err) => {
        if (err) logger.warn("Failed to delete temp ZIP file", { path: zipPath, error: err });
      });
    }, 5000);

    logger.info("Floor plan DWG served successfully", { projectId });
  } catch (error: any) {
    logger.error("Error converting floor plan to DWG", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message || "Failed to convert floor plan to DWG" });
  }
});

/**
 * GET /projects/:id/glb-proxy
 * Proxy GLB files to avoid CORS issues
 */
router.get("/:id/glb-proxy", async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    logger.info("Proxying GLB file", { projectId, url: url.substring(0, 100) });

    // Fetch the GLB file from the external URL
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("Content-Disposition", `inline; filename="model.glb"`);
    res.setHeader("Cache-Control", "public, max-age=3600");

    res.send(Buffer.from(response.data));
  } catch (error: any) {
    logger.error("Error proxying GLB file", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message || "Failed to proxy GLB file" });
  }
});

/**
 * Generate SVG Floor Plan Layout (Test Purpose - Not Stored)
 * Uses AI to generate an SVG with equipment layout and connections
 */
router.post("/:id/layout-floor-svg", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Generating SVG floor plan layout", { projectId: id });

    // Get project data
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*, planning_data")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get production machine assets only
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, name, type, description, specifications")
      .eq("project_id", id)
      .eq("type", "Production Machine");

    if (assetsError) {
      logger.error("Error fetching assets", assetsError);
      return res.status(500).json({ error: "Failed to fetch assets" });
    }

    const planningData = project.planning_data || {};
    const factoryDimensions = planningData.factory_dimensions || { width: 50, length: 100 };
    const productionLines = planningData.production_lines || [];
    const factoryEngineering = planningData.factory_engineering || {};

    // Build equipment list for AI
    const equipmentList = (assets || []).map((a: any) => a.name).join(", ");

    // Build zones info
    const zones = factoryEngineering.zoning_concept?.zones || [];
    const zonesInfo = zones.map((z: any) => `${z.zone_name}: ${z.purpose}`).join("; ");

    // Build production lines info
    const linesInfo = productionLines.map((l: any) => `${l.line_name}: ${l.function}`).join("; ");

    // AI Prompt for SVG generation
    const svgPrompt = `Generate a clean, professional SVG factory floor plan layout.

FACTORY DIMENSIONS:
- Width: ${factoryDimensions.width}m
- Length: ${factoryDimensions.length}m

PRODUCTION MACHINES TO INCLUDE:
${equipmentList || "Standard production equipment"}

ZONES (if any):
${zonesInfo || "Production area, Storage area, Office area"}

PRODUCTION LINES (if any):
${linesInfo || "Main production line"}

REQUIREMENTS:
1. Create a valid SVG with viewBox="0 0 800 600"
2. Draw the factory outline as a rectangle with dark gray stroke (#374151)
3. Use DISTINCT COLORS for different elements:
   - Walls/Outline: Dark gray (#374151) with 3px stroke
   - Production Machines: Blue (#3B82F6) rectangles with rounded corners
   - Conveyors/Connections: Orange (#F59E0B) dashed lines between machines
   - Storage Areas: Green (#10B981) rectangles
   - Office Areas: Purple (#8B5CF6) rectangles
   - Utility Areas: Cyan (#06B6D4) rectangles
   - Pathways: Light gray (#E5E7EB) rectangles
   - Entry/Exit points: Red (#EF4444) triangles/arrows
4. Add equipment LABELS below each machine (small text, 10px font)
5. Draw FLOW ARROWS (orange dashed lines) showing material flow between machines
6. Include a simple LEGEND in the bottom-right corner
7. Keep the design CLEAN and READABLE
8. Use simple geometric shapes (rectangles, circles, triangles)
9. Position machines logically following production flow (left to right or top to bottom)
10. Leave adequate spacing between equipment for pathways

OUTPUT: Return ONLY the SVG code, starting with <svg and ending with </svg>. No markdown, no explanation.`;

    // Call Gemini AI to generate SVG
    if (!genAI) {
      return res.status(500).json({ error: "AI service not configured" });
    }

    const model = genAI.getGenerativeModel({ model: "models/gemini-3-pro-preview" });
    
    const result = await model.generateContent(svgPrompt);
    const response = result.response;
    const text = response.text();

    // Extract SVG from response (in case there's any extra text)
    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
    if (!svgMatch) {
      logger.error("AI did not return valid SVG", { response: text.substring(0, 500) });
      return res.status(500).json({ error: "Failed to generate valid SVG" });
    }

    const svgContent = svgMatch[0];

    logger.info("SVG floor plan generated successfully", { projectId: id, svgLength: svgContent.length });

    res.json({
      success: true,
      svg: svgContent,
      metadata: {
        factory_width: factoryDimensions.width,
        factory_length: factoryDimensions.length,
        equipment_count: (assets || []).length,
        generated_at: new Date().toISOString(),
      }
    });
  } catch (error: any) {
    logger.error("Error generating SVG floor plan", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message || "Failed to generate SVG floor plan" });
  }
});

/**
 * Convert SVG to DXF Floor Plan Layout
 * Takes the AI-generated SVG and converts it to DXF format
 */
router.post("/:id/convert-svg-to-dxf", async (req, res) => {
  try {
    const { id } = req.params;
    const { svgContent } = req.body;
    
    if (!svgContent) {
      return res.status(400).json({ error: "SVG content is required" });
    }
    
    logger.info("Converting SVG to DXF", { projectId: id });
    
    // Parse SVG and convert to DXF
    const dxfContent = convertSvgToDxf(svgContent);
    
    // Extract dimensions from SVG viewBox
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    let width = 100, height = 100;
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/);
      if (parts.length >= 4) {
        width = parseFloat(parts[2]) || 100;
        height = parseFloat(parts[3]) || 100;
      }
    }
    
    res.json({
      success: true,
      dxf: dxfContent,
      metadata: {
        factory_width: width,
        factory_length: height,
        converted_from: "svg",
        generated_at: new Date().toISOString(),
        format: "DXF AC1009",
        units: "meters"
      }
    });
  } catch (error: any) {
    logger.error("Error converting SVG to DXF", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message || "Failed to convert SVG to DXF" });
  }
});

/**
 * Generate DXF Floor Plan Layout (Test Purpose - Not Stored)
 * Generates a proper DXF file with equipment layout
 * DXF is a CAD format compatible with AutoCAD and other CAD software
 */
router.post("/:id/layout-floor-dxf", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Generating DXF floor plan layout", { projectId: id });

    // Get project data
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*, planning_data")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get production machine assets only
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, name, type, description, specifications")
      .eq("project_id", id)
      .eq("type", "Production Machine");

    if (assetsError) {
      logger.error("Error fetching assets", assetsError);
      return res.status(500).json({ error: "Failed to fetch assets" });
    }

    const planningData = project.planning_data || {};
    const factoryDimensions = planningData.factory_dimensions || { width: 50, length: 100 };
    const factoryEngineering = planningData.factory_engineering || {};
    const zones = factoryEngineering.zoning_concept?.zones || [];

    // Generate proper DXF file
    const dxfContent = generateProperDXF(factoryDimensions, assets || [], zones);

    logger.info("DXF floor plan generated successfully", { projectId: id, dxfLength: dxfContent.length });

    res.json({
      success: true,
      dxf: dxfContent,
      metadata: {
        factory_width: factoryDimensions.width,
        factory_length: factoryDimensions.length,
        equipment_count: (assets || []).length,
        generated_at: new Date().toISOString(),
        format: "DXF AC1009",
        units: "meters"
      }
    });
  } catch (error: any) {
    logger.error("Error generating DXF floor plan", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message || "Failed to generate DXF floor plan" });
  }
});

/**
 * Convert SVG content to DXF format
 * Parses SVG elements and creates corresponding DXF entities
 */
function convertSvgToDxf(svgContent: string): string {
  const dxf = new DXFWriter();
  
  // Extract viewBox dimensions
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  let width = 100, height = 100;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/);
    if (parts.length >= 4) {
      width = parseFloat(parts[2]) || 100;
      height = parseFloat(parts[3]) || 100;
    }
  }
  
  // Add header
  dxf.addHeader(width, height);
  
  // Add tables with layer definitions
  dxf.addTables();
  
  // Add blocks section
  dxf.addBlocks();
  
  // Start entities
  dxf.startEntities();
  
  // Parse and convert SVG elements
  
  // Extract all rectangles (rect elements)
  const rectRegex = /<rect[^>]*>/gi;
  const rects = svgContent.match(rectRegex) || [];
  
  for (const rect of rects) {
    const x = parseFloat(rect.match(/x="([^"]+)"/)?.[1] || "0");
    const y = parseFloat(rect.match(/y="([^"]+)"/)?.[1] || "0");
    const w = parseFloat(rect.match(/width="([^"]+)"/)?.[1] || "0");
    const h = parseFloat(rect.match(/height="([^"]+)"/)?.[1] || "0");
    const fill = rect.match(/fill="([^"]+)"/)?.[1] || "";
    const stroke = rect.match(/stroke="([^"]+)"/)?.[1] || "";
    
    // Determine layer based on color
    let layer = "0";
    let color: number | undefined;
    const colorStr = fill || stroke;
    
    if (colorStr.includes("404040") || colorStr.includes("gray") || colorStr.includes("333")) {
      layer = "WALLS";
      color = 7;
    } else if (colorStr.includes("4169e1") || colorStr.includes("4682b4") || colorStr.includes("1e90ff") || colorStr.includes("blue")) {
      layer = "MACHINES";
      color = 5;
    } else if (colorStr.includes("ff8c00") || colorStr.includes("ffa500") || colorStr.includes("orange")) {
      layer = "CONVEYORS";
      color = 30;
    } else if (colorStr.includes("228b22") || colorStr.includes("32cd32") || colorStr.includes("green")) {
      layer = "STORAGE";
      color = 3;
    } else if (colorStr.includes("8b008b") || colorStr.includes("9932cc") || colorStr.includes("purple") || colorStr.includes("800080")) {
      layer = "OFFICE";
      color = 6;
    } else if (colorStr.includes("008b8b") || colorStr.includes("20b2aa") || colorStr.includes("cyan") || colorStr.includes("teal")) {
      layer = "UTILITIES";
      color = 4;
    } else if (colorStr.includes("808080") || colorStr.includes("a9a9a9") || colorStr.includes("696969")) {
      layer = "PATHWAYS";
      color = 8;
    }
    
    // Convert Y coordinate (SVG Y is top-down, DXF Y is bottom-up)
    const dxfY = height - y - h;
    
    if (w > 0 && h > 0) {
      dxf.addRectangle(layer, x, dxfY, w, h, color);
    }
  }
  
  // Extract all lines
  const lineRegex = /<line[^>]*>/gi;
  const lines = svgContent.match(lineRegex) || [];
  
  for (const line of lines) {
    const x1 = parseFloat(line.match(/x1="([^"]+)"/)?.[1] || "0");
    const y1 = parseFloat(line.match(/y1="([^"]+)"/)?.[1] || "0");
    const x2 = parseFloat(line.match(/x2="([^"]+)"/)?.[1] || "0");
    const y2 = parseFloat(line.match(/y2="([^"]+)"/)?.[1] || "0");
    const stroke = line.match(/stroke="([^"]+)"/)?.[1] || "";
    
    let layer = "0";
    let color: number | undefined;
    
    if (stroke.includes("ff8c00") || stroke.includes("ffa500") || stroke.includes("orange")) {
      layer = "CONVEYORS";
      color = 30;
    } else if (stroke.includes("404040") || stroke.includes("gray")) {
      layer = "WALLS";
      color = 7;
    }
    
    // Convert Y coordinates
    const dxfY1 = height - y1;
    const dxfY2 = height - y2;
    
    dxf.addLine(layer, x1, dxfY1, x2, dxfY2, color);
  }
  
  // Extract polylines/paths for arrows and complex shapes
  const polylineRegex = /<polyline[^>]*points="([^"]+)"[^>]*>/gi;
  let polyMatch;
  while ((polyMatch = polylineRegex.exec(svgContent)) !== null) {
    const pointsStr = polyMatch[1];
    const points = pointsStr.trim().split(/\s+/).map(p => {
      const [x, y] = p.split(",").map(Number);
      return { x, y: height - y };
    });
    
    // Draw as connected lines
    for (let i = 0; i < points.length - 1; i++) {
      dxf.addLine("CONVEYORS", points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, 30);
    }
  }
  
  // Extract all text elements
  const textRegex = /<text[^>]*>([^<]*)<\/text>/gi;
  let textMatch;
  while ((textMatch = textRegex.exec(svgContent)) !== null) {
    const textElement = textMatch[0];
    const textContent = textMatch[1].trim();
    
    if (!textContent) continue;
    
    const x = parseFloat(textElement.match(/x="([^"]+)"/)?.[1] || "0");
    const y = parseFloat(textElement.match(/y="([^"]+)"/)?.[1] || "0");
    const fontSize = parseFloat(textElement.match(/font-size="([^"]+)"/)?.[1] || "2");
    
    // Convert Y coordinate
    const dxfY = height - y;
    
    // Text height in DXF (scale from SVG font-size)
    const textHeight = Math.max(0.3, fontSize * 0.3);
    
    dxf.addText("TEXT", x, dxfY, textHeight, textContent);
  }
  
  // Extract circles
  const circleRegex = /<circle[^>]*>/gi;
  const circles = svgContent.match(circleRegex) || [];
  
  for (const circle of circles) {
    const cx = parseFloat(circle.match(/cx="([^"]+)"/)?.[1] || "0");
    const cy = parseFloat(circle.match(/cy="([^"]+)"/)?.[1] || "0");
    const r = parseFloat(circle.match(/r="([^"]+)"/)?.[1] || "1");
    const fill = circle.match(/fill="([^"]+)"/)?.[1] || "";
    
    // Convert Y coordinate
    const dxfY = height - cy;
    
    let color: number | undefined;
    if (fill.includes("dc143c") || fill.includes("red") || fill.includes("ff")) {
      color = 1; // Red
    }
    
    dxf.addCircle("WALLS", cx, dxfY, r, color);
  }
  
  // Extract polygons (like triangles for entry/exit points)
  const polygonRegex = /<polygon[^>]*points="([^"]+)"[^>]*>/gi;
  let polygonMatch;
  while ((polygonMatch = polygonRegex.exec(svgContent)) !== null) {
    const pointsStr = polygonMatch[1];
    const fill = polygonMatch[0].match(/fill="([^"]+)"/)?.[1] || "";
    
    const points = pointsStr.trim().split(/\s+/).map(p => {
      const [x, y] = p.split(",").map(Number);
      return { x, y: height - y };
    });
    
    let color: number | undefined;
    if (fill.includes("dc143c") || fill.includes("red")) {
      color = 1;
    }
    
    // Draw as connected lines
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      dxf.addLine("WALLS", points[i].x, points[i].y, points[next].x, points[next].y, color);
    }
  }
  
  // Add title block
  dxf.addText("DIMENSIONS", 0, height + 3, 1.5, "FACTORY FLOOR PLAN (Converted from SVG)");
  dxf.addText("DIMENSIONS", 0, height + 6, 0.8, `Scale: 1 unit = 1 meter | Dimensions: ${width}m x ${height}m`);
  
  // End entities
  dxf.endEntities();
  
  // End file
  dxf.end();
  
  return dxf.toString();
}

/**
 * DXF Writer Helper Class
 */
class DXFWriter {
  private lines: string[] = [];
  private handle = 100;

  private nextHandle(): string {
    return (this.handle++).toString(16).toUpperCase();
  }

  add(code: number, value: string | number): void {
    this.lines.push(code.toString());
    this.lines.push(value.toString());
  }

  addSection(name: string): void {
    this.add(0, "SECTION");
    this.add(2, name);
  }

  endSection(): void {
    this.add(0, "ENDSEC");
  }

  toString(): string {
    return this.lines.join("\r\n");
  }

  // Add header section
  addHeader(width: number, height: number): void {
    this.addSection("HEADER");
    
    // AutoCAD version
    this.add(9, "$ACADVER");
    this.add(1, "AC1009");
    
    // Drawing units (6 = meters)
    this.add(9, "$INSUNITS");
    this.add(70, 6);
    
    // Drawing extents min
    this.add(9, "$EXTMIN");
    this.add(10, 0);
    this.add(20, 0);
    this.add(30, 0);
    
    // Drawing extents max
    this.add(9, "$EXTMAX");
    this.add(10, width);
    this.add(20, height);
    this.add(30, 0);
    
    // Limits min
    this.add(9, "$LIMMIN");
    this.add(10, 0);
    this.add(20, 0);
    
    // Limits max
    this.add(9, "$LIMMAX");
    this.add(10, width);
    this.add(20, height);
    
    this.endSection();
  }

  // Add tables section with layers
  addTables(): void {
    this.addSection("TABLES");
    
    // VPORT table
    this.add(0, "TABLE");
    this.add(2, "VPORT");
    this.add(70, 0);
    this.add(0, "ENDTAB");
    
    // LTYPE table
    this.add(0, "TABLE");
    this.add(2, "LTYPE");
    this.add(70, 2);
    
    // CONTINUOUS linetype
    this.add(0, "LTYPE");
    this.add(2, "CONTINUOUS");
    this.add(70, 0);
    this.add(3, "Solid line");
    this.add(72, 65);
    this.add(73, 0);
    this.add(40, 0);
    
    // DASHED linetype
    this.add(0, "LTYPE");
    this.add(2, "DASHED");
    this.add(70, 0);
    this.add(3, "Dashed line");
    this.add(72, 65);
    this.add(73, 2);
    this.add(40, 1);
    this.add(49, 0.5);
    this.add(49, -0.5);
    
    this.add(0, "ENDTAB");
    
    // LAYER table
    this.add(0, "TABLE");
    this.add(2, "LAYER");
    this.add(70, 10);
    
    // Layer 0 (default)
    this.addLayer("0", 7, "CONTINUOUS");
    // Walls layer
    this.addLayer("WALLS", 7, "CONTINUOUS");
    // Machines layer
    this.addLayer("MACHINES", 5, "CONTINUOUS");
    // Conveyors layer
    this.addLayer("CONVEYORS", 30, "DASHED");
    // Storage layer
    this.addLayer("STORAGE", 3, "CONTINUOUS");
    // Office layer
    this.addLayer("OFFICE", 6, "CONTINUOUS");
    // Utilities layer
    this.addLayer("UTILITIES", 4, "CONTINUOUS");
    // Text layer
    this.addLayer("TEXT", 7, "CONTINUOUS");
    // Pathways layer
    this.addLayer("PATHWAYS", 8, "CONTINUOUS");
    // Dimensions layer
    this.addLayer("DIMENSIONS", 1, "CONTINUOUS");
    
    this.add(0, "ENDTAB");
    
    // STYLE table
    this.add(0, "TABLE");
    this.add(2, "STYLE");
    this.add(70, 1);
    
    this.add(0, "STYLE");
    this.add(2, "STANDARD");
    this.add(70, 0);
    this.add(40, 0);
    this.add(41, 1);
    this.add(50, 0);
    this.add(71, 0);
    this.add(42, 2.5);
    this.add(3, "txt");
    this.add(4, "");
    
    this.add(0, "ENDTAB");
    
    this.endSection();
  }

  private addLayer(name: string, color: number, lineType: string): void {
    this.add(0, "LAYER");
    this.add(2, name);
    this.add(70, 0);
    this.add(62, color);
    this.add(6, lineType);
  }

  // Add blocks section (empty for basic DXF)
  addBlocks(): void {
    this.addSection("BLOCKS");
    this.endSection();
  }

  // Start entities section
  startEntities(): void {
    this.addSection("ENTITIES");
  }

  // End entities section
  endEntities(): void {
    this.endSection();
  }

  // Add LINE entity
  addLine(layer: string, x1: number, y1: number, x2: number, y2: number, color?: number): void {
    this.add(0, "LINE");
    this.add(8, layer);
    if (color !== undefined) this.add(62, color);
    this.add(10, x1);
    this.add(20, y1);
    this.add(30, 0);
    this.add(11, x2);
    this.add(21, y2);
    this.add(31, 0);
  }

  // Add closed polyline (rectangle)
  addRectangle(layer: string, x: number, y: number, width: number, height: number, color?: number): void {
    this.add(0, "POLYLINE");
    this.add(8, layer);
    if (color !== undefined) this.add(62, color);
    this.add(66, 1);
    this.add(70, 1); // Closed polyline
    
    // Vertices
    const vertices = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ];
    
    for (const [vx, vy] of vertices) {
      this.add(0, "VERTEX");
      this.add(8, layer);
      this.add(10, vx);
      this.add(20, vy);
      this.add(30, 0);
    }
    
    this.add(0, "SEQEND");
    this.add(8, layer);
  }

  // Add TEXT entity
  addText(layer: string, x: number, y: number, height: number, text: string, color?: number): void {
    this.add(0, "TEXT");
    this.add(8, layer);
    if (color !== undefined) this.add(62, color);
    this.add(10, x);
    this.add(20, y);
    this.add(30, 0);
    this.add(40, height);
    this.add(1, text);
    this.add(7, "STANDARD");
  }

  // Add CIRCLE entity
  addCircle(layer: string, x: number, y: number, radius: number, color?: number): void {
    this.add(0, "CIRCLE");
    this.add(8, layer);
    if (color !== undefined) this.add(62, color);
    this.add(10, x);
    this.add(20, y);
    this.add(30, 0);
    this.add(40, radius);
  }

  // End the file
  end(): void {
    this.add(0, "EOF");
  }
}

/**
 * Generate a proper valid DXF file with smart layout
 */
function generateProperDXF(
  dimensions: { width: number; length: number },
  assets: any[],
  zones: any[]
): string {
  const width = dimensions.width || 50;
  const length = dimensions.length || 100;
  const margin = 2; // Margin from walls
  
  const dxf = new DXFWriter();
  
  // Add header
  dxf.addHeader(width, length);
  
  // Add tables with layer definitions
  dxf.addTables();
  
  // Add blocks section
  dxf.addBlocks();
  
  // Start entities
  dxf.startEntities();
  
  // Draw factory outline (walls) - thick rectangle
  dxf.addRectangle("WALLS", 0, 0, width, length);
  
  // Add dimension text outside the factory
  dxf.addText("DIMENSIONS", 0, -4, 1.5, `${width}m x ${length}m Factory`);
  
  // Calculate layout based on factory size
  // Use horizontal layout if width >= 30m, otherwise vertical stacking
  const useHorizontalLayout = width >= 30;
  
  // Calculate machine sizes based on factory dimensions (adaptive)
  const machineW = Math.min(3, width * 0.08);
  const machineH = Math.min(4, length * 0.06);
  const machineSpacing = Math.min(2, Math.max(1, width * 0.03));
  
  if (useHorizontalLayout) {
    // HORIZONTAL LAYOUT: Production on left, support areas on right
    const sideAreaWidth = Math.min(width * 0.25, 15);
    const productionWidth = width - sideAreaWidth - margin * 3;
    
    // Production Area (left side)
    const prodX = margin;
    const prodY = margin;
    const prodW = productionWidth;
    const prodH = length - margin * 2;
    
    dxf.addRectangle("PATHWAYS", prodX, prodY, prodW, prodH, 8);
    dxf.addText("TEXT", prodX + 2, prodY + prodH - 3, 1.2, "PRODUCTION AREA");
    
    // Side areas (right column)
    const sideX = prodX + prodW + margin;
    const sideW = sideAreaWidth;
    
    // Storage (bottom right)
    const storageH = (length - margin * 4) * 0.4;
    dxf.addRectangle("STORAGE", sideX, margin, sideW, storageH, 3);
    dxf.addText("TEXT", sideX + 1, margin + storageH - 2, 0.8, "STORAGE");
    
    // Office (middle right)
    const officeY = margin + storageH + margin;
    const officeH = (length - margin * 4) * 0.35;
    dxf.addRectangle("OFFICE", sideX, officeY, sideW, officeH, 6);
    dxf.addText("TEXT", sideX + 1, officeY + officeH - 2, 0.8, "OFFICE");
    
    // Utilities (top right)
    const utilY = officeY + officeH + margin;
    const utilH = length - utilY - margin;
    if (utilH > 3) {
      dxf.addRectangle("UTILITIES", sideX, utilY, sideW, utilH, 4);
      dxf.addText("TEXT", sideX + 1, utilY + utilH - 2, 0.8, "UTILITIES");
    }
    
    // Place machines in production area
    const machineAreaX = prodX + 3;
    const machineAreaY = prodY + 5;
    const machineAreaW = prodW - 6;
    const machineAreaH = prodH - 10;
    
    const cols = Math.max(1, Math.floor(machineAreaW / (machineW + machineSpacing)));
    const rows = Math.max(1, Math.floor(machineAreaH / (machineH + machineSpacing * 2)));
    
    const machinePositions: { x: number; y: number }[] = [];
    let idx = 0;
    
    for (let row = 0; row < rows && idx < assets.length; row++) {
      for (let col = 0; col < cols && idx < assets.length; col++) {
        const mx = machineAreaX + col * (machineW + machineSpacing);
        const my = machineAreaY + row * (machineH + machineSpacing * 2);
        
        dxf.addRectangle("MACHINES", mx, my, machineW, machineH, 5);
        
        const label = (assets[idx].name || `M${idx + 1}`).substring(0, 12);
        dxf.addText("TEXT", mx, my - 1, 0.4, label);
        
        machinePositions.push({ x: mx + machineW / 2, y: my + machineH / 2 });
        idx++;
      }
    }
    
    // Draw conveyors between machines
    for (let i = 0; i < machinePositions.length - 1; i++) {
      dxf.addLine("CONVEYORS", machinePositions[i].x, machinePositions[i].y, 
                  machinePositions[i + 1].x, machinePositions[i + 1].y, 30);
    }
    
    // Main pathway
    dxf.addRectangle("PATHWAYS", prodX, prodY + 2, prodW, 2, 8);
    dxf.addText("TEXT", prodX + prodW / 2 - 4, prodY + 2.5, 0.5, "MAIN AISLE");
    
    // Entry/Exit
    dxf.addCircle("WALLS", 0, length / 3, 1, 1);
    dxf.addText("TEXT", 1.5, length / 3 - 0.3, 0.5, "IN");
    dxf.addCircle("WALLS", 0, length * 2 / 3, 1, 1);
    dxf.addText("TEXT", 1.5, length * 2 / 3 - 0.3, 0.5, "OUT");
    
  } else {
    // VERTICAL LAYOUT: For smaller factories - stack areas vertically
    const usableWidth = width - margin * 2;
    const usableHeight = length - margin * 2;
    
    // Production Area (main, top 60%)
    const prodH = usableHeight * 0.6;
    const prodX = margin;
    const prodY = margin + usableHeight * 0.4;
    
    dxf.addRectangle("PATHWAYS", prodX, prodY, usableWidth, prodH, 8);
    dxf.addText("TEXT", prodX + 1, prodY + prodH - 2, 0.8, "PRODUCTION");
    
    // Bottom strip: Storage, Office, Utilities side by side
    const bottomY = margin;
    const bottomH = usableHeight * 0.35;
    const areaCount = 3;
    const areaW = (usableWidth - margin * 2) / areaCount;
    
    // Storage (left)
    dxf.addRectangle("STORAGE", margin, bottomY, areaW, bottomH, 3);
    dxf.addText("TEXT", margin + 0.5, bottomY + bottomH - 1.5, 0.6, "STORAGE");
    
    // Office (middle)
    dxf.addRectangle("OFFICE", margin + areaW + margin, bottomY, areaW, bottomH, 6);
    dxf.addText("TEXT", margin + areaW + margin + 0.5, bottomY + bottomH - 1.5, 0.6, "OFFICE");
    
    // Utilities (right)
    dxf.addRectangle("UTILITIES", margin + (areaW + margin) * 2, bottomY, areaW, bottomH, 4);
    dxf.addText("TEXT", margin + (areaW + margin) * 2 + 0.5, bottomY + bottomH - 1.5, 0.6, "UTIL");
    
    // Place machines in production area
    const machineAreaX = prodX + 2;
    const machineAreaY = prodY + 3;
    const machineAreaW = usableWidth - 4;
    const machineAreaH = prodH - 6;
    
    // Smaller machines for small factories
    const smallMachineW = Math.min(2, machineAreaW * 0.15);
    const smallMachineH = Math.min(2.5, machineAreaH * 0.2);
    const smallSpacing = Math.max(0.5, smallMachineW * 0.3);
    
    const cols = Math.max(1, Math.floor(machineAreaW / (smallMachineW + smallSpacing)));
    const rows = Math.max(1, Math.floor(machineAreaH / (smallMachineH + smallSpacing * 1.5)));
    
    const machinePositions: { x: number; y: number }[] = [];
    let idx = 0;
    
    for (let row = 0; row < rows && idx < assets.length; row++) {
      for (let col = 0; col < cols && idx < assets.length; col++) {
        const mx = machineAreaX + col * (smallMachineW + smallSpacing);
        const my = machineAreaY + row * (smallMachineH + smallSpacing * 1.5);
        
        dxf.addRectangle("MACHINES", mx, my, smallMachineW, smallMachineH, 5);
        
        const label = (assets[idx].name || `M${idx + 1}`).substring(0, 8);
        dxf.addText("TEXT", mx, my - 0.7, 0.3, label);
        
        machinePositions.push({ x: mx + smallMachineW / 2, y: my + smallMachineH / 2 });
        idx++;
      }
    }
    
    // Draw conveyors
    for (let i = 0; i < machinePositions.length - 1; i++) {
      dxf.addLine("CONVEYORS", machinePositions[i].x, machinePositions[i].y, 
                  machinePositions[i + 1].x, machinePositions[i + 1].y, 30);
    }
    
    // Entry/Exit on left wall
    dxf.addCircle("WALLS", 0, length * 0.7, 0.8, 1);
    dxf.addText("TEXT", 1, length * 0.7 - 0.2, 0.4, "IN");
    dxf.addCircle("WALLS", width, length * 0.7, 0.8, 1);
    dxf.addText("TEXT", width - 2.5, length * 0.7 - 0.2, 0.4, "OUT");
  }
  
  // Add title block outside factory bounds
  dxf.addText("DIMENSIONS", 0, length + 3, 1.5, "FACTORY FLOOR PLAN");
  dxf.addText("DIMENSIONS", 0, length + 6, 0.8, `Scale: 1 unit = 1 meter | Equipment: ${assets.length} machines`);
  
  // End entities
  dxf.endEntities();
  
  // End file
  dxf.end();
  
  return dxf.toString();
}

export default router;

