import { createLLM } from "../../utils/langchain.js";
import { supabase } from "../../utils/supabase.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { stepOrchestrator } from "../stepOrchestrator.js";
import { logger } from "../../utils/logger.js";

type PlanningStreamCallback = (update: {
  type: "thinking" | "analyzing" | "generating" | "complete";
  content: string;
  progress: number;
}) => void;

// Track running planning processes to prevent double execution
const runningPlanning = new Set<string>();

class PlanningService {
  /**
   * Start planning with streaming updates
   */
  async startPlanningWithStream(
    projectId: string,
    onUpdate: PlanningStreamCallback
  ): Promise<void> {
    // Check if planning is already running
    if (runningPlanning.has(projectId)) {
      console.log(`Planning already running for project ${projectId}`);
      return;
    }

    runningPlanning.add(projectId);
    try {
      onUpdate({ type: "thinking", content: "Gathering project requirements...", progress: 10 });

      // Get all messages and files for context
      const { data: messages } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const { data: files } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId);

      // Extract requirements from messages
      const userRequirements = messages
        ?.filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n") || "";

      onUpdate({
        type: "analyzing",
        content: "Analyzing requirements and determining production process...",
        progress: 30,
      });

      const llm = createLLM();

      const systemPrompt = `You are an expert factory planning AI. Analyze the user's requirements and create a comprehensive factory plan.

Based on the provided requirements, determine:
1. Production process needed (injection molding, extrusion, thermoforming, etc.)
2. Required machinery and equipment
3. Factory dimensions and layout estimates
4. List of assets/machines needed with specifications
5. Material requirements
6. Capacity calculations

Return your analysis as a JSON object with this structure:
{
  "production_process": "process name",
  "machinery": ["machine1", "machine2", ...],
  "factory_dimensions": {
    "width": number (meters),
    "length": number (meters),
    "height": number (meters),
    "floors": number
  },
  "assets": [
    {
      "name": "asset name",
      "type": "equipment type",
      "appearance": "detailed description for image generation",
      "description": "technical description",
      "specifications": {}
    }
  ],
  "capacity": "estimated production capacity",
  "materials": ["material1", "material2"]
}`;

      onUpdate({
        type: "generating",
        content: "Generating comprehensive factory plan...",
        progress: 50,
      });

      // Stream the response
      let fullContent = "";
      const stream = await llm.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(`User Requirements:\n${userRequirements}`),
      ]);

      for await (const chunk of stream) {
        const chunkContent = chunk.content as string;
        fullContent += chunkContent;
        onUpdate({
          type: "generating",
          content: fullContent,
          progress: 50 + (fullContent.length / 2000) * 40, // Estimate progress
        });
      }

      onUpdate({
        type: "complete",
        content: "Finalizing plan structure...",
        progress: 90,
      });

      let planningData;
      try {
        // Try to extract JSON from response
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planningData = JSON.parse(jsonMatch[0]);
        } else {
          planningData = JSON.parse(fullContent);
        }
      } catch (parseError) {
        console.error("Error parsing planning data:", parseError);
        // Create a basic structure if parsing fails
        planningData = {
          production_process: "General Manufacturing",
          machinery: [],
          factory_dimensions: { width: 50, length: 100, height: 8, floors: 1 },
          assets: [],
          capacity: "Unknown",
          materials: [],
        };
      }

      // Save planning data to project
      await supabase
        .from("projects")
        .update({
          planning_data: planningData,
          current_step: "planed",
        })
        .eq("id", projectId);

      // Create assets in database
      if (planningData.assets && Array.isArray(planningData.assets)) {
        logger.info("Creating assets in database", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
        for (const asset of planningData.assets) {
          logger.db("INSERT", "assets", { projectId, assetName: asset.name });
          const { error: insertError } = await supabase.from("assets").insert({
            project_id: projectId,
            name: asset.name,
            type: asset.type,
            appearance: asset.appearance,
            description: asset.description,
            specifications: asset.specifications || {},
            image_generated: false,
          });
          if (insertError) {
            logger.error("Error inserting asset", insertError, { 
              projectId, 
              assetName: asset.name 
            });
          }
        }
        logger.info("Assets created successfully", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
      } else {
        logger.warn("No assets found in planning data to create", { 
          projectId,
          hasAssets: !!planningData.assets,
          assetsType: typeof planningData.assets
        });
      }

      onUpdate({
        type: "complete",
        content: "Planning complete!",
        progress: 100,
      });

      // Steps are now manually triggered - user must click "Next Step" button
    } catch (error: any) {
      console.error("Error in planningService.startPlanningWithStream:", error);
      // Update project step to indicate error
      await supabase
        .from("projects")
        .update({ current_step: "planning" })
        .eq("id", projectId);
      throw error;
    } finally {
      runningPlanning.delete(projectId);
    }
  }

  async startPlanning(projectId: string): Promise<void> {
    // Check if planning is already running (e.g., via streaming)
    if (runningPlanning.has(projectId)) {
      console.log(`Planning already running for project ${projectId}`);
      return;
    }

    runningPlanning.add(projectId);
    try {
      // Get all messages and files for context
      const { data: messages } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const { data: files } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId);

      // Extract requirements from messages
      const userRequirements = messages
        ?.filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n") || "";

      const llm = createLLM();

      const systemPrompt = `You are an expert factory planning AI. Analyze the user's requirements and create a comprehensive factory plan.

Based on the provided requirements, determine:
1. Production process needed (injection molding, extrusion, thermoforming, etc.)
2. Required machinery and equipment
3. Factory dimensions and layout estimates
4. List of assets/machines needed with specifications
5. Material requirements
6. Capacity calculations

Return your analysis as a JSON object with this structure:
{
  "production_process": "process name",
  "machinery": ["machine1", "machine2", ...],
  "factory_dimensions": {
    "width": number (meters),
    "length": number (meters),
    "height": number (meters),
    "floors": number
  },
  "assets": [
    {
      "name": "asset name",
      "type": "equipment type",
      "appearance": "detailed description for image generation",
      "description": "technical description",
      "specifications": {}
    }
  ],
  "capacity": "estimated production capacity",
  "materials": ["material1", "material2"]
}`;

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`User Requirements:\n${userRequirements}`),
      ]);

      let planningData;
      try {
        const content = response.content as string;
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planningData = JSON.parse(jsonMatch[0]);
        } else {
          planningData = JSON.parse(content);
        }
      } catch (parseError) {
        console.error("Error parsing planning data:", parseError);
        // Create a basic structure if parsing fails
        planningData = {
          production_process: "General Manufacturing",
          machinery: [],
          factory_dimensions: { width: 50, length: 100, height: 8, floors: 1 },
          assets: [],
          capacity: "Unknown",
          materials: [],
        };
      }

      // Save planning data to project
      await supabase
        .from("projects")
        .update({
          planning_data: planningData,
          current_step: "planed",
        })
        .eq("id", projectId);

      // Create assets in database
      if (planningData.assets && Array.isArray(planningData.assets)) {
        logger.info("Creating assets in database (non-streaming)", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
        for (const asset of planningData.assets) {
          logger.db("INSERT", "assets", { projectId, assetName: asset.name });
          const { error: insertError } = await supabase.from("assets").insert({
            project_id: projectId,
            name: asset.name,
            type: asset.type,
            appearance: asset.appearance,
            description: asset.description,
            specifications: asset.specifications || {},
            image_generated: false,
          });
          if (insertError) {
            logger.error("Error inserting asset", insertError, { 
              projectId, 
              assetName: asset.name 
            });
          }
        }
        logger.info("Assets created successfully (non-streaming)", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
      } else {
        logger.warn("No assets found in planning data to create (non-streaming)", { 
          projectId,
          hasAssets: !!planningData.assets,
          assetsType: typeof planningData.assets
        });
      }

      // Steps are now manually triggered - user must click "Next Step" button
    } catch (error: any) {
      console.error("Error in planningService.startPlanning:", error);
      // Update project step to indicate error
      await supabase
        .from("projects")
        .update({ current_step: "planning" })
        .eq("id", projectId);
      throw error;
    } finally {
      runningPlanning.delete(projectId);
    }
  }
}

export const planningService = new PlanningService();

