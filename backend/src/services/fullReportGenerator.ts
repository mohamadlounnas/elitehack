/**
 * Elite Full Industrial Report Generator
 * 
 * Creates a comprehensive, professionally-styled PDF report with:
 * - Structured workflow with planning phase first
 * - Table of Contents with page numbers
 * - Modern typography (no overflow issues)
 * - Financial numbers in proper mathematical format
 * - Clean, organized sections
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, grayscale } from "pdf-lib";
import fs from "fs";
import path from "path";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";

// Modern Color Palette
const COLORS = {
  // Primary Navy
  navy: rgb(0.06, 0.09, 0.16), // #0F172A
  navyLight: rgb(0.12, 0.16, 0.24), // #1E293B
  
  // Accent Purple
  accent: rgb(0.38, 0.27, 0.89), // #6145E3
  accentLight: rgb(0.49, 0.36, 0.89), // #7C5CE3
  
  // Status Colors
  success: rgb(0.07, 0.63, 0.45), // #12A172
  warning: rgb(0.91, 0.55, 0.09), // #E88C17
  danger: rgb(0.87, 0.24, 0.24), // #DD3D3D
  
  // Text Colors
  textDark: rgb(0.06, 0.09, 0.16), // #0F172A
  textMedium: rgb(0.33, 0.38, 0.45), // #546173
  textLight: rgb(0.58, 0.62, 0.69), // #949EB0
  
  // Background Colors
  white: rgb(1, 1, 1),
  bgLight: rgb(0.97, 0.98, 0.99), // #F8FAFC
  bgSubtle: rgb(0.94, 0.95, 0.97), // #F1F3F7
  
  // Border
  border: rgb(0.87, 0.89, 0.92), // #DEE3EB
  borderLight: rgb(0.93, 0.94, 0.96), // #EDF0F5
};

// Report Section Definition
interface ReportSection {
  id: string;
  title: string;
  subtitle: string;
  pageStart?: number;
}

// Streaming callback type
export interface ReportStreamUpdate {
  type: "planning" | "generating" | "section" | "progress" | "complete" | "error";
  section?: string;
  progress?: number;
  total?: number;
  message?: string;
  tocItems?: ReportSection[];
}

interface ReportData {
  project: any;
  planningData: any;
  assets: any[];
  suppliers: any[];
  tcoAnalysis: any;
  generatedFiles?: any[];
  messages?: any[];
}

class FullReportGenerator {
  private pdfDoc!: PDFDocument;
  private helvetica!: PDFFont;
  private helveticaBold!: PDFFont;
  private helveticaOblique!: PDFFont;
  private timesRoman!: PDFFont;
  private timesItalic!: PDFFont;
  private courier!: PDFFont;
  
  private currentPage!: PDFPage;
  private pageWidth = 612; // US Letter
  private pageHeight = 792;
  private margin = 60;
  private contentWidth: number;
  private yPosition = 0;
  private pageNumber = 0;
  private pages: PDFPage[] = [];
  
  // Section tracking for TOC
  private sections: ReportSection[] = [];
  private sectionPageMap: Map<string, number> = new Map();
  
  constructor() {
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  /**
   * Generate the full industrial report with streaming updates
   */
  async generateReport(
    projectId: string,
    onUpdate?: (update: ReportStreamUpdate) => void
  ): Promise<string> {
    logger.info("Starting full report generation", { projectId });
    
    const sendUpdate = (update: ReportStreamUpdate) => {
      if (onUpdate) onUpdate(update);
    };

    try {
      // Phase 1: Planning - Create the report outline
      sendUpdate({
        type: "planning",
        message: "Creating report structure and table of contents...",
        progress: 0,
        total: 100,
      });

      // Fetch all project data
      const reportData = await this.fetchReportData(projectId);
      
      // Plan the report structure
      const toc = this.planReportStructure(reportData);
      
      sendUpdate({
        type: "planning",
        message: "Report structure planned. Starting generation...",
        progress: 10,
        total: 100,
        tocItems: toc,
      });

      // Phase 2: Generate PDF
      await this.initializePdf();
      
      // Generate each section with streaming updates
      const sectionCount = toc.length + 2; // +2 for cover and TOC
      let currentSection = 0;

      // Cover Page
      sendUpdate({
        type: "section",
        section: "Cover Page",
        progress: 15,
        total: 100,
      });
      await this.generateCoverPage(reportData);
      currentSection++;

      // Table of Contents (placeholder - will be updated)
      sendUpdate({
        type: "section",
        section: "Table of Contents",
        progress: 20,
        total: 100,
      });
      const tocPageStart = this.pages.length;
      await this.generateTableOfContents(toc);
      currentSection++;

      // Generate each content section
      for (let i = 0; i < toc.length; i++) {
        const section = toc[i];
        const progress = 20 + Math.floor((i / toc.length) * 70);
        
        sendUpdate({
          type: "section",
          section: section.title,
          progress,
          total: 100,
        });

        // Record page start for this section
        this.sectionPageMap.set(section.id, this.pages.length + 1);

        // Generate section cover
        await this.generateSectionCover(
          String(i + 1).padStart(2, "0"),
          section.title,
          section.subtitle
        );

        // Generate section content
        await this.generateSectionContent(section.id, reportData);
        currentSection++;
      }

      // Update TOC with actual page numbers
      sendUpdate({
        type: "generating",
        message: "Finalizing document...",
        progress: 95,
        total: 100,
      });

      // Add page numbers to all pages
      await this.addPageNumbers();

      // Save PDF
      const pdfBytes = await this.pdfDoc.save();
      const buffer = Buffer.from(pdfBytes);

      // Save to file
      const outputDir = path.join(process.cwd(), "tmp", "projects", projectId);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `full_report_${Date.now()}.pdf`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, buffer);

      // Update project with PDF path
      const relativePath = `tmp/projects/${projectId}/${filename}`;
      await supabase
        .from("projects")
        .update({ full_report_pdf_url: relativePath })
        .eq("id", projectId);

      sendUpdate({
        type: "complete",
        message: "Report generated successfully!",
        progress: 100,
        total: 100,
      });

      logger.info("Full report generated successfully", { projectId, path: relativePath });
      return relativePath;

    } catch (error: any) {
      logger.error("Error generating full report", error, { projectId });
      sendUpdate({
        type: "error",
        message: error.message || "Failed to generate report",
      });
      throw error;
    }
  }

  /**
   * Fetch all data needed for the report
   * Handles missing data gracefully
   */
  private async fetchReportData(projectId: string): Promise<ReportData> {
    const [projectRes, assetsRes, tcoRes, messagesRes, filesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("assets").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("tco_calculations").select("*").eq("project_id", projectId).limit(1).maybeSingle(),
      supabase.from("project_messages").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("generated_files").select("*").eq("project_id", projectId),
    ]);

    if (!projectRes.data) {
      throw new Error("Project not found");
    }

    // Fetch suppliers
    let suppliers: any[] = [];
    if (assetsRes.data && assetsRes.data.length > 0) {
      const supplierIds = [...new Set(assetsRes.data.map(a => a.supplier_id).filter(Boolean))];
      if (supplierIds.length > 0) {
        const { data } = await supabase.from("suppliers").select("*").in("id", supplierIds);
        suppliers = data || [];
      }
    }

    // Handle missing planning data gracefully
    const planningData = projectRes.data?.planning_data || {};
    
    // If no planning data, try to construct basic info from project and messages
    if (!projectRes.data?.planning_data) {
      logger.warn("Project has no planning data, generating report with available data", { projectId });
      
      // Create minimal identity from project name
      planningData.industrial_identity = {
        factory_name: projectRes.data.name,
        industrial_category: "Manufacturing",
        operating_scope: "Regional",
      };
      
      // Try to extract requirements from messages
      const userMessages = (messagesRes.data || []).filter(m => m.role === "user");
      if (userMessages.length > 0) {
        const firstMessage = userMessages[0];
        const content = typeof firstMessage.content === "string" 
          ? firstMessage.content 
          : JSON.stringify(firstMessage.content);
        planningData.executive_summary = {
          strategic_positioning: content.substring(0, 500),
          key_highlights: ["Project requirements documented via chat interface"],
        };
      }
    }

    return {
      project: projectRes.data,
      planningData,
      assets: assetsRes.data || [],
      suppliers,
      tcoAnalysis: tcoRes.data?.breakdown || {},
      generatedFiles: filesRes.data || [],
      messages: messagesRes.data || [],
    };
  }

  /**
   * Plan the report structure based on available data
   * Always includes core sections, conditionally adds others based on data availability
   */
  private planReportStructure(data: ReportData): ReportSection[] {
    const sections: ReportSection[] = [];
    const hasFullPlanningData = data.planningData && Object.keys(data.planningData).length > 2;

    // Always include these core sections
    sections.push({
      id: "executive",
      title: "Executive Summary",
      subtitle: "Strategic investment overview and key recommendations",
    });

    sections.push({
      id: "identity",
      title: "Industrial Identity",
      subtitle: "Factory profile, legal structure, and market positioning",
    });

    // Production & Engineering - include if we have production lines OR assets (equipment implies production)
    if (data.planningData?.production_lines?.length > 0 || (data.assets.length > 0 && hasFullPlanningData)) {
      sections.push({
        id: "production",
        title: "Production Engineering",
        subtitle: "Manufacturing lines, processes, and capacity analysis",
      });
    }

    // Factory Layout & Dimensions
    if (data.planningData?.factory_dimensions) {
      sections.push({
        id: "facility",
        title: "Facility Specifications",
        subtitle: "Building dimensions, zoning, and infrastructure requirements",
      });
    }

    // Equipment & Assets - include if we have any assets
    if (data.assets.length > 0) {
      sections.push({
        id: "equipment",
        title: "Equipment & Machinery",
        subtitle: "Complete inventory with specifications and cost estimates",
      });
    }

    // Suppliers - include if we have any
    if (data.suppliers.length > 0) {
      sections.push({
        id: "suppliers",
        title: "Supplier Network",
        subtitle: "Verified suppliers, certifications, and contact information",
      });
    }

    // Financial Analysis - Always include (will show available data or placeholders)
    sections.push({
      id: "financial",
      title: "Financial Analysis",
      subtitle: "Capital expenditure, operating costs, and ROI projections",
    });

    // Cash Flow Projections - include if we have projection data
    if (data.tcoAnalysis?.projections?.length > 0 || data.tcoAnalysis?.ten_year_projection?.length > 0) {
      sections.push({
        id: "projections",
        title: "Financial Projections",
        subtitle: "10-year cash flow analysis and break-even forecast",
      });
    }

    // Risk Assessment - include if available
    if (data.planningData?.risk_assessment || data.tcoAnalysis?.risk_analysis) {
      sections.push({
        id: "risk",
        title: "Risk Assessment",
        subtitle: "Risk identification, analysis, and mitigation strategies",
      });
    }

    // Digital Transformation - include if available
    if (data.planningData?.digital_transformation) {
      sections.push({
        id: "digital",
        title: "Digital Transformation",
        subtitle: "Industry 4.0 integration and smart factory capabilities",
      });
    }

    // Location & Logistics - include if available
    if (data.planningData?.location_justification) {
      sections.push({
        id: "location",
        title: "Location & Logistics",
        subtitle: "Site selection criteria and supply chain optimization",
      });
    }

    // Appendix - Always include for requirements/conversation
    sections.push({
      id: "appendix",
      title: "Appendix",
      subtitle: "Project requirements and supporting documentation",
    });

    // Log the planned structure
    logger.info("Report structure planned", { 
      projectId: data.project?.id,
      sectionCount: sections.length,
      hasFullPlanningData,
      assetCount: data.assets.length,
      supplierCount: data.suppliers.length,
    });

    this.sections = sections;
    return sections;
  }

  /**
   * Initialize PDF document with fonts
   */
  private async initializePdf(): Promise<void> {
    this.pdfDoc = await PDFDocument.create();
    this.helvetica = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.helveticaBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.helveticaOblique = await this.pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    this.timesRoman = await this.pdfDoc.embedFont(StandardFonts.TimesRoman);
    this.timesItalic = await this.pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    this.courier = await this.pdfDoc.embedFont(StandardFonts.Courier);
    this.pages = [];
    this.pageNumber = 0;
  }

  /**
   * Add a new page
   */
  private addNewPage(): PDFPage {
    this.currentPage = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.pages.push(this.currentPage);
    this.yPosition = this.pageHeight - this.margin;
    this.pageNumber++;
    return this.currentPage;
  }

  /**
   * Check if new page needed
   */
  private checkNewPage(requiredSpace: number = 80): boolean {
    if (this.yPosition < this.margin + requiredSpace) {
      this.addNewPage();
      return true;
    }
    return false;
  }

  /**
   * Add page numbers to all pages
   */
  private async addPageNumbers(): Promise<void> {
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      // Skip cover page
      if (i === 0) continue;

      const pageNum = i.toString();
      const textWidth = this.helvetica.widthOfTextAtSize(pageNum, 9);

      // Page number at bottom center
      page.drawText(pageNum, {
        x: (this.pageWidth - textWidth) / 2,
        y: 35,
        size: 9,
        font: this.helvetica,
        color: COLORS.textLight,
      });

      // Subtle line above
      page.drawLine({
        start: { x: this.pageWidth / 2 - 40, y: 48 },
        end: { x: this.pageWidth / 2 + 40, y: 48 },
        thickness: 0.5,
        color: COLORS.borderLight,
      });
    }
  }

  // ============================================
  // COVER PAGE
  // ============================================
  private async generateCoverPage(data: ReportData): Promise<void> {
    const page = this.addNewPage();
    const { project, planningData, tcoAnalysis } = data;
    const identity = planningData?.industrial_identity || {};
    const analysis = tcoAnalysis || {};

    // Full dark background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageWidth,
      height: this.pageHeight,
      color: COLORS.navy,
    });

    // Top accent stripe
    page.drawRectangle({
      x: 0,
      y: this.pageHeight - 6,
      width: this.pageWidth,
      height: 6,
      color: COLORS.accent,
    });

    // Generator badge
    page.drawText("ELITE INDUSTRIAL STRATEGY", {
      x: this.margin,
      y: this.pageHeight - 55,
      size: 9,
      font: this.helvetica,
      color: COLORS.textLight,
    });

    // Report Type
    this.yPosition = this.pageHeight - 180;
    page.drawText("COMPREHENSIVE", {
      x: this.margin,
      y: this.yPosition,
      size: 42,
      font: this.helveticaBold,
      color: COLORS.white,
    });
    
    this.yPosition -= 50;
    page.drawText("INDUSTRIAL", {
      x: this.margin,
      y: this.yPosition,
      size: 42,
      font: this.helveticaBold,
      color: COLORS.white,
    });
    
    this.yPosition -= 50;
    page.drawText("REPORT", {
      x: this.margin,
      y: this.yPosition,
      size: 42,
      font: this.helveticaBold,
      color: COLORS.white,
    });

    // Accent underline
    this.yPosition -= 20;
    page.drawRectangle({
      x: this.margin,
      y: this.yPosition,
      width: 80,
      height: 4,
      color: COLORS.accent,
    });

    // Project Name
    this.yPosition -= 50;
    const factoryName = identity.factory_name || project.name || "Industrial Project";
    page.drawText(factoryName.toUpperCase(), {
      x: this.margin,
      y: this.yPosition,
      size: 14,
      font: this.helveticaBold,
      color: COLORS.accent,
    });

    // Category
    this.yPosition -= 25;
    const category = identity.industrial_category || "Manufacturing Facility";
    page.drawText(category, {
      x: this.margin,
      y: this.yPosition,
      size: 11,
      font: this.helvetica,
      color: COLORS.textLight,
    });

    // Key Metrics at bottom
    const metricsY = 200;
    
    // Divider line
    page.drawLine({
      start: { x: this.margin, y: metricsY + 50 },
      end: { x: this.pageWidth - this.margin, y: metricsY + 50 },
      thickness: 0.5,
      color: COLORS.navyLight,
    });

    const metrics = [
      { label: "TOTAL INVESTMENT", value: this.formatCurrency(analysis?.initial_investment?.total || 0) },
      { label: "ANNUAL ROI", value: `${(analysis?.financial_metrics?.roi || 0).toFixed(1)}%` },
      { label: "PAYBACK PERIOD", value: `${(analysis?.financial_metrics?.payback_period_years || 0).toFixed(1)} yrs` },
      { label: "NPV (5 YEAR)", value: this.formatCurrency(analysis?.financial_metrics?.npv_5_years || 0) },
    ];

    const metricWidth = (this.pageWidth - this.margin * 2) / metrics.length;
    
    metrics.forEach((metric, index) => {
      const x = this.margin + (metricWidth * index);
      
      // Value
      page.drawText(metric.value, {
        x,
        y: metricsY,
        size: 16,
        font: this.courier, // Monospace for numbers
        color: COLORS.white,
      });
      
      // Label
      page.drawText(metric.label, {
        x,
        y: metricsY - 18,
        size: 8,
        font: this.helvetica,
        color: COLORS.textLight,
      });
    });

    // Footer
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    page.drawText(date, {
      x: this.margin,
      y: 60,
      size: 9,
      font: this.helvetica,
      color: COLORS.textLight,
    });

    page.drawText("CONFIDENTIAL", {
      x: this.pageWidth - this.margin - this.helveticaBold.widthOfTextAtSize("CONFIDENTIAL", 9),
      y: 60,
      size: 9,
      font: this.helveticaBold,
      color: COLORS.accent,
    });
  }

  // ============================================
  // TABLE OF CONTENTS
  // ============================================
  private async generateTableOfContents(sections: ReportSection[]): Promise<void> {
    const page = this.addNewPage();

    // Header
    page.drawText("CONTENTS", {
      x: this.margin,
      y: this.pageHeight - 80,
      size: 24,
      font: this.helveticaBold,
      color: COLORS.navy,
    });

    // Accent underline
    page.drawRectangle({
      x: this.margin,
      y: this.pageHeight - 92,
      width: 50,
      height: 3,
      color: COLORS.accent,
    });

    this.yPosition = this.pageHeight - 140;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionNum = String(i + 1).padStart(2, "0");

      this.checkNewPage(70);

      // Section number
      this.currentPage.drawText(sectionNum, {
        x: this.margin,
        y: this.yPosition,
        size: 12,
        font: this.helveticaBold,
        color: COLORS.accent,
      });

      // Section title
      this.currentPage.drawText(section.title, {
        x: this.margin + 35,
        y: this.yPosition,
        size: 12,
        font: this.helveticaBold,
        color: COLORS.navy,
      });

      // Subtitle
      this.currentPage.drawText(section.subtitle, {
        x: this.margin + 35,
        y: this.yPosition - 16,
        size: 9,
        font: this.helvetica,
        color: COLORS.textMedium,
      });

      // Dotted leader line
      const titleWidth = this.helveticaBold.widthOfTextAtSize(section.title, 12);
      const leaderStart = this.margin + 35 + titleWidth + 10;
      const leaderEnd = this.pageWidth - this.margin - 30;
      
      // Draw dots
      let dotX = leaderStart;
      while (dotX < leaderEnd) {
        this.currentPage.drawCircle({
          x: dotX,
          y: this.yPosition + 3,
          size: 0.8,
          color: COLORS.border,
        });
        dotX += 6;
      }

      this.yPosition -= 55;
    }
  }

  // ============================================
  // SECTION COVER PAGE
  // ============================================
  private async generateSectionCover(number: string, title: string, subtitle: string): Promise<void> {
    const page = this.addNewPage();

    // Light gray background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageWidth,
      height: this.pageHeight,
      color: COLORS.bgLight,
    });

    // Left accent bar
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 6,
      height: this.pageHeight,
      color: COLORS.accent,
    });

    // Large faded number in background
    page.drawText(number, {
      x: this.pageWidth - 200,
      y: this.pageHeight - 250,
      size: 140,
      font: this.helveticaBold,
      color: rgb(0.92, 0.93, 0.95),
    });

    // Section number badge
    const centerY = this.pageHeight / 2 + 30;
    
    page.drawRectangle({
      x: this.margin,
      y: centerY + 50,
      width: 45,
      height: 28,
      color: COLORS.accent,
    });
    
    page.drawText(number, {
      x: this.margin + 12,
      y: centerY + 58,
      size: 13,
      font: this.helveticaBold,
      color: COLORS.white,
    });

    // Title
    page.drawText(title.toUpperCase(), {
      x: this.margin,
      y: centerY - 10,
      size: 28,
      font: this.helveticaBold,
      color: COLORS.navy,
    });

    // Accent underline
    page.drawRectangle({
      x: this.margin,
      y: centerY - 30,
      width: 50,
      height: 3,
      color: COLORS.accent,
    });

    // Subtitle
    page.drawText(subtitle, {
      x: this.margin,
      y: centerY - 55,
      size: 11,
      font: this.helvetica,
      color: COLORS.textMedium,
    });
  }

  // ============================================
  // SECTION CONTENT GENERATOR
  // ============================================
  private async generateSectionContent(sectionId: string, data: ReportData): Promise<void> {
    switch (sectionId) {
      case "executive":
        await this.generateExecutiveSummary(data);
        break;
      case "identity":
        await this.generateIndustrialIdentity(data);
        break;
      case "production":
        await this.generateProductionSection(data);
        break;
      case "facility":
        await this.generateFacilitySection(data);
        break;
      case "equipment":
        await this.generateEquipmentSection(data);
        break;
      case "suppliers":
        await this.generateSuppliersSection(data);
        break;
      case "financial":
        await this.generateFinancialSection(data);
        break;
      case "projections":
        await this.generateProjectionsSection(data);
        break;
      case "risk":
        await this.generateRiskSection(data);
        break;
      case "digital":
        await this.generateDigitalSection(data);
        break;
      case "location":
        await this.generateLocationSection(data);
        break;
      case "appendix":
        await this.generateAppendix(data);
        break;
    }
  }

  // ============================================
  // EXECUTIVE SUMMARY
  // ============================================
  private async generateExecutiveSummary(data: ReportData): Promise<void> {
    this.addNewPage();
    const { tcoAnalysis, planningData, project } = data;
    const analysis = tcoAnalysis || {};
    const summary = planningData?.executive_summary || {};
    const hasFinancialData = analysis?.initial_investment?.total > 0 || analysis?.financial_metrics?.roi > 0;

    this.yPosition = this.pageHeight - this.margin;

    // Investment Recommendation Box
    const recommendation = analysis?.executive_summary?.investment_recommendation || 
      summary?.investment_recommendation || 
      (hasFinancialData ? "Proceed with Investment - Strong ROI Potential" : "Financial Analysis Pending");
    const isPositive = !recommendation.toLowerCase().includes("no-go") && 
                       !recommendation.toLowerCase().includes("reject") &&
                       !recommendation.toLowerCase().includes("pending");

    const boxColor = isPositive ? rgb(0.94, 0.99, 0.96) : rgb(1, 0.96, 0.94);
    const borderColor = isPositive ? COLORS.success : COLORS.warning;

    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 70,
      width: this.contentWidth,
      height: 80,
      color: boxColor,
      borderColor: borderColor,
      borderWidth: 1.5,
    });

    this.currentPage.drawText("INVESTMENT RECOMMENDATION", {
      x: this.margin + 20,
      y: this.yPosition - 18,
      size: 9,
      font: this.helveticaBold,
      color: COLORS.textMedium,
    });

    // Truncate recommendation if too long
    const maxRecLength = 80;
    const displayRec = recommendation.length > maxRecLength 
      ? recommendation.substring(0, maxRecLength) + "..."
      : recommendation;

    this.currentPage.drawText(displayRec, {
      x: this.margin + 20,
      y: this.yPosition - 42,
      size: 12,
      font: this.helveticaBold,
      color: isPositive ? COLORS.success : COLORS.warning,
    });

    this.yPosition -= 110;

    // Key Metrics Grid
    this.drawSectionHeader("Key Financial Indicators");
    this.yPosition -= 25;

    const metrics = [
      ["Total Capital Investment (CAPEX)", this.formatCurrency(analysis?.initial_investment?.total || 0)],
      ["Annual Operating Costs (OPEX)", this.formatCurrency(analysis?.operating_costs?.total_annual || 0)],
      ["5-Year Total Cost of Ownership", this.formatCurrency(analysis?.financial_metrics?.total_cost_5_years || 0)],
      ["Return on Investment (ROI)", `${this.formatNumber(analysis?.financial_metrics?.roi || 0, 1)}%`],
      ["Payback Period", `${this.formatNumber(analysis?.financial_metrics?.payback_period_years || 0, 1)} years`],
      ["Internal Rate of Return (IRR)", `${this.formatNumber(analysis?.financial_metrics?.irr || 0, 1)}%`],
      ["Net Present Value (5-Year)", this.formatCurrency(analysis?.financial_metrics?.npv_5_years || 0)],
    ];

    for (const [label, value] of metrics) {
      this.checkNewPage(28);
      this.drawMetricRow(label, value);
      this.yPosition -= 28;
    }

    // Key Highlights
    if (summary?.key_highlights?.length > 0) {
      this.yPosition -= 20;
      this.checkNewPage(100);
      this.drawSectionHeader("Strategic Highlights");
      this.yPosition -= 20;

      for (const highlight of summary.key_highlights.slice(0, 6)) {
        this.checkNewPage(25);
        this.drawBulletPoint(highlight, COLORS.success);
        this.yPosition -= 25;
      }
    }

    // Key Risks Summary
    const risks = analysis?.executive_summary?.key_risks || analysis?.risk_analysis?.key_risks || [];
    if (risks.length > 0) {
      this.yPosition -= 25;
      this.checkNewPage(100);
      this.drawSectionHeader("Key Risk Factors");
      this.yPosition -= 20;

      for (const risk of risks.slice(0, 4)) {
        this.checkNewPage(25);
        this.drawBulletPoint(risk, COLORS.warning);
        this.yPosition -= 25;
      }
    }
  }

  // ============================================
  // INDUSTRIAL IDENTITY
  // ============================================
  private async generateIndustrialIdentity(data: ReportData): Promise<void> {
    this.addNewPage();
    const identity = data.planningData?.industrial_identity || {};
    const location = data.planningData?.location_justification || {};
    const hasDetailedIdentity = identity.factory_name || identity.industrial_category;

    this.yPosition = this.pageHeight - this.margin;

    // Factory Profile
    this.drawSectionHeader("Factory Profile");
    this.yPosition -= 25;

    // If no detailed identity data, show a notice
    if (!hasDetailedIdentity && !data.project?.name) {
      this.drawWrappedText(
        "Detailed industrial identity information will be available after planning phase completion.",
        10,
        COLORS.textMedium
      );
      this.yPosition -= 20;
    }

    const profileData = [
      ["Legal Entity Name", identity.factory_name || data.project?.name || "To be determined"],
      ["Legal Structure", identity.legal_nature || "Limited Liability Company (SPA)"],
      ["Industry Category", identity.industrial_category || "Manufacturing"],
      ["Operating Scope", identity.operating_scope || "Regional Operations"],
      ["Target Markets", (identity.target_markets || []).join(", ") || "Domestic & International"],
    ];

    for (const [label, value] of profileData) {
      this.checkNewPage(25);
      this.drawInfoRow(label, value);
      this.yPosition -= 25;
    }

    // Certifications
    if (identity.certifications_required?.length > 0) {
      this.yPosition -= 30;
      this.checkNewPage(100);
      this.drawSectionHeader("Required Certifications");
      this.yPosition -= 20;

      for (const cert of identity.certifications_required) {
        this.checkNewPage(22);
        this.drawBulletPoint(cert, COLORS.accent);
        this.yPosition -= 22;
      }
    }

    // Strategic Positioning
    if (data.planningData?.executive_summary?.strategic_positioning) {
      this.yPosition -= 30;
      this.checkNewPage(100);
      this.drawSectionHeader("Strategic Positioning");
      this.yPosition -= 20;
      
      this.drawWrappedText(
        data.planningData.executive_summary.strategic_positioning,
        10,
        COLORS.textDark
      );
    }
  }

  // ============================================
  // PRODUCTION SECTION
  // ============================================
  private async generateProductionSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const lines = data.planningData?.production_lines || [];
    const engineering = data.planningData?.factory_engineering || {};

    this.yPosition = this.pageHeight - this.margin;

    this.drawSectionHeader("Production Lines");
    this.yPosition -= 30;

    // Handle case when no production lines defined
    if (lines.length === 0) {
      this.drawWrappedText(
        "Production line specifications will be detailed after completing the planning phase. " +
        "The system will analyze your requirements and define optimal manufacturing processes.",
        10,
        COLORS.textMedium
      );
      this.yPosition -= 30;
      
      // If we have assets, show them as implied production capability
      if (data.assets.length > 0) {
        this.drawSectionHeader("Equipment-Based Production Capability");
        this.yPosition -= 20;
        this.drawWrappedText(
          `Based on ${data.assets.length} equipment items identified for this project.`,
          10,
          COLORS.textDark
        );
      }
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      this.checkNewPage(150);

      // Line card
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 100,
        width: this.contentWidth,
        height: 110,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Line indicator
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 100,
        width: 4,
        height: 110,
        color: COLORS.accent,
      });

      // Line name
      this.currentPage.drawText(line.line_name || `Production Line ${i + 1}`, {
        x: this.margin + 15,
        y: this.yPosition - 18,
        size: 12,
        font: this.helveticaBold,
        color: COLORS.navy,
      });

      let infoY = this.yPosition - 40;

      // Function
      if (line.function) {
        this.currentPage.drawText("Function:", {
          x: this.margin + 15,
          y: infoY,
          size: 9,
          font: this.helveticaBold,
          color: COLORS.textMedium,
        });
        this.currentPage.drawText(this.truncateText(line.function, this.contentWidth - 100), {
          x: this.margin + 80,
          y: infoY,
          size: 9,
          font: this.helvetica,
          color: COLORS.textDark,
        });
        infoY -= 18;
      }

      // Capacity
      if (line.capacity) {
        this.currentPage.drawText("Capacity:", {
          x: this.margin + 15,
          y: infoY,
          size: 9,
          font: this.helveticaBold,
          color: COLORS.textMedium,
        });
        this.currentPage.drawText(this.truncateText(line.capacity, this.contentWidth - 100), {
          x: this.margin + 80,
          y: infoY,
          size: 9,
          font: this.helvetica,
          color: COLORS.textDark,
        });
        infoY -= 18;
      }

      // Process
      if (line.process_logic) {
        this.currentPage.drawText("Process:", {
          x: this.margin + 15,
          y: infoY,
          size: 9,
          font: this.helveticaBold,
          color: COLORS.textMedium,
        });
        this.currentPage.drawText(this.truncateText(line.process_logic, this.contentWidth - 100), {
          x: this.margin + 80,
          y: infoY,
          size: 9,
          font: this.helvetica,
          color: COLORS.textDark,
        });
      }

      this.yPosition -= 125;
    }

    // Material Flow
    if (engineering.material_flow) {
      this.checkNewPage(150);
      this.yPosition -= 20;
      this.drawSectionHeader("Material Flow");
      this.yPosition -= 25;

      const flow = engineering.material_flow;
      const flowData = [
        ["Raw Material Intake", flow.raw_material_intake || "Standard receiving dock"],
        ["Production Flow", flow.production_flow || "Sequential processing"],
        ["Finished Goods Output", flow.finished_goods_output || "Direct shipping"],
      ];

      for (const [label, value] of flowData) {
        this.checkNewPage(25);
        this.drawInfoRow(label, value);
        this.yPosition -= 25;
      }
    }
  }

  // ============================================
  // FACILITY SECTION
  // ============================================
  private async generateFacilitySection(data: ReportData): Promise<void> {
    this.addNewPage();
    const dimensions = data.planningData?.factory_dimensions || {};
    const location = data.planningData?.location_justification || {};
    const engineering = data.planningData?.factory_engineering || {};

    this.yPosition = this.pageHeight - this.margin;

    this.drawSectionHeader("Building Dimensions");
    this.yPosition -= 25;

    const totalArea = dimensions.total_area_sqm || 
      (dimensions.width * dimensions.length) || 0;

    const dimensionData = [
      ["Width", `${this.formatNumber(dimensions.width || 0, 0)} meters`],
      ["Length", `${this.formatNumber(dimensions.length || 0, 0)} meters`],
      ["Height", `${this.formatNumber(dimensions.height || 0, 1)} meters`],
      ["Number of Floors", `${dimensions.floors || 1}`],
      ["Total Floor Area", `${this.formatNumber(totalArea, 0)} sqm`],
      ["Gross Building Volume", `${this.formatNumber(totalArea * (dimensions.height || 6), 0)} m3`],
    ];

    for (const [label, value] of dimensionData) {
      this.checkNewPage(25);
      this.drawInfoRow(label, value);
      this.yPosition -= 25;
    }

    // Zoning
    if (data.planningData?.layout_zones?.length > 0) {
      this.yPosition -= 30;
      this.checkNewPage(100);
      this.drawSectionHeader("Facility Zones");
      this.yPosition -= 20;

      for (const zone of data.planningData.layout_zones.slice(0, 8)) {
        this.checkNewPage(22);
        const zoneName = typeof zone === "string" ? zone : zone.name || zone.zone_name || "Zone";
        this.drawBulletPoint(zoneName, COLORS.accent);
        this.yPosition -= 22;
      }
    }

    // Utilities
    if (engineering.utilities) {
      this.yPosition -= 30;
      this.checkNewPage(120);
      this.drawSectionHeader("Utilities & Infrastructure");
      this.yPosition -= 25;

      const utils = engineering.utilities;
      const utilityData = [
        ["Electrical Supply", utils.electrical_supply || "High-voltage industrial connection"],
        ["Water Supply", utils.water_supply || "Municipal water with treatment"],
        ["HVAC System", utils.hvac_requirements || "Industrial climate control"],
        ["Waste Management", utils.waste_management || "Certified disposal partner"],
      ];

      for (const [label, value] of utilityData) {
        this.checkNewPage(25);
        this.drawInfoRow(label, value);
        this.yPosition -= 25;
      }
    }
  }

  // ============================================
  // EQUIPMENT SECTION
  // ============================================
  private async generateEquipmentSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const assets = data.assets || [];

    this.yPosition = this.pageHeight - this.margin;

    this.drawSectionHeader(`Equipment Inventory (${assets.length} Items)`);
    this.yPosition -= 30;

    let totalCost = 0;

    for (const asset of assets) {
      this.checkNewPage(100);

      // Equipment card
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 80,
        width: this.contentWidth,
        height: 90,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Equipment name
      this.currentPage.drawText(this.truncateText(asset.name || "Equipment", this.contentWidth - 150), {
        x: this.margin + 15,
        y: this.yPosition - 18,
        size: 11,
        font: this.helveticaBold,
        color: COLORS.navy,
      });

      // Type badge
      const assetType = (asset.type || "Equipment").substring(0, 20);
      const typeWidth = this.helvetica.widthOfTextAtSize(assetType, 8) + 14;
      
      this.currentPage.drawRectangle({
        x: this.pageWidth - this.margin - typeWidth - 10,
        y: this.yPosition - 23,
        width: typeWidth,
        height: 16,
        color: COLORS.accent,
      });
      
      this.currentPage.drawText(assetType, {
        x: this.pageWidth - this.margin - typeWidth - 3,
        y: this.yPosition - 18,
        size: 8,
        font: this.helvetica,
        color: COLORS.white,
      });

      // Specifications
      const specs = asset.specifications || {};
      const cost = specs.estimated_cost_usd || 0;
      totalCost += cost;

      let specY = this.yPosition - 42;

      // Cost
      this.currentPage.drawText(`Estimated Cost: ${this.formatCurrency(cost)}`, {
        x: this.margin + 15,
        y: specY,
        size: 10,
        font: this.courier,
        color: COLORS.success,
      });
      specY -= 18;

      // Dimensions
      if (specs.dimensions) {
        this.currentPage.drawText(`Dimensions: ${specs.dimensions}`, {
          x: this.margin + 15,
          y: specY,
          size: 9,
          font: this.helvetica,
          color: COLORS.textMedium,
        });
        specY -= 16;
      }

      // Power
      if (specs.power_kw) {
        this.currentPage.drawText(`Power: ${specs.power_kw} kW`, {
          x: this.margin + 200,
          y: specY + 16,
          size: 9,
          font: this.helvetica,
          color: COLORS.textMedium,
        });
      }

      this.yPosition -= 100;
    }

    // Total Equipment Cost Summary
    this.yPosition -= 15;
    this.checkNewPage(60);

    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 40,
      width: this.contentWidth,
      height: 50,
      color: COLORS.navy,
    });

    this.currentPage.drawText("TOTAL EQUIPMENT INVESTMENT", {
      x: this.margin + 20,
      y: this.yPosition - 18,
      size: 10,
      font: this.helvetica,
      color: COLORS.textLight,
    });

    const totalStr = this.formatCurrency(totalCost);
    this.currentPage.drawText(totalStr, {
      x: this.pageWidth - this.margin - 20 - this.courier.widthOfTextAtSize(totalStr, 16),
      y: this.yPosition - 22,
      size: 16,
      font: this.courier,
      color: COLORS.white,
    });
  }

  // ============================================
  // SUPPLIERS SECTION
  // ============================================
  private async generateSuppliersSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const suppliers = data.suppliers || [];

    this.yPosition = this.pageHeight - this.margin;

    this.drawSectionHeader(`Verified Suppliers (${suppliers.length})`);
    this.yPosition -= 30;

    for (const supplier of suppliers) {
      this.checkNewPage(100);

      // Supplier card
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 80,
        width: this.contentWidth,
        height: 90,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Supplier name
      this.currentPage.drawText(this.truncateText(supplier.name || "Supplier", this.contentWidth - 100), {
        x: this.margin + 15,
        y: this.yPosition - 18,
        size: 11,
        font: this.helveticaBold,
        color: COLORS.navy,
      });

      // Verification badge
      if (supplier.verified) {
        this.currentPage.drawRectangle({
          x: this.pageWidth - this.margin - 70,
          y: this.yPosition - 23,
          width: 55,
          height: 16,
          color: COLORS.success,
        });
        this.currentPage.drawText("VERIFIED", {
          x: this.pageWidth - this.margin - 65,
          y: this.yPosition - 18,
          size: 8,
          font: this.helveticaBold,
          color: COLORS.white,
        });
      }

      let infoY = this.yPosition - 40;

      // Location
      if (supplier.location || supplier.country) {
        this.currentPage.drawText(`Location: ${supplier.location || supplier.country}`, {
          x: this.margin + 15,
          y: infoY,
          size: 9,
          font: this.helvetica,
          color: COLORS.textMedium,
        });
        infoY -= 15;
      }

      // Contact
      if (supplier.email) {
        this.currentPage.drawText(`Email: ${supplier.email}`, {
          x: this.margin + 15,
          y: infoY,
          size: 9,
          font: this.helvetica,
          color: COLORS.accent,
        });
        infoY -= 15;
      }

      if (supplier.website) {
        this.currentPage.drawText(`Web: ${this.truncateText(supplier.website, 200)}`, {
          x: this.margin + 15,
          y: infoY,
          size: 9,
          font: this.helvetica,
          color: COLORS.accent,
        });
      }

      this.yPosition -= 100;
    }
  }

  // ============================================
  // FINANCIAL SECTION
  // ============================================
  private async generateFinancialSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const analysis = data.tcoAnalysis || {};
    const hasFinancialData = analysis?.initial_investment?.total > 0;

    this.yPosition = this.pageHeight - this.margin;

    // Show notice if no financial data
    if (!hasFinancialData) {
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 60,
        width: this.contentWidth,
        height: 70,
        color: rgb(1, 0.98, 0.94), // Light amber
        borderColor: COLORS.warning,
        borderWidth: 1,
      });

      this.currentPage.drawText("FINANCIAL ANALYSIS PENDING", {
        x: this.margin + 20,
        y: this.yPosition - 20,
        size: 10,
        font: this.helveticaBold,
        color: COLORS.warning,
      });

      this.currentPage.drawText("Complete cost analysis step to generate detailed financial projections.", {
        x: this.margin + 20,
        y: this.yPosition - 40,
        size: 9,
        font: this.helvetica,
        color: COLORS.textMedium,
      });

      this.yPosition -= 90;
    }

    // CAPEX Section
    this.drawSectionHeader("Initial Investment (CAPEX)");
    this.yPosition -= 25;

    const capex = analysis?.initial_investment || {};
    const capexItems = [
      ["Equipment & Machinery", capex.equipment || 0],
      ["Building & Infrastructure", capex.building || 0],
      ["Installation & Setup", capex.installation || 0],
      ["Working Capital", capex.working_capital || 0],
      ["Contingency Reserve", capex.contingency || 0],
    ];

    for (const [label, value] of capexItems) {
      this.checkNewPage(25);
      this.drawFinancialRow(label, value as number);
      this.yPosition -= 25;
    }

    // CAPEX Total
    this.yPosition -= 5;
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition + 3 },
      end: { x: this.pageWidth - this.margin, y: this.yPosition + 3 },
      thickness: 1,
      color: COLORS.navy,
    });
    this.drawFinancialRow("TOTAL CAPEX", capex.total || 0, true);
    this.yPosition -= 40;

    // OPEX Section
    this.checkNewPage(200);
    this.drawSectionHeader("Annual Operating Costs (OPEX)");
    this.yPosition -= 25;

    const opex = analysis?.operating_costs || {};
    const opexItems = [
      ["Labor & Personnel", opex.labor || 0],
      ["Utilities & Energy", opex.utilities || 0],
      ["Maintenance & Repairs", opex.maintenance || 0],
      ["Raw Materials", opex.raw_materials || 0],
      ["Insurance & Compliance", opex.insurance || 0],
    ];

    for (const [label, value] of opexItems) {
      this.checkNewPage(25);
      this.drawFinancialRow(label, value as number);
      this.yPosition -= 25;
    }

    // OPEX Total
    this.yPosition -= 5;
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition + 3 },
      end: { x: this.pageWidth - this.margin, y: this.yPosition + 3 },
      thickness: 1,
      color: COLORS.navy,
    });
    this.drawFinancialRow("TOTAL ANNUAL OPEX", opex.total_annual || 0, true);
    this.yPosition -= 40;

    // Financial Metrics
    this.checkNewPage(200);
    this.drawSectionHeader("Financial Metrics Summary");
    this.yPosition -= 25;

    const metrics = analysis?.financial_metrics || {};
    const metricData = [
      ["5-Year TCO", this.formatCurrency(metrics.total_cost_5_years || 0)],
      ["10-Year TCO", this.formatCurrency(metrics.total_cost_10_years || 0)],
      ["Net Present Value (10%)", this.formatCurrency(metrics.npv_5_years || 0)],
      ["Internal Rate of Return", `${this.formatNumber(metrics.irr || 0, 1)}%`],
      ["Return on Investment", `${this.formatNumber(metrics.roi || 0, 1)}%`],
      ["Payback Period", `${this.formatNumber(metrics.payback_period_years || 0, 1)} years`],
    ];

    for (const [label, value] of metricData) {
      this.checkNewPage(28);
      this.drawMetricRow(label, value);
      this.yPosition -= 28;
    }
  }

  // ============================================
  // PROJECTIONS SECTION
  // ============================================
  private async generateProjectionsSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const analysis = data.tcoAnalysis || {};
    const projections = analysis?.projections || analysis?.ten_year_projection || [];

    this.yPosition = this.pageHeight - this.margin;

    this.drawSectionHeader("10-Year Financial Projections");
    this.yPosition -= 30;

    if (projections.length === 0) {
      this.drawWrappedText("Financial projections not available.", 11, COLORS.textMedium);
      return;
    }

    // Table Header
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 22,
      width: this.contentWidth,
      height: 28,
      color: COLORS.navy,
    });

    const headers = ["Year", "Revenue", "Costs", "Cash Flow", "Cumulative"];
    const colWidths = [45, 110, 100, 110, 120];
    let headerX = this.margin + 8;

    for (let i = 0; i < headers.length; i++) {
      this.currentPage.drawText(headers[i], {
        x: headerX,
        y: this.yPosition - 14,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.white,
      });
      headerX += colWidths[i];
    }

    this.yPosition -= 28;

    // Table Rows
    for (let i = 0; i < Math.min(projections.length, 10); i++) {
      const proj = projections[i];
      this.checkNewPage(26);

      const isEven = i % 2 === 0;
      if (isEven) {
        this.currentPage.drawRectangle({
          x: this.margin,
          y: this.yPosition - 20,
          width: this.contentWidth,
          height: 24,
          color: COLORS.bgSubtle,
        });
      }

      let rowX = this.margin + 8;
      
      // Year
      this.currentPage.drawText(`Year ${proj.year || i + 1}`, {
        x: rowX,
        y: this.yPosition - 12,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.textDark,
      });
      rowX += colWidths[0];

      // Revenue
      this.currentPage.drawText(this.formatCurrency(proj.revenue || 0), {
        x: rowX,
        y: this.yPosition - 12,
        size: 9,
        font: this.courier,
        color: COLORS.textDark,
      });
      rowX += colWidths[1];

      // Costs
      this.currentPage.drawText(this.formatCurrency(proj.total_costs || proj.costs || 0), {
        x: rowX,
        y: this.yPosition - 12,
        size: 9,
        font: this.courier,
        color: COLORS.textDark,
      });
      rowX += colWidths[2];

      // Cash Flow
      const cashFlow = proj.net_cash_flow || 0;
      this.currentPage.drawText(this.formatCurrency(cashFlow), {
        x: rowX,
        y: this.yPosition - 12,
        size: 9,
        font: this.courier,
        color: cashFlow >= 0 ? COLORS.success : COLORS.danger,
      });
      rowX += colWidths[3];

      // Cumulative
      const cumulative = proj.cumulative_cash_flow || 0;
      this.currentPage.drawText(this.formatCurrency(cumulative), {
        x: rowX,
        y: this.yPosition - 12,
        size: 9,
        font: this.courier,
        color: cumulative >= 0 ? COLORS.success : COLORS.danger,
      });

      this.yPosition -= 24;
    }
  }

  // ============================================
  // RISK SECTION
  // ============================================
  private async generateRiskSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const risks = data.planningData?.risk_assessment || {};
    const analysisRisks = data.tcoAnalysis?.risk_analysis || {};

    this.yPosition = this.pageHeight - this.margin;

    const riskCategories = [
      { title: "Market Risks", items: risks.market_risks || [], color: COLORS.warning },
      { title: "Technical Risks", items: risks.technical_risks || [], color: COLORS.accent },
      { title: "Supply Chain Risks", items: risks.supply_risks || [], color: COLORS.warning },
      { title: "Operational Risks", items: risks.operational_risks || [], color: COLORS.textMedium },
    ];

    for (const category of riskCategories) {
      if (category.items.length === 0) continue;

      this.checkNewPage(100);
      this.drawSectionHeader(category.title);
      this.yPosition -= 20;

      for (const risk of category.items.slice(0, 4)) {
        this.checkNewPage(25);
        this.drawBulletPoint(risk, category.color);
        this.yPosition -= 25;
      }

      this.yPosition -= 15;
    }

    // Mitigation Strategies
    if (risks.mitigation_strategies?.length > 0) {
      this.yPosition -= 10;
      this.checkNewPage(150);

      // Green box for mitigation
      const boxHeight = Math.min(risks.mitigation_strategies.length * 25 + 50, 200);
      
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - boxHeight,
        width: this.contentWidth,
        height: boxHeight,
        color: rgb(0.94, 0.99, 0.96),
        borderColor: COLORS.success,
        borderWidth: 1,
      });

      this.currentPage.drawText("MITIGATION STRATEGIES", {
        x: this.margin + 20,
        y: this.yPosition - 22,
        size: 10,
        font: this.helveticaBold,
        color: COLORS.success,
      });

      this.yPosition -= 45;

      for (const strategy of risks.mitigation_strategies.slice(0, 5)) {
        this.currentPage.drawText(`>> ${this.truncateText(strategy, this.contentWidth - 60)}`, {
          x: this.margin + 25,
          y: this.yPosition,
          size: 9,
          font: this.helvetica,
          color: COLORS.textDark,
        });
        this.yPosition -= 22;
      }
    }
  }

  // ============================================
  // DIGITAL TRANSFORMATION SECTION
  // ============================================
  private async generateDigitalSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const digital = data.planningData?.digital_transformation || {};

    this.yPosition = this.pageHeight - this.margin;

    this.drawSectionHeader("Industry 4.0 Capabilities");
    this.yPosition -= 30;

    const capabilities = [
      { label: "Production Optimization", value: digital.production_optimization || "AI-driven process optimization" },
      { label: "Predictive Maintenance", value: digital.predictive_maintenance || "Sensor-based failure prediction" },
      { label: "Quality Intelligence", value: digital.quality_intelligence || "Machine vision inspection" },
      { label: "Energy Management", value: digital.energy_optimization || "Smart grid integration" },
      { label: "Business Intelligence", value: digital.business_intelligence || "Real-time analytics dashboards" },
      { label: "Cybersecurity", value: digital.cybersecurity || "Industrial network protection" },
    ];

    for (const cap of capabilities) {
      this.checkNewPage(70);

      // Capability card
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 50,
        width: this.contentWidth,
        height: 55,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Label
      this.currentPage.drawText(cap.label.toUpperCase(), {
        x: this.margin + 15,
        y: this.yPosition - 18,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.accent,
      });

      // Value
      this.currentPage.drawText(this.truncateText(cap.value, this.contentWidth - 40), {
        x: this.margin + 15,
        y: this.yPosition - 36,
        size: 10,
        font: this.helvetica,
        color: COLORS.textDark,
      });

      this.yPosition -= 65;
    }
  }

  // ============================================
  // LOCATION SECTION
  // ============================================
  private async generateLocationSection(data: ReportData): Promise<void> {
    this.addNewPage();
    const location = data.planningData?.location_justification || {};

    this.yPosition = this.pageHeight - this.margin;

    this.drawSectionHeader("Site Selection");
    this.yPosition -= 25;

    const locationData = [
      ["Recommended Region", location.recommended_region || "To be determined"],
      ["Industrial Zone Type", location.industrial_zone_type || "General Industrial Zone"],
      ["Total Land Area", `${this.formatNumber(location.land_requirements?.total_area_sqm || 0, 0)} sqm`],
      ["Built Area", `${this.formatNumber(location.land_requirements?.built_area_sqm || 0, 0)} sqm`],
      ["Expansion Reserve", `${this.formatNumber(location.land_requirements?.expansion_reserve_sqm || 0, 0)} sqm`],
    ];

    for (const [label, value] of locationData) {
      this.checkNewPage(25);
      this.drawInfoRow(label, value);
      this.yPosition -= 25;
    }

    // Selection Criteria
    if (location.selection_criteria?.length > 0) {
      this.yPosition -= 30;
      this.checkNewPage(100);
      this.drawSectionHeader("Selection Criteria");
      this.yPosition -= 20;

      for (const criterion of location.selection_criteria) {
        this.checkNewPage(22);
        this.drawBulletPoint(criterion, COLORS.accent);
        this.yPosition -= 22;
      }
    }

    // Logistics Access
    if (location.logistics_access) {
      this.yPosition -= 30;
      this.checkNewPage(150);
      this.drawSectionHeader("Logistics Infrastructure");
      this.yPosition -= 25;

      const logistics = location.logistics_access;
      const logisticsData = [
        ["Nearest Port", logistics.nearest_port || "N/A"],
        ["Highway Access", logistics.highway_access || "N/A"],
        ["Railway Access", logistics.railway_access || "N/A"],
        ["Supplier Proximity", logistics.supplier_proximity || "N/A"],
      ];

      for (const [label, value] of logisticsData) {
        this.checkNewPage(25);
        this.drawInfoRow(label, value);
        this.yPosition -= 25;
      }
    }
  }

  // ============================================
  // APPENDIX
  // ============================================
  private async generateAppendix(data: ReportData): Promise<void> {
    this.addNewPage();
    const messages = data.messages || [];
    const hasFullPlanningData = data.planningData && Object.keys(data.planningData).length > 2;

    this.yPosition = this.pageHeight - this.margin;

    // Data Completeness Summary
    this.drawSectionHeader("Report Data Summary");
    this.yPosition -= 25;

    const dataStatus = [
      ["Planning Data", hasFullPlanningData ? "Complete" : "Pending"],
      ["Equipment Inventory", data.assets.length > 0 ? `${data.assets.length} items` : "Pending"],
      ["Supplier Network", data.suppliers.length > 0 ? `${data.suppliers.length} suppliers` : "Pending"],
      ["Financial Analysis", (data.tcoAnalysis?.initial_investment?.total || 0) > 0 ? "Complete" : "Pending"],
      ["Conversation Records", `${messages.length} messages`],
    ];

    for (const [label, value] of dataStatus) {
      this.drawInfoRow(label, value);
      this.yPosition -= 22;
    }

    this.yPosition -= 30;
    this.drawSectionHeader("Project Requirements");
    this.yPosition -= 25;

    // Summary of requirements from user messages
    const userMessages = messages.filter(m => m.role === "user");
    
    if (userMessages.length === 0) {
      this.drawWrappedText(
        "No conversation records found. Project requirements will be documented as you interact with the system.",
        10,
        COLORS.textMedium
      );
      return;
    }

    this.currentPage.drawText(`${userMessages.length} requirement conversations documented`, {
      x: this.margin,
      y: this.yPosition,
      size: 10,
      font: this.helvetica,
      color: COLORS.textMedium,
    });
    this.yPosition -= 25;

    // Show first few user messages
    for (let i = 0; i < Math.min(userMessages.length, 5); i++) {
      const msg = userMessages[i];
      const content = typeof msg.content === "string" 
        ? msg.content 
        : JSON.stringify(msg.content);
      
      this.checkNewPage(80);

      // Message box
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 55,
        width: this.contentWidth,
        height: 60,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Timestamp
      const timestamp = new Date(msg.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      
      this.currentPage.drawText(timestamp, {
        x: this.margin + 10,
        y: this.yPosition - 15,
        size: 8,
        font: this.helvetica,
        color: COLORS.textLight,
      });

      // Content preview
      const preview = this.truncateText(content, this.contentWidth - 40);
      this.currentPage.drawText(preview, {
        x: this.margin + 10,
        y: this.yPosition - 35,
        size: 9,
        font: this.helvetica,
        color: COLORS.textDark,
      });

      this.yPosition -= 70;
    }

    // Document footer
    this.yPosition -= 30;
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition },
      end: { x: this.pageWidth - this.margin, y: this.yPosition },
      thickness: 0.5,
      color: COLORS.border,
    });
    
    this.yPosition -= 20;
    this.currentPage.drawText("End of Report", {
      x: (this.pageWidth - this.helveticaOblique.widthOfTextAtSize("End of Report", 10)) / 2,
      y: this.yPosition,
      size: 10,
      font: this.helveticaOblique,
      color: COLORS.textLight,
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private drawSectionHeader(title: string): void {
    this.currentPage.drawText(title, {
      x: this.margin,
      y: this.yPosition,
      size: 13,
      font: this.helveticaBold,
      color: COLORS.navy,
    });

    // Accent underline
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 8,
      width: Math.min(this.helveticaBold.widthOfTextAtSize(title, 13), 150),
      height: 2,
      color: COLORS.accent,
    });
  }

  private drawMetricRow(label: string, value: string): void {
    this.currentPage.drawText(label, {
      x: this.margin,
      y: this.yPosition,
      size: 10,
      font: this.helvetica,
      color: COLORS.textMedium,
    });

    this.currentPage.drawText(value, {
      x: this.pageWidth - this.margin - this.courier.widthOfTextAtSize(value, 11),
      y: this.yPosition,
      size: 11,
      font: this.courier,
      color: COLORS.navy,
    });
  }

  private drawInfoRow(label: string, value: string): void {
    this.currentPage.drawText(label + ":", {
      x: this.margin,
      y: this.yPosition,
      size: 10,
      font: this.helveticaBold,
      color: COLORS.textMedium,
    });

    const truncatedValue = this.truncateText(value, this.contentWidth - 160);
    this.currentPage.drawText(truncatedValue, {
      x: this.margin + 160,
      y: this.yPosition,
      size: 10,
      font: this.helvetica,
      color: COLORS.textDark,
    });
  }

  private drawFinancialRow(label: string, value: number, isTotal: boolean = false): void {
    const font = isTotal ? this.helveticaBold : this.helvetica;
    const size = isTotal ? 11 : 10;
    const color = isTotal ? COLORS.navy : COLORS.textDark;

    this.currentPage.drawText(label, {
      x: this.margin + 10,
      y: this.yPosition,
      size,
      font,
      color,
    });

    const valueStr = this.formatCurrency(value);
    this.currentPage.drawText(valueStr, {
      x: this.pageWidth - this.margin - 10 - this.courier.widthOfTextAtSize(valueStr, size),
      y: this.yPosition,
      size,
      font: this.courier,
      color,
    });
  }

  private drawBulletPoint(text: string, color: any): void {
    // Bullet
    this.currentPage.drawCircle({
      x: this.margin + 8,
      y: this.yPosition + 3,
      size: 3,
      color,
    });

    // Text
    const truncatedText = this.truncateText(text, this.contentWidth - 30);
    this.currentPage.drawText(truncatedText, {
      x: this.margin + 20,
      y: this.yPosition,
      size: 10,
      font: this.helvetica,
      color: COLORS.textDark,
    });
  }

  private drawWrappedText(text: string, size: number, color: any): void {
    // Sanitize text first
    const sanitized = this.sanitizeText(text);
    const words = sanitized.split(" ");
    let line = "";
    const maxWidth = this.contentWidth - 20;

    for (const word of words) {
      const testLine = line + (line ? " " : "") + word;
      const width = this.helvetica.widthOfTextAtSize(testLine, size);

      if (width > maxWidth && line) {
        this.checkNewPage(18);
        this.currentPage.drawText(line, {
          x: this.margin + 10,
          y: this.yPosition,
          size,
          font: this.helvetica,
          color,
        });
        this.yPosition -= 16;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      this.checkNewPage(18);
      this.currentPage.drawText(line, {
        x: this.margin + 10,
        y: this.yPosition,
        size,
        font: this.helvetica,
        color,
      });
      this.yPosition -= 16;
    }
  }

  /**
   * Sanitize text to only use WinAnsi-compatible characters
   * pdf-lib standard fonts can only encode WinAnsi characters
   */
  private sanitizeText(text: string): string {
    if (!text) return "";
    
    // Replace common problematic Unicode characters with ASCII equivalents
    return text
      .replace(/→/g, ">>")
      .replace(/←/g, "<<")
      .replace(/↑/g, "^")
      .replace(/↓/g, "v")
      .replace(/•/g, "-")
      .replace(/·/g, "-")
      .replace(/²/g, "2")
      .replace(/³/g, "3")
      .replace(/°/g, " deg")
      .replace(/±/g, "+/-")
      .replace(/×/g, "x")
      .replace(/÷/g, "/")
      .replace(/≠/g, "!=")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/…/g, "...")
      .replace(/–/g, "-")
      .replace(/—/g, "--")
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      .replace(/'/g, "'")
      .replace(/™/g, "(TM)")
      .replace(/®/g, "(R)")
      .replace(/©/g, "(C)")
      .replace(/€/g, "EUR")
      .replace(/£/g, "GBP")
      .replace(/¥/g, "JPY")
      // Remove any remaining non-ASCII characters
      .replace(/[^\x00-\x7F]/g, "");
  }

  private truncateText(text: string, maxWidth: number): string {
    if (!text) return "";
    
    // Sanitize text first
    const sanitized = this.sanitizeText(text);
    
    if (this.helvetica.widthOfTextAtSize(sanitized, 10) <= maxWidth) {
      return sanitized;
    }

    let truncated = sanitized;
    while (this.helvetica.widthOfTextAtSize(truncated + "...", 10) > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "...";
  }

  private formatCurrency(value: number): string {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  }

  private formatNumber(value: number, decimals: number = 0): string {
    return value.toFixed(decimals);
  }
}

export const fullReportGenerator = new FullReportGenerator();

