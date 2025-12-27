import { supabase } from "../utils/supabase.js";
import { planningService } from "./ai/planningService.js";
import { layoutGeneratorService } from "./layoutGenerator.js";
import { imageGenerationService } from "./imageGeneration.js";
import { sourcingService } from "./ai/sourcingService.js";
import { costAnalysisService } from "./ai/costAnalysisService.js";
import { logger } from "../utils/logger.js";

export type ProjectStep =
  | "chat"
  | "planning"
  | "planed"
  | "layoutGenerating"
  | "layoutGenerated"
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
    logger.db("SELECT", "projects", { projectId });
    const { data: project } = await supabase
      .from("projects")
      .select("current_step")
      .eq("id", projectId)
      .single();

    if (!project) {
      logger.error("Project not found in nextStep", undefined, { projectId });
      throw new Error("Project not found");
    }

    const currentStep = project.current_step;
    logger.workflow("nextStep", projectId, { currentStep });

    const stepFlow: Record<ProjectStep, ProjectStep | null> = {
      chat: "planning",
      planning: "planed",
      planed: "assetsImagesGenerating",
      assetsImagesGenerating: "assetsImagesGenerated",
      assetsImagesGenerated: "layoutGenerating",
      layoutGenerating: "layoutGenerated",
      layoutGenerated: "sourcing",
      sourcing: "sourced",
      sourced: "negotiating",
      negotiating: "negotiated",
      negotiated: "cost_analysing",
      cost_analysing: "cost_analysed",
      cost_analysed: "completed",
      completed: null,
    };

    const nextStep = stepFlow[currentStep as ProjectStep];
    if (nextStep) {
      logger.workflow("transitioning", projectId, { from: currentStep, to: nextStep });
      logger.db("UPDATE", "projects", { projectId, currentStep, nextStep });
      await supabase
        .from("projects")
        .update({ current_step: nextStep })
        .eq("id", projectId);

      // Execute the next step
      logger.info("Executing step", { projectId, step: nextStep });
      await this.executeStep(projectId, nextStep, false);
    } else {
      logger.info("No next step available", { projectId, currentStep });
    }
  }

  async executeStep(projectId: string, step: ProjectStep, isRetry: boolean = false): Promise<void> {
    logger.workflow("executeStep", projectId, { step, isRetry });
    switch (step) {
      case "planning":
        logger.info("Starting planning step", { projectId });
        await planningService.startPlanning(projectId);
        break;

      case "planed":
        // Move to asset image generation after planning is complete
        await this.nextStep(projectId);
        break;

      case "assetsImagesGenerating":
        logger.info("Starting asset image generation step", { projectId });
        await imageGenerationService.generateImagesForProject(projectId);
        break;

      case "assetsImagesGenerated":
        // Move to layout generation after images are complete
        logger.info("Asset images complete, moving to layout generation", { projectId });
        await this.nextStep(projectId);
        break;

      case "layoutGenerating":
        logger.info("Starting layout generation step", { projectId });
        await layoutGeneratorService.generate2DLayout(projectId);
        break;

      case "layoutGenerated":
        logger.info("Layout generation complete, moving to next step", { projectId });
        // Move to sourcing after layouts are complete
        await this.nextStep(projectId);
        break;

      case "sourcing":
        logger.info("Starting sourcing step", { projectId });
        await sourcingService.startSourcing(projectId);
        break;

      case "sourced":
        logger.info("Sourcing complete, moving to next step", { projectId });
        // Move to negotiating after sourcing is complete
        await this.nextStep(projectId);
        break;

      case "negotiating":
        logger.info("Starting negotiation step (bypassed)", { projectId });
        // Bypassed for now - just wait 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await this.nextStep(projectId);
        break;

      case "negotiated":
        logger.info("Negotiation complete, moving to next step", { projectId });
        // Move to cost analysis after negotiation is complete
        await this.nextStep(projectId);
        break;

      case "cost_analysing":
        logger.info("Starting cost analysis step", { projectId });
        await costAnalysisService.analyzeCosts(projectId);
        break;

      case "cost_analysed":
        logger.workflow("completed", projectId, { action: "mark_complete" });
        logger.db("UPDATE", "projects", { projectId, newStep: "completed" });
        await supabase
          .from("projects")
          .update({ current_step: "completed" })
          .eq("id", projectId);
        logger.info("Project completed", { projectId });
        break;

      default:
        logger.debug(`Step ${step} does not require execution`, { projectId, step });
    }
  }
}

export const stepOrchestrator = new StepOrchestrator();

