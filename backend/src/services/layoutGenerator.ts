import { supabase } from "../utils/supabase.js";
import { stepOrchestrator } from "./stepOrchestrator.js";
import { createImageLLM } from "../utils/langchain.js";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type LayoutStreamCallback = (update: {
  type: "starting" | "generating" | "complete";
  layoutType?: "floor_plan" | "atex_zones" | "agv_routing";
  imageUrl?: string;
  progress: number;
  total: number;
}) => void;

/**
 * Generates 2D layout images after planning is complete
 * Uses LangChain with Gemini to generate: Floor Plan → Equipment → ATEX → AGV Routing
 */
class LayoutGeneratorService {
  private readonly AI_TIMEOUT_MS = 120000; // 2 minutes timeout for AI calls
  private generatingProjects = new Set<string>(); // Track projects currently generating

  /**
   * Generates 2D layouts with streaming support and AI chaining
   */
  async generate2DLayoutWithStream(
    projectId: string,
    onUpdate: LayoutStreamCallback
  ): Promise<void> {
    // Prevent duplicate calls
    if (this.generatingProjects.has(projectId)) {
      console.log(`[LAYOUT GENERATION] Already generating layouts for project ${projectId}, skipping duplicate call`);
      return;
    }

    this.generatingProjects.add(projectId);

    try {
      console.log(`[LAYOUT GENERATION] Starting layout generation for project ${projectId}`);
      logger.workflow("layoutGenerating", projectId, { action: "start" });
      
      // Fetch project data
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("planning_data, current_step")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        const errorMsg = projectError?.message || "Project not found";
        console.error(`[LAYOUT GENERATION] ERROR fetching project:`, errorMsg);
        logger.error("Error fetching project", projectError, { projectId });
        throw new Error(`Failed to fetch project: ${errorMsg}`);
      }

      if (!project.planning_data) {
        const errorMsg = `Planning data not found. Project is at step: ${project.current_step}`;
        console.error(`[LAYOUT GENERATION] ERROR: ${errorMsg}`);
        logger.error("Planning data not found", undefined, { projectId, currentStep: project.current_step });
        throw new Error(`${errorMsg}. Please ensure planning is complete before generating layouts.`);
      }

      const planningData = project.planning_data;
      console.log(`[LAYOUT GENERATION] Project data loaded. Factory dimensions:`, planningData.factory_dimensions);

      // Fetch assets (only name, type, and appearance by default - no images to avoid timeouts)
      console.log(`[LAYOUT GENERATION] Fetching assets (names and appearance only)...`);
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("id, name, type, appearance, description")
        .eq("project_id", projectId);

      if (assetsError) {
        console.warn(`[LAYOUT GENERATION] Warning fetching assets:`, assetsError.message);
        logger.warn("Error fetching assets", { projectId, error: assetsError });
      }

      const assetsList = assets || [];
      console.log(`[LAYOUT GENERATION] Found ${assetsList.length} assets`);

      onUpdate({ type: "starting", progress: 0, total: 3 });

      // Step 1: Generate Factory Floor Plan
      console.log(`[LAYOUT GENERATION] Step 1/3: Generating Factory Floor Plan...`);
      onUpdate({ type: "generating", layoutType: "floor_plan", progress: 1, total: 3 });
      const floorPlanImage = await this.generateFloorPlanWithAI(planningData, assetsList);
      await this.saveDebugImage(projectId, "floor_plan", floorPlanImage);
      await this.saveLayout(projectId, "factory_floor_plan.png", "floor_plan", floorPlanImage);
      onUpdate({ type: "complete", layoutType: "floor_plan", imageUrl: floorPlanImage, progress: 1, total: 3 });
      console.log(`[LAYOUT GENERATION] Floor plan saved`);

      // Step 2: Add ATEX Zones (on top of floor plan)
      console.log(`[LAYOUT GENERATION] Step 2/3: Adding ATEX Zones...`);
      onUpdate({ type: "generating", layoutType: "atex_zones", progress: 2, total: 3 });
      const atexImage = await this.addATEXZonesWithAI(floorPlanImage, planningData);
      await this.saveDebugImage(projectId, "atex_zones", atexImage);
      await this.saveLayout(projectId, "atex_zones.png", "atex_zones", atexImage);
      onUpdate({ type: "complete", layoutType: "atex_zones", imageUrl: atexImage, progress: 2, total: 3 });
      console.log(`[LAYOUT GENERATION] ATEX zones saved`);

      // Step 3: Add AGV Routing (on top of floor plan)
      console.log(`[LAYOUT GENERATION] Step 3/3: Adding AGV Routing...`);
      onUpdate({ type: "generating", layoutType: "agv_routing", progress: 3, total: 3 });
      const agvImage = await this.addAGVRoutingWithAI(floorPlanImage, planningData);
      await this.saveDebugImage(projectId, "agv_routing", agvImage);
      await this.saveLayout(projectId, "agv_routing.png", "agv_routing", agvImage);
      onUpdate({ type: "complete", layoutType: "agv_routing", imageUrl: agvImage, progress: 3, total: 3 });
      console.log(`[LAYOUT GENERATION] AGV routing saved`);

      // Update project step
      console.log(`[LAYOUT GENERATION] All layouts generated successfully!`);
      logger.workflow("layoutGenerated", projectId, { action: "complete" });
      await supabase
        .from("projects")
        .update({ current_step: "layoutGenerated" })
        .eq("id", projectId);
      
      await stepOrchestrator.nextStep(projectId);
      console.log(`[LAYOUT GENERATION] Layout generation complete for project ${projectId}`);
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR in generate2DLayoutWithStream:`, error);
      logger.error("Error in generate2DLayoutWithStream", error, { projectId });
      
      // Update project step to indicate error
      await supabase
        .from("projects")
        .update({ current_step: "layoutGenerating" }) // Keep at layoutGenerating so user can retry
        .eq("id", projectId);
      
      throw error; // Re-throw to let caller handle
    } finally {
      // Always remove from generating set
      this.generatingProjects.delete(projectId);
    }
  }

  /**
   * Non-streaming version for backward compatibility
   */
  async generate2DLayout(projectId: string): Promise<void> {
    return this.generate2DLayoutWithStream(projectId, () => {});
  }

  /**
   * Uses LangChain with Gemini to generate Factory Floor Plan
   * @param planningData - Planning data including factory dimensions and production process
   * @param assets - Array of assets with name, type, and appearance (not images)
   */
  private async generateFloorPlanWithAI(
    planningData: any,
    assets: any[]
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Generating floor plan with LangChain...`);
      
