/**
 * Equipment Catalog PDF Generator
 * Generates a comprehensive catalog of all equipment/assets with images and supplier comparisons
 * Uses embedded Unicode fonts for full character support (accents, symbols, etc.)
 */

import { PDFDocument, rgb, PDFPage, PDFFont, Color } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { logger } from "../utils/logger.js";
import axios from "axios";
import fs from "fs";
import path from "path";

// Font URLs - using Google Fonts CDN for Roboto (supports extended Latin + symbols)
const FONT_URLS = {
  regular: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf",
  bold: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf",
};

// Font cache to avoid re-downloading
let fontCache: { regular?: Buffer; bold?: Buffer } = {};

// Medusa.js Color Palette
const COLORS = {
  primary: rgb(0.06, 0.09, 0.16), // #0F172A
  primaryLight: rgb(0.12, 0.16, 0.24), // #1E293B
  accent: rgb(0.49, 0.36, 0.89), // #7C5CE3
  accentLight: rgb(0.58, 0.47, 0.93), // #9478ED
  success: rgb(0.13, 0.73, 0.49), // #22BA7D
  warning: rgb(0.95, 0.63, 0.15), // #F2A025
  textPrimary: rgb(0.06, 0.09, 0.16), // #0F172A
  textSecondary: rgb(0.4, 0.45, 0.53), // #64748B
  textMuted: rgb(0.58, 0.62, 0.69), // #94A3B0
  bgWhite: rgb(1, 1, 1),
  bgSubtle: rgb(0.98, 0.98, 0.99), // #F8FAFC
  bgBase: rgb(0.96, 0.97, 0.98), // #F1F5F9
  border: rgb(0.89, 0.91, 0.94), // #E2E8F0
};

interface Asset {
  id: string;
  name: string;
  type?: string;
  description?: string;
  appearance?: string;
  image_url?: string;
  specifications?: {
    estimated_cost_usd?: number;
    power_kw?: number;
    dimensions?: string;
    weight_kg?: number;
    manufacturer?: string;
    model?: string;
    warranty?: string;
    [key: string]: any;
  };
}

interface Supplier {
  id: string;
  name: string;
  website?: string;
  email?: string;
  phone?: string;
  location?: string;
  country?: string;
  rating?: number;
  verified?: boolean;
  asset_suppliers?: {
    asset_id: string;
    quote_price?: number;
    lead_time_days?: number;
    notes?: string;
    is_preferred?: boolean;
  }[];
}

interface CatalogData {
  projectName: string;
  factoryName?: string;
  assets: Asset[];
  suppliers: Supplier[];
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}

class EquipmentCatalogGenerator {
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
  private brandPrimaryColor!: Color;
  private brandSecondaryColor!: Color;

