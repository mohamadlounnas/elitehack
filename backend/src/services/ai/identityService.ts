/**
 * Identity Generation Service
 * Generates professional brand identity including logo and color scheme
 */

import { supabase } from "../../utils/supabase.js";
import { logger } from "../../utils/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

type IdentityStreamCallback = (update: {
  type: "analyzing" | "generating_colors" | "generating_logo" | "complete";
  content?: string;
  progress: number;
  colors?: { primary: string; secondary: string };
  logoUrl?: string;
}) => void;

interface BrandIdentity {
  logo_svg: string;
  logo_concept: string;
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    heading_font: string;
    body_font: string;
  };
  brand_values: string[];
  tagline: string;
}

class IdentityService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  /**
   * Generate brand identity with streaming updates
   */
  async generateIdentityWithStream(
    projectId: string,
    onUpdate: IdentityStreamCallback
  ): Promise<void> {
    logger.info("Starting identity generation", { projectId });

    try {
      // Step 1: Get project and planning data
      onUpdate({
        type: "analyzing",
        content: "Analyzing project requirements...",
        progress: 10,
      });

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        throw new Error("Project not found");
      }

      const planningData = project.planning_data || {};
      const factoryName = planningData.industrial_identity?.factory_name || project.name;
      const category = planningData.industrial_identity?.industrial_category || "Manufacturing";

      // Step 2: Generate color palette
      onUpdate({
        type: "generating_colors",
        content: "Creating professional color palette...",
        progress: 30,
      });

      const colors = await this.generateColorPalette(factoryName, category, planningData);
      
      onUpdate({
        type: "generating_colors",
        content: `Selected colors: ${colors.primary} (primary), ${colors.secondary} (secondary)`,
        progress: 50,
        colors: { primary: colors.primary, secondary: colors.secondary },
      });

      // Step 3: Generate logo
      onUpdate({
        type: "generating_logo",
        content: "Generating professional logo...",
        progress: 60,
      });

      const logoResult = await this.generateLogo(factoryName, category, colors, planningData);

      onUpdate({
        type: "generating_logo",
        content: "Logo generated successfully!",
        progress: 80,
        logoUrl: logoResult.logoUrl,
      });

      // Step 4: Save to database
      const brandIdentity: BrandIdentity = {
        logo_svg: logoResult.logoSvg || "",
        logo_concept: logoResult.concept,
        color_palette: colors,
        typography: {
          heading_font: "Inter",
          body_font: "Inter",
        },
        brand_values: this.extractBrandValues(planningData),
        tagline: logoResult.tagline || `${factoryName} - Industrial Excellence`,
      };

      const { error: updateError } = await supabase
        .from("projects")
        .update({
          logo_url: logoResult.logoUrl,
          primary_color: colors.primary,
          secondary_color: colors.secondary,
          brand_identity: brandIdentity,
        })
        .eq("id", projectId);

      if (updateError) {
        logger.error("Failed to save brand identity", updateError, { projectId });
        throw updateError;
      }

      onUpdate({
        type: "complete",
        content: "Brand identity generated successfully!",
        progress: 100,
        colors: { primary: colors.primary, secondary: colors.secondary },
        logoUrl: logoResult.logoUrl,
      });

      logger.info("Identity generation complete", { projectId });
    } catch (error: any) {
      logger.error("Error in identity generation", error, { projectId });
      throw error;
    }
  }

  /**
   * Generate a professional color palette based on industry and brand
   */
  private async generateColorPalette(
    factoryName: string,
    category: string,
    planningData: any
  ): Promise<{
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  }> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

    const prompt = `You are a professional brand designer. Generate a sophisticated, industrial color palette for:

COMPANY: ${factoryName}
INDUSTRY: ${category}
CONTEXT: ${planningData.industrial_identity?.operating_scope || "Regional manufacturing"}

Requirements:
- Primary color: Strong, professional, represents trust and industry
- Secondary color: Complementary, adds depth
- Keep it simple: 1-2 main colors that work together
- Colors should be appropriate for industrial/manufacturing context
- Consider psychology: trust, innovation, reliability, strength

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "primary": "#HEXCODE",
  "secondary": "#HEXCODE",
  "accent": "#HEXCODE",
  "background": "#FFFFFF",
  "text": "#1A1A1A",
  "reasoning": "Brief explanation"
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const colors = JSON.parse(jsonMatch[0]);
        return {
          primary: colors.primary || "#0F172A",
          secondary: colors.secondary || "#3B82F6",
          accent: colors.accent || "#10B981",
          background: colors.background || "#FFFFFF",
          text: colors.text || "#1A1A1A",
        };
      }
    } catch (error) {
      logger.warn("Failed to generate colors with AI, using defaults", { error });
    }

    // Fallback professional industrial colors
    return {
      primary: "#0F172A", // Dark navy
      secondary: "#3B82F6", // Blue
      accent: "#10B981", // Green
      background: "#FFFFFF",
      text: "#1A1A1A",
    };
  }

  /**
   * Generate a professional logo using AI
   */
  private async generateLogo(
    factoryName: string,
    category: string,
    colors: { primary: string; secondary: string },
    planningData: any
  ): Promise<{ logoUrl: string; logoSvg?: string; concept: string; tagline: string }> {
    try {
      // Use Gemini to generate logo concept and SVG
      const model = this.genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
      
      // Get industry-specific icon suggestions
      const industryIcons = this.getIndustryIconSuggestions(category);
      
      const prompt = `You are a world-class brand designer from Pentagram or Wolff Olins. Create a stunning, UNIQUE SVG logo for:

COMPANY NAME: ${factoryName}
INDUSTRY: ${category}
PRIMARY COLOR: ${colors.primary}
SECONDARY COLOR: ${colors.secondary}

STRICT REQUIREMENTS:
1. WHITE BACKGROUND - The logo MUST be designed for white backgrounds
2. UNIQUE & MEMORABLE - Not generic, must be distinctive and recognizable
3. MINIMALIST - Clean lines, no clutter, maximum 2-3 colors
4. PROFESSIONAL - Suitable for Fortune 500 company
5. SCALABLE - Works from favicon (16px) to billboard
6. NO TEXT - Symbol/icon only, no letters or words
7. GEOMETRIC PRECISION - Use golden ratio, perfect circles, balanced proportions

DESIGN INSPIRATION FOR ${category}:
${industryIcons}

TECHNICAL SVG REQUIREMENTS:
- viewBox="0 0 100 100"
- Use the primary color (${colors.primary}) as the main color
- May use secondary (${colors.secondary}) for accents
- White (#FFFFFF) for background or negative space
- Clean paths, no unnecessary complexity
- Use <defs> for gradients if needed

Return ONLY a valid JSON object:
{
  "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='200' height='200'>...</svg>",
  "concept": "Design concept explanation",
  "tagline": "Professional tagline"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const logoData = JSON.parse(jsonMatch[0]);
        
        if (logoData.svg) {
          // Ensure SVG has white background
          let svg = logoData.svg;
          if (!svg.includes('background') && !svg.includes('#FFFFFF') && !svg.includes('#fff')) {
            // Add white background rect at the beginning
            svg = svg.replace(
              /(<svg[^>]*>)/,
              '$1<rect width="100" height="100" fill="#FFFFFF"/>'
            );
          }
          
          // Convert SVG to base64 data URL
          const base64 = Buffer.from(svg).toString("base64");
          const logoUrl = `data:image/svg+xml;base64,${base64}`;
          
          return {
            logoUrl,
            logoSvg: svg,
            concept: logoData.concept || `Professional ${category} logo for ${factoryName}`,
            tagline: logoData.tagline || `${factoryName} - Industrial Excellence`,
          };
        }
      }
      
      // Fallback to professional SVG
      return this.generateProfessionalSvgLogo(factoryName, category, colors);
    } catch (error) {
      logger.warn("Failed to generate logo with AI, using professional fallback", { error });
      return this.generateProfessionalSvgLogo(factoryName, category, colors);
    }
  }

  /**
   * Get industry-specific icon suggestions for the AI
   */
  private getIndustryIconSuggestions(category: string): string {
    const suggestions: Record<string, string> = {
      "Manufacturing": "Gear cogs interlocking, abstract factory silhouette, precision engineering symbols, hexagonal patterns",
      "Automotive": "Steering wheel abstraction, speed lines, aerodynamic curves, wheel/motion symbols",
      "Electronics": "Circuit patterns, chip designs, connection nodes, wave forms, pixel-inspired geometry",
      "Food & Beverage": "Leaf elements, circular flow, natural curves, droplet shapes, organic forms",
      "Pharmaceutical": "Helix patterns, molecular structures, shield/protection symbols, cross variations",
      "Textile": "Weave patterns, thread intersections, fabric folds, interlocking lines",
      "Chemical": "Molecular bonds, hexagonal chemistry patterns, flask abstractions, element symbols",
      "Aerospace": "Wing curves, trajectory arcs, star patterns, orbital rings",
      "Energy": "Sun rays, lightning bolts, circular energy flow, wind turbine abstractions",
      "Construction": "Building blocks, structural beams, architectural arches, foundation symbols",
    };
    
    const defaultSuggestions = "Geometric shapes, interlocking forms, precision angles, abstract industrial symbols, circles and lines in harmony";
    
    // Find matching category or use default
    for (const [key, value] of Object.entries(suggestions)) {
      if (category.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(category.toLowerCase())) {
        return value;
      }
    }
    
    return defaultSuggestions;
  }

  /**
   * Generate a professional SVG logo as fallback (better than simple)
   */
  private generateProfessionalSvgLogo(
    name: string,
    category: string,
    colors: { primary: string; secondary: string }
  ): { logoUrl: string; logoSvg: string; concept: string; tagline: string } {
    // Generate different logo styles based on category
    const logoStyles = [
      this.generateGeometricLogo(name, colors),
      this.generateCircularLogo(name, colors),
      this.generateHexagonLogo(name, colors),
      this.generateAbstractLogo(name, colors),
    ];
    
    // Pick one based on name hash for consistency
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const selectedLogo = logoStyles[hash % logoStyles.length];
    
    return {
      logoUrl: selectedLogo.url,
      logoSvg: selectedLogo.svg,
      concept: `Professional geometric logo representing ${name}'s commitment to precision and excellence`,
      tagline: `${name} - Industrial Excellence`,
    };
  }

  /**
   * Generate a geometric style logo
   */
  private generateGeometricLogo(name: string, colors: { primary: string; secondary: string }): { url: string; svg: string } {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <rect width="100" height="100" fill="#FFFFFF"/>
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <g transform="translate(50,50)">
    <polygon points="0,-35 30,17.5 -30,17.5" fill="url(#grad1)" transform="rotate(0)"/>
    <polygon points="0,-25 21,12.5 -21,12.5" fill="#FFFFFF" transform="rotate(180)"/>
    <circle cx="0" cy="0" r="8" fill="${colors.primary}"/>
  </g>
</svg>`;
    
    const base64 = Buffer.from(svg).toString("base64");
    return { url: `data:image/svg+xml;base64,${base64}`, svg };
  }

  /**
   * Generate a circular style logo
   */
  private generateCircularLogo(name: string, colors: { primary: string; secondary: string }): { url: string; svg: string } {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <rect width="100" height="100" fill="#FFFFFF"/>
  <circle cx="50" cy="50" r="40" fill="none" stroke="${colors.primary}" stroke-width="6"/>
  <circle cx="50" cy="50" r="28" fill="none" stroke="${colors.secondary}" stroke-width="4"/>
  <circle cx="50" cy="50" r="16" fill="${colors.primary}"/>
  <line x1="50" y1="10" x2="50" y2="25" stroke="${colors.primary}" stroke-width="3" stroke-linecap="round"/>
  <line x1="50" y1="75" x2="50" y2="90" stroke="${colors.primary}" stroke-width="3" stroke-linecap="round"/>
  <line x1="10" y1="50" x2="25" y2="50" stroke="${colors.primary}" stroke-width="3" stroke-linecap="round"/>
  <line x1="75" y1="50" x2="90" y2="50" stroke="${colors.primary}" stroke-width="3" stroke-linecap="round"/>
</svg>`;
    
    const base64 = Buffer.from(svg).toString("base64");
    return { url: `data:image/svg+xml;base64,${base64}`, svg };
  }

  /**
   * Generate a hexagon style logo
   */
  private generateHexagonLogo(name: string, colors: { primary: string; secondary: string }): { url: string; svg: string } {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <rect width="100" height="100" fill="#FFFFFF"/>
  <defs>
    <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <polygon points="50,8 88,29 88,71 50,92 12,71 12,29" fill="url(#hexGrad)"/>
  <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" fill="#FFFFFF"/>
  <polygon points="50,32 62,41 62,59 50,68 38,59 38,41" fill="${colors.primary}"/>
</svg>`;
    
    const base64 = Buffer.from(svg).toString("base64");
    return { url: `data:image/svg+xml;base64,${base64}`, svg };
  }

  /**
   * Generate an abstract style logo
   */
  private generateAbstractLogo(name: string, colors: { primary: string; secondary: string }): { url: string; svg: string } {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <rect width="100" height="100" fill="#FFFFFF"/>
  <defs>
    <linearGradient id="absGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <path d="M20,50 Q35,20 50,50 T80,50" fill="none" stroke="url(#absGrad)" stroke-width="8" stroke-linecap="round"/>
  <path d="M20,50 Q35,80 50,50 T80,50" fill="none" stroke="${colors.primary}" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
  <circle cx="20" cy="50" r="6" fill="${colors.primary}"/>
  <circle cx="50" cy="50" r="8" fill="${colors.secondary}"/>
  <circle cx="80" cy="50" r="6" fill="${colors.primary}"/>
</svg>`;
    
    const base64 = Buffer.from(svg).toString("base64");
    return { url: `data:image/svg+xml;base64,${base64}`, svg };
  }

  /**
   * Generate a simple SVG logo as fallback (with white background)
   */
  private generateSimpleSvgLogo(
    name: string,
    colors: { primary: string; secondary: string }
  ): string {
    // Create initials from name
    const initials = name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <rect width="100" height="100" fill="#FFFFFF"/>
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect x="10" y="10" width="80" height="80" rx="12" fill="url(#grad)"/>
  <text x="50" y="62" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
</svg>`;

    // Convert to base64 data URL
    const base64 = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Extract brand values from planning data
   */
  private extractBrandValues(planningData: any): string[] {
    const values: string[] = [];
    
    if (planningData.executive_summary?.key_highlights) {
      values.push(...planningData.executive_summary.key_highlights.slice(0, 3));
    }
    
    if (planningData.industrial_identity?.certifications_required) {
      values.push(...planningData.industrial_identity.certifications_required.slice(0, 2));
    }
    
    if (values.length === 0) {
      values.push("Quality", "Innovation", "Reliability");
    }
    
    return values.slice(0, 5);
  }
}

export const identityService = new IdentityService();