      const llm = createImageLLM();
      const contentParts: any[] = [];

      // Add reference example (educational reference only - note it has multiple production lines)
      const referenceImage = this.loadReferenceImage("factory_floor_plan", "0.jpeg");
      if (referenceImage) {
        contentParts.push({
          type: "image_url",
          image_url: referenceImage,
        });
        contentParts.push({
          type: "text",
          text: "Reference example of factory floor plan layout style (note: this is an educational example with multiple production lines, but generate a single unified design)",
        });
      }

      // Build equipment list from asset names and appearance
      const equipmentList = assets.length > 0
        ? assets.map(asset => {
            const appearance = asset.appearance || asset.description || "standard equipment";
            return `- ${asset.name} (${asset.type || "equipment"}): ${appearance}`;
          }).join("\n")
        : "No specific equipment listed";

      // Prompt for single unified design
      const prompt = `Generate a SINGLE unified factory floor plan (not multiple production lines).

Factory dimensions: ${planningData.factory_dimensions?.width || 50}m x ${planningData.factory_dimensions?.length || 30}m
Production process: ${planningData.production_process || "Not specified"}

Equipment to include:
${equipmentList}

IMPORTANT: Generate ONE unified factory floor plan that integrates all equipment in a single, cohesive layout. Do NOT create multiple separate production lines. The reference image shows multiple lines for educational purposes, but your design must be a single integrated factory floor plan.`;

      contentParts.push({
        type: "text",
        text: prompt,
      });

      const message = new HumanMessage({ content: contentParts });

