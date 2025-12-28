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

    // ============================================
    // PART I: EXECUTIVE OVERVIEW
    // ============================================
    sections.push({
      id: "executive",
      title: "Executive Summary",
      subtitle: "Strategic investment overview, key findings, and recommendations",
    });

    sections.push({
      id: "identity",
      title: "Company Profile & Industrial Identity",
      subtitle: "Factory profile, legal structure, brand identity, and market positioning",
    });

    sections.push({
      id: "market",
      title: "Market Analysis & Opportunity",
      subtitle: "Industry overview, competitive landscape, and growth potential",
    });

    // ============================================
    // PART II: TECHNICAL & PRODUCTION
    // ============================================
    sections.push({
      id: "production",
      title: "Production Engineering & Processes",
      subtitle: "Manufacturing lines, production workflows, and capacity analysis",
    });

    sections.push({
      id: "facility",
      title: "Facility Design & Specifications",
      subtitle: "Building dimensions, layout, zoning, and infrastructure requirements",
    });

    // Equipment & Assets - detailed if available
    if (data.assets.length > 0) {
      sections.push({
        id: "equipment",
        title: "Equipment & Machinery Inventory",
        subtitle: "Complete equipment list with detailed specifications",
      });

      sections.push({
        id: "equipment_detail",
        title: "Technical Equipment Specifications",
        subtitle: "Detailed specifications, capacities, and requirements for each asset",
      });
    } else {
      sections.push({
        id: "equipment",
        title: "Equipment & Machinery Requirements",
        subtitle: "Planned equipment needs and specifications",
      });
    }

    sections.push({
      id: "quality",
      title: "Quality Assurance & Standards",
      subtitle: "Quality management systems, certifications, and compliance requirements",
    });

    // ============================================
    // PART III: SUPPLY CHAIN & PROCUREMENT
    // ============================================
    sections.push({
      id: "suppliers",
      title: "Supplier Network & Procurement",
      subtitle: "Verified suppliers, sourcing strategy, and vendor relationships",
    });

    if (data.suppliers.length > 0) {
      sections.push({
        id: "supplier_analysis",
        title: "Supplier Analysis & Comparison",
        subtitle: "Detailed supplier evaluation, pricing, and selection criteria",
      });
    }

    // ============================================
    // PART IV: FINANCIAL ANALYSIS
    // ============================================
    sections.push({
      id: "financial",
      title: "Financial Analysis Overview",
      subtitle: "Investment summary, key financial metrics, and funding requirements",
    });

    sections.push({
      id: "capex",
      title: "Capital Expenditure Breakdown",
      subtitle: "Detailed CAPEX analysis by category with cost justification",
    });

    sections.push({
      id: "opex",
      title: "Operating Cost Analysis",
      subtitle: "Annual operating expenses, cost structure, and efficiency metrics",
    });

    sections.push({
      id: "projections",
      title: "10-Year Financial Projections",
      subtitle: "Revenue forecasts, cash flow analysis, and profitability timeline",
    });

    sections.push({
      id: "roi",
      title: "ROI & Payback Analysis",
      subtitle: "Return on investment, payback period, and NPV calculations",
    });

    // ============================================
    // PART V: RISK & STRATEGY
    // ============================================
    sections.push({
      id: "risk",
      title: "Risk Assessment & Mitigation",
      subtitle: "Risk identification, probability analysis, and mitigation strategies",
    });

    sections.push({
      id: "sensitivity",
      title: "Sensitivity Analysis",
      subtitle: "Financial impact of key variable changes and scenario planning",
    });

    // Digital Transformation
    if (data.planningData?.digital_transformation) {
      sections.push({
        id: "digital",
        title: "Digital Transformation Strategy",
        subtitle: "Industry 5.0 integration, IoT, and smart factory capabilities",
      });
    }

    sections.push({
      id: "sustainability",
      title: "Sustainability & ESG Considerations",
      subtitle: "Environmental impact, energy efficiency, and ESG compliance",
    });

    // ============================================
    // PART VI: IMPLEMENTATION
    // ============================================
    sections.push({
      id: "location",
      title: "Location Analysis & Logistics",
      subtitle: "Site selection criteria, logistics optimization, and supply chain",
    });

    sections.push({
      id: "timeline",
      title: "Implementation Timeline",
      subtitle: "Project phases, milestones, and critical path analysis",
    });

    sections.push({
      id: "team",
      title: "Organizational Structure",
      subtitle: "Management team, workforce requirements, and training needs",
    });

    // ============================================
    // APPENDICES
    // ============================================
    sections.push({
      id: "appendix",
      title: "Appendix A: Project Requirements",
      subtitle: "Original project specifications and conversation summary",
    });

    sections.push({
      id: "appendix_technical",
      title: "Appendix B: Technical Documentation",
      subtitle: "Detailed technical specifications and data sheets",
    });

    sections.push({
      id: "appendix_financial",
      title: "Appendix C: Financial Details",
      subtitle: "Detailed financial calculations and assumptions",
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
      case "market":
        await this.generateMarketAnalysis(data);
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
      case "equipment_detail":
        await this.generateEquipmentDetailSection(data);
        break;
      case "quality":
        await this.generateQualitySection(data);
        break;
      case "suppliers":
        await this.generateSuppliersSection(data);
        break;
      case "supplier_analysis":
        await this.generateSupplierAnalysis(data);
        break;
      case "financial":
        await this.generateFinancialSection(data);
        break;
      case "capex":
        await this.generateCapexSection(data);
        break;
      case "opex":
        await this.generateOpexSection(data);
        break;
      case "projections":
        await this.generateProjectionsSection(data);
        break;
      case "roi":
        await this.generateRoiSection(data);
        break;
      case "risk":
        await this.generateRiskSection(data);
        break;
      case "sensitivity":
        await this.generateSensitivitySection(data);
        break;
      case "digital":
        await this.generateDigitalSection(data);
        break;
      case "sustainability":
        await this.generateSustainabilitySection(data);
        break;
      case "location":
        await this.generateLocationSection(data);
        break;
      case "timeline":
        await this.generateTimelineSection(data);
        break;
      case "team":
        await this.generateTeamSection(data);
        break;
      case "appendix":
        await this.generateAppendix(data);
        break;
      case "appendix_technical":
        await this.generateTechnicalAppendix(data);
        break;
      case "appendix_financial":
        await this.generateFinancialAppendix(data);
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

    this.drawSectionHeader("Industry 5.0 Capabilities");
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
    this.currentPage.drawText("End of Appendix A", {
      x: (this.pageWidth - this.helveticaOblique.widthOfTextAtSize("End of Appendix A", 10)) / 2,
      y: this.yPosition,
      size: 10,
      font: this.helveticaOblique,
      color: COLORS.textLight,
    });
  }

  // ============================================
  // MARKET ANALYSIS
  // ============================================
  private async generateMarketAnalysis(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const planningData = data.planningData || {};
    const category = planningData.identity?.category || "Manufacturing";

    this.drawSectionHeader("Industry Overview");
    this.yPosition -= 25;

    // Market introduction
    const marketIntro = `The ${category} industry represents a significant segment of the global manufacturing sector. 
This analysis examines the market dynamics, competitive landscape, and growth opportunities relevant to the proposed facility.`;
    this.drawWrappedText(marketIntro, 10, COLORS.textMedium);
    this.yPosition -= 20;

    // Market size & trends
    this.checkNewPage(120);
    this.drawSectionHeader("Market Size & Trends");
    this.yPosition -= 25;
    
    const trends = [
      "Growing demand for automated and smart manufacturing solutions",
      "Increasing focus on sustainability and green manufacturing practices",
      "Industry 5.0 adoption driving digital transformation investments",
      "Supply chain resilience becoming a key competitive advantage",
      "Rising labor costs driving automation investments",
    ];
    
    for (const trend of trends) {
      this.checkNewPage(25);
      this.drawBulletPoint(trend, COLORS.textMedium);
      this.yPosition -= 20;
    }

    // Competitive landscape
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Competitive Landscape");
    this.yPosition -= 25;

    const competitive = `The market features a mix of established players and emerging competitors. 
Key success factors include operational efficiency, product quality, customer service, and technological innovation. 
The proposed facility is designed to compete effectively through modern equipment and optimized processes.`;
    this.drawWrappedText(competitive, 10, COLORS.textMedium);
    this.yPosition -= 20;

    // Growth opportunities
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Growth Opportunities");
    this.yPosition -= 25;

    const opportunities = [
      "Expansion into adjacent market segments",
      "Geographic expansion to underserved regions",
      "Product innovation and value-added services",
      "Strategic partnerships and joint ventures",
      "E-commerce and digital sales channels",
    ];
    
    for (const opp of opportunities) {
      this.checkNewPage(25);
      this.drawBulletPoint(opp, COLORS.textMedium);
      this.yPosition -= 20;
    }

    // Target market
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Target Market Segments");
    this.yPosition -= 25;

    const targetMarket = planningData.target_market || 
      "Primary focus on domestic B2B customers with potential for export markets. Secondary opportunities in retail and direct-to-consumer channels.";
    this.drawWrappedText(targetMarket, 10, COLORS.textMedium);
  }

  // ============================================
  // QUALITY ASSURANCE
  // ============================================
  private async generateQualitySection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    this.drawSectionHeader("Quality Management System");
    this.yPosition -= 25;

    const qmsIntro = `The facility will implement a comprehensive Quality Management System (QMS) aligned with 
international standards. This system ensures consistent product quality, regulatory compliance, and continuous improvement.`;
    this.drawWrappedText(qmsIntro, 10, COLORS.textMedium);
    this.yPosition -= 30;

    // Certifications
    this.checkNewPage(120);
    this.drawSectionHeader("Planned Certifications");
    this.yPosition -= 25;

    const certifications = [
      ["ISO 9001:2015", "Quality Management System"],
      ["ISO 14001:2015", "Environmental Management System"],
      ["ISO 45001:2018", "Occupational Health & Safety"],
      ["Industry-Specific", "Relevant sector certifications"],
    ];

    for (const [cert, desc] of certifications) {
      this.checkNewPage(30);
      this.drawInfoRow(cert, desc);
      this.yPosition -= 25;
    }

    // Quality control processes
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Quality Control Processes");
    this.yPosition -= 25;

    const qcProcesses = [
      "Incoming material inspection and testing",
      "In-process quality monitoring at each production stage",
      "Statistical Process Control (SPC) implementation",
      "Final product inspection and testing",
      "Non-conformance management and corrective actions",
      "Supplier quality management program",
      "Regular internal and external audits",
    ];

    for (const process of qcProcesses) {
      this.checkNewPage(25);
      this.drawBulletPoint(process, COLORS.textMedium);
      this.yPosition -= 20;
    }

    // Quality KPIs
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Quality Key Performance Indicators");
    this.yPosition -= 25;

    const kpis = [
      ["First Pass Yield (FPY)", "Target > 98%"],
      ["Customer Complaint Rate", "Target < 0.1%"],
      ["Defect Rate", "Target < 50 PPM"],
      ["On-Time Delivery", "Target > 99%"],
      ["Supplier Quality Rating", "Target > 95%"],
    ];

    for (const [kpi, target] of kpis) {
      this.checkNewPage(30);
      this.drawInfoRow(kpi, target);
      this.yPosition -= 25;
    }
  }

  // ============================================
  // EQUIPMENT DETAIL SECTION
  // ============================================
  private async generateEquipmentDetailSection(data: ReportData): Promise<void> {
    const assets = data.assets || [];
    
    if (assets.length === 0) {
      this.addNewPage();
      this.yPosition = this.pageHeight - this.margin;
      this.drawWrappedText("Equipment specifications will be documented as procurement progresses.", 10, COLORS.textMedium);
      return;
    }

    // Create a detailed page for each major equipment
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      this.addNewPage();
      this.yPosition = this.pageHeight - this.margin;

      // Equipment header
      this.drawSectionHeader(`${i + 1}. ${asset.name || 'Equipment'}`);
      this.yPosition -= 30;

      // Basic info
      const specs = asset.specifications || {};
      
      this.drawInfoRow("Equipment Type", asset.type || "General");
      this.yPosition -= 22;
      this.drawInfoRow("Category", asset.category || asset.type || "Manufacturing");
      this.yPosition -= 22;
      
      if (specs.manufacturer) {
        this.drawInfoRow("Manufacturer", specs.manufacturer);
        this.yPosition -= 22;
      }
      if (specs.model) {
        this.drawInfoRow("Model", specs.model);
        this.yPosition -= 22;
      }

      // Description
      if (asset.description) {
        this.yPosition -= 20;
        this.checkNewPage(80);
        this.drawSectionHeader("Description");
        this.yPosition -= 20;
        this.drawWrappedText(asset.description, 10, COLORS.textMedium);
        this.yPosition -= 20;
      }

      // Technical specifications
      this.yPosition -= 20;
      this.checkNewPage(120);
      this.drawSectionHeader("Technical Specifications");
      this.yPosition -= 25;

      const techSpecs = [
        ["Power Requirement", specs.power_kw ? `${specs.power_kw} kW` : "TBD"],
        ["Dimensions", specs.dimensions || "TBD"],
        ["Weight", specs.weight_kg ? `${specs.weight_kg} kg` : "TBD"],
        ["Capacity", specs.capacity || "TBD"],
        ["Voltage", specs.voltage || "380V / 3-phase (typical)"],
        ["Operating Temperature", specs.operating_temp || "Standard ambient"],
      ];

      for (const [label, value] of techSpecs) {
        this.checkNewPage(25);
        this.drawInfoRow(label, value);
        this.yPosition -= 22;
      }

      // Cost information
      this.yPosition -= 20;
      this.checkNewPage(80);
      this.drawSectionHeader("Cost Information");
      this.yPosition -= 25;

      const estCost = asset.estimated_cost_usd || specs.estimated_cost_usd || 0;
      this.drawInfoRow("Estimated Cost", estCost > 0 ? `$${estCost.toLocaleString()}` : "To be quoted");
      this.yPosition -= 22;
      this.drawInfoRow("Installation Cost", estCost > 0 ? `$${Math.round(estCost * 0.1).toLocaleString()} (est.)` : "TBD");
      this.yPosition -= 22;
      this.drawInfoRow("Annual Maintenance", estCost > 0 ? `$${Math.round(estCost * 0.05).toLocaleString()} (est.)` : "TBD");
    }
  }

  // ============================================
  // SUPPLIER ANALYSIS
  // ============================================
  private async generateSupplierAnalysis(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const suppliers = data.suppliers || [];

    this.drawSectionHeader("Supplier Evaluation Criteria");
    this.yPosition -= 25;

    const criteria = [
      ["Price Competitiveness", "25%", "Comparison of quoted prices"],
      ["Quality Certification", "20%", "ISO and industry certifications"],
      ["Delivery Performance", "20%", "Lead times and reliability"],
      ["Technical Support", "15%", "After-sales service capability"],
      ["Financial Stability", "10%", "Company financial health"],
      ["Location/Logistics", "10%", "Geographic proximity and shipping"],
    ];

    for (const [criterion, weight, desc] of criteria) {
      this.checkNewPage(35);
      this.drawInfoRow(`${criterion} (${weight})`, desc);
      this.yPosition -= 25;
    }

    // Supplier comparison
    if (suppliers.length > 0) {
      this.yPosition -= 30;
      this.checkNewPage(100);
      this.drawSectionHeader("Supplier Comparison Matrix");
      this.yPosition -= 25;

      for (const supplier of suppliers) {
        this.checkNewPage(80);
        
        // Supplier card
        this.currentPage.drawRectangle({
          x: this.margin,
          y: this.yPosition - 60,
          width: this.contentWidth,
          height: 65,
          color: COLORS.bgSubtle,
          borderColor: COLORS.border,
          borderWidth: 0.5,
        });

        this.currentPage.drawText(supplier.name || "Supplier", {
          x: this.margin + 10,
          y: this.yPosition - 15,
          size: 11,
          font: this.helveticaBold,
          color: COLORS.navy,
        });

        this.currentPage.drawText(supplier.location || "Location TBD", {
          x: this.margin + 10,
          y: this.yPosition - 32,
          size: 9,
          font: this.helvetica,
          color: COLORS.textMedium,
        });

        const rating = supplier.rating || "Pending Evaluation";
        this.currentPage.drawText(`Rating: ${rating}`, {
          x: this.margin + 10,
          y: this.yPosition - 48,
          size: 9,
          font: this.helvetica,
          color: COLORS.textMedium,
        });

        this.yPosition -= 75;
      }
    }

    // Procurement strategy
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Procurement Strategy");
    this.yPosition -= 25;

    const strategy = [
      "Maintain multiple qualified suppliers for critical equipment",
      "Negotiate framework agreements for volume discounts",
      "Implement supplier performance monitoring system",
      "Develop strategic partnerships with key suppliers",
      "Establish clear SLAs and quality requirements",
    ];

    for (const item of strategy) {
      this.checkNewPage(25);
      this.drawBulletPoint(item, COLORS.textMedium);
      this.yPosition -= 20;
    }
  }

  // ============================================
  // CAPEX SECTION
  // ============================================
  private async generateCapexSection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const analysis = data.tcoAnalysis || {};
    const initialInv = analysis.initial_investment || {};
    const assets = data.assets || [];

    this.drawSectionHeader("Capital Expenditure Summary");
    this.yPosition -= 25;

    // Calculate totals
    const equipmentCost = assets.reduce((sum, a) => sum + (a.estimated_cost_usd || a.specifications?.estimated_cost_usd || 0), 0);
    const buildingCost = initialInv.building || equipmentCost * 0.5;
    const installationCost = initialInv.installation || equipmentCost * 0.1;
    const workingCapital = initialInv.working_capital || equipmentCost * 0.15;
    const contingency = initialInv.contingency || equipmentCost * 0.1;
    const totalCapex = initialInv.total || (equipmentCost + buildingCost + installationCost + workingCapital + contingency);

    const capexItems = [
      ["Equipment & Machinery", equipmentCost],
      ["Building & Civil Works", buildingCost],
      ["Installation & Commissioning", installationCost],
      ["Working Capital", workingCapital],
      ["Contingency Reserve", contingency],
    ];

    for (const [label, value] of capexItems) {
      this.checkNewPage(30);
      this.drawInfoRow(label, this.formatCurrency(value));
      this.yPosition -= 25;
    }

    // Total with highlight
    this.yPosition -= 10;
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 25,
      width: this.contentWidth,
      height: 30,
      color: COLORS.accent,
    });

    this.currentPage.drawText("TOTAL CAPITAL EXPENDITURE", {
      x: this.margin + 10,
      y: this.yPosition - 15,
      size: 10,
      font: this.helveticaBold,
      color: COLORS.white,
    });

    this.currentPage.drawText(this.formatCurrency(totalCapex), {
      x: this.pageWidth - this.margin - 100,
      y: this.yPosition - 15,
      size: 12,
      font: this.courier,
      color: COLORS.white,
    });

    this.yPosition -= 50;

    // Equipment breakdown by category
    this.checkNewPage(100);
    this.drawSectionHeader("Equipment CAPEX by Category");
    this.yPosition -= 25;

    // Group assets by type
    const byType: Record<string, number> = {};
    for (const asset of assets) {
      const type = asset.type || "Other";
      const cost = asset.estimated_cost_usd || asset.specifications?.estimated_cost_usd || 0;
      byType[type] = (byType[type] || 0) + cost;
    }

    for (const [type, cost] of Object.entries(byType)) {
      this.checkNewPage(25);
      const pct = totalCapex > 0 ? ((cost / totalCapex) * 100).toFixed(1) : "0";
      this.drawInfoRow(`${type} (${pct}%)`, this.formatCurrency(cost));
      this.yPosition -= 22;
    }

    // Funding structure
    this.yPosition -= 30;
    this.checkNewPage(100);
    this.drawSectionHeader("Recommended Funding Structure");
    this.yPosition -= 25;

    const equity = totalCapex * 0.4;
    const debt = totalCapex * 0.6;

    this.drawInfoRow("Equity Contribution (40%)", this.formatCurrency(equity));
    this.yPosition -= 22;
    this.drawInfoRow("Debt Financing (60%)", this.formatCurrency(debt));
    this.yPosition -= 22;
    this.drawInfoRow("Assumed Interest Rate", "6-8% p.a.");
    this.yPosition -= 22;
    this.drawInfoRow("Loan Tenure", "7-10 years");
  }

  // ============================================
  // OPEX SECTION
  // ============================================
  private async generateOpexSection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const analysis = data.tcoAnalysis || {};
    const annualOps = analysis.annual_operational || {};

    this.drawSectionHeader("Annual Operating Cost Structure");
    this.yPosition -= 25;

    const labor = annualOps.labor || 500000;
    const utilities = annualOps.utilities || 120000;
    const maintenance = annualOps.maintenance || 80000;
    const rawMaterials = annualOps.raw_materials || 800000;
    const insurance = annualOps.insurance || 50000;
    const other = annualOps.other || 100000;
    const totalOpex = annualOps.total || (labor + utilities + maintenance + rawMaterials + insurance + other);

    const opexItems = [
      ["Raw Materials & Supplies", rawMaterials],
      ["Labor & Personnel", labor],
      ["Utilities (Power, Water, Gas)", utilities],
      ["Maintenance & Repairs", maintenance],
      ["Insurance & Compliance", insurance],
      ["Administrative & Other", other],
    ];

    for (const [label, value] of opexItems) {
      this.checkNewPage(30);
      const pct = totalOpex > 0 ? ((value / totalOpex) * 100).toFixed(1) : "0";
      this.drawInfoRow(`${label} (${pct}%)`, this.formatCurrency(value));
      this.yPosition -= 25;
    }

    // Total
    this.yPosition -= 10;
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 25,
      width: this.contentWidth,
      height: 30,
      color: COLORS.navyLight,
    });

    this.currentPage.drawText("TOTAL ANNUAL OPEX", {
      x: this.margin + 10,
      y: this.yPosition - 15,
      size: 10,
      font: this.helveticaBold,
      color: COLORS.white,
    });

    this.currentPage.drawText(this.formatCurrency(totalOpex), {
      x: this.pageWidth - this.margin - 100,
      y: this.yPosition - 15,
      size: 12,
      font: this.courier,
      color: COLORS.white,
    });

    this.yPosition -= 50;

    // Monthly breakdown
    this.checkNewPage(100);
    this.drawSectionHeader("Monthly Operating Budget");
    this.yPosition -= 25;

    this.drawInfoRow("Monthly Fixed Costs", this.formatCurrency((labor + insurance + other) / 12));
    this.yPosition -= 22;
    this.drawInfoRow("Monthly Variable Costs", this.formatCurrency((rawMaterials + utilities + maintenance) / 12));
    this.yPosition -= 22;
    this.drawInfoRow("Monthly Total", this.formatCurrency(totalOpex / 12));
    this.yPosition -= 30;

    // Cost optimization opportunities
    this.checkNewPage(100);
    this.drawSectionHeader("Cost Optimization Opportunities");
    this.yPosition -= 25;

    const optimizations = [
      "Energy efficiency improvements through LED lighting and smart controls",
      "Preventive maintenance program to reduce downtime and repair costs",
      "Bulk purchasing and inventory optimization for raw materials",
      "Process automation to improve labor productivity",
      "Waste reduction and recycling programs",
    ];

    for (const opt of optimizations) {
      this.checkNewPage(25);
      this.drawBulletPoint(opt, COLORS.textMedium);
      this.yPosition -= 20;
    }
  }

  // ============================================
  // ROI SECTION
  // ============================================
  private async generateRoiSection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const analysis = data.tcoAnalysis || {};
    const metrics = analysis.financial_metrics || {};
    const initialInv = analysis.initial_investment || {};

    this.drawSectionHeader("Investment Return Analysis");
    this.yPosition -= 25;

    // Key metrics
    const roi = metrics.roi || 18;
    const irr = metrics.irr || 22;
    const payback = metrics.payback_period || 4.5;
    const npv = metrics.npv || initialInv.total * 0.8 || 1000000;

    const metricsData = [
      ["Return on Investment (ROI)", `${roi}%`],
      ["Internal Rate of Return (IRR)", `${irr}%`],
      ["Payback Period", `${payback} years`],
      ["Net Present Value (NPV)", this.formatCurrency(npv)],
    ];

    for (const [label, value] of metricsData) {
      this.checkNewPage(40);
      
      // Metric box
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 30,
        width: this.contentWidth,
        height: 35,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      this.currentPage.drawText(label, {
        x: this.margin + 10,
        y: this.yPosition - 18,
        size: 10,
        font: this.helvetica,
        color: COLORS.textMedium,
      });

      this.currentPage.drawText(value, {
        x: this.pageWidth - this.margin - 80,
        y: this.yPosition - 18,
        size: 12,
        font: this.helveticaBold,
        color: COLORS.accent,
      });

      this.yPosition -= 45;
    }

    // Break-even analysis
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Break-Even Analysis");
    this.yPosition -= 25;

    const breakEvenAnalysis = `Based on projected revenue and cost structure, the facility is expected to reach break-even 
at approximately ${Math.round(payback * 12)} months of operation. This analysis assumes stable market conditions 
and achievement of projected capacity utilization rates.`;
    this.drawWrappedText(breakEvenAnalysis, 10, COLORS.textMedium);
    this.yPosition -= 30;

    // Investment recommendation
    this.checkNewPage(100);
    this.drawSectionHeader("Investment Recommendation");
    this.yPosition -= 25;

    const isPositive = roi >= 15 && payback <= 6;
    const recommendation = isPositive 
      ? "Based on the financial analysis, this investment demonstrates strong potential returns with acceptable risk levels. Recommend proceeding with the project."
      : "The investment shows moderate returns. Consider optimizing the cost structure or phasing the investment to improve financial metrics.";
    
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 50,
      width: this.contentWidth,
      height: 55,
      color: isPositive ? rgb(0.92, 0.97, 0.95) : rgb(0.98, 0.95, 0.92),
      borderColor: isPositive ? COLORS.success : COLORS.warning,
      borderWidth: 1,
    });

    this.currentPage.drawText(isPositive ? "RECOMMENDED" : "CONDITIONAL", {
      x: this.margin + 10,
      y: this.yPosition - 18,
      size: 10,
      font: this.helveticaBold,
      color: isPositive ? COLORS.success : COLORS.warning,
    });

    this.currentPage.drawText(recommendation, {
      x: this.margin + 10,
      y: this.yPosition - 38,
      size: 9,
      font: this.helvetica,
      color: COLORS.textMedium,
    });
  }

  // ============================================
  // SENSITIVITY ANALYSIS
  // ============================================
  private async generateSensitivitySection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const analysis = data.tcoAnalysis || {};
    const metrics = analysis.financial_metrics || {};
    const baseRoi = metrics.roi || 18;

    this.drawSectionHeader("Sensitivity Analysis Overview");
    this.yPosition -= 25;

    const intro = `This section examines how changes in key variables affect project profitability. 
Understanding these sensitivities helps in risk management and strategic planning.`;
    this.drawWrappedText(intro, 10, COLORS.textMedium);
    this.yPosition -= 30;

    // Variable impact table
    this.checkNewPage(150);
    this.drawSectionHeader("Variable Impact on ROI");
    this.yPosition -= 25;

    const scenarios = [
      ["Revenue +10%", `ROI: ${(baseRoi * 1.25).toFixed(1)}%`, "+25% impact"],
      ["Revenue -10%", `ROI: ${(baseRoi * 0.75).toFixed(1)}%`, "-25% impact"],
      ["OPEX +10%", `ROI: ${(baseRoi * 0.85).toFixed(1)}%`, "-15% impact"],
      ["OPEX -10%", `ROI: ${(baseRoi * 1.15).toFixed(1)}%`, "+15% impact"],
      ["CAPEX +10%", `ROI: ${(baseRoi * 0.9).toFixed(1)}%`, "-10% impact"],
      ["CAPEX -10%", `ROI: ${(baseRoi * 1.1).toFixed(1)}%`, "+10% impact"],
    ];

    for (const [scenario, result, impact] of scenarios) {
      this.checkNewPage(30);
      this.currentPage.drawText(scenario, {
        x: this.margin,
        y: this.yPosition,
        size: 10,
        font: this.helvetica,
        color: COLORS.textMedium,
      });
      this.currentPage.drawText(result, {
        x: this.margin + 150,
        y: this.yPosition,
        size: 10,
        font: this.courier,
        color: COLORS.textDark,
      });
      this.currentPage.drawText(impact, {
        x: this.margin + 300,
        y: this.yPosition,
        size: 10,
        font: this.helvetica,
        color: impact.includes("+") ? COLORS.success : COLORS.danger,
      });
      this.yPosition -= 25;
    }

    // Key insights
    this.yPosition -= 30;
    this.checkNewPage(100);
    this.drawSectionHeader("Key Insights");
    this.yPosition -= 25;

    const insights = [
      "Revenue is the most sensitive variable - focus on sales and pricing strategy",
      "Operating costs have moderate impact - maintain cost control discipline",
      "Capital costs are least sensitive due to one-time nature",
      "Capacity utilization is critical for achieving projected returns",
    ];

    for (const insight of insights) {
      this.checkNewPage(25);
      this.drawBulletPoint(insight, COLORS.textMedium);
      this.yPosition -= 20;
    }
  }

  // ============================================
  // SUSTAINABILITY SECTION
  // ============================================
  private async generateSustainabilitySection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    this.drawSectionHeader("Environmental Sustainability");
    this.yPosition -= 25;

    const envIntro = `The facility will implement sustainable practices to minimize environmental impact 
and comply with regulatory requirements. These initiatives also contribute to operational cost savings.`;
    this.drawWrappedText(envIntro, 10, COLORS.textMedium);
    this.yPosition -= 30;

    // Environmental initiatives
    this.checkNewPage(100);
    this.drawSectionHeader("Environmental Initiatives");
    this.yPosition -= 25;

    const envInitiatives = [
      "Energy-efficient equipment and LED lighting systems",
      "Solar panel installation for supplementary power",
      "Water recycling and treatment systems",
      "Waste segregation and recycling program",
      "Low-emission equipment and processes",
      "Green building design principles",
    ];

    for (const init of envInitiatives) {
      this.checkNewPage(25);
      this.drawBulletPoint(init, COLORS.textMedium);
      this.yPosition -= 20;
    }

    // Social responsibility
    this.yPosition -= 30;
    this.checkNewPage(100);
    this.drawSectionHeader("Social Responsibility");
    this.yPosition -= 25;

    const socialItems = [
      "Fair employment practices and competitive wages",
      "Employee training and development programs",
      "Safe working conditions exceeding regulatory requirements",
      "Community engagement and local hiring preferences",
      "Support for local suppliers and businesses",
    ];

    for (const item of socialItems) {
      this.checkNewPage(25);
      this.drawBulletPoint(item, COLORS.textMedium);
      this.yPosition -= 20;
    }

    // Governance
    this.yPosition -= 30;
    this.checkNewPage(100);
    this.drawSectionHeader("Corporate Governance");
    this.yPosition -= 25;

    const govItems = [
      "Transparent financial reporting and auditing",
      "Ethics and compliance program",
      "Board oversight and accountability",
      "Stakeholder communication policies",
      "Anti-corruption and anti-bribery policies",
    ];

    for (const item of govItems) {
      this.checkNewPage(25);
      this.drawBulletPoint(item, COLORS.textMedium);
      this.yPosition -= 20;
    }
  }

  // ============================================
  // TIMELINE SECTION
  // ============================================
  private async generateTimelineSection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    this.drawSectionHeader("Project Implementation Timeline");
    this.yPosition -= 25;

    const intro = `The following timeline outlines the key phases and milestones for project implementation. 
Total estimated project duration: 18-24 months from approval to full production.`;
    this.drawWrappedText(intro, 10, COLORS.textMedium);
    this.yPosition -= 30;

    // Phases
    const phases = [
      {
        name: "Phase 1: Planning & Approvals",
        duration: "Months 1-3",
        activities: ["Detailed engineering design", "Permit applications", "Financing arrangements", "Supplier negotiations"],
      },
      {
        name: "Phase 2: Construction",
        duration: "Months 4-12",
        activities: ["Site preparation", "Building construction", "Utility connections", "Equipment installation"],
      },
      {
        name: "Phase 3: Commissioning",
        duration: "Months 13-15",
        activities: ["Equipment testing", "Trial production", "Quality validation", "Staff training"],
      },
      {
        name: "Phase 4: Ramp-Up",
        duration: "Months 16-24",
        activities: ["Production ramp-up", "Process optimization", "Full capacity achievement", "Continuous improvement"],
      },
    ];

    for (const phase of phases) {
      this.checkNewPage(120);
      
      // Phase header
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 25,
        width: this.contentWidth,
        height: 28,
        color: COLORS.navyLight,
      });

      this.currentPage.drawText(phase.name, {
        x: this.margin + 10,
        y: this.yPosition - 15,
        size: 10,
        font: this.helveticaBold,
        color: COLORS.white,
      });

      this.currentPage.drawText(phase.duration, {
        x: this.pageWidth - this.margin - 80,
        y: this.yPosition - 15,
        size: 10,
        font: this.helvetica,
        color: COLORS.white,
      });

      this.yPosition -= 35;

      // Activities
      for (const activity of phase.activities) {
        this.checkNewPage(25);
        this.drawBulletPoint(activity, COLORS.textMedium);
        this.yPosition -= 18;
      }

      this.yPosition -= 15;
    }

    // Critical milestones
    this.yPosition -= 20;
    this.checkNewPage(100);
    this.drawSectionHeader("Critical Milestones");
    this.yPosition -= 25;

    const milestones = [
      ["Financial Close", "Month 2"],
      ["Ground Breaking", "Month 4"],
      ["Building Complete", "Month 10"],
      ["Equipment Installation", "Month 12"],
      ["First Production", "Month 14"],
      ["Full Capacity", "Month 24"],
    ];

    for (const [milestone, timing] of milestones) {
      this.checkNewPage(25);
      this.drawInfoRow(milestone, timing);
      this.yPosition -= 22;
    }
  }

  // ============================================
  // TEAM SECTION
  // ============================================
  private async generateTeamSection(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const planningData = data.planningData || {};

    this.drawSectionHeader("Organizational Structure");
    this.yPosition -= 25;

    const intro = `The facility will require a skilled workforce to operate efficiently. 
The organizational structure is designed to support operational excellence and continuous improvement.`;
    this.drawWrappedText(intro, 10, COLORS.textMedium);
    this.yPosition -= 30;

    // Key positions
    this.checkNewPage(150);
    this.drawSectionHeader("Key Management Positions");
    this.yPosition -= 25;

    const positions = [
      ["Plant Manager", "Overall operations management"],
      ["Production Manager", "Manufacturing oversight"],
      ["Quality Manager", "QA/QC and compliance"],
      ["Maintenance Manager", "Equipment and facilities"],
      ["Finance Controller", "Financial operations"],
      ["HR Manager", "Human resources"],
    ];

    for (const [title, resp] of positions) {
      this.checkNewPage(30);
      this.drawInfoRow(title, resp);
      this.yPosition -= 25;
    }

    // Workforce breakdown
    this.yPosition -= 30;
    this.checkNewPage(120);
    this.drawSectionHeader("Workforce Requirements");
    this.yPosition -= 25;

    const workforce = planningData.workforce || {};
    const employees = workforce.total_employees || 50;
    const directLabor = Math.round(employees * 0.6);
    const indirect = Math.round(employees * 0.25);
    const management = Math.round(employees * 0.15);

    this.drawInfoRow("Direct Labor (Production)", `${directLabor} employees`);
    this.yPosition -= 22;
    this.drawInfoRow("Indirect Labor (Support)", `${indirect} employees`);
    this.yPosition -= 22;
    this.drawInfoRow("Management & Admin", `${management} employees`);
    this.yPosition -= 22;
    this.drawInfoRow("Total Workforce", `${employees} employees`);
    this.yPosition -= 30;

    // Training
    this.checkNewPage(100);
    this.drawSectionHeader("Training & Development");
    this.yPosition -= 25;

    const training = [
      "Comprehensive onboarding program for all new hires",
      "Technical skills training for production staff",
      "Quality management and ISO awareness training",
      "Safety and emergency response training",
      "Continuous improvement and lean manufacturing",
      "Leadership development for supervisors",
    ];

    for (const item of training) {
      this.checkNewPage(25);
      this.drawBulletPoint(item, COLORS.textMedium);
      this.yPosition -= 20;
    }
  }

  // ============================================
  // TECHNICAL APPENDIX
  // ============================================
  private async generateTechnicalAppendix(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const assets = data.assets || [];
    const planningData = data.planningData || {};

    this.drawSectionHeader("Technical Reference Data");
    this.yPosition -= 25;

    // Equipment summary table
    this.checkNewPage(100);
    this.drawSectionHeader("Equipment Summary Table");
    this.yPosition -= 25;

    // Table header
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 20,
      width: this.contentWidth,
      height: 22,
      color: COLORS.navyLight,
    });

    const headers = ["Equipment", "Type", "Power (kW)", "Est. Cost"];
    const colWidths = [180, 100, 80, 100];
    let xPos = this.margin + 5;

    for (let i = 0; i < headers.length; i++) {
      this.currentPage.drawText(headers[i], {
        x: xPos,
        y: this.yPosition - 14,
        size: 8,
        font: this.helveticaBold,
        color: COLORS.white,
      });
      xPos += colWidths[i];
    }
    this.yPosition -= 28;

    // Table rows
    for (const asset of assets.slice(0, 20)) { // Limit to 20 for space
      this.checkNewPage(22);
      
      xPos = this.margin + 5;
      const specs = asset.specifications || {};
      const values = [
        this.truncateText(asset.name || "Equipment", 170),
        asset.type || "General",
        specs.power_kw ? `${specs.power_kw}` : "-",
        asset.estimated_cost_usd ? `$${(asset.estimated_cost_usd / 1000).toFixed(0)}K` : "-",
      ];

      for (let i = 0; i < values.length; i++) {
        this.currentPage.drawText(values[i], {
          x: xPos,
          y: this.yPosition,
          size: 8,
          font: this.helvetica,
          color: COLORS.textMedium,
        });
        xPos += colWidths[i];
      }
      this.yPosition -= 18;
    }

    if (assets.length > 20) {
      this.yPosition -= 10;
      this.currentPage.drawText(`... and ${assets.length - 20} more items (see Equipment Detail section)`, {
        x: this.margin,
        y: this.yPosition,
        size: 8,
        font: this.helveticaOblique,
        color: COLORS.textLight,
      });
    }

    // Factory dimensions
    this.yPosition -= 40;
    this.checkNewPage(100);
    this.drawSectionHeader("Factory Dimensions & Layout");
    this.yPosition -= 25;

    const dims = planningData.factory_dimensions || {};
    
    this.drawInfoRow("Total Area", `${dims.total_area || dims.width * dims.length || 5000} sqm`);
    this.yPosition -= 22;
    this.drawInfoRow("Building Footprint", `${dims.width || 50}m x ${dims.length || 100}m`);
    this.yPosition -= 22;
    this.drawInfoRow("Ceiling Height", `${dims.height || 8}m`);
    this.yPosition -= 22;
    this.drawInfoRow("Number of Floors", `${dims.floors || 1}`);
  }

  // ============================================
  // FINANCIAL APPENDIX
  // ============================================
  private async generateFinancialAppendix(data: ReportData): Promise<void> {
    this.addNewPage();
    this.yPosition = this.pageHeight - this.margin;
    
    const analysis = data.tcoAnalysis || {};

    this.drawSectionHeader("Financial Calculation Details");
    this.yPosition -= 25;

    // Assumptions
    this.checkNewPage(100);
    this.drawSectionHeader("Key Financial Assumptions");
    this.yPosition -= 25;

    const assumptions = [
      ["Inflation Rate", "3% per annum"],
      ["Discount Rate", "10% for NPV calculations"],
      ["Tax Rate", "25% corporate tax"],
      ["Depreciation Method", "Straight-line over useful life"],
      ["Equipment Useful Life", "10-15 years average"],
      ["Working Capital", "15% of annual revenue"],
      ["Capacity Utilization Year 1", "60%"],
      ["Capacity Utilization Year 3+", "85%"],
    ];

    for (const [assumption, value] of assumptions) {
      this.checkNewPage(25);
      this.drawInfoRow(assumption, value);
      this.yPosition -= 22;
    }

    // 10-year projection detail
    this.yPosition -= 30;
    this.checkNewPage(200);
    this.drawSectionHeader("10-Year Cash Flow Projection");
    this.yPosition -= 25;

    const projections = analysis.ten_year_projection || analysis.projections || [];
    
    if (projections.length > 0) {
      // Simple projection table
      for (let i = 0; i < Math.min(projections.length, 10); i++) {
        const proj = projections[i];
        this.checkNewPage(25);
        
        const revenue = proj.revenue || proj.annual_revenue || 0;
        const costs = proj.costs || proj.operating_costs || 0;
        const profit = proj.profit || proj.net_profit || (revenue - costs);
        
        this.currentPage.drawText(`Year ${i + 1}:`, {
          x: this.margin,
          y: this.yPosition,
          size: 9,
          font: this.helveticaBold,
          color: COLORS.textMedium,
        });
        
        this.currentPage.drawText(`Revenue: ${this.formatCurrency(revenue)}  |  Costs: ${this.formatCurrency(costs)}  |  Profit: ${this.formatCurrency(profit)}`, {
          x: this.margin + 60,
          y: this.yPosition,
          size: 9,
          font: this.courier,
          color: profit >= 0 ? COLORS.success : COLORS.danger,
        });
        
        this.yPosition -= 22;
      }
    } else {
      this.drawWrappedText("Detailed projections will be generated after complete financial analysis.", 10, COLORS.textMedium);
    }

    // End of report
    this.yPosition -= 50;
    this.checkNewPage(50);
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition },
      end: { x: this.pageWidth - this.margin, y: this.yPosition },
      thickness: 1,
      color: COLORS.accent,
    });
    
    this.yPosition -= 30;
    this.currentPage.drawText("END OF REPORT", {
      x: (this.pageWidth - this.helveticaBold.widthOfTextAtSize("END OF REPORT", 12)) / 2,
      y: this.yPosition,
      size: 12,
      font: this.helveticaBold,
      color: COLORS.navy,
    });

    this.yPosition -= 20;
    const generatedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    this.currentPage.drawText(`Generated: ${generatedDate}`, {
      x: (this.pageWidth - this.helvetica.widthOfTextAtSize(`Generated: ${generatedDate}`, 9)) / 2,
      y: this.yPosition,
      size: 9,
      font: this.helvetica,
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
      // First, remove control characters (0x00-0x1F except tab, newline)
      // \r (0x0D) and other control chars are NOT supported by WinAnsi
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // Remove most control chars
      .replace(/\r\n/g, " ")  // Windows line endings to space
      .replace(/\r/g, " ")    // Mac line endings to space
      .replace(/\n/g, " ")    // Unix line endings to space
      .replace(/\t/g, "  ")   // Tab to spaces
      // Unicode replacements
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
      // Remove any remaining non-printable or non-ASCII characters
      .replace(/[^\x20-\x7E]/g, "");
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

