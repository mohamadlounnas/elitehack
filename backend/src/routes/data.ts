import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import { fullReportGenerator } from "../services/fullReportGenerator.js";
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

export default router;