      console.log(`[LAYOUT GENERATION] Invoking LangChain model with ${contentParts.length} content parts...`);
      const response = await Promise.race([
        llm.invoke([message]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("AI call timeout")), this.AI_TIMEOUT_MS)
        ),
      ]) as any;

      // Extract image from response
      const content = response.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image" || part.inlineData) {
            const imageData = part.inlineData?.data || part.data || "";
            const mimeType = part.inlineData?.mimeType || part.mimeType || "image/png";
            return `data:${mimeType};base64,${imageData}`;
          }
        }
      }

      // Fallback: check if content is a string with base64
      if (typeof content === "string" && content.includes("base64")) {
        return content;
      }

      throw new Error("AI did not generate floor plan image");
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR generating floor plan:`, error);
      logger.error("Error generating floor plan with AI", error);
      throw error;
    }
  }

  /**
   * Uses LangChain to add ATEX Zones
   */
  private async addATEXZonesWithAI(
    equipmentImage: string,
    planningData: any
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Adding ATEX zones with LangChain...`);
      
      const llm = createImageLLM();

      const contentParts: any[] = [
        {
          type: "image_url",
          image_url: equipmentImage,
        },
      ];

      // Add reference example
      const referenceImage = this.loadReferenceImage("atex_zones", "0.jpeg");
      if (referenceImage) {
        contentParts.push({
          type: "image_url",
          image_url: referenceImage,
        });
        contentParts.push({
          type: "text",
          text: "Example of ATEX zones",
        });
      }

      const prompt = `Add ATEX zone markings to this factory layout. Mark hazardous areas (Zone 0/20, Zone 1/21, Zone 2/22) and safe areas.`;

      contentParts.push({ type: "text", text: prompt });
      const message = new HumanMessage({ content: contentParts });

      console.log(`[LAYOUT GENERATION] Invoking LangChain model for ATEX zones...`);
      const response = await Promise.race([
        llm.invoke([message]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("AI call timeout")), this.AI_TIMEOUT_MS)
        ),
      ]) as any;

      const content = response.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image" || part.inlineData) {
            const imageData = part.inlineData?.data || part.data || "";
            const mimeType = part.inlineData?.mimeType || part.mimeType || "image/png";
            return `data:${mimeType};base64,${imageData}`;
          }
        }
      }

      console.warn(`[LAYOUT GENERATION] WARNING: AI did not generate ATEX zones image`);
      return equipmentImage;
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR adding ATEX zones:`, error);
      logger.error("Error adding ATEX zones with AI", error);
      return equipmentImage;
    }
  }

  /**
   * Uses LangChain to add AGV Routing Paths
   */
  private async addAGVRoutingWithAI(
    atexImage: string,
    planningData: any
  ): Promise<string> {
    try {
      console.log(`[LAYOUT GENERATION] Adding AGV routing with LangChain...`);
      
      const llm = createImageLLM();

      const contentParts: any[] = [
        {
          type: "image_url",
          image_url: atexImage,
        },
      ];

      const prompt = `Add AGV routing paths to this factory layout. Show paths connecting production areas, storage, and loading docks. Include charging stations.`;

      contentParts.push({ type: "text", text: prompt });
      const message = new HumanMessage({ content: contentParts });

      console.log(`[LAYOUT GENERATION] Invoking LangChain model for AGV routing...`);
      const response = await Promise.race([
        llm.invoke([message]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("AI call timeout")), this.AI_TIMEOUT_MS)
        ),
      ]) as any;

      const content = response.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image" || part.inlineData) {
            const imageData = part.inlineData?.data || part.data || "";
            const mimeType = part.inlineData?.mimeType || part.mimeType || "image/png";
            return `data:${mimeType};base64,${imageData}`;
          }
        }
      }

      console.warn(`[LAYOUT GENERATION] WARNING: AI did not generate AGV routing image`);
      return atexImage;
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR adding AGV routing:`, error);
      logger.error("Error adding AGV routing with AI", error);
      return atexImage;
    }
  }

  /**
   * Loads reference image from ai_refrences folder
   */
  private loadReferenceImage(folder: string, filename: string): string | null {
    try {
      const possiblePaths = [
        path.join(__dirname, "..", "..", "ai_refrences", folder, filename),
        path.join(process.cwd(), "backend", "ai_refrences", folder, filename),
        path.join(process.cwd(), "ai_refrences", folder, filename),
      ];

      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          const imageBuffer = fs.readFileSync(filePath);
          const base64 = imageBuffer.toString("base64");
          const ext = path.extname(filename).slice(1) || "jpeg";
          return `data:image/${ext};base64,${base64}`;
        }
      }

      logger.warn("Reference image not found", { folder, filename });
      return null;
    } catch (error: any) {
      logger.error("Error loading reference image", error, { folder, filename });
      return null;
    }
  }

  /**
   * Saves debug copy of generated image
   */
  private async saveDebugImage(
    projectId: string,
    layoutType: string,
    imageDataUrl: string
  ): Promise<void> {
    try {
      const debugDir = path.join(process.cwd(), "tmp", "projects", projectId);
      await fs.promises.mkdir(debugDir, { recursive: true });
      
      const base64Data = imageDataUrl.split(",")[1];
      if (!base64Data) {
        console.warn(`[LAYOUT GENERATION] No base64 data found for ${layoutType}`);
        return;
      }
      
      const imageBuffer = Buffer.from(base64Data, "base64");
      const filename = `${layoutType}_${Date.now()}.png`;
      const filePath = path.join(debugDir, filename);
      await fs.promises.writeFile(filePath, imageBuffer);
      console.log(`[LAYOUT GENERATION] Debug: Saved image to ${filePath}`);
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] Error saving debug image:`, error);
    }
  }

  /**
   * Saves layout to database
   */
  private async saveLayout(
    projectId: string,
    filename: string,
    layoutType: string,
    imageUrl: string
  ): Promise<void> {
    try {
      logger.db("INSERT", "generated_files", { projectId, layoutType, filename });
      const { error } = await supabase.from("generated_files").insert({
        project_id: projectId,
        filename,
        file_type: "image/png",
        file_path: imageUrl,
        metadata: {
          type: "2d_layout",
          layout_type: layoutType,
        },
      });
      
      if (error) {
        console.error(`[LAYOUT GENERATION] ERROR saving layout:`, error);
        logger.error("Error saving layout", error, { projectId, layoutType });
      } else {
        console.log(`[LAYOUT GENERATION] Layout saved successfully`);
      }
    } catch (error: any) {
      console.error(`[LAYOUT GENERATION] ERROR saving layout:`, error);
      logger.error("Error saving layout", error, { projectId, layoutType });
    }
  }
}

export const layoutGeneratorService = new LayoutGeneratorService();