  constructor() {
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  private hexToRgb(hex: string): Color {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }

  private addPage(): PDFPage {
    this.pageNumber++;
    const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.currentPage = page;
    this.yPosition = this.pageHeight - this.margin;
    return page;
  }

  private checkPageBreak(neededHeight: number): void {
    if (this.yPosition - neededHeight < this.margin + 40) {
      this.addPage();
      this.addPageHeader();
    }
  }

  private addPageHeader(): void {
    const page = this.currentPage;
    
    // Header line
    page.drawRectangle({
      x: 0,
      y: this.pageHeight - 30,
      width: this.pageWidth,
      height: 30,
      color: this.brandPrimaryColor,
    });
    
    // Page title
    page.drawText("CATALOGUE ÉQUIPEMENTS INDUSTRIELS", {
      x: this.margin,
      y: this.pageHeight - 22,
      size: 10,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    
    // Page number
    page.drawText(`Page ${this.pageNumber}`, {
      x: this.pageWidth - this.margin - 40,
      y: this.pageHeight - 22,
      size: 10,
      font: this.helvetica,
      color: COLORS.bgWhite,
    });
    
    this.yPosition = this.pageHeight - 60;
  }

  private drawText(
    text: string,
    x: number,
    y: number,
    options: {
      size?: number;
      font?: PDFFont;
      color?: Color;
      maxWidth?: number;
    } = {}
  ): number {
    const { size = 10, font = this.helvetica, color = COLORS.textPrimary, maxWidth } = options;
    
    if (!text) return y;
    
    // Handle text wrapping
    if (maxWidth) {
      const words = text.split(' ');
      let line = '';
      let currentY = y;
      
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const width = font.widthOfTextAtSize(testLine, size);
        
        if (width > maxWidth && line) {
          this.currentPage.drawText(line, { x, y: currentY, size, font, color });
          line = word;
          currentY -= size + 4;
        } else {
          line = testLine;
        }
      }
      
      if (line) {
        this.currentPage.drawText(line, { x, y: currentY, size, font, color });
        currentY -= size + 4;
      }
      
      return currentY;
    }
    
    this.currentPage.drawText(text, { x, y, size, font, color });
    return y - size - 4;
  }

  private async embedImage(imageUrl: string): Promise<any | null> {
    try {
      if (!imageUrl) return null;
      
      let imageData: Buffer;
      let imageType: 'png' | 'jpg' = 'png';
      
      if (imageUrl.startsWith('data:')) {
        // Handle data URL
        const matches = imageUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!matches) return null;
        imageType = matches[1] === 'jpeg' || matches[1] === 'jpg' ? 'jpg' : 'png';
        imageData = Buffer.from(matches[2], 'base64');
      } else if (imageUrl.startsWith('http')) {
        // Fetch from URL
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
        imageData = Buffer.from(response.data);
        if (imageUrl.toLowerCase().includes('.jpg') || imageUrl.toLowerCase().includes('.jpeg')) {
          imageType = 'jpg';
        }
      } else {
        return null;
      }
      
      if (imageType === 'jpg') {
        return await this.pdfDoc.embedJpg(imageData);
      } else {
        return await this.pdfDoc.embedPng(imageData);
      }
    } catch (error) {
      logger.warn("Failed to embed image", { imageUrl: imageUrl?.substring(0, 50), error });
      return null;
    }
  }

  /**
   * Load and cache fonts for Unicode support
   */
  private async loadFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
    // Return cached fonts if available
    if (fontCache.regular && fontCache.bold) {
      return { regular: fontCache.regular, bold: fontCache.bold };
    }

    logger.info("Downloading Unicode fonts for PDF generation...");
    
    try {
      // Download fonts in parallel
      const [regularResponse, boldResponse] = await Promise.all([
        axios.get(FONT_URLS.regular, { responseType: 'arraybuffer', timeout: 30000 }),
        axios.get(FONT_URLS.bold, { responseType: 'arraybuffer', timeout: 30000 }),
      ]);

      fontCache.regular = Buffer.from(regularResponse.data);
      fontCache.bold = Buffer.from(boldResponse.data);
      
      logger.info("Fonts downloaded and cached successfully");
      return { regular: fontCache.regular, bold: fontCache.bold };
    } catch (error) {
      logger.error("Failed to download fonts", { error });
      throw new Error("Failed to load fonts for PDF generation");
    }
  }

