import { supabase } from "../utils/supabase.js";
import { planningService } from "./ai/planningService.js";
import { layoutGeneratorService } from "./layoutGenerator.js";
import { imageGenerationService } from "./imageGeneration.js";
import { sourcingService } from "./ai/sourcingService.js";
import { costAnalysisService } from "./ai/costAnalysisService.js";

export type ProjectStep =
  | "chat"
  | "planning"
  | "planed"
  | "assetsImagesGenerating"
  | "assetsImagesGenerated"
  | "sourcing"
  | "sourced"
  | "negotiating"
  | "negotiated"
  | "cost_analysing"
  | "cost_analysed"
  | "completed";

class StepOrchestrator {
  async nextStep(projectId: string): Promise<void> {
    const { data: project } = await supabase
      .from("projects")
      .select("current_step")
      .eq("id", projectId)
      .single();

    if (!project) {
      throw new Error("Project not found");
    }

    const stepFlow: Record<ProjectStep, ProjectStep | null> = {
      chat: "planning",
      planning: "planed",
      planed: "assetsImagesGenerating",
      assetsImagesGenerating: "assetsImagesGenerated",
      assetsImagesGenerated: "sourcing",
      sourcing: "sourced",
      sourced: "negotiating",
      negotiating: "negotiated",
      negotiated: "cost_analysing",
      cost_analysing: "cost_analysed",
      cost_analysed: "completed",
      completed: null,
    };

    const nextStep = stepFlow[project.current_step as ProjectStep];
    if (nextStep) {
      await supabase
        .from("projects")
        .update({ current_step: nextStep })
        .eq("id", projectId);

      // Execute the next step
      await this.executeStep(projectId, nextStep, false);
    }
  }

  async executeStep(projectId: string, step: ProjectStep, isRetry: boolean = false): Promise<void> {
    switch (step) {
      case "planning":
        await planningService.startPlanning(projectId);
        break;

      case "planed":
        // Generate 2D layouts after planning is complete
        await layoutGeneratorService.generate2DLayout(projectId);
        await this.nextStep(projectId);
        break;

      case "assetsImagesGenerating":
        await imageGenerationService.generateImagesForProject(projectId);
        break;

      case "assetsImagesGenerated":
        // Move to sourcing after images are generated
        await this.nextStep(projectId);
        break;

      case "sourcing":
        await sourcingService.startSourcing(projectId);
        break;

      case "sourced":
        // Move to negotiating after sourcing is complete
        await this.nextStep(projectId);
        break;

      case "negotiating":
        // Bypassed for now - just wait 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await this.nextStep(projectId);
        break;

      case "negotiated":
        // Move to cost analysis after negotiation is complete
        await this.nextStep(projectId);
        break;

      case "cost_analysing":
        await costAnalysisService.analyzeCosts(projectId);
        break;

      case "cost_analysed":
        await supabase
          .from("projects")
          .update({ current_step: "completed" })
          .eq("id", projectId);
        break;

      default:
        console.log(`Step ${step} does not require execution`);
    }
  }
}

export const stepOrchestrator = new StepOrchestrator();

