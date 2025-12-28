/**
 * Elite Industrial PDF Report Generator
 * Medusa.js-inspired professional styling with section cover pages
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, Color } from "pdf-lib";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";

// Medusa.js Color Palette
const COLORS = {
  // Primary - Dark Navy
  primary: rgb(0.06, 0.09, 0.16), // #0F172A
  primaryLight: rgb(0.12, 0.16, 0.24), // #1E293B
  
  // Accent - Purple/Violet
  accent: rgb(0.49, 0.36, 0.89), // #7C5CE3
  accentLight: rgb(0.58, 0.47, 0.93), // #9478ED
  
  // Success/Positive
  success: rgb(0.13, 0.73, 0.49), // #22BA7D
  successBg: rgb(0.93, 0.99, 0.96), // #ECFDF5
  
  // Warning
  warning: rgb(0.95, 0.63, 0.15), // #F2A025
  warningBg: rgb(1, 0.98, 0.92), // #FFFAEB
  
  // Text
  textPrimary: rgb(0.06, 0.09, 0.16), // #0F172A
  textSecondary: rgb(0.4, 0.45, 0.53), // #64748B
  textMuted: rgb(0.58, 0.62, 0.69), // #94A3B0
  
  // Background
  bgWhite: rgb(1, 1, 1),
  bgSubtle: rgb(0.98, 0.98, 0.99), // #F8FAFC
  bgBase: rgb(0.96, 0.97, 0.98), // #F1F5F9
  
  // Border
  border: rgb(0.89, 0.91, 0.94), // #E2E8F0
  borderLight: rgb(0.95, 0.96, 0.97), // #F1F5F9
};

interface ReportData {
  project: any;
  planningData: any;
  assets: any[];
  suppliers: any[];
  analysis: any;
  generatedFiles?: any[];
}

class ElitePDFGenerator {
  private pdfDoc!: PDFDocument;
  private helvetica!: PDFFont;
  private helveticaBold!: PDFFont;
  private currentPage!: PDFPage;
  private pageWidth = 612; // Letter size
  private pageHeight = 792;
  private margin = 50;
  private contentWidth: number;
  private yPosition = 0;
  private pageNumber = 0;
  private totalPages = 0;
  private pages: PDFPage[] = [];
  
  // Brand colors (set during report generation)
  private brandPrimaryColor!: Color;
  private brandSecondaryColor!: Color;

  constructor() {
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  /**
   * Convert hex color string to RGB color for pdf-lib
   */
  private hexToRgb(hex: string): Color {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    return rgb(r, g, b);
  }

  async generateReport(data: ReportData): Promise<Buffer> {
    logger.info("Generating Elite Industrial PDF Report - Medusa.js Style");
    
    this.pdfDoc = await PDFDocument.create();
    this.helvetica = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.helveticaBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Set brand colors from project (or use defaults)
    this.brandPrimaryColor = this.hexToRgb(data.project.primary_color || "#0F172A");
    this.brandSecondaryColor = this.hexToRgb(data.project.secondary_color || "#7C5CE3");

    // Generate all sections
    await this.generateCoverPage(data);
    await this.generateTableOfContents(data);
    
    // Section 1: Executive Summary
    await this.generateSectionCover("01", "Executive Summary", "Strategic overview and investment recommendation");
    await this.generateExecutiveSummary(data);
    
    // Section 2: Industrial Identity
    await this.generateSectionCover("02", "Industrial Identity", "Factory profile and strategic positioning");
    await this.generateIndustrialIdentity(data);
    
    // Section 3: Production Engineering
    await this.generateSectionCover("03", "Production Engineering", "Manufacturing lines and technical specifications");
    await this.generateProductionEngineering(data);
    
    // Section 4: Equipment & Assets
    await this.generateSectionCover("04", "Equipment & Assets", "Machinery inventory and specifications");
    await this.generateEquipmentAssets(data);
    
    // Section 5: Supplier Network
    if (data.suppliers.length > 0) {
      await this.generateSectionCover("05", "Supplier Network", "Verified suppliers and procurement sources");
      await this.generateSupplierNetwork(data);
    }
    
    // Section 6: Financial Analysis
    await this.generateSectionCover("06", "Financial Analysis", "Total Cost of Ownership and ROI projections");
    await this.generateFinancialAnalysis(data);
    
    // Section 7: Risk Assessment
    await this.generateSectionCover("07", "Risk Assessment", "Risk identification and mitigation strategies");
    await this.generateRiskAssessment(data);
    
    // Section 8: Digital Transformation
    await this.generateSectionCover("08", "Digital Transformation", "Industry 4.0 integration and smart factory capabilities");
    await this.generateDigitalTransformation(data);

    // Add page numbers to all pages
    this.totalPages = this.pages.length;
    await this.addPageNumbers();

    const pdfBytes = await this.pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private addNewPage(): PDFPage {
    this.currentPage = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.pages.push(this.currentPage);
    this.yPosition = this.pageHeight - this.margin;
    this.pageNumber++;
    return this.currentPage;
  }

  private checkNewPage(requiredSpace: number = 80): boolean {
    if (this.yPosition < this.margin + requiredSpace) {
      this.addNewPage();
      return true;
    }
    return false;
  }

  private async addPageNumbers() {
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      // Skip cover page (page 0)
      if (i === 0) continue;
      
      const pageNum = i.toString();
      const text = `${pageNum}`;
      const textWidth = this.helvetica.widthOfTextAtSize(text, 9);
      
      // Draw page number centered at bottom
      page.drawText(text, {
        x: (this.pageWidth - textWidth) / 2,
        y: 30,
        size: 9,
        font: this.helvetica,
        color: COLORS.textMuted,
      });
      
      // Draw subtle line above page number
      page.drawLine({
        start: { x: this.pageWidth / 2 - 50, y: 45 },
        end: { x: this.pageWidth / 2 + 50, y: 45 },
        thickness: 0.5,
        color: COLORS.border,
      });
    }
  }

  // ============================================
  // COVER PAGE
  // ============================================
  private async generateCoverPage(data: ReportData) {
    const page = this.addNewPage();
    const { project, planningData, analysis } = data;
    const identity = planningData?.industrial_identity || {};
    const summary = planningData?.executive_summary || {};

    // Get brand colors from project (or use defaults)
    const primaryColor = this.hexToRgb(project.primary_color || "#0F172A");
    const secondaryColor = this.hexToRgb(project.secondary_color || "#7C5CE3");

    // Full page background with brand primary color
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageWidth,
      height: this.pageHeight,
      color: primaryColor,
    });

    // Top accent line with brand secondary color
    page.drawRectangle({
      x: 0,
      y: this.pageHeight - 8,
      width: this.pageWidth,
      height: 8,
      color: secondaryColor,
    });

    // Side accent bar with brand secondary color
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 12,
      height: this.pageHeight,
      color: secondaryColor,
    });

    // Company/Generator badge
    page.drawText("ELITE INDUSTRIAL INTELLIGENCE", {
      x: this.margin,
      y: this.pageHeight - 60,
      size: 10,
      font: this.helvetica,
      color: COLORS.textMuted,
    });

    // Brand Logo (if available) - positioned in top right
    if (project.logo_url) {
      try {
        // Draw a placeholder rectangle for logo area
        page.drawRectangle({
          x: this.pageWidth - this.margin - 80,
          y: this.pageHeight - 130,
          width: 80,
          height: 80,
          color: secondaryColor,
          opacity: 0.3,
          borderColor: secondaryColor,
          borderWidth: 2,
        });
        // Note: Actual logo embedding would require image processing
        // For now we show a styled placeholder with initials
        const initials = (project.name || "P").substring(0, 2).toUpperCase();
        page.drawText(initials, {
          x: this.pageWidth - this.margin - 60,
          y: this.pageHeight - 100,
          size: 32,
          font: this.helveticaBold,
          color: COLORS.bgWhite,
        });
      } catch (e) {
        // Logo embedding failed, continue without it
      }
    }

    // Main title
    const factoryName = identity.factory_name || project.name || "Industrial Project";
    this.yPosition = this.pageHeight - 200;
    
    page.drawText("INVESTMENT", {
      x: this.margin,
      y: this.yPosition,
      size: 48,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    this.yPosition -= 55;
    
    page.drawText("DOSSIER", {
      x: this.margin,
      y: this.yPosition,
      size: 48,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    this.yPosition -= 50;

    // Accent line under title with brand secondary color
    page.drawRectangle({
      x: this.margin,
      y: this.yPosition,
      width: 100,
      height: 4,
      color: secondaryColor,
    });
    this.yPosition -= 40;

    // Factory name with brand secondary color
    page.drawText(factoryName.toUpperCase(), {
      x: this.margin,
      y: this.yPosition,
      size: 16,
      font: this.helveticaBold,
      color: secondaryColor,
    });
    this.yPosition -= 30;

    // Category
    const category = identity.industrial_category || "Manufacturing";
    page.drawText(category, {
      x: this.margin,
      y: this.yPosition,
      size: 12,
      font: this.helvetica,
      color: COLORS.textMuted,
    });
    
    // Brand colors preview circles
    this.yPosition -= 40;
    page.drawCircle({
      x: this.margin + 10,
      y: this.yPosition,
      size: 10,
      color: primaryColor,
      borderColor: COLORS.bgWhite,
      borderWidth: 1,
    });
    page.drawCircle({
      x: this.margin + 35,
      y: this.yPosition,
      size: 10,
      color: secondaryColor,
      borderColor: COLORS.bgWhite,
      borderWidth: 1,
    });
    page.drawText("Brand Colors", {
      x: this.margin + 55,
      y: this.yPosition - 4,
      size: 8,
      font: this.helvetica,
      color: COLORS.textMuted,
    });

    // Bottom section with key metrics
    const metricsY = 200;
    const metricBoxWidth = (this.pageWidth - this.margin * 2 - 30) / 4;
    
    // Metrics row
    const metrics = [
      { label: "INVESTMENT", value: `$${(analysis?.initial_investment?.total || 0).toLocaleString()}` },
      { label: "ROI", value: `${(analysis?.financial_metrics?.roi || 0).toFixed(0)}%` },
      { label: "PAYBACK", value: `${(analysis?.financial_metrics?.payback_period_years || 0).toFixed(1)} YRS` },
      { label: "IRR", value: `${(analysis?.financial_metrics?.irr || 0).toFixed(0)}%` },
    ];

    metrics.forEach((metric, index) => {
      const x = this.margin + (metricBoxWidth + 10) * index;
      
      // Metric value
      page.drawText(metric.value, {
        x: x,
        y: metricsY,
        size: 20,
        font: this.helveticaBold,
        color: COLORS.bgWhite,
      });
      
      // Metric label
      page.drawText(metric.label, {
        x: x,
        y: metricsY - 20,
        size: 9,
        font: this.helvetica,
        color: COLORS.textMuted,
      });
    });

    // Divider line above metrics
    page.drawLine({
      start: { x: this.margin, y: metricsY + 40 },
      end: { x: this.pageWidth - this.margin, y: metricsY + 40 },
      thickness: 0.5,
      color: COLORS.primaryLight,
    });

    // Date and classification
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    page.drawText(date, {
      x: this.margin,
      y: 60,
      size: 10,
      font: this.helvetica,
      color: COLORS.textMuted,
    });

    page.drawText("CONFIDENTIAL", {
      x: this.pageWidth - this.margin - this.helvetica.widthOfTextAtSize("CONFIDENTIAL", 10),
      y: 60,
      size: 10,
      font: this.helveticaBold,
      color: COLORS.accent,
    });
  }

  // ============================================
  // SECTION COVER PAGE (Page de Garde)
  // Uses brand colors for accent elements
  // ============================================
  private async generateSectionCover(number: string, title: string, subtitle: string) {
    const page = this.addNewPage();

    // Light gray background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageWidth,
      height: this.pageHeight,
      color: COLORS.bgSubtle,
    });

    // Left accent bar with brand secondary color
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 8,
      height: this.pageHeight,
      color: this.brandSecondaryColor,
    });

    // Section number (large, faded)
    page.drawText(number, {
      x: this.pageWidth - 180,
      y: this.pageHeight - 200,
      size: 120,
      font: this.helveticaBold,
      color: rgb(0.9, 0.91, 0.93), // Very light, almost background
    });

    // Center content
    const centerY = this.pageHeight / 2;

    // Section number badge with brand secondary color
    page.drawRectangle({
      x: this.margin,
      y: centerY + 60,
      width: 50,
      height: 30,
      color: this.brandSecondaryColor,
    });
    
    page.drawText(number, {
      x: this.margin + 15,
      y: centerY + 70,
      size: 14,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });

    // Section title with brand primary color
    page.drawText(title.toUpperCase(), {
      x: this.margin,
      y: centerY,
      size: 32,
      font: this.helveticaBold,
      color: this.brandPrimaryColor,
    });

    // Accent line with brand secondary color
    page.drawRectangle({
      x: this.margin,
      y: centerY - 20,
      width: 60,
      height: 3,
      color: this.brandSecondaryColor,
    });

    // Subtitle
    page.drawText(subtitle, {
      x: this.margin,
      y: centerY - 50,
      size: 12,
      font: this.helvetica,
      color: COLORS.textSecondary,
    });
  }

  // ============================================
  // TABLE OF CONTENTS
  // ============================================
  private async generateTableOfContents(data: ReportData) {
    const page = this.addNewPage();
    
    // Header
    page.drawText("CONTENTS", {
      x: this.margin,
      y: this.pageHeight - 80,
      size: 28,
      font: this.helveticaBold,
      color: COLORS.primary,
    });

    // Accent line
    page.drawRectangle({
      x: this.margin,
      y: this.pageHeight - 95,
      width: 40,
      height: 3,
      color: COLORS.accent,
    });

    const sections = [
      { num: "01", title: "Executive Summary", desc: "Investment recommendation and key metrics" },
      { num: "02", title: "Industrial Identity", desc: "Factory profile and market positioning" },
      { num: "03", title: "Production Engineering", desc: "Manufacturing lines and processes" },
      { num: "04", title: "Equipment & Assets", desc: "Machinery specifications and costs" },
      { num: "05", title: "Supplier Network", desc: "Procurement sources and partnerships" },
      { num: "06", title: "Financial Analysis", desc: "TCO, ROI, and cash flow projections" },
      { num: "07", title: "Risk Assessment", desc: "Risk factors and mitigation strategies" },
      { num: "08", title: "Digital Transformation", desc: "Industry 4.0 and smart factory capabilities" },
    ];

    let y = this.pageHeight - 160;
    
    for (const section of sections) {
      // Section number
      page.drawText(section.num, {
        x: this.margin,
        y: y,
        size: 14,
        font: this.helveticaBold,
        color: COLORS.accent,
      });

      // Section title
      page.drawText(section.title, {
        x: this.margin + 40,
        y: y,
        size: 14,
        font: this.helveticaBold,
        color: COLORS.primary,
      });

      // Description
      page.drawText(section.desc, {
        x: this.margin + 40,
        y: y - 18,
        size: 10,
        font: this.helvetica,
        color: COLORS.textSecondary,
      });

      // Dotted line
      page.drawLine({
        start: { x: this.margin, y: y - 35 },
        end: { x: this.pageWidth - this.margin, y: y - 35 },
        thickness: 0.5,
        color: COLORS.border,
        dashArray: [2, 2],
      });

      y -= 65;
    }
  }

  // ============================================
  // EXECUTIVE SUMMARY
  // ============================================
  private async generateExecutiveSummary(data: ReportData) {
    const page = this.addNewPage();
    const { analysis, planningData } = data;
    const summary = planningData?.executive_summary || {};

    this.yPosition = this.pageHeight - 80;
    
    // Investment Recommendation Box
    const recommendation = analysis?.executive_summary?.investment_recommendation || "GO - Strong Investment Case";
    const isPositive = recommendation.toUpperCase().includes("GO");
    
    page.drawRectangle({
      x: this.margin,
      y: this.yPosition - 70,
      width: this.contentWidth,
      height: 80,
      color: isPositive ? COLORS.successBg : COLORS.warningBg,
      borderColor: isPositive ? COLORS.success : COLORS.warning,
      borderWidth: 1,
    });

    page.drawText("INVESTMENT RECOMMENDATION", {
      x: this.margin + 20,
      y: this.yPosition - 15,
      size: 10,
      font: this.helveticaBold,
      color: COLORS.textSecondary,
    });

    page.drawText(recommendation.substring(0, 80), {
      x: this.margin + 20,
      y: this.yPosition - 40,
      size: 14,
      font: this.helveticaBold,
      color: isPositive ? COLORS.success : COLORS.warning,
    });

    this.yPosition -= 110;

    // Key Metrics Grid
    this.drawSectionTitle("Key Financial Indicators");
    this.yPosition -= 20;

    const metrics = [
      ["Total Investment (CAPEX)", `$${(analysis?.initial_investment?.total || 0).toLocaleString()}`],
      ["Annual Operating Costs", `$${(analysis?.operating_costs?.total_annual || 0).toLocaleString()}`],
      ["5-Year Total Cost", `$${(analysis?.financial_metrics?.total_cost_5_years || 0).toLocaleString()}`],
      ["Return on Investment", `${(analysis?.financial_metrics?.roi || 0).toFixed(1)}%`],
      ["Payback Period", `${(analysis?.financial_metrics?.payback_period_years || 0).toFixed(1)} years`],
      ["Internal Rate of Return", `${(analysis?.financial_metrics?.irr || 0).toFixed(1)}%`],
      ["Net Present Value (5yr)", `$${(analysis?.financial_metrics?.npv_5_years || 0).toLocaleString()}`],
    ];

    for (const [label, value] of metrics) {
      this.checkNewPage(25);
      this.drawMetricRow(label, value);
      this.yPosition -= 25;
    }

    // Key Highlights
    if (summary.key_highlights?.length) {
      this.yPosition -= 20;
      this.checkNewPage(100);
      this.drawSectionTitle("Strategic Highlights");
      this.yPosition -= 15;

      for (const highlight of summary.key_highlights.slice(0, 5)) {
        this.checkNewPage(20);
        this.drawBulletPoint(highlight, COLORS.success);
        this.yPosition -= 20;
      }
    }

    // Key Risks
    if (analysis?.executive_summary?.key_risks?.length) {
      this.yPosition -= 20;
      this.checkNewPage(100);
      this.drawSectionTitle("Key Risk Factors");
      this.yPosition -= 15;

      for (const risk of analysis.executive_summary.key_risks.slice(0, 4)) {
        this.checkNewPage(20);
        this.drawBulletPoint(risk, COLORS.warning);
        this.yPosition -= 20;
      }
    }
  }

  // ============================================
  // INDUSTRIAL IDENTITY
  // ============================================
  private async generateIndustrialIdentity(data: ReportData) {
    const page = this.addNewPage();
    const identity = data.planningData?.industrial_identity || {};
    const location = data.planningData?.location_justification || {};
    const dimensions = data.planningData?.factory_dimensions || {};

    this.yPosition = this.pageHeight - 80;

    // Factory Profile
    this.drawSectionTitle("Factory Profile");
    this.yPosition -= 20;

    const profileData = [
      ["Legal Entity", identity.factory_name || "N/A"],
      ["Legal Structure", identity.legal_nature || "SPA"],
      ["Industry Category", identity.industrial_category || "Manufacturing"],
      ["Operating Scope", identity.operating_scope || "Regional"],
    ];

    for (const [label, value] of profileData) {
      this.checkNewPage(25);
      this.drawInfoRow(label, value);
      this.yPosition -= 22;
    }

    // Location & Site
    this.yPosition -= 25;
    this.checkNewPage(150);
    this.drawSectionTitle("Location & Site");
    this.yPosition -= 20;

    const locationData = [
      ["Recommended Region", location.recommended_region || "N/A"],
      ["Industrial Zone", location.industrial_zone_type || "N/A"],
      ["Total Site Area", `${(location.land_requirements?.total_area_sqm || dimensions.total_area_sqm || 0).toLocaleString()} m²`],
      ["Built Area", `${(location.land_requirements?.built_area_sqm || dimensions.total_area_sqm || 0).toLocaleString()} m²`],
      ["Expansion Reserve", `${(location.land_requirements?.expansion_reserve_sqm || 0).toLocaleString()} m²`],
    ];

    for (const [label, value] of locationData) {
      this.checkNewPage(25);
      this.drawInfoRow(label, value);
      this.yPosition -= 22;
    }

    // Logistics Access
    if (location.logistics_access) {
      this.yPosition -= 25;
      this.checkNewPage(120);
      this.drawSectionTitle("Logistics & Infrastructure");
      this.yPosition -= 20;

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
        this.yPosition -= 22;
      }
    }

    // Certifications
    if (identity.certifications_required?.length) {
      this.yPosition -= 25;
      this.checkNewPage(100);
      this.drawSectionTitle("Required Certifications");
      this.yPosition -= 15;

      for (const cert of identity.certifications_required) {
        this.checkNewPage(20);
        this.drawBulletPoint(cert, COLORS.accent);
        this.yPosition -= 18;
      }
    }
  }

  // ============================================
  // PRODUCTION ENGINEERING
  // ============================================
  private async generateProductionEngineering(data: ReportData) {
    const page = this.addNewPage();
    const lines = data.planningData?.production_lines || [];
    const engineering = data.planningData?.factory_engineering || {};

    this.yPosition = this.pageHeight - 80;

    // Production Lines
    this.drawSectionTitle("Production Lines");
    this.yPosition -= 25;

    for (const line of lines) {
      this.checkNewPage(150);
      
      // Line name with accent
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 5,
        width: 4,
        height: 20,
        color: COLORS.accent,
      });

      this.currentPage.drawText(line.line_name || "Production Line", {
        x: this.margin + 15,
        y: this.yPosition,
        size: 12,
        font: this.helveticaBold,
        color: COLORS.primary,
      });
      this.yPosition -= 25;

      // Line details
      const lineDetails = [
        ["Function", line.function || "N/A"],
        ["Capacity", line.capacity || "N/A"],
        ["Role", line.role_in_chain || "N/A"],
      ];

      for (const [label, value] of lineDetails) {
        this.checkNewPage(20);
        this.drawSmallInfoRow(label, value);
        this.yPosition -= 18;
      }

      this.yPosition -= 15;
    }

    // Material Flow
    if (engineering.material_flow) {
      this.checkNewPage(120);
      this.drawSectionTitle("Material Flow");
      this.yPosition -= 20;

      const flow = engineering.material_flow;
      const flowData = [
        ["Raw Material Intake", flow.raw_material_intake || "N/A"],
        ["Production Flow", flow.production_flow || "N/A"],
        ["Finished Goods Output", flow.finished_goods_output || "N/A"],
      ];

      for (const [label, value] of flowData) {
        this.checkNewPage(25);
        this.drawInfoRow(label, value);
        this.yPosition -= 22;
      }
    }

    // Safety Compliance
    if (engineering.safety_compliance) {
      this.yPosition -= 25;
      this.checkNewPage(100);
      this.drawSectionTitle("Safety & Compliance");
      this.yPosition -= 15;

      const safety = engineering.safety_compliance;
      
      if (safety.atex_requirements) {
        this.checkNewPage(40);
        this.currentPage.drawText("ATEX Requirements:", {
          x: this.margin,
          y: this.yPosition,
          size: 10,
          font: this.helveticaBold,
          color: COLORS.textPrimary,
        });
        this.yPosition -= 15;
        this.drawWrappedText(safety.atex_requirements, 10, COLORS.textSecondary);
      }

      if (safety.emergency_systems?.length) {
        this.yPosition -= 20;
        this.checkNewPage(80);
        this.currentPage.drawText("Emergency Systems:", {
          x: this.margin,
          y: this.yPosition,
          size: 10,
          font: this.helveticaBold,
          color: COLORS.textPrimary,
        });
        this.yPosition -= 15;

        for (const system of safety.emergency_systems) {
          this.checkNewPage(18);
          this.drawBulletPoint(system, COLORS.warning);
          this.yPosition -= 18;
        }
      }
    }
  }

  // ============================================
  // EQUIPMENT & ASSETS
  // ============================================
  private async generateEquipmentAssets(data: ReportData) {
    const page = this.addNewPage();
    const assets = data.assets || data.planningData?.assets || [];

    this.yPosition = this.pageHeight - 80;

    this.drawSectionTitle(`Equipment Inventory (${assets.length} Items)`);
    this.yPosition -= 30;

    let totalCost = 0;

    for (const asset of assets) {
      this.checkNewPage(120);
      
      // Asset card background
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 80,
        width: this.contentWidth,
        height: 90,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Asset name
      this.currentPage.drawText(asset.name || "Equipment", {
        x: this.margin + 15,
        y: this.yPosition - 15,
        size: 12,
        font: this.helveticaBold,
        color: COLORS.primary,
      });

      // Asset type badge
      const assetType = asset.type || "Equipment";
      this.currentPage.drawRectangle({
        x: this.pageWidth - this.margin - 120,
        y: this.yPosition - 22,
        width: 105,
        height: 18,
        color: COLORS.accent,
      });
      this.currentPage.drawText(assetType.substring(0, 18), {
        x: this.pageWidth - this.margin - 115,
        y: this.yPosition - 17,
        size: 8,
        font: this.helveticaBold,
        color: COLORS.bgWhite,
      });

      // Specifications
      const specs = asset.specifications || {};
      const cost = specs.estimated_cost_usd || asset.estimated_cost_usd || 0;
      totalCost += cost;

      this.currentPage.drawText(`Est. Cost: $${cost.toLocaleString()}`, {
        x: this.margin + 15,
        y: this.yPosition - 40,
        size: 10,
        font: this.helveticaBold,
        color: COLORS.success,
      });

      if (specs.dimensions) {
        this.currentPage.drawText(`Dimensions: ${specs.dimensions}`, {
          x: this.margin + 15,
          y: this.yPosition - 55,
          size: 9,
          font: this.helvetica,
          color: COLORS.textSecondary,
        });
      }

      if (specs.power_kw) {
        this.currentPage.drawText(`Power: ${specs.power_kw} kW`, {
          x: this.margin + 200,
          y: this.yPosition - 55,
          size: 9,
          font: this.helvetica,
          color: COLORS.textSecondary,
        });
      }

      if (asset.production_line) {
        this.currentPage.drawText(`Line: ${asset.production_line}`, {
          x: this.margin + 15,
          y: this.yPosition - 70,
          size: 9,
          font: this.helvetica,
          color: COLORS.textMuted,
        });
      }

      this.yPosition -= 100;
    }

    // Total Equipment Cost
    this.yPosition -= 20;
    this.checkNewPage(50);
    
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 30,
      width: this.contentWidth,
      height: 40,
      color: COLORS.primary,
    });

    this.currentPage.drawText("TOTAL EQUIPMENT INVESTMENT", {
      x: this.margin + 15,
      y: this.yPosition - 15,
      size: 10,
      font: this.helvetica,
      color: COLORS.textMuted,
    });

    this.currentPage.drawText(`$${totalCost.toLocaleString()}`, {
      x: this.pageWidth - this.margin - 15 - this.helveticaBold.widthOfTextAtSize(`$${totalCost.toLocaleString()}`, 16),
      y: this.yPosition - 18,
      size: 16,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
  }

  // ============================================
  // SUPPLIER NETWORK
  // ============================================
  private async generateSupplierNetwork(data: ReportData) {
    const page = this.addNewPage();
    const suppliers = data.suppliers || [];

    this.yPosition = this.pageHeight - 80;

    this.drawSectionTitle(`Verified Suppliers (${suppliers.length})`);
    this.yPosition -= 30;

    for (const supplier of suppliers) {
      this.checkNewPage(100);
      
      // Supplier card
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 70,
        width: this.contentWidth,
        height: 80,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Supplier name
      this.currentPage.drawText(supplier.name || "Supplier", {
        x: this.margin + 15,
        y: this.yPosition - 15,
        size: 12,
        font: this.helveticaBold,
        color: COLORS.primary,
      });

      // Location
      if (supplier.location) {
        this.currentPage.drawText(`Location: ${supplier.location}`, {
          x: this.margin + 15,
          y: this.yPosition - 35,
          size: 9,
          font: this.helvetica,
          color: COLORS.textSecondary,
        });
      }

      // Contact info
      let contactX = this.margin + 15;
      if (supplier.email) {
        this.currentPage.drawText(`Email: ${supplier.email}`, {
          x: contactX,
          y: this.yPosition - 52,
          size: 8,
          font: this.helvetica,
          color: COLORS.accent,
        });
        contactX += 180;
      }

      if (supplier.phone) {
        this.currentPage.drawText(`Tel: ${supplier.phone}`, {
          x: contactX,
          y: this.yPosition - 52,
          size: 8,
          font: this.helvetica,
          color: COLORS.textSecondary,
        });
      }

      // Website
      if (supplier.website) {
        this.currentPage.drawText(`Web: ${supplier.website}`, {
          x: this.margin + 15,
          y: this.yPosition - 65,
          size: 8,
          font: this.helvetica,
          color: COLORS.accent,
        });
      }

      this.yPosition -= 90;
    }
  }

  // ============================================
  // FINANCIAL ANALYSIS
  // ============================================
  private async generateFinancialAnalysis(data: ReportData) {
    const page = this.addNewPage();
    const analysis = data.analysis || {};

    this.yPosition = this.pageHeight - 80;

    // CAPEX Breakdown
    this.drawSectionTitle("Initial Investment (CAPEX)");
    this.yPosition -= 20;

    const capex = analysis.initial_investment || {};
    const capexItems = [
      ["Equipment & Machinery", capex.equipment || 0],
      ["Building & Infrastructure", capex.building || 0],
      ["Installation & Setup", capex.installation || 0],
      ["Working Capital", capex.working_capital || 0],
      ["Contingency Reserve", capex.contingency || 0],
    ];

    for (const [label, value] of capexItems) {
      this.checkNewPage(22);
      this.drawFinancialRow(label, value as number);
      this.yPosition -= 22;
    }

    // CAPEX Total
    this.yPosition -= 10;
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition + 5 },
      end: { x: this.pageWidth - this.margin, y: this.yPosition + 5 },
      thickness: 1,
      color: COLORS.primary,
    });
    this.drawFinancialRow("TOTAL CAPEX", capex.total || 0, true);
    this.yPosition -= 35;

    // OPEX Breakdown
    this.checkNewPage(200);
    this.drawSectionTitle("Annual Operating Costs (OPEX)");
    this.yPosition -= 20;

    const opex = analysis.operating_costs || {};
    const opexItems = [
      ["Labor & Personnel", opex.labor || 0],
      ["Utilities & Energy", opex.utilities || 0],
      ["Maintenance", opex.maintenance || 0],
      ["Raw Materials", opex.raw_materials || 0],
      ["Insurance & Compliance", opex.insurance || 0],
    ];

    for (const [label, value] of opexItems) {
      this.checkNewPage(22);
      this.drawFinancialRow(label, value as number);
      this.yPosition -= 22;
    }

    // OPEX Total
    this.yPosition -= 10;
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition + 5 },
      end: { x: this.pageWidth - this.margin, y: this.yPosition + 5 },
      thickness: 1,
      color: COLORS.primary,
    });
    this.drawFinancialRow("TOTAL ANNUAL OPEX", opex.total_annual || 0, true);

    // Financial Projections Page
    this.addNewPage();
    this.yPosition = this.pageHeight - 80;

    this.drawSectionTitle("10-Year Financial Projections");
    this.yPosition -= 25;

    // Table header
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 20,
      width: this.contentWidth,
      height: 25,
      color: COLORS.primary,
    });

    const headers = ["Year", "Revenue", "Costs", "Cash Flow", "Cumulative"];
    const colWidths = [50, 110, 110, 110, 130];
    let headerX = this.margin + 10;
    
    for (let i = 0; i < headers.length; i++) {
      this.currentPage.drawText(headers[i], {
        x: headerX,
        y: this.yPosition - 13,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.bgWhite,
      });
      headerX += colWidths[i];
    }
    this.yPosition -= 25;

    // Projection rows
    const projections = analysis.ten_year_projection || [];
    for (let i = 0; i < Math.min(projections.length, 10); i++) {
      const proj = projections[i];
      this.checkNewPage(25);
      
      const isEven = i % 2 === 0;
      if (isEven) {
        this.currentPage.drawRectangle({
          x: this.margin,
          y: this.yPosition - 17,
          width: this.contentWidth,
          height: 22,
          color: COLORS.bgSubtle,
        });
      }

      let rowX = this.margin + 10;
      const rowData = [
        `Year ${proj.year || i + 1}`,
        `$${(proj.revenue || 0).toLocaleString()}`,
        `$${(proj.total_costs || 0).toLocaleString()}`,
        `$${(proj.net_cash_flow || 0).toLocaleString()}`,
        `$${(proj.cumulative_cash_flow || 0).toLocaleString()}`,
      ];

      for (let j = 0; j < rowData.length; j++) {
        const color = j === 3 && (proj.net_cash_flow || 0) > 0 ? COLORS.success : 
                      j === 3 && (proj.net_cash_flow || 0) < 0 ? COLORS.warning : COLORS.textPrimary;
        this.currentPage.drawText(rowData[j], {
          x: rowX,
          y: this.yPosition - 10,
          size: 9,
          font: j === 0 ? this.helveticaBold : this.helvetica,
          color: color,
        });
        rowX += colWidths[j];
      }
      this.yPosition -= 22;
    }
  }

  // ============================================
  // RISK ASSESSMENT
  // ============================================
  private async generateRiskAssessment(data: ReportData) {
    const page = this.addNewPage();
    const risks = data.planningData?.risk_assessment || {};
    const analysisRisks = data.analysis?.risk_assessment || {};

    this.yPosition = this.pageHeight - 80;

    const riskCategories = [
      { title: "Market Risks", items: risks.market_risks || [], color: COLORS.warning },
      { title: "Technical Risks", items: risks.technical_risks || [], color: COLORS.accent },
      { title: "Supply Chain Risks", items: risks.supply_risks || [], color: COLORS.warning },
      { title: "Operational Risks", items: risks.operational_risks || [], color: COLORS.textSecondary },
    ];

    for (const category of riskCategories) {
      if (category.items.length === 0) continue;
      
      this.checkNewPage(100);
      this.drawSectionTitle(category.title);
      this.yPosition -= 15;

      for (const risk of category.items.slice(0, 4)) {
        this.checkNewPage(20);
        this.drawBulletPoint(risk, category.color);
        this.yPosition -= 20;
      }
      this.yPosition -= 15;
    }

    // Mitigation Strategies
    if (risks.mitigation_strategies?.length) {
      this.yPosition -= 10;
      this.checkNewPage(120);
      
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - (risks.mitigation_strategies.length * 25 + 40),
        width: this.contentWidth,
        height: risks.mitigation_strategies.length * 25 + 50,
        color: COLORS.successBg,
        borderColor: COLORS.success,
        borderWidth: 1,
      });

      this.currentPage.drawText("MITIGATION STRATEGIES", {
        x: this.margin + 15,
        y: this.yPosition - 15,
        size: 11,
        font: this.helveticaBold,
        color: COLORS.success,
      });
      this.yPosition -= 35;

      for (const strategy of risks.mitigation_strategies) {
        this.checkNewPage(25);
        this.currentPage.drawText(`>> ${strategy}`, {
          x: this.margin + 20,
          y: this.yPosition,
          size: 10,
          font: this.helvetica,
          color: COLORS.textPrimary,
        });
        this.yPosition -= 22;
      }
    }
  }

  // ============================================
  // DIGITAL TRANSFORMATION
  // ============================================
  private async generateDigitalTransformation(data: ReportData) {
    const page = this.addNewPage();
    const digital = data.planningData?.digital_transformation || {};

    this.yPosition = this.pageHeight - 80;

    this.drawSectionTitle("Industry 4.0 Capabilities");
    this.yPosition -= 25;

    const capabilities = [
      { label: "Production Optimization", value: digital.production_optimization || "AI-driven process optimization" },
      { label: "Predictive Maintenance", value: digital.predictive_maintenance || "Sensor-based failure prediction" },
      { label: "Quality Intelligence", value: digital.quality_intelligence || "Machine vision inspection" },
      { label: "Energy Management", value: digital.energy_optimization || "Smart grid integration" },
      { label: "Business Intelligence", value: digital.business_intelligence || "Real-time analytics dashboards" },
      { label: "Cybersecurity", value: digital.cybersecurity || "Industrial network protection" },
    ];

    for (const cap of capabilities) {
      this.checkNewPage(60);
      
      // Capability card
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.yPosition - 45,
        width: this.contentWidth,
        height: 50,
        color: COLORS.bgSubtle,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      // Label
      this.currentPage.drawText(cap.label.toUpperCase(), {
        x: this.margin + 15,
        y: this.yPosition - 15,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.accent,
      });

      // Value
      this.currentPage.drawText(cap.value.substring(0, 80), {
        x: this.margin + 15,
        y: this.yPosition - 32,
        size: 10,
        font: this.helvetica,
        color: COLORS.textPrimary,
      });

      this.yPosition -= 60;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================
  
  private drawSectionTitle(title: string) {
    this.currentPage.drawText(title, {
      x: this.margin,
      y: this.yPosition,
      size: 14,
      font: this.helveticaBold,
      color: COLORS.primary,
    });
    
    // Underline
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition - 8 },
      end: { x: this.margin + this.helveticaBold.widthOfTextAtSize(title, 14), y: this.yPosition - 8 },
      thickness: 2,
      color: COLORS.accent,
    });
  }

  private drawMetricRow(label: string, value: string) {
    this.currentPage.drawText(label, {
      x: this.margin,
      y: this.yPosition,
      size: 11,
      font: this.helvetica,
      color: COLORS.textSecondary,
    });

    this.currentPage.drawText(value, {
      x: this.pageWidth - this.margin - this.helveticaBold.widthOfTextAtSize(value, 12),
      y: this.yPosition,
      size: 12,
      font: this.helveticaBold,
      color: COLORS.primary,
    });
  }

  private drawInfoRow(label: string, value: string) {
    this.currentPage.drawText(label + ":", {
      x: this.margin,
      y: this.yPosition,
      size: 10,
      font: this.helveticaBold,
      color: COLORS.textSecondary,
    });

    const maxValueWidth = this.contentWidth - 150;
    const truncatedValue = this.truncateText(value, maxValueWidth, 10);
    
    this.currentPage.drawText(truncatedValue, {
      x: this.margin + 150,
      y: this.yPosition,
      size: 10,
      font: this.helvetica,
      color: COLORS.textPrimary,
    });
  }

  private drawSmallInfoRow(label: string, value: string) {
    this.currentPage.drawText(label + ":", {
      x: this.margin + 15,
      y: this.yPosition,
      size: 9,
      font: this.helvetica,
      color: COLORS.textMuted,
    });

    const maxWidth = this.contentWidth - 100;
    const truncatedValue = this.truncateText(value, maxWidth, 9);

    this.currentPage.drawText(truncatedValue, {
      x: this.margin + 80,
      y: this.yPosition,
      size: 9,
      font: this.helvetica,
      color: COLORS.textPrimary,
    });
  }

  private drawFinancialRow(label: string, value: number, isTotal: boolean = false) {
    const font = isTotal ? this.helveticaBold : this.helvetica;
    const size = isTotal ? 12 : 10;
    const color = isTotal ? COLORS.primary : COLORS.textPrimary;

    this.currentPage.drawText(label, {
      x: this.margin + 10,
      y: this.yPosition,
      size: size,
      font: font,
      color: color,
    });

    const valueStr = `$${value.toLocaleString()}`;
    this.currentPage.drawText(valueStr, {
      x: this.pageWidth - this.margin - 10 - font.widthOfTextAtSize(valueStr, size),
      y: this.yPosition,
      size: size,
      font: font,
      color: color,
    });
  }

  private drawBulletPoint(text: string, color: Color) {
    // Bullet
    this.currentPage.drawCircle({
      x: this.margin + 8,
      y: this.yPosition + 3,
      size: 3,
      color: color,
    });

    // Text
    const truncatedText = this.truncateText(text, this.contentWidth - 30, 10);
    this.currentPage.drawText(truncatedText, {
      x: this.margin + 20,
      y: this.yPosition,
      size: 10,
      font: this.helvetica,
      color: COLORS.textPrimary,
    });
  }

  private drawWrappedText(text: string, size: number, color: Color) {
    const words = text.split(' ');
    let line = '';
    const maxWidth = this.contentWidth - 20;

    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const width = this.helvetica.widthOfTextAtSize(testLine, size);
      
      if (width > maxWidth && line) {
        this.checkNewPage(15);
        this.currentPage.drawText(line, {
          x: this.margin + 10,
          y: this.yPosition,
          size: size,
          font: this.helvetica,
          color: color,
        });
        this.yPosition -= 14;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      this.checkNewPage(15);
      this.currentPage.drawText(line, {
        x: this.margin + 10,
        y: this.yPosition,
        size: size,
        font: this.helvetica,
        color: color,
      });
      this.yPosition -= 14;
    }
  }

  private truncateText(text: string, maxWidth: number, fontSize: number): string {
    if (this.helvetica.widthOfTextAtSize(text, fontSize) <= maxWidth) {
      return text;
    }
    
    let truncated = text;
    while (this.helvetica.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }
}

export const elitePdfGenerator = new ElitePDFGenerator();