  async generateCatalog(data: CatalogData): Promise<Buffer> {
    logger.info("Generating Equipment Catalog PDF", { 
      projectName: data.projectName,
      assetCount: data.assets.length,
      supplierCount: data.suppliers.length 
    });
    
    this.pdfDoc = await PDFDocument.create();
    
    // Register fontkit for custom font embedding (required for Unicode support)
    this.pdfDoc.registerFontkit(fontkit);
    
    // Load and embed Unicode-compatible fonts
    const fonts = await this.loadFonts();
    this.helvetica = await this.pdfDoc.embedFont(fonts.regular);
    this.helveticaBold = await this.pdfDoc.embedFont(fonts.bold);
    
    // Set brand colors
    this.brandPrimaryColor = this.hexToRgb(data.primaryColor || "#0F172A");
    this.brandSecondaryColor = this.hexToRgb(data.secondaryColor || "#7C5CE3");
    
    // Create cover page
    await this.createCoverPage(data);
    
    // Table of contents
    this.createTableOfContents(data);
    
    // Summary section
    this.createSummarySection(data);
    
    // Equipment details
    for (let i = 0; i < data.assets.length; i++) {
      await this.createAssetPage(data.assets[i], i + 1, data.suppliers);
    }
    
    // Supplier comparison table
    this.createSupplierComparisonTable(data);
    
    const pdfBytes = await this.pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private async createCoverPage(data: CatalogData): Promise<void> {
    const page = this.addPage();
    
    // Full page gradient background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageWidth,
      height: this.pageHeight,
      color: this.brandPrimaryColor,
    });
    
    // Decorative elements
    page.drawRectangle({
      x: 0,
      y: this.pageHeight - 200,
      width: this.pageWidth,
      height: 8,
      color: this.brandSecondaryColor,
    });
    
    // Logo placeholder area
    if (data.logoUrl) {
      try {
        const logoImage = await this.embedImage(data.logoUrl);
        if (logoImage) {
          const logoSize = 80;
          page.drawImage(logoImage, {
            x: (this.pageWidth - logoSize) / 2,
            y: this.pageHeight - 180,
            width: logoSize,
            height: logoSize,
          });
        }
      } catch (e) {
        // Skip logo if failed
      }
    }
    
