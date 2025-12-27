import { supabase } from "../../utils/supabase.js";
import { stepOrchestrator } from "../stepOrchestrator.js";
import { PDFDocument, rgb } from "pdf-lib";

type CostAnalysisStreamCallback = (update: {
  type: "analyzing" | "calculating" | "generating" | "complete";
  content: string;
  progress: number;
}) => void;

class CostAnalysisService {
  /**
   * Analyze costs with streaming updates
   */
  async analyzeCostsWithStream(
    projectId: string,
    onUpdate: CostAnalysisStreamCallback
  ): Promise<void> {
    try {
      onUpdate({
        type: "analyzing",
        content: "Gathering project data and assets...",
        progress: 10,
      });

      // Get project data
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (!project) {
        throw new Error("Project not found");
      }

      onUpdate({
        type: "analyzing",
        content: "Retrieving assets and supplier information...",
        progress: 30,
      });

      // Get assets with suppliers
      const { data: assets } = await supabase
        .from("assets")
        .select(`
          *,
          suppliers (
            id,
            name,
            location
          )
        `)
        .eq("project_id", projectId);

      onUpdate({
        type: "calculating",
        content: "Calculating Total Cost of Ownership (TCO)...",
        progress: 50,
      });

      // Calculate TCO (simplified calculation)
      const totalAssetCost = 1000000; // Placeholder - would calculate from actual supplier prices
      const annualOperatingCost = totalAssetCost * 0.1; // 10% of asset cost
      const npv = this.calculateNPV(totalAssetCost, annualOperatingCost, 5);

      onUpdate({
        type: "calculating",
        content: `TCO Analysis:\n- Total Asset Cost: $${totalAssetCost.toLocaleString()}\n- Annual Operating Cost: $${annualOperatingCost.toLocaleString()}\n- NPV (5 years): $${npv.toLocaleString()}`,
        progress: 70,
      });

      // Create TCO calculation record
      await supabase.from("tco_calculations").insert({
        project_id: projectId,
        project_name: project.name,
        total_tco: totalAssetCost + annualOperatingCost * 5,
        annual_tco: annualOperatingCost,
        npv: npv,
        breakdown: {
          assets: totalAssetCost,
          operating: annualOperatingCost,
          years: 5,
        },
      });

      onUpdate({
        type: "generating",
        content: "Generating business plan PDF...",
        progress: 85,
      });

      // Generate business plan PDF
      const pdfBuffer = await this.generateBusinessPlanPDF(project, assets || []);

      // Upload PDF to storage (for now, save path in database)
      const pdfPath = `projects/${projectId}/cost_analysis.pdf`;
      // In production, upload to Supabase Storage
      // For now, just store the path

      // Update project with PDF path
      await supabase
        .from("projects")
        .update({
          cost_analysis_pdf: pdfPath,
          current_step: "cost_analysed",
        })
        .eq("id", projectId);

      onUpdate({
        type: "complete",
        content: "Cost analysis complete! Business plan PDF generated.",
        progress: 100,
      });

      await stepOrchestrator.nextStep(projectId);
    } catch (error: any) {
      console.error("Error in costAnalysisService.analyzeCostsWithStream:", error);
      throw error;
    }
  }

  async analyzeCosts(projectId: string): Promise<void> {
    try {
      // Get project data
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (!project) {
        throw new Error("Project not found");
      }

      // Get assets with suppliers
      const { data: assets } = await supabase
        .from("assets")
        .select(`
          *,
          suppliers (
            id,
            name,
            location
          )
        `)
        .eq("project_id", projectId);

      // Calculate TCO (simplified calculation)
      const totalAssetCost = 1000000; // Placeholder - would calculate from actual supplier prices
      const annualOperatingCost = totalAssetCost * 0.1; // 10% of asset cost
      const npv = this.calculateNPV(totalAssetCost, annualOperatingCost, 5);

      // Create TCO calculation record
      await supabase.from("tco_calculations").insert({
        project_id: projectId,
        project_name: project.name,
        total_tco: totalAssetCost + annualOperatingCost * 5,
        annual_tco: annualOperatingCost,
        npv: npv,
        breakdown: {
          assets: totalAssetCost,
          operating: annualOperatingCost,
          years: 5,
        },
      });

      // Generate business plan PDF
      const pdfBuffer = await this.generateBusinessPlanPDF(project, assets || []);

      // Upload PDF to storage (for now, save path in database)
      const pdfPath = `projects/${projectId}/cost_analysis.pdf`;
      // In production, upload to Supabase Storage
      // For now, just store the path

      // Update project with PDF path
      await supabase
        .from("projects")
        .update({
          cost_analysis_pdf: pdfPath,
          current_step: "cost_analysed",
        })
        .eq("id", projectId);

      await stepOrchestrator.nextStep(projectId);
    } catch (error: any) {
      console.error("Error in costAnalysisService.analyzeCosts:", error);
      throw error;
    }
  }

  private calculateNPV(initialInvestment: number, annualCashFlow: number, years: number, discountRate: number = 0.1): number {
    let npv = -initialInvestment;
    for (let year = 1; year <= years; year++) {
      npv += annualCashFlow / Math.pow(1 + discountRate, year);
    }
    return npv;
  }

  private async generateBusinessPlanPDF(project: any, assets: any[]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont("Helvetica");

    let yPosition = height - 50;

    // Title
    page.drawText("Business Plan & Cost Analysis", {
      x: 50,
      y: yPosition,
      size: 24,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 40;

    // Project Name
    page.drawText(`Project: ${project.name}`, {
      x: 50,
      y: yPosition,
      size: 14,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    // Assets section
    page.drawText("Assets & Equipment:", {
      x: 50,
      y: yPosition,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 25;

    for (const asset of assets) {
      if (yPosition < 50) {
        const newPage = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
      }

      page.drawText(`- ${asset.name}`, {
        x: 70,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      yPosition -= 20;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

export const costAnalysisService = new CostAnalysisService();

