import { createCanvas, CanvasRenderingContext2D } from "canvas";
import { supabase } from "../utils/supabase.js";
import { stepOrchestrator } from "./stepOrchestrator.js";
import { createLLM, createNanoLLM } from "../utils/langchain.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { logger } from "../utils/logger.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mime from "mime";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geminiApiKey = process.env.GEMINI_API_KEY || "AIzaSyDoflplqtb52hrNrFB3OWZ7JRxdshCdGbo";

type LayoutStreamCallback = (update: {
  type: "starting" | "generating" | "reviewing" | "refining" | "complete";
  layoutType?: "floor_plan" | "equipment_placement" | "atex_zones" | "agv_routing";
  imageUrl?: string;
  iteration?: number;
  feedback?: string;
  progress: number;
  total: number;
}) => void;

interface LayoutIteration {
  iteration: number;
  imageUrl: string;
  feedback?: string;
  improvements?: string[];
}

/**
 * Generates 2D layout images after planning is complete
 * Uses AI to chain: Base Grid → Floor Plan → Equipment → ATEX → AGV Routing
 */
class LayoutGeneratorService {
  private readonly CANVAS_WIDTH = 1200;
  private readonly CANVAS_HEIGHT = 800;
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: geminiApiKey,
    });
  }

  /**
   * Generates 2D layouts with streaming support and AI chaining
   */
  async generate2DLayoutWithStream(
    projectId: string,
    onUpdate: LayoutStreamCallback
  ): Promise<void> {
    try {
      console.log(`[LAYOUT GENERATION] Starting layout generation for project ${projectId}`);
      logger.workflow("layoutGenerating", projectId, { action: "start" });
      logger.db("SELECT", "projects", { projectId });
      
      console.log(`[LAYOUT GENERATION] Fetching project data...`);
      const { data: project } = await supabase
        .from("projects")
        .select("planning_data")
        .eq("id", projectId)
        .single();

      if (!project || !project.planning_data) {
        console.error(`[LAYOUT GENERATION] ERROR: Project or planning data not found for ${projectId}`);
        logger.error("Project or planning data not found", undefined, { projectId });
        throw new Error("Project or planning data not found");
      }

      const planningData = project.planning_data;
      console.log(`[LAYOUT GENERATION] Project data loaded. Factory dimensions:`, planningData.factory_dimensions);

      // Get assets with dimensions and images
      console.log(`[LAYOUT GENERATION] Fetching assets with images...`);
      const { data: assets } = await supabase
        .from("assets")
        .select("*")
        .eq("project_id", projectId)
        .eq("image_generated", true); // Only get assets with images

      const assetCount = assets?.length || 0;
      const assetsWithImages = assets?.filter(a => a.image_url).length || 0;
      console.log(`[LAYOUT GENERATION] Found ${assetCount} assets, ${assetsWithImages} with images`);
      if (assets && assets.length > 0) {
        console.log(`[LAYOUT GENERATION] Asset names:`, assets.map(a => a.name).join(", "));
      }

      logger.info("Starting AI-based layout generation", { 
        projectId, 
        assetCount,
        assetsWithImages
      });

      const ITERATIONS = 2; // Reduced to 2 iterations
      console.log(`[LAYOUT GENERATION] Starting with ${ITERATIONS} refinement iterations per layout`);
      onUpdate({ type: "starting", progress: 0, total: 4 });

      // Step 1: Generate base grid image
      console.log(`[LAYOUT GENERATION] Step 1/4: Generating base grid image...`);
      logger.info("Generating base grid image", { projectId });
      onUpdate({ type: "generating", layoutType: "floor_plan", iteration: 0, progress: 0, total: 4 });
      const baseGridImage = await this.generateBaseGridImage(planningData);
      console.log(`[LAYOUT GENERATION] Base grid image generated (${baseGridImage.substring(0, 50)}...)`);
      
      // Save grid image
      console.log(`[LAYOUT GENERATION] Saving base grid image to database...`);
      await this.saveLayout(projectId, "base_grid.png", "base_grid", baseGridImage, 0);
      console.log(`[LAYOUT GENERATION] Base grid image saved successfully`);
      
      // Step 2: Generate Factory Floor Plan with AI (includes equipment)
      console.log(`[LAYOUT GENERATION] Step 2/4: Generating Factory Floor Plan with AI...`);
      logger.info("Generating Factory Floor Plan with AI", { projectId });
      logger.ai("Generating floor plan", "gemini-2.5-flash-image", { projectId });
      onUpdate({ type: "generating", layoutType: "floor_plan", iteration: 0, progress: 1, total: 4 });
      
      const floorPlanIterations: LayoutIteration[] = [];
      
      // Initialize conversation context for iterative refinement
      let conversationContents: any[] = [];
      
      // Initial generation with image model
      console.log(`[LAYOUT GENERATION] Initial floor plan generation with image model...`);
      const initialResult = await this.generateFloorPlanWithAIWithContext(
        baseGridImage, 
        planningData, 
        assets || [], 
        conversationContents
      );
      let floorPlanImage = initialResult.image;
      conversationContents = initialResult.conversation;
      
      floorPlanIterations.push({
        iteration: 0,
        imageUrl: floorPlanImage,
        feedback: undefined,
      });
      console.log(`[LAYOUT GENERATION] Initial floor plan generated (${floorPlanImage.substring(0, 50)}...)`);

      // Refine floor plan with iterations using conversation context
      console.log(`[LAYOUT GENERATION] Refining floor plan with ${ITERATIONS} iterations...`);
      for (let iter = 1; iter <= ITERATIONS; iter++) {
        console.log(`[LAYOUT GENERATION] Floor plan iteration ${iter}/${ITERATIONS}: Reviewing with text model...`);
        logger.info("Refining floor plan", { projectId, iteration: iter });
        onUpdate({ type: "reviewing", layoutType: "floor_plan", iteration: iter, imageUrl: floorPlanImage, progress: 1, total: 4 });
        
        // Add generated image to conversation and get feedback from text model
        const feedback = await this.getFeedbackFromTextModel(
          "floor_plan",
          "Factory Floor Plan",
          floorPlanImage,
          planningData,
          conversationContents
        );
        console.log(`[LAYOUT GENERATION] Floor plan iteration ${iter}/${ITERATIONS}: Feedback received (${feedback.feedback.length} chars)`);
        conversationContents = feedback.conversation;
        
        onUpdate({ type: "refining", layoutType: "floor_plan", iteration: iter, feedback: feedback.feedback, imageUrl: floorPlanImage, progress: 1, total: 4 });
        console.log(`[LAYOUT GENERATION] Floor plan iteration ${iter}/${ITERATIONS}: Regenerating with image model...`);
        
        // Regenerate with image model using conversation context
        const regenerateResult = await this.regenerateLayoutWithImageModel(
          feedback.feedback,
          conversationContents
        );
        floorPlanImage = regenerateResult.image;
        conversationContents = regenerateResult.conversation;
        
        floorPlanIterations.push({
          iteration: iter,
          imageUrl: floorPlanImage,
          feedback: feedback.feedback,
        });
        console.log(`[LAYOUT GENERATION] Floor plan iteration ${iter}/${ITERATIONS}: Complete`);
      }

      // Save floor plan with iterations
      console.log(`[LAYOUT GENERATION] Saving floor plan to database...`);
      await this.saveLayoutWithIterations(projectId, "factory_floor_plan.png", "floor_plan", floorPlanImage, floorPlanIterations);
      console.log(`[LAYOUT GENERATION] Floor plan saved successfully with ${floorPlanIterations.length} iterations`);
      onUpdate({ type: "complete", layoutType: "floor_plan", imageUrl: floorPlanImage, iteration: ITERATIONS, progress: 1, total: 4 });

      // Step 3: Add Equipment Placement to Floor Plan
      console.log(`[LAYOUT GENERATION] Step 3/4: Adding Equipment Placement to Floor Plan...`);
      logger.info("Adding Equipment Placement to Floor Plan", { projectId });
      logger.ai("Adding equipment placement", "gemini-2.5-flash-image", { projectId });
      onUpdate({ type: "generating", layoutType: "equipment_placement", iteration: 0, progress: 2, total: 4 });
      
      const equipmentIterations: LayoutIteration[] = [];
      let equipmentImage = await this.addEquipmentPlacementWithAI(floorPlanImage, planningData, assets || []);
      equipmentIterations.push({
        iteration: 0,
        imageUrl: equipmentImage,
        feedback: undefined,
      });
      console.log(`[LAYOUT GENERATION] Initial equipment placement generated`);

      console.log(`[LAYOUT GENERATION] Refining equipment placement with ${ITERATIONS} iterations...`);
      for (let iter = 1; iter <= ITERATIONS; iter++) {
        console.log(`[LAYOUT GENERATION] Equipment placement iteration ${iter}/${ITERATIONS}: Reviewing...`);
        logger.info("Refining equipment placement", { projectId, iteration: iter });
        onUpdate({ type: "reviewing", layoutType: "equipment_placement", iteration: iter, imageUrl: equipmentImage, progress: 2, total: 4 });
        const feedback = await this.reviewLayoutWithAI("equipment_placement", "Equipment Placement", equipmentImage, planningData);
        console.log(`[LAYOUT GENERATION] Equipment placement iteration ${iter}/${ITERATIONS}: Feedback received (${feedback.length} chars)`);
        onUpdate({ type: "refining", layoutType: "equipment_placement", iteration: iter, feedback, imageUrl: equipmentImage, progress: 2, total: 4 });
        console.log(`[LAYOUT GENERATION] Equipment placement iteration ${iter}/${ITERATIONS}: Regenerating...`);
        equipmentImage = await this.addEquipmentPlacementWithAI(floorPlanImage, planningData, assets || [], feedback);
        equipmentIterations.push({
          iteration: iter,
          imageUrl: equipmentImage,
          feedback: feedback,
        });
        console.log(`[LAYOUT GENERATION] Equipment placement iteration ${iter}/${ITERATIONS}: Complete`);
      }

      console.log(`[LAYOUT GENERATION] Saving equipment placement to database...`);
      await this.saveLayoutWithIterations(projectId, "equipment_placement.png", "equipment_placement", equipmentImage, equipmentIterations);
      console.log(`[LAYOUT GENERATION] Equipment placement saved successfully`);
      onUpdate({ type: "complete", layoutType: "equipment_placement", imageUrl: equipmentImage, iteration: ITERATIONS, progress: 2, total: 4 });

      // Step 4: Add ATEX Zones
      console.log(`[LAYOUT GENERATION] Step 4/4: Adding ATEX Zones...`);
      logger.info("Adding ATEX Zones", { projectId });
      logger.ai("Adding ATEX zones", "gemini-2.5-flash-image", { projectId });
      onUpdate({ type: "generating", layoutType: "atex_zones", iteration: 0, progress: 3, total: 4 });
      
      const atexIterations: LayoutIteration[] = [];
      let atexImage = await this.addATEXZonesWithAI(equipmentImage, planningData);
      atexIterations.push({
        iteration: 0,
        imageUrl: atexImage,
        feedback: undefined,
      });
      console.log(`[LAYOUT GENERATION] Initial ATEX zones generated`);

      console.log(`[LAYOUT GENERATION] Refining ATEX zones with ${ITERATIONS} iterations...`);
      for (let iter = 1; iter <= ITERATIONS; iter++) {
        console.log(`[LAYOUT GENERATION] ATEX zones iteration ${iter}/${ITERATIONS}: Reviewing...`);
        logger.info("Refining ATEX zones", { projectId, iteration: iter });
        onUpdate({ type: "reviewing", layoutType: "atex_zones", iteration: iter, imageUrl: atexImage, progress: 3, total: 4 });
        const feedback = await this.reviewLayoutWithAI("atex_zones", "ATEX Zones", atexImage, planningData);
        console.log(`[LAYOUT GENERATION] ATEX zones iteration ${iter}/${ITERATIONS}: Feedback received (${feedback.length} chars)`);
        onUpdate({ type: "refining", layoutType: "atex_zones", iteration: iter, feedback, imageUrl: atexImage, progress: 3, total: 4 });
        console.log(`[LAYOUT GENERATION] ATEX zones iteration ${iter}/${ITERATIONS}: Regenerating...`);
        atexImage = await this.addATEXZonesWithAI(equipmentImage, planningData, feedback);
        atexIterations.push({
          iteration: iter,
          imageUrl: atexImage,
          feedback: feedback,
        });
        console.log(`[LAYOUT GENERATION] ATEX zones iteration ${iter}/${ITERATIONS}: Complete`);
      }

      console.log(`[LAYOUT GENERATION] Saving ATEX zones to database...`);
      await this.saveLayoutWithIterations(projectId, "atex_zones.png", "atex_zones", atexImage, atexIterations);
      console.log(`[LAYOUT GENERATION] ATEX zones saved successfully`);
      onUpdate({ type: "complete", layoutType: "atex_zones", imageUrl: atexImage, iteration: ITERATIONS, progress: 3, total: 4 });

      // Step 5: Add AGV Routing
      console.log(`[LAYOUT GENERATION] Step 5/5: Adding AGV Routing Paths...`);
      logger.info("Adding AGV Routing Paths", { projectId });
      logger.ai("Adding AGV routing", "gemini-2.5-flash-image", { projectId });
      onUpdate({ type: "generating", layoutType: "agv_routing", iteration: 0, progress: 4, total: 4 });
      
      const agvIterations: LayoutIteration[] = [];
      let agvImage = await this.addAGVRoutingWithAI(atexImage, planningData);
      agvIterations.push({
        iteration: 0,
        imageUrl: agvImage,
        feedback: undefined,
      });
      console.log(`[LAYOUT GENERATION] Initial AGV routing generated`);

      console.log(`[LAYOUT GENERATION] Refining AGV routing with ${ITERATIONS} iterations...`);
      for (let iter = 1; iter <= ITERATIONS; iter++) {
        console.log(`[LAYOUT GENERATION] AGV routing iteration ${iter}/${ITERATIONS}: Reviewing...`);
        logger.info("Refining AGV routing", { projectId, iteration: iter });
        onUpdate({ type: "reviewing", layoutType: "agv_routing", iteration: iter, imageUrl: agvImage, progress: 4, total: 4 });
        const feedback = await this.reviewLayoutWithAI("agv_routing", "AGV Routing Paths", agvImage, planningData);
        console.log(`[LAYOUT GENERATION] AGV routing iteration ${iter}/${ITERATIONS}: Feedback received (${feedback.length} chars)`);
        onUpdate({ type: "refining", layoutType: "agv_routing", iteration: iter, feedback, imageUrl: agvImage, progress: 4, total: 4 });
        console.log(`[LAYOUT GENERATION] AGV routing iteration ${iter}/${ITERATIONS}: Regenerating...`);
        agvImage = await this.addAGVRoutingWithAI(atexImage, planningData, feedback);
        agvIterations.push({
          iteration: iter,
          imageUrl: agvImage,
          feedback: feedback,
        });
        console.log(`[LAYOUT GENERATION] AGV routing iteration ${iter}/${ITERATIONS}: Complete`);
      }

      console.log(`[LAYOUT GENERATION] Saving AGV routing to database...`);
      await this.saveLayoutWithIterations(projectId, "agv_routing.png", "agv_routing", agvImage, agvIterations);
      console.log(`[LAYOUT GENERATION] AGV routing saved successfully`);
      onUpdate({ type: "complete", layoutType: "agv_routing", imageUrl: agvImage, iteration: ITERATIONS, progress: 4, total: 4 });

      // Update project step
      console.log(`[LAYOUT GENERATION] All layouts generated successfully!`);
      console.log(`[LAYOUT GENERATION] Updating project step to 'layoutGenerated'...`);
      logger.workflow("layoutGenerated", projectId, { action: "complete" });
      logger.db("UPDATE", "projects", { projectId, newStep: "layoutGenerated" });
      await supabase
        .from("projects")
        .update({ current_step: "layoutGenerated" })
        .eq("id", projectId);
      console.log(`[LAYOUT GENERATION] Project step updated`);
      console.log(`[LAYOUT GENERATION] Moving to next step...`);
      await stepOrchestrator.nextStep(projectId);
      console.log(`[LAYOUT GENERATION] Layout generation complete for project ${projectId}`);
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR in generate2DLayoutWithStream for project ${projectId}:`, error);
      logger.error("Error in generate2DLayoutWithStream", error, { projectId });
      throw error;
    }
  }

  /**
   * Generates 2D layouts (non-streaming version for backward compatibility)
   */
  async generate2DLayout(projectId: string): Promise<void> {
    await this.generate2DLayoutWithStream(projectId, () => {});
  }

  /**
   * Generates base grid image with factory dimensions, 1m grid, and labels
   */
  private async generateBaseGridImage(planningData: any): Promise<string> {
    console.log(`[LAYOUT GENERATION] Generating base grid image...`);
    const canvas = createCanvas(this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    const ctx = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Get factory dimensions (ensure AI provides these)
    const width = planningData.factory_dimensions?.width || 50;
    const length = planningData.factory_dimensions?.length || 30;
    const height = planningData.factory_dimensions?.height || 8;
    const floors = planningData.factory_dimensions?.floors || 1;

    // Calculate scale to fit canvas while maintaining aspect ratio
    const margin = 120;
    const availableWidth = this.CANVAS_WIDTH - 2 * margin;
    const availableHeight = this.CANVAS_HEIGHT - 2 * margin;
    const scale = Math.min(availableWidth / width, availableHeight / length);
    const scaledWidth = width * scale;
    const scaledLength = length * scale;
    const startX = margin + (availableWidth - scaledWidth) / 2;
    const startY = margin + (availableHeight - scaledLength) / 2;

    // Draw 1m grid lines
    ctx.strokeStyle = "#D0D0D0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= width; i++) {
      const x = startX + (i * scale);
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + scaledLength);
      ctx.stroke();
      // Label every 5m
      if (i % 5 === 0 && i > 0) {
        ctx.fillStyle = "#666666";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${i}m`, x, startY - 5);
      }
    }
    for (let i = 0; i <= length; i++) {
      const y = startY + (i * scale);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + scaledWidth, y);
      ctx.stroke();
      // Label every 5m
      if (i % 5 === 0 && i > 0) {
        ctx.fillStyle = "#666666";
        ctx.font = "10px Arial";
        ctx.textAlign = "right";
        ctx.fillText(`${i}m`, startX - 5, y + 3);
      }
    }

    // Draw factory outline
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(startX, startY, scaledWidth, scaledLength);

    // Add dimension labels
    ctx.fillStyle = "#000000";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Width: ${width}m`, this.CANVAS_WIDTH / 2, startY - 20);
    ctx.fillText(`Length: ${length}m`, this.CANVAS_WIDTH / 2, startY - 40);
    ctx.fillText(`Height: ${height}m | Floors: ${floors}`, this.CANVAS_WIDTH / 2, startY - 60);

    // Title
    ctx.font = "bold 24px Arial";
    ctx.fillText("Factory Base Grid (1m grid)", this.CANVAS_WIDTH / 2, 40);

    // Scale bar
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    const scaleBarLength = 5 * scale; // 5m scale bar
    const scaleBarX = this.CANVAS_WIDTH - margin - scaleBarLength;
    const scaleBarY = this.CANVAS_HEIGHT - 60;
    ctx.beginPath();
    ctx.moveTo(scaleBarX, scaleBarY);
    ctx.lineTo(scaleBarX + scaleBarLength, scaleBarY);
    ctx.stroke();
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("5m", scaleBarX, scaleBarY - 5);

    const buffer = canvas.toBuffer("image/png");
    const base64 = buffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  }

  /**
   * Loads reference image from ai_refrences folder
   */
  private loadReferenceImage(folder: string, filename: string): string | null {
    try {
      // Try multiple possible paths (dev vs production, compiled vs source)
      // __dirname will be backend/src/services (dev) or backend/dist/services (compiled)
      const possiblePaths = [
        path.join(__dirname, "../../ai_refrences", folder, filename), // From src/services or dist/services -> backend/ai_refrences
        path.join(__dirname, "../../../backend/ai_refrences", folder, filename), // From project root perspective
        path.join(process.cwd(), "backend", "ai_refrences", folder, filename), // From project root
        path.join(process.cwd(), "ai_refrences", folder, filename), // Direct from root (if running from backend/)
        path.resolve(__dirname, "../../ai_refrences", folder, filename), // Absolute path resolution
      ];

      for (const refPath of possiblePaths) {
        const normalizedPath = path.resolve(refPath);
        if (fs.existsSync(normalizedPath)) {
          logger.info("Reference image found", { folder, filename, path: normalizedPath });
          const imageBuffer = fs.readFileSync(normalizedPath);
          const base64 = imageBuffer.toString("base64");
          const ext = path.extname(filename).slice(1) || "jpeg";
          return `data:image/${ext};base64,${base64}`;
        }
      }

      logger.warn("Reference image not found in any path", { 
        folder, 
        filename, 
        triedPaths: possiblePaths.map(p => path.resolve(p)),
        cwd: process.cwd(),
        __dirname 
      });
      return null;
    } catch (error: any) {
      logger.error("Error loading reference image", error, { folder, filename });
      return null;
    }
  }

  /**
   * Uses AI to generate Factory Floor Plan from base grid (includes equipment)
   */
  private async generateFloorPlanWithAI(
    baseGridImage: string,
    planningData: any,
    assets: any[],
    feedback?: string
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Calling AI to generate floor plan...`);
      console.log(`[LAYOUT GENERATION] - Assets count: ${assets.length}`);
      console.log(`[LAYOUT GENERATION] - Has feedback: ${!!feedback}`);

      // Prepare assets with dimensions and images
      const assetsInfo = assets.map(asset => ({
        name: asset.name,
        type: asset.type,
        dimensions: asset.specifications?.dimensions || asset.specifications || {},
        description: asset.description,
        hasImage: !!asset.image_url,
      }));

      // Load reference image
      const referenceImage = this.loadReferenceImage("factory_floor_plan", "0.jpeg");

      // Collect equipment images
      const equipmentImages: string[] = [];
      for (const asset of assets) {
        if (asset.image_url) {
          equipmentImages.push(asset.image_url);
        }
      }

      // Prepare planning data text with description
      const planningText = `FACTORY FLOOR PLAN GENERATION

What is a Factory Floor Plan?
A factory floor plan is a detailed 2D layout showing the complete factory structure including:
- Building walls, rooms, and structural elements
- All production equipment and machinery placement
- Production lines and workflow paths
- Material flow routes
- Storage areas, loading docks, and access points
- Safety zones and emergency exits
- Utilities and infrastructure

Factory Dimensions:
- Width: ${planningData.factory_dimensions?.width || 50}m
- Length: ${planningData.factory_dimensions?.length || 30}m
- Height: ${planningData.factory_dimensions?.height || 8}m
- Floors: ${planningData.factory_dimensions?.floors || 1}

Equipment/Assets to include (${assets.length} total):
${JSON.stringify(assetsInfo, null, 2)}

Production Process: ${planningData.production_process || "Not specified"}

${feedback ? `Previous Feedback: ${feedback}` : ""}

CRITICAL REQUIREMENTS:
1. TRANSFORM the base grid - draw walls, rooms, structural elements ON TOP of the grid
2. Use ALL the equipment images provided to understand what each equipment looks like and where to place them
3. Place ALL equipment/assets in optimal positions using their real dimensions from the specifications
4. Draw equipment shapes accurately based on the reference images provided
5. Include production lines, material flow paths, and workflow connections
6. Add detailed labels for all equipment, rooms, and key areas
7. Ensure proper spacing for maintenance, safety, and material handling
8. Use the 1m grid for accurate placement and scaling
9. The output MUST be a complete, detailed floor plan - not just the grid
10. Draw everything: walls, doors, windows, equipment, production lines, storage areas

Generate a professional, detailed factory floor plan image that completely transforms the base grid into a comprehensive layout.`;

      // Prepare contents array following the example pattern
      const contents: any[] = [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: baseGridImage.split(",")[1], // Base64 data without prefix
                mimeType: "image/png",
              },
            },
            {
              text: "This is the production line placeholder, we will draw on it",
            },
          ],
        },
      ];

      // Add reference image if available
      if (referenceImage) {
        const [header, data] = referenceImage.split(",");
        const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || "jpeg";
        contents[0].parts.push({
          inlineData: {
            data: data,
            mimeType: `image/${mimeType}`,
        },
      });
        contents[0].parts.push({
          text: "This is an educational example (has 4 plans) of what I want you to generate, you need to generate only one",
        });
      }

      // Add ALL equipment images with labels
      console.log(`[LAYOUT GENERATION] Adding ${equipmentImages.length} equipment images to AI request...`);
      for (let i = 0; i < equipmentImages.length; i++) {
        const imgUrl = equipmentImages[i];
        const asset = assets[i];
        if (imgUrl && imgUrl.startsWith("data:")) {
          const [header, data] = imgUrl.split(",");
          const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || "png";
          contents[0].parts.push({
            inlineData: {
              data: data,
              mimeType: `image/${mimeType}`,
        },
      });
          // Add label for each equipment image
          if (asset) {
            contents[0].parts.push({
              text: `This is ${asset.name} (${asset.type}) - use this image to understand its appearance and place it in the floor plan. Dimensions: ${JSON.stringify(asset.specifications?.dimensions || asset.specifications || {})}`,
            });
          }
        }
      }

      // Add planning text at the end
      contents[0].parts.push({
        text: planningText,
      });

      console.log(`[LAYOUT GENERATION] AI Request details:`);
      console.log(`[LAYOUT GENERATION] - Base grid: yes`);
      console.log(`[LAYOUT GENERATION] - Equipment images: ${equipmentImages.length}`);
      console.log(`[LAYOUT GENERATION] - Reference image: ${referenceImage ? 'yes' : 'no'}`);
      console.log(`[LAYOUT GENERATION] - Total parts: ${contents[0].parts.length}`);
      
      logger.info("Generating floor plan with AI", { 
        baseGrid: true, 
        equipmentImages: equipmentImages.length,
        referenceImage: !!referenceImage,
        totalParts: contents[0].parts.length 
      });

      console.log(`[LAYOUT GENERATION] Sending streaming request to Gemini AI...`);
      const config = {
        responseModalities: ["IMAGE", "TEXT"],
      };
      const model = "gemini-2.5-flash-image";
      
      const response = await this.genAI.models.generateContentStream({
        model,
        config,
        contents,
      });

      // Process streaming response
      let generatedImage: string | null = null;
      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
          continue;
        }
        
        const part = chunk.candidates[0].content.parts[0];
        if (part?.inlineData) {
          const inlineData = part.inlineData;
          const mimeType = inlineData.mimeType || "image/png";
          const imageData = inlineData.data || "";
          generatedImage = `data:${mimeType};base64,${imageData}`;
          console.log(`[LAYOUT GENERATION] ✓ Image chunk received (${mimeType}, ${imageData.length} bytes)`);
        } else if (chunk.text) {
          console.log(`[LAYOUT GENERATION] Text chunk: ${chunk.text.substring(0, 100)}...`);
        }
      }

      if (generatedImage) {
        console.log(`[LAYOUT GENERATION] ✓ Image generated successfully`);
        return generatedImage;
      }

      // Fallback: return base grid if AI doesn't generate image
      console.warn(`[LAYOUT GENERATION] WARNING: AI did not generate image, using base grid as fallback`);
      logger.warn("AI did not generate image, using base grid", {});
      return baseGridImage;
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR generating floor plan with AI:`, error);
      logger.error("Error generating floor plan with AI", error);
      return baseGridImage;
    }
  }

  /**
   * Uses AI to add Equipment Placement details to existing floor plan
   */
  private async addEquipmentPlacementWithAI(
    floorPlanImage: string,
    planningData: any,
    assets: any[],
    feedback?: string
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Calling AI to add equipment placement...`);
      console.log(`[LAYOUT GENERATION] - Assets count: ${assets.length}`);
      console.log(`[LAYOUT GENERATION] - Has feedback: ${!!feedback}`);

      const assetsInfo = assets.map(asset => ({
        name: asset.name,
        type: asset.type,
        dimensions: asset.specifications?.dimensions || asset.specifications || {},
        description: asset.description,
        hasImage: !!asset.image_url,
      }));

      // Load reference image
      const referenceImage = this.loadReferenceImage("equipment_placement_plan", "0.jpeg");

      // Collect ALL equipment images
      const equipmentImages: string[] = [];
      for (const asset of assets) {
        if (asset.image_url) {
          equipmentImages.push(asset.image_url);
        }
      }

      const prompt = `EQUIPMENT PLACEMENT PLAN GENERATION

What is an Equipment Placement Plan?
An equipment placement plan is a detailed layout showing:
- Exact positioning of all production equipment and machinery
- Equipment dimensions, orientations, and access points
- Material flow connections between equipment (conveyors, pipes, cables)
- Maintenance zones and clearance areas around each equipment
- Equipment labels, IDs, model numbers, and specifications
- Safety perimeters and operational zones
- Equipment-to-equipment relationships and workflow connections

Equipment/Assets with dimensions (${assets.length} total):
${JSON.stringify(assetsInfo, null, 2)}

${feedback ? `Previous Feedback: ${feedback}` : ""}

CRITICAL REQUIREMENTS:
1. ENHANCE the existing floor plan - add detailed equipment drawings ON TOP of the existing layout
2. Use ALL the equipment images provided to draw accurate equipment shapes and appearances
3. Show each equipment with its exact dimensions and proper scale based on the 1m grid
4. Add detailed equipment labels, IDs, model numbers, and specifications
5. Draw connections between equipment showing material flow (conveyors, pipes, etc.)
6. Indicate equipment orientation, access points, and maintenance areas
7. Add maintenance zones, safety perimeters, and clearance areas around equipment
8. Ensure ALL equipment from the list is visible, properly placed, and accurately scaled
9. Draw equipment based on ALL the reference images provided - match their appearance exactly
10. Preserve all existing floor plan elements while adding equipment details

Generate an enhanced floor plan image that adds comprehensive equipment placement details to the existing layout.`;

      // Prepare contents array
      const contents: any[] = [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: floorPlanImage.split(",")[1],
                mimeType: "image/png",
              },
            },
            {
              text: "This is the current factory floor plan, add detailed equipment placement to it",
            },
          ],
        },
      ];

      // Add reference image if available
      if (referenceImage) {
        const [header, data] = referenceImage.split(",");
        const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || "jpeg";
        contents[0].parts.push({
          inlineData: {
            data: data,
            mimeType: `image/${mimeType}`,
          },
        });
        contents[0].parts.push({
          text: "This is an educational example of equipment placement plan - use this style",
        });
      }

      // Add ALL equipment images with labels
      console.log(`[LAYOUT GENERATION] Adding ${equipmentImages.length} equipment images to AI request...`);
      for (let i = 0; i < equipmentImages.length; i++) {
        const imgUrl = equipmentImages[i];
        const asset = assets[i];
        if (imgUrl && imgUrl.startsWith("data:")) {
          const [header, data] = imgUrl.split(",");
          const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || "png";
          contents[0].parts.push({
            inlineData: {
              data: data,
              mimeType: `image/${mimeType}`,
        },
      });
          // Add label for each equipment image
          if (asset) {
            contents[0].parts.push({
              text: `This is ${asset.name} (${asset.type}) - place it in the layout with dimensions: ${JSON.stringify(asset.specifications?.dimensions || asset.specifications || {})}`,
            });
          }
        }
      }

      // Add prompt text
      contents[0].parts.push({
        text: prompt,
      });

      console.log(`[LAYOUT GENERATION] AI Request details for equipment placement:`);
      console.log(`[LAYOUT GENERATION] - Equipment images: ${equipmentImages.length}`);
      console.log(`[LAYOUT GENERATION] - Reference image: ${referenceImage ? 'yes' : 'no'}`);
      console.log(`[LAYOUT GENERATION] - Total parts: ${contents[0].parts.length}`);
      
      logger.info("Adding equipment placement with AI", { 
        equipmentImages: equipmentImages.length,
        totalParts: contents[0].parts.length 
      });

      console.log(`[LAYOUT GENERATION] Sending equipment placement streaming request to Gemini AI...`);
      const config = {
        responseModalities: ["IMAGE", "TEXT"],
      };
      const model = "gemini-2.5-flash-image";
      
      const response = await this.genAI.models.generateContentStream({
        model,
        config,
        contents,
      });

      // Process streaming response
      let generatedImage: string | null = null;
      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
          continue;
        }
        
        const part = chunk.candidates[0].content.parts[0];
        if (part?.inlineData) {
          const inlineData = part.inlineData;
          const mimeType = inlineData.mimeType || "image/png";
          const imageData = inlineData.data || "";
          generatedImage = `data:${mimeType};base64,${imageData}`;
          console.log(`[LAYOUT GENERATION] ✓ Equipment placement image chunk received (${mimeType}, ${imageData.length} bytes)`);
        } else if (chunk.text) {
          console.log(`[LAYOUT GENERATION] Text chunk: ${chunk.text.substring(0, 100)}...`);
        }
      }

      console.log(`[LAYOUT GENERATION] Equipment placement AI response received`);

      if (generatedImage) {
        console.log(`[LAYOUT GENERATION] ✓ Equipment placement image generated successfully`);
        return generatedImage;
      }

      console.warn(`[LAYOUT GENERATION] WARNING: AI did not generate equipment placement image, using floor plan as fallback`);
      logger.warn("AI did not generate equipment placement image", {});
      return floorPlanImage;
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR adding equipment placement with AI:`, error);
      logger.error("Error adding equipment placement with AI", error);
      return floorPlanImage;
    }
  }

  /**
   * Uses AI to add ATEX Zones to existing layout
   */
  private async addATEXZonesWithAI(
    previousImage: string,
    planningData: any,
    feedback?: string
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Calling AI to add ATEX zones...`);
      console.log(`[LAYOUT GENERATION] - Has feedback: ${!!feedback}`);

      const atexZones = planningData.atex_zones || [];

      // Load reference image - use atex_zones folder
      const referenceImage = this.loadReferenceImage("atex_zones", "0.jpeg");

      const prompt = `ATEX ZONES PLAN GENERATION

What are ATEX Zones?
ATEX (Atmosphères Explosibles) zones are hazardous area classifications for explosive atmospheres:
- Zone 0/20: Continuous explosive atmosphere (highest risk - RED)
- Zone 1/21: Likely explosive atmosphere (high risk - ORANGE)
- Zone 2/22: Occasional explosive atmosphere (moderate risk - YELLOW)

You need to:
1. Identify areas where explosive gases, vapors, or dusts may be present
2. Mark equipment that generates or handles flammable materials
3. Highlight storage areas for hazardous substances
4. Mark areas near potential ignition sources
5. Show safety distances and barriers around hazardous equipment
6. Indicate exclusion zones and restricted access areas

ATEX Zone Requirements:
${JSON.stringify(atexZones, null, 2)}

${feedback ? `Previous Feedback: ${feedback}` : ""}

CRITICAL REQUIREMENTS:
1. Use the reference image as a guide for proper ATEX zone marking style
2. Identify and mark all ATEX zones (Zone 0, Zone 1, Zone 2, Zone 20, Zone 21, Zone 22)
3. Use standard ATEX zone colors and markings as shown in the reference
4. Show zone boundaries clearly with proper visual indicators
5. Add zone labels, classifications, and safety ratings
6. Include safety distances, barriers, and exclusion zones
7. Mark equipment that requires ATEX certification
8. Overlay zones on the existing layout while preserving all previous details
9. Use appropriate colors: Zone 0/20 (red), Zone 1/21 (orange), Zone 2/22 (yellow)

Generate the layout with professional ATEX zone markings overlaid on the existing plan, following the reference image style.`;

      // Prepare contents array following the example pattern
      const contents: any[] = [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: previousImage.split(",")[1], // Base64 data without prefix
                mimeType: "image/png",
              },
            },
            {
              text: "This is the current factory layout, add ATEX zones to it",
            },
          ],
        },
      ];

      // Add reference image if available
      if (referenceImage) {
        const [header, data] = referenceImage.split(",");
        const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || "jpeg";
        contents[0].parts.push({
          inlineData: {
            data: data,
            mimeType: `image/${mimeType}`,
          },
        });
        contents[0].parts.push({
          text: "This is an educational example of ATEX zone markings - use this style",
        });
      }

      // Add prompt text
      contents[0].parts.push({
        text: prompt,
      });

      console.log(`[LAYOUT GENERATION] AI Request details for ATEX zones:`);
      console.log(`[LAYOUT GENERATION] - Reference image: ${referenceImage ? 'yes' : 'no'}`);
      console.log(`[LAYOUT GENERATION] - ATEX zones count: ${atexZones.length}`);
      console.log(`[LAYOUT GENERATION] - Total parts: ${contents[0].parts.length}`);
      
      logger.info("Adding ATEX zones with AI", { 
        hasReference: !!referenceImage,
        atexZonesCount: atexZones.length 
      });

      console.log(`[LAYOUT GENERATION] Sending ATEX zones streaming request to Gemini AI...`);
      const config = {
        responseModalities: ["IMAGE", "TEXT"],
      };
      const model = "gemini-2.5-flash-image";
      
      const response = await this.genAI.models.generateContentStream({
        model,
        config,
        contents,
      });

      // Process streaming response
      let generatedImage: string | null = null;
      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
          continue;
        }
        
        const part = chunk.candidates[0].content.parts[0];
        if (part?.inlineData) {
          const inlineData = part.inlineData;
          const mimeType = inlineData.mimeType || "image/png";
          const imageData = inlineData.data || "";
          generatedImage = `data:${mimeType};base64,${imageData}`;
          console.log(`[LAYOUT GENERATION] ✓ ATEX zones image chunk received (${mimeType}, ${imageData.length} bytes)`);
        } else if (chunk.text) {
          console.log(`[LAYOUT GENERATION] Text chunk: ${chunk.text.substring(0, 100)}...`);
        }
      }

      console.log(`[LAYOUT GENERATION] ATEX zones AI response received`);

      if (generatedImage) {
        console.log(`[LAYOUT GENERATION] ✓ ATEX zones image generated successfully`);
        return generatedImage;
      }

      console.warn(`[LAYOUT GENERATION] WARNING: AI did not generate ATEX zones image, using previous image as fallback`);
      logger.warn("AI did not generate ATEX zones image", {});
      return previousImage;
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR adding ATEX zones with AI:`, error);
      logger.error("Error adding ATEX zones with AI", error);
      return previousImage;
    }
  }

  /**
   * Uses AI to add AGV Routing Paths to existing layout
   */
  private async addAGVRoutingWithAI(
    previousImage: string,
    planningData: any,
    feedback?: string
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Calling AI to add AGV routing...`);
      console.log(`[LAYOUT GENERATION] - Has feedback: ${!!feedback}`);

      const prompt = `AGV ROUTING PATHS PLAN GENERATION

What are AGV Routing Paths?
AGV (Automated Guided Vehicle) routing paths are navigation routes for autonomous material handling vehicles:
- Primary routes connecting key areas (production, storage, loading docks)
- Secondary routes for specific tasks (waste removal, material transport)
- Charging stations and parking areas for AGV maintenance
- Loading/unloading points for material transfer
- Traffic control points and priority zones
- Safety zones and collision avoidance areas

You need to:
1. Design optimal routes connecting all key production and storage areas
2. Plan multiple routes for different AGV tasks
3. Include charging stations and parking areas
4. Mark path directions with arrows
5. Show intersections and traffic control points
6. Ensure paths avoid equipment and respect ATEX zones
7. Add path labels and route numbers

${feedback ? `Previous Feedback: ${feedback}` : ""}

CRITICAL REQUIREMENTS:
1. DRAW optimal AGV routing paths ON TOP of the existing layout
2. Design multiple routes for different AGV tasks (material transport, waste removal, etc.)
3. Include charging stations, parking areas, and maintenance zones
4. Mark path directions clearly with arrows and flow indicators
5. Show intersections, priority zones, and traffic control points
6. Ensure paths avoid equipment, maintain safe distances, and respect ATEX zones
7. Add detailed path labels, route numbers, and distance markers
8. Show loading/unloading points, staging areas, and material transfer zones
9. Use different colors/styles for different route types
10. Preserve all existing layout elements while adding routing paths

Generate the layout with comprehensive AGV routing paths drawn on the existing plan.`;

      // Prepare contents array
      const contents: any[] = [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: previousImage.split(",")[1],
                mimeType: "image/png",
              },
            },
            {
              text: "This is the current factory layout with equipment and ATEX zones, add AGV routing paths to it",
            },
            {
              text: prompt,
            },
          ],
        },
      ];

      console.log(`[LAYOUT GENERATION] AI Request details for AGV routing:`);
      console.log(`[LAYOUT GENERATION] - Prompt length: ${prompt.length} chars`);
      
      logger.info("Adding AGV routing with AI");

      console.log(`[LAYOUT GENERATION] Sending AGV routing streaming request to Gemini AI...`);
      const config = {
        responseModalities: ["IMAGE", "TEXT"],
      };
      const model = "gemini-2.5-flash-image";
      
      const response = await this.genAI.models.generateContentStream({
        model,
        config,
        contents,
      });

      // Process streaming response
      let generatedImage: string | null = null;
      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
          continue;
        }
        
        const part = chunk.candidates[0].content.parts[0];
        if (part?.inlineData) {
          const inlineData = part.inlineData;
          const mimeType = inlineData.mimeType || "image/png";
          const imageData = inlineData.data || "";
          generatedImage = `data:${mimeType};base64,${imageData}`;
          console.log(`[LAYOUT GENERATION] ✓ AGV routing image chunk received (${mimeType}, ${imageData.length} bytes)`);
        } else if (chunk.text) {
          console.log(`[LAYOUT GENERATION] Text chunk: ${chunk.text.substring(0, 100)}...`);
        }
      }

      console.log(`[LAYOUT GENERATION] AGV routing AI response received`);

      if (generatedImage) {
        console.log(`[LAYOUT GENERATION] ✓ AGV routing image generated successfully`);
        return generatedImage;
      }

      console.warn(`[LAYOUT GENERATION] WARNING: AI did not generate AGV routing image, using previous image as fallback`);
      logger.warn("AI did not generate AGV routing image", {});
      return previousImage;
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR adding AGV routing with AI:`, error);
      logger.error("Error adding AGV routing with AI", error);
      return previousImage;
    }
  }

  /**
   * Reviews layout with AI and provides feedback for improvement
   */
  private async reviewLayoutWithAI(
    layoutType: string,
    layoutName: string,
    imageUrl: string,
    planningData: any,
    previousFeedback?: string
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Starting AI layout review for ${layoutName}...`);
      console.log(`[LAYOUT GENERATION] - Layout type: ${layoutType}`);
      console.log(`[LAYOUT GENERATION] - Has previous feedback: ${!!previousFeedback}`);
      logger.debug("Starting AI layout review", { layoutType, layoutName, hasPreviousFeedback: !!previousFeedback });
      const llm = createLLM();
      
      const context = `
Layout Type: ${layoutName}
Factory Dimensions: ${JSON.stringify(planningData.factory_dimensions || {})}
Assets: ${JSON.stringify(planningData.assets?.slice(0, 5) || [])}
${previousFeedback ? `Previous Feedback: ${previousFeedback}` : ""}

Please review this factory layout and provide specific, actionable feedback for improvement. 
Focus on:
1. Spatial efficiency and workflow optimization
2. Safety compliance (ATEX zones, fire exits, etc.)
3. Equipment placement and accessibility
4. Material flow and logistics
5. Compliance with factory dimensions and constraints

Provide concise, actionable feedback that can be used to regenerate an improved layout.
`;

      const messages = [
        new SystemMessage("You are an expert factory layout designer and industrial engineer. Review factory layouts and provide specific, actionable feedback for improvement."),
        new HumanMessage(context),
      ];

      console.log(`[LAYOUT GENERATION] Sending review request to AI...`);
      const response = await llm.invoke(messages);
      const feedback = response.content as string;
      console.log(`[LAYOUT GENERATION] AI review completed - Feedback length: ${feedback.length} chars`);
      logger.debug("AI layout review completed", { 
        layoutType, 
        feedbackLength: feedback.length 
      });
      return feedback;
    } catch (error: any) {
      logger.error("Error in AI layout review", error, { layoutType, layoutName });
      // Return default feedback if AI fails
      return "Review the layout for optimal space utilization and safety compliance.";
    }
  }

  /**
   * Generates floor plan with conversation context (returns image and updated conversation)
   * IMPORTANT: This conversation is completely isolated from chat messages - only contains layout generation data
   */
  private async generateFloorPlanWithAIWithContext(
    baseGridImage: string,
    planningData: any,
    assets: any[],
    conversationContents: any[]
  ): Promise<{ image: string; conversation: any[] }> {
    // Build initial conversation if empty - this is a FRESH, ISOLATED conversation for layout generation only
    if (conversationContents.length === 0) {
      console.log(`[LAYOUT GENERATION] Building fresh conversation context for floor plan generation...`);
      const assetsInfo = assets.map(asset => ({
        name: asset.name,
        type: asset.type,
        dimensions: asset.specifications?.dimensions || asset.specifications || {},
        description: asset.description,
        hasImage: !!asset.image_url,
      }));

      const referenceImage = this.loadReferenceImage("factory_floor_plan", "0.jpeg");
      const equipmentImages: string[] = [];
      for (const asset of assets) {
        if (asset.image_url) {
          equipmentImages.push(asset.image_url);
        }
      }

      const planningText = `FACTORY FLOOR PLAN GENERATION

What is a Factory Floor Plan?
A factory floor plan is a detailed 2D layout showing the complete factory structure including:
- Building walls, rooms, and structural elements
- All production equipment and machinery placement
- Production lines and workflow paths
- Material flow routes
- Storage areas, loading docks, and access points
- Safety zones and emergency exits
- Utilities and infrastructure

Factory Dimensions:
- Width: ${planningData.factory_dimensions?.width || 50}m
- Length: ${planningData.factory_dimensions?.length || 30}m
- Height: ${planningData.factory_dimensions?.height || 8}m
- Floors: ${planningData.factory_dimensions?.floors || 1}

Equipment/Assets to include (${assets.length} total):
${JSON.stringify(assetsInfo, null, 2)}

Production Process: ${planningData.production_process || "Not specified"}

CRITICAL REQUIREMENTS:
1. TRANSFORM the base grid - draw walls, rooms, structural elements ON TOP of the grid
2. Use ALL the equipment images provided to understand what each equipment looks like and where to place them
3. Place ALL equipment/assets in optimal positions using their real dimensions from the specifications
4. Draw equipment shapes accurately based on the reference images provided
5. Include production lines, material flow paths, and workflow connections
6. Add detailed labels for all equipment, rooms, and key areas
7. Ensure proper spacing for maintenance, safety, and material handling
8. Use the 1m grid for accurate placement and scaling
9. The output MUST be a complete, detailed floor plan - not just the grid
10. Draw everything: walls, doors, windows, equipment, production lines, storage areas

Generate a professional, detailed factory floor plan image that completely transforms the base grid into a comprehensive layout.`;

      const userParts: any[] = [
        {
          inlineData: {
            data: baseGridImage.split(",")[1],
            mimeType: "image/png",
          },
        },
        {
          text: "This is the production line placeholder, we will draw on it",
        },
      ];

      if (referenceImage) {
        const [header, data] = referenceImage.split(",");
        const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || "jpeg";
        userParts.push({
          inlineData: {
            data: data,
            mimeType: `image/${mimeType}`,
          },
        });
        userParts.push({
          text: "This is an educational example (has 4 plans) of what I want you to generate, you need to generate only one",
        });
      }

      for (let i = 0; i < equipmentImages.length; i++) {
        const imgUrl = equipmentImages[i];
        const asset = assets[i];
        if (imgUrl && imgUrl.startsWith("data:")) {
          const [header, data] = imgUrl.split(",");
          const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || "png";
          userParts.push({
            inlineData: {
              data: data,
              mimeType: `image/${mimeType}`,
            },
          });
          if (asset) {
            userParts.push({
              text: `This is ${asset.name} (${asset.type}) - use this image to understand its appearance and place it in the floor plan. Dimensions: ${JSON.stringify(asset.specifications?.dimensions || asset.specifications || {})}`,
            });
          }
        }
      }

      userParts.push({ text: planningText });

      conversationContents = [
        {
          role: "user",
          parts: userParts,
        },
      ];
      console.log(`[LAYOUT GENERATION] ✓ Fresh conversation context built with ${userParts.length} parts`);
      console.log(`[LAYOUT GENERATION] Conversation is isolated from chat messages - only contains layout generation data`);
    } else {
      console.log(`[LAYOUT GENERATION] Using existing conversation context (${conversationContents.length} messages)`);
    }

    // Generate image with image model
    const config = { responseModalities: ["IMAGE", "TEXT"] };
    const model = "gemini-2.5-flash-image";
    
    const response = await this.genAI.models.generateContentStream({
      model,
      config,
      contents: conversationContents,
    });

    let generatedImage: string | null = null;
    let assistantParts: any[] = [];

    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
        continue;
      }
      
      const part = chunk.candidates[0].content.parts[0];
      if (part?.inlineData) {
        const inlineData = part.inlineData;
        const mimeType = inlineData.mimeType || "image/png";
        const imageData = inlineData.data || "";
        generatedImage = `data:${mimeType};base64,${imageData}`;
        assistantParts.push({
          inlineData: {
            data: imageData,
            mimeType: mimeType,
          },
        });
      } else if (part?.text) {
        assistantParts.push({ text: part.text });
      }
    }

    if (!generatedImage) {
      throw new Error("Failed to generate image");
    }

    // Add assistant response to conversation
    conversationContents.push({
      role: "model",
      parts: assistantParts,
    });

    return { image: generatedImage, conversation: conversationContents };
  }

  /**
   * Gets feedback from text model about generated image (image is in conversation context)
   * IMPORTANT: This conversation is isolated from chat messages - only contains layout generation context
   */
  private async getFeedbackFromTextModel(
    layoutType: string,
    layoutName: string,
    imageUrl: string,
    planningData: any,
    conversationContents: any[]
  ): Promise<{ feedback: string; conversation: any[] }> {
    // Validate conversation contents - ensure it only contains layout generation data
    console.log(`[LAYOUT GENERATION] Validating conversation context for ${layoutName}...`);
    console.log(`[LAYOUT GENERATION] Conversation has ${conversationContents.length} messages`);
    
    // Add the generated image to conversation for text model to review
    const imageData = imageUrl.split(",")[1];
    const mimeType = imageUrl.match(/data:image\/([^;]+)/)?.[1] || "png";

    // Create a clean review request - this should be the ONLY new message
    const reviewRequest = {
      role: "user",
      parts: [
        {
          inlineData: {
            data: imageData,
            mimeType: `image/${mimeType}`,
          },
        },
        {
          text: `You are an expert factory layout designer. Please review this ${layoutName} layout image and provide specific, actionable feedback for improvement. 

Focus on:
1. Spatial efficiency and workflow optimization
2. Safety compliance (ATEX zones, fire exits, etc.)
3. Equipment placement and accessibility
4. Material flow and logistics
5. Compliance with factory dimensions and constraints

Factory Dimensions: ${JSON.stringify(planningData.factory_dimensions || {})}

Provide concise, actionable feedback (2-3 sentences) that can be used to regenerate an improved layout. Do not include any chat conversation context - only focus on the layout image provided.`,
        },
      ],
    };

    // Create a fresh conversation array with only layout generation context
    const reviewConversation = [...conversationContents, reviewRequest];
    
    console.log(`[LAYOUT GENERATION] Sending review request to text model (gemini-pro)...`);
    console.log(`[LAYOUT GENERATION] Review conversation has ${reviewConversation.length} messages`);
    
    // Use text model (gemini-3-flash-preview) for review - this is a fresh, isolated conversation
    const textModel = "models/gemini-3-flash-preview";
    const response = await this.genAI.models.generateContent({
      model: textModel,
      contents: reviewConversation,
    });

    // Extract ONLY text from the response - ignore any inlineData or other parts
    let feedback = "Review the layout for optimal space utilization and safety compliance.";
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      const textParts = candidate.content.parts
        .filter((part: any) => part.text && !part.inlineData) // Only text, no images
        .map((part: any) => part.text.trim())
        .filter((text: string) => text.length > 0);
      if (textParts.length > 0) {
        feedback = textParts.join("\n").trim();
      }
    }

    console.log(`[LAYOUT GENERATION] ✓ Feedback extracted (${feedback.length} chars)`);
    console.log(`[LAYOUT GENERATION] Feedback preview: ${feedback.substring(0, 150)}...`);

    // Add text model response to conversation (only text, no inlineData)
    const feedbackResponse = {
      role: "model",
      parts: [{ text: feedback }],
    };
    
    conversationContents.push(reviewRequest);
    conversationContents.push(feedbackResponse);

    return { feedback, conversation: conversationContents };
  }

  /**
   * Regenerates layout with image model using feedback from conversation
   */
  private async regenerateLayoutWithImageModel(
    feedback: string,
    conversationContents: any[]
  ): Promise<{ image: string; conversation: any[] }> {
    // Add user request with feedback to conversation
    conversationContents.push({
      role: "user",
      parts: [
        {
          text: `Based on this feedback, please regenerate an improved layout: ${feedback}

Apply the feedback while maintaining all the good aspects of the previous design. Generate a new, improved version.`,
        },
      ],
    });

    // Generate new image with image model
    const config = { responseModalities: ["IMAGE", "TEXT"] };
    const model = "gemini-2.5-flash-image";
    
    const response = await this.genAI.models.generateContentStream({
      model,
      config,
      contents: conversationContents,
    });

    let generatedImage: string | null = null;
    let assistantParts: any[] = [];

    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
        continue;
      }
      
      const part = chunk.candidates[0].content.parts[0];
      if (part?.inlineData) {
        const inlineData = part.inlineData;
        const mimeType = inlineData.mimeType || "image/png";
        const imageData = inlineData.data || "";
        generatedImage = `data:${mimeType};base64,${imageData}`;
        assistantParts.push({
          inlineData: {
            data: imageData,
            mimeType: mimeType,
          },
        });
      } else if (part?.text) {
        assistantParts.push({ text: part.text });
      }
    }

    if (!generatedImage) {
      throw new Error("Failed to regenerate image");
    }

    // Add assistant response to conversation
    conversationContents.push({
      role: "model",
      parts: assistantParts,
    });

    return { image: generatedImage, conversation: conversationContents };
  }

  /**
   * Generates equipment placement with conversation context
   */
  private async generateEquipmentPlacementWithContext(
    floorPlanImage: string,
    planningData: any,
    assets: any[],
    conversationContents: any[]
  ): Promise<{ image: string; conversation: any[] }> {
    // Similar to floor plan but for equipment placement
    // This is a simplified version - in production, you'd want to build the full conversation
    // For now, we'll use the existing method but adapt it for conversation context
    const image = await this.addEquipmentPlacementWithAI(floorPlanImage, planningData, assets);
    // Note: This needs to be enhanced to properly maintain conversation context
    // For now, returning a basic structure
    return { image, conversation: conversationContents };
  }

  /**
   * Regenerates equipment placement with feedback
   */
  private async regenerateEquipmentPlacementWithImageModel(
    floorPlanImage: string,
    planningData: any,
    assets: any[],
    feedback: string,
    conversationContents: any[]
  ): Promise<{ image: string; conversation: any[] }> {
    // Similar pattern to regenerateLayoutWithImageModel but for equipment
    conversationContents.push({
      role: "user",
      parts: [
        {
          text: `Based on this feedback, please regenerate an improved equipment placement layout: ${feedback}`,
        },
      ],
    });

    const config = { responseModalities: ["IMAGE", "TEXT"] };
    const model = "gemini-2.5-flash-image";
    
    const response = await this.genAI.models.generateContentStream({
      model,
      config,
      contents: conversationContents,
    });

    let generatedImage: string | null = null;
    let assistantParts: any[] = [];

    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
        continue;
      }
      
      const part = chunk.candidates[0].content.parts[0];
      if (part?.inlineData) {
        const inlineData = part.inlineData;
        const mimeType = inlineData.mimeType || "image/png";
        const imageData = inlineData.data || "";
        generatedImage = `data:${mimeType};base64,${imageData}`;
        assistantParts.push({
          inlineData: {
            data: imageData,
            mimeType: mimeType,
          },
        });
      }
    }

    if (!generatedImage) {
      // Fallback to existing method
      generatedImage = await this.addEquipmentPlacementWithAI(floorPlanImage, planningData, assets, feedback);
      return { image: generatedImage, conversation: conversationContents };
    }

    conversationContents.push({
      role: "model",
      parts: assistantParts,
    });

    return { image: generatedImage, conversation: conversationContents };
  }

  /**
   * Saves layout to database
   */
  private async saveLayout(
    projectId: string,
    filename: string,
    layoutType: string,
    imageUrl: string,
    iterations: number
  ): Promise<void> {
    console.log(`[LAYOUT GENERATION] Saving layout to database:`);
    console.log(`[LAYOUT GENERATION] - Filename: ${filename}`);
    console.log(`[LAYOUT GENERATION] - Layout type: ${layoutType}`);
    console.log(`[LAYOUT GENERATION] - Iterations: ${iterations}`);
    console.log(`[LAYOUT GENERATION] - Image size: ${imageUrl.length} chars`);
    logger.db("INSERT", "generated_files", { projectId, layoutType, filename });
    const { error } = await supabase.from("generated_files").insert({
      project_id: projectId,
      filename,
      file_type: "image/png",
      file_path: imageUrl,
      metadata: {
        type: "2d_layout",
        layout_type: layoutType,
        iterations,
      },
    });
    if (error) {
      console.error(`[LAYOUT GENERATION] ERROR saving layout:`, error);
    } else {
      console.log(`[LAYOUT GENERATION] Layout saved successfully`);
    }
  }

  /**
   * Saves layout with iteration history to database
   */
  private async saveLayoutWithIterations(
    projectId: string,
    filename: string,
    layoutType: string,
    finalImageUrl: string,
    iterations: LayoutIteration[]
  ): Promise<void> {
    console.log(`[LAYOUT GENERATION] Saving layout with iterations to database:`);
    console.log(`[LAYOUT GENERATION] - Filename: ${filename}`);
    console.log(`[LAYOUT GENERATION] - Layout type: ${layoutType}`);
    console.log(`[LAYOUT GENERATION] - Iterations count: ${iterations.length}`);
    console.log(`[LAYOUT GENERATION] - Final image size: ${finalImageUrl.length} chars`);
    
    logger.db("INSERT", "generated_files", { projectId, layoutType, filename });
    const { error } = await supabase.from("generated_files").insert({
      project_id: projectId,
      filename,
      file_type: "image/png",
      file_path: finalImageUrl,
      metadata: {
        type: "2d_layout",
        layout_type: layoutType,
        iterations: iterations.length,
        iteration_history: iterations.map(iter => ({
          iteration: iter.iteration,
          imageUrl: iter.imageUrl,
          feedback: iter.feedback,
          improvements: iter.improvements || [],
        })),
      },
    });
    if (error) {
      console.error(`[LAYOUT GENERATION] ERROR saving layout with iterations:`, error);
      logger.error("Error saving layout with iterations", error, { projectId, layoutType });
    } else {
      console.log(`[LAYOUT GENERATION] Layout with ${iterations.length} iterations saved successfully`);
    }
  }
}

export const layoutGeneratorService = new LayoutGeneratorService();