    // Title
    const title = "CATALOGUE";
    const titleWidth = this.helveticaBold.widthOfTextAtSize(title, 48);
    page.drawText(title, {
      x: (this.pageWidth - titleWidth) / 2,
      y: this.pageHeight / 2 + 80,
      size: 48,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    
    const subtitle = "ÉQUIPEMENTS INDUSTRIELS";
    const subtitleWidth = this.helveticaBold.widthOfTextAtSize(subtitle, 24);
    page.drawText(subtitle, {
      x: (this.pageWidth - subtitleWidth) / 2,
      y: this.pageHeight / 2 + 40,
      size: 24,
      font: this.helveticaBold,
      color: this.brandSecondaryColor,
    });
    
    // Factory name
    const factoryName = data.factoryName || data.projectName;
    const factoryWidth = this.helvetica.widthOfTextAtSize(factoryName, 18);
    page.drawText(factoryName, {
      x: (this.pageWidth - factoryWidth) / 2,
      y: this.pageHeight / 2 - 20,
      size: 18,
      font: this.helvetica,
      color: COLORS.bgWhite,
    });
    
    // Stats bar
    const statsY = 150;
    page.drawRectangle({
      x: this.margin,
      y: statsY - 20,
      width: this.contentWidth,
      height: 60,
      color: rgb(1, 1, 1),
      opacity: 0.1,
      borderColor: rgb(1, 1, 1),
      borderWidth: 1,
      borderOpacity: 0.2,
    });
    
    const statWidth = this.contentWidth / 3;
    
    // Asset count
    page.drawText(data.assets.length.toString(), {
      x: this.margin + statWidth / 2 - 10,
      y: statsY + 10,
      size: 28,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    page.drawText("Équipements", {
      x: this.margin + statWidth / 2 - 30,
      y: statsY - 10,
      size: 10,
      font: this.helvetica,
      color: rgb(1, 1, 1),
      opacity: 0.7,
    });
    
    // Supplier count
    page.drawText(data.suppliers.length.toString(), {
      x: this.margin + statWidth + statWidth / 2 - 10,
      y: statsY + 10,
      size: 28,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    page.drawText("Fournisseurs", {
      x: this.margin + statWidth + statWidth / 2 - 35,
      y: statsY - 10,
      size: 10,
      font: this.helvetica,
      color: rgb(1, 1, 1),
      opacity: 0.7,
    });
    
    // Total cost
    const totalCost = data.assets.reduce((sum, a) => sum + (a.specifications?.estimated_cost_usd || 0), 0);
    const costStr = `$${(totalCost / 1000).toFixed(0)}K`;
    page.drawText(costStr, {
      x: this.margin + statWidth * 2 + statWidth / 2 - 25,
      y: statsY + 10,
      size: 28,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    page.drawText("Coût Total Est.", {
      x: this.margin + statWidth * 2 + statWidth / 2 - 35,
      y: statsY - 10,
      size: 10,
      font: this.helvetica,
      color: rgb(1, 1, 1),
      opacity: 0.7,
    });
    
    // Date
    const date = new Date().toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const dateWidth = this.helvetica.widthOfTextAtSize(date, 10);
    page.drawText(date, {
      x: (this.pageWidth - dateWidth) / 2,
      y: 60,
      size: 10,
      font: this.helvetica,
      color: rgb(1, 1, 1),
      opacity: 0.6,
    });
  }

  private createTableOfContents(data: CatalogData): void {
    this.addPage();
    this.addPageHeader();
    
    // Title
    this.currentPage.drawText("TABLE DES MATIÈRES", {
      x: this.margin,
      y: this.yPosition,
      size: 20,
      font: this.helveticaBold,
      color: this.brandPrimaryColor,
    });
    this.yPosition -= 40;
    
    // Sections
    const sections = [
      { title: "Résumé Exécutif", page: 3 },
      ...data.assets.map((asset, i) => ({ 
        title: `${i + 1}. ${asset.name}`, 
        page: 4 + i 
      })),
      { title: "Tableau Comparatif Fournisseurs", page: 4 + data.assets.length },
    ];
    
    for (const section of sections) {
      this.checkPageBreak(25);
      
      // Section title
      this.currentPage.drawText(section.title, {
        x: this.margin,
        y: this.yPosition,
        size: 11,
        font: this.helvetica,
        color: COLORS.textPrimary,
      });
      
      // Dots
      const titleWidth = this.helvetica.widthOfTextAtSize(section.title, 11);
      const pageNumWidth = this.helvetica.widthOfTextAtSize(section.page.toString(), 11);
      const dotsStart = this.margin + titleWidth + 10;
      const dotsEnd = this.pageWidth - this.margin - pageNumWidth - 10;
      
      let dotX = dotsStart;
      while (dotX < dotsEnd) {
        this.currentPage.drawText(".", {
          x: dotX,
          y: this.yPosition,
          size: 11,
          font: this.helvetica,
          color: COLORS.textMuted,
        });
        dotX += 8;
      }
      
      // Page number
      this.currentPage.drawText(section.page.toString(), {
        x: this.pageWidth - this.margin - pageNumWidth,
        y: this.yPosition,
        size: 11,
        font: this.helvetica,
        color: COLORS.textPrimary,
      });
      
      this.yPosition -= 25;
    }
  }

  private createSummarySection(data: CatalogData): void {
    this.addPage();
    this.addPageHeader();
    
    // Title
    this.currentPage.drawText("RÉSUMÉ EXÉCUTIF", {
      x: this.margin,
      y: this.yPosition,
      size: 20,
      font: this.helveticaBold,
      color: this.brandPrimaryColor,
    });
    this.yPosition -= 35;
    
    // Summary stats
    const totalCost = data.assets.reduce((sum, a) => sum + (a.specifications?.estimated_cost_usd || 0), 0);
    const avgCost = totalCost / (data.assets.length || 1);
    const typeCounts = data.assets.reduce((acc, a) => {
      const type = a.type || "Autre";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Stats cards
    const cardWidth = (this.contentWidth - 30) / 3;
    const cardHeight = 70;
    const cardY = this.yPosition - cardHeight;
    
    // Card 1: Total Equipment
    this.currentPage.drawRectangle({
      x: this.margin,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: COLORS.bgSubtle,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    this.currentPage.drawText(data.assets.length.toString(), {
      x: this.margin + 15,
      y: cardY + cardHeight - 30,
      size: 28,
      font: this.helveticaBold,
      color: this.brandPrimaryColor,
    });
    this.currentPage.drawText("Équipements", {
      x: this.margin + 15,
      y: cardY + 15,
      size: 10,
      font: this.helvetica,
      color: COLORS.textSecondary,
    });
    
    // Card 2: Total Cost
    this.currentPage.drawRectangle({
      x: this.margin + cardWidth + 15,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: COLORS.bgSubtle,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    this.currentPage.drawText(`$${totalCost.toLocaleString()}`, {
      x: this.margin + cardWidth + 30,
      y: cardY + cardHeight - 30,
      size: 22,
      font: this.helveticaBold,
      color: COLORS.success,
    });
    this.currentPage.drawText("Investissement Total", {
      x: this.margin + cardWidth + 30,
      y: cardY + 15,
      size: 10,
      font: this.helvetica,
      color: COLORS.textSecondary,
    });
    
    // Card 3: Suppliers
    this.currentPage.drawRectangle({
      x: this.margin + (cardWidth + 15) * 2,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: COLORS.bgSubtle,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    this.currentPage.drawText(data.suppliers.length.toString(), {
      x: this.margin + (cardWidth + 15) * 2 + 15,
      y: cardY + cardHeight - 30,
      size: 28,
      font: this.helveticaBold,
      color: this.brandSecondaryColor,
    });
    this.currentPage.drawText("Fournisseurs", {
      x: this.margin + (cardWidth + 15) * 2 + 15,
      y: cardY + 15,
      size: 10,
      font: this.helvetica,
      color: COLORS.textSecondary,
    });
    
    this.yPosition = cardY - 30;
    
    // Equipment by type
    this.currentPage.drawText("Répartition par Type", {
      x: this.margin,
      y: this.yPosition,
      size: 14,
      font: this.helveticaBold,
      color: COLORS.textPrimary,
    });
    this.yPosition -= 25;
    
    for (const [type, count] of Object.entries(typeCounts)) {
      this.checkPageBreak(20);
      
      // Type name
      this.currentPage.drawText(`• ${type}`, {
        x: this.margin + 10,
        y: this.yPosition,
        size: 11,
        font: this.helvetica,
        color: COLORS.textPrimary,
      });
      
      // Count badge
      this.currentPage.drawRectangle({
        x: this.margin + 200,
        y: this.yPosition - 3,
        width: 30,
        height: 16,
        color: this.brandSecondaryColor,
        opacity: 0.1,
        borderRadius: 3,
      });
      this.currentPage.drawText(count.toString(), {
        x: this.margin + 210,
        y: this.yPosition,
        size: 10,
        font: this.helveticaBold,
        color: this.brandSecondaryColor,
      });
      
      this.yPosition -= 22;
    }
  }

  private async createAssetPage(asset: Asset, index: number, suppliers: Supplier[]): Promise<void> {
    this.addPage();
    this.addPageHeader();
    
    // Asset header with badge
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 5,
      width: 30,
      height: 25,
      color: this.brandPrimaryColor,
    });
    this.currentPage.drawText(index.toString(), {
      x: this.margin + (index < 10 ? 11 : 7),
      y: this.yPosition,
      size: 14,
      font: this.helveticaBold,
      color: COLORS.bgWhite,
    });
    
    // Asset name
    this.currentPage.drawText(asset.name.toUpperCase(), {
      x: this.margin + 45,
      y: this.yPosition,
      size: 18,
      font: this.helveticaBold,
      color: this.brandPrimaryColor,
    });
    
    // Type badge
    if (asset.type) {
      const typeText = asset.type;
      const typeWidth = this.helvetica.widthOfTextAtSize(typeText, 9) + 12;
      this.currentPage.drawRectangle({
        x: this.pageWidth - this.margin - typeWidth,
        y: this.yPosition - 3,
        width: typeWidth,
        height: 18,
        color: this.brandSecondaryColor,
        opacity: 0.15,
      });
      this.currentPage.drawText(typeText, {
        x: this.pageWidth - this.margin - typeWidth + 6,
        y: this.yPosition,
        size: 9,
        font: this.helvetica,
        color: this.brandSecondaryColor,
      });
    }
    
    this.yPosition -= 35;
    
    // Two column layout
    const leftColWidth = 200;
    const rightColX = this.margin + leftColWidth + 30;
    const rightColWidth = this.contentWidth - leftColWidth - 30;
    
    // Left column: Image
    const imageBoxHeight = 150;
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - imageBoxHeight,
      width: leftColWidth,
      height: imageBoxHeight,
      color: COLORS.bgSubtle,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    
    if (asset.image_url) {
      try {
        const image = await this.embedImage(asset.image_url);
        if (image) {
          // Calculate aspect ratio to fit
          const imgWidth = leftColWidth - 20;
          const imgHeight = imageBoxHeight - 20;
          const scale = Math.min(imgWidth / image.width, imgHeight / image.height);
          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;
          
          this.currentPage.drawImage(image, {
            x: this.margin + (leftColWidth - scaledWidth) / 2,
            y: this.yPosition - imageBoxHeight + (imageBoxHeight - scaledHeight) / 2,
            width: scaledWidth,
            height: scaledHeight,
          });
        }
      } catch (e) {
        // Show placeholder text if image fails
        this.currentPage.drawText("Image non disponible", {
          x: this.margin + 50,
          y: this.yPosition - imageBoxHeight / 2,
          size: 10,
          font: this.helvetica,
          color: COLORS.textMuted,
        });
      }
    } else {
      this.currentPage.drawText("Image non disponible", {
        x: this.margin + 50,
        y: this.yPosition - imageBoxHeight / 2,
        size: 10,
        font: this.helvetica,
        color: COLORS.textMuted,
      });
    }
    
    // Right column: Specifications
    let specY = this.yPosition;
    this.currentPage.drawText("SPÉCIFICATIONS", {
      x: rightColX,
      y: specY,
      size: 11,
      font: this.helveticaBold,
      color: COLORS.textSecondary,
    });
    specY -= 20;
    
    const specs = asset.specifications || {};
    const specItems = [
      { label: "Coût Estimé", value: specs.estimated_cost_usd ? `$${specs.estimated_cost_usd.toLocaleString()}` : "-" },
      { label: "Puissance", value: specs.power_kw ? `${specs.power_kw} kW` : "-" },
      { label: "Dimensions", value: specs.dimensions || "-" },
      { label: "Poids", value: specs.weight_kg ? `${specs.weight_kg} kg` : "-" },
      { label: "Fabricant", value: specs.manufacturer || "-" },
      { label: "Modèle", value: specs.model || "-" },
      { label: "Garantie", value: specs.warranty || "-" },
    ];
    
    for (const item of specItems) {
      this.currentPage.drawText(`${item.label}:`, {
        x: rightColX,
        y: specY,
        size: 9,
        font: this.helvetica,
        color: COLORS.textMuted,
      });
      this.currentPage.drawText(item.value, {
        x: rightColX + 80,
        y: specY,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.textPrimary,
      });
      specY -= 16;
    }
    
    this.yPosition -= imageBoxHeight + 20;
    
    // Description
    if (asset.description) {
      this.checkPageBreak(60);
      this.currentPage.drawText("DESCRIPTION", {
        x: this.margin,
        y: this.yPosition,
        size: 11,
        font: this.helveticaBold,
        color: COLORS.textSecondary,
      });
      this.yPosition -= 18;
      
      this.yPosition = this.drawText(asset.description, this.margin, this.yPosition, {
        size: 10,
        color: COLORS.textPrimary,
        maxWidth: this.contentWidth,
      });
      this.yPosition -= 15;
    }
    
    // Suppliers for this asset
    const assetSuppliers = suppliers.filter(s => 
      s.asset_suppliers?.some(as => as.asset_id === asset.id)
    );
    
    if (assetSuppliers.length > 0) {
      this.checkPageBreak(100);
      
      this.currentPage.drawText("FOURNISSEURS", {
        x: this.margin,
        y: this.yPosition,
        size: 11,
        font: this.helveticaBold,
        color: COLORS.textSecondary,
      });
      this.yPosition -= 20;
      
      // Supplier table header
      const colWidths = [150, 100, 80, 80, 80];
      const headerY = this.yPosition;
      
      this.currentPage.drawRectangle({
        x: this.margin,
        y: headerY - 5,
        width: this.contentWidth,
        height: 22,
        color: COLORS.bgBase,
      });
      
      const headers = ["Fournisseur", "Localisation", "Prix Devis", "Délai", "Note"];
      let headerX = this.margin + 5;
      for (let i = 0; i < headers.length; i++) {
        this.currentPage.drawText(headers[i], {
          x: headerX,
          y: headerY,
          size: 8,
          font: this.helveticaBold,
          color: COLORS.textSecondary,
        });
        headerX += colWidths[i];
      }
      
      this.yPosition -= 25;
      
      // Supplier rows
      for (const supplier of assetSuppliers) {
        this.checkPageBreak(25);
        
        const assetSupplier = supplier.asset_suppliers?.find(as => as.asset_id === asset.id);
        
        let colX = this.margin + 5;
        
        // Name (with preferred badge)
        let nameText = supplier.name;
        if (assetSupplier?.is_preferred) {
          nameText += " ★";
        }
        this.currentPage.drawText(nameText.substring(0, 25), {
          x: colX,
          y: this.yPosition,
          size: 9,
          font: assetSupplier?.is_preferred ? this.helveticaBold : this.helvetica,
          color: assetSupplier?.is_preferred ? this.brandPrimaryColor : COLORS.textPrimary,
        });
        colX += colWidths[0];
        
        // Location
        this.currentPage.drawText((supplier.location || supplier.country || "-").substring(0, 15), {
          x: colX,
          y: this.yPosition,
          size: 9,
          font: this.helvetica,
          color: COLORS.textPrimary,
        });
        colX += colWidths[1];
        
        // Quote price
        this.currentPage.drawText(
          assetSupplier?.quote_price ? `$${assetSupplier.quote_price.toLocaleString()}` : "-",
          {
            x: colX,
            y: this.yPosition,
            size: 9,
            font: this.helvetica,
            color: assetSupplier?.quote_price ? COLORS.success : COLORS.textMuted,
          }
        );
        colX += colWidths[2];
        
        // Lead time
        this.currentPage.drawText(
          assetSupplier?.lead_time_days ? `${assetSupplier.lead_time_days}j` : "-",
          {
            x: colX,
            y: this.yPosition,
            size: 9,
            font: this.helvetica,
            color: COLORS.textPrimary,
          }
        );
        colX += colWidths[3];
        
        // Rating
        this.currentPage.drawText(
          supplier.rating ? `${supplier.rating}/5` : "-",
          {
            x: colX,
            y: this.yPosition,
            size: 9,
            font: this.helvetica,
            color: COLORS.textPrimary,
          }
        );
        
        this.yPosition -= 20;
        
        // Divider line
        this.currentPage.drawLine({
          start: { x: this.margin, y: this.yPosition + 8 },
          end: { x: this.pageWidth - this.margin, y: this.yPosition + 8 },
          thickness: 0.5,
          color: COLORS.border,
        });
      }
    }
  }

  private createSupplierComparisonTable(data: CatalogData): void {
    this.addPage();
    this.addPageHeader();
    
    // Title
    this.currentPage.drawText("TABLEAU COMPARATIF DES FOURNISSEURS", {
      x: this.margin,
      y: this.yPosition,
      size: 18,
      font: this.helveticaBold,
      color: this.brandPrimaryColor,
    });
    this.yPosition -= 35;
    
    // Summary text
    this.currentPage.drawText(
      `${data.suppliers.length} fournisseurs identifiés pour ${data.assets.length} équipements`,
      {
        x: this.margin,
        y: this.yPosition,
        size: 11,
        font: this.helvetica,
        color: COLORS.textSecondary,
      }
    );
    this.yPosition -= 30;
    
    // Main comparison table
    const colWidths = [140, 100, 60, 70, 70, 70];
    
    // Header
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yPosition - 5,
      width: this.contentWidth,
      height: 25,
      color: this.brandPrimaryColor,
    });
    
    const headers = ["Fournisseur", "Localisation", "Note", "Vérifié", "Équip.", "Contact"];
    let headerX = this.margin + 5;
    for (let i = 0; i < headers.length; i++) {
      this.currentPage.drawText(headers[i], {
        x: headerX,
        y: this.yPosition,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.bgWhite,
      });
      headerX += colWidths[i];
    }
    
    this.yPosition -= 30;
    
    // Supplier rows
    for (let i = 0; i < data.suppliers.length; i++) {
      const supplier = data.suppliers[i];
      this.checkPageBreak(30);
      
      // Alternating background
      if (i % 2 === 0) {
        this.currentPage.drawRectangle({
          x: this.margin,
          y: this.yPosition - 8,
          width: this.contentWidth,
          height: 25,
          color: COLORS.bgSubtle,
        });
      }
      
      let colX = this.margin + 5;
      
      // Name
      this.currentPage.drawText(supplier.name.substring(0, 22), {
        x: colX,
        y: this.yPosition,
        size: 9,
        font: this.helveticaBold,
        color: COLORS.textPrimary,
      });
      colX += colWidths[0];
      
      // Location
      this.currentPage.drawText((supplier.location || supplier.country || "-").substring(0, 15), {
        x: colX,
        y: this.yPosition,
        size: 9,
        font: this.helvetica,
        color: COLORS.textPrimary,
      });
      colX += colWidths[1];
      
      // Rating
      this.currentPage.drawText(supplier.rating ? `${supplier.rating}/5` : "-", {
        x: colX,
        y: this.yPosition,
        size: 9,
        font: this.helvetica,
        color: supplier.rating && supplier.rating >= 4 ? COLORS.success : COLORS.textPrimary,
      });
      colX += colWidths[2];
      
      // Verified
      this.currentPage.drawText(supplier.verified ? "✓ Oui" : "Non", {
        x: colX,
        y: this.yPosition,
        size: 9,
        font: this.helvetica,
        color: supplier.verified ? COLORS.success : COLORS.textMuted,
      });
      colX += colWidths[3];
      
      // Equipment count
      const equipCount = supplier.asset_suppliers?.length || 0;
      this.currentPage.drawText(equipCount.toString(), {
        x: colX,
        y: this.yPosition,
        size: 9,
        font: this.helvetica,
        color: COLORS.textPrimary,
      });
      colX += colWidths[4];
      
      // Contact (truncated email or phone)
      const contact = supplier.email || supplier.phone || "-";
      this.currentPage.drawText(contact.substring(0, 12), {
        x: colX,
        y: this.yPosition,
        size: 8,
        font: this.helvetica,
        color: COLORS.textSecondary,
      });
      
      this.yPosition -= 25;
    }
    
    // Footer note
    this.yPosition -= 20;
    this.currentPage.drawText(
      "★ = Fournisseur préféré | Les prix et délais sont indicatifs et sujets à confirmation",
      {
        x: this.margin,
        y: this.yPosition,
        size: 8,
        font: this.helvetica,
        color: COLORS.textMuted,
      }
    );
  }
}

export const equipmentCatalogGenerator = new EquipmentCatalogGenerator();

