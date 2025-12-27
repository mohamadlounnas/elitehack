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
  | "assetsImagesGenerating"
  | "assetsImagesGenerated"
  | "sourcing"
  | "sourced"
  | "negotiating"
  | "negotiated"
  | "cost_analysing"
  | "cost_analysed"
  | "layoutGenerating"
  | "layoutGenerated"
  | "completed";

/**
 * Step Orchestrator - Manages workflow step execution and transitions
 * 
 * Features:
 * - Prevents concurrent execution of the same step
 * - Ensures atomic step transitions
 * - Maintains correct step order matching frontend
 */
class StepOrchestrator {
  // Track projects currently executing steps to prevent concurrent execution
  private executingProjects = new Set<string>();
  // Track the step being executed for each project
  private executingSteps = new Map<string, ProjectStep>();

  /**
   * Defines the step flow order (must match frontend StepProgress component)
   */
  private readonly stepFlow: Record<ProjectStep, ProjectStep | null> = {
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
    cost_analysed: "layoutGenerating",
    layoutGenerating: "layoutGenerated",
    layoutGenerated: "completed",
    completed: null,
  };

  /**
   * Gets the ordered list of steps (for reference)
   */
  getStepOrder(): ProjectStep[] {
    return [
      "chat",
      "planning",
      "planed",
      "assetsImagesGenerating",
      "assetsImagesGenerated",
      "sourcing",
      "sourced",
      "negotiating",
      "negotiated",
      "cost_analysing",
      "cost_analysed",
      "layoutGenerating",
      "layoutGenerated",
      "completed",
    ];
  }

  /**
   * Moves to the next step in the workflow
   * This should only be called after a step has completed successfully
   */
  async nextStep(projectId: string): Promise<void> {
    // Prevent concurrent execution
    if (this.executingProjects.has(projectId)) {
      const executingStep = this.executingSteps.get(projectId);
      logger.warn("Step already executing, skipping nextStep", {
        projectId,
        executingStep,
      });
      return;
    }

    try {
      // Fetch current step from database (single source of truth)
      logger.db("SELECT", "projects", { projectId });
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("current_step")
        .eq("id", projectId)
        .single();

      if (projectError) {
        logger.error("Error fetching project in nextStep", projectError, { projectId });
        throw new Error(`Failed to fetch project: ${projectError.message}`);
      }

      if (!project) {
        logger.error("Project not found in nextStep", undefined, { projectId });
        throw new Error("Project not found");
      }

      const currentStep = project.current_step as ProjectStep;
      logger.workflow("nextStep", projectId, { currentStep });

      const nextStep = this.stepFlow[currentStep];
      if (!nextStep) {
        logger.info("No next step available", { projectId, currentStep });
        return;
      }

      // Atomic transition: Update step in database
      logger.workflow("transitioning", projectId, { from: currentStep, to: nextStep });
      logger.db("UPDATE", "projects", { projectId, currentStep, nextStep });

      const { error: updateError } = await supabase
        .from("projects")
        .update({ current_step: nextStep })
        .eq("id", projectId);

      if (updateError) {
        logger.error("Error updating project step", updateError, {
          projectId,
          currentStep,
          nextStep,
        });
        throw new Error(`Failed to update step: ${updateError.message}`);
      }

      logger.info("Step updated successfully, executing next step", {
        projectId,
        from: currentStep,
        to: nextStep,
      });

      // Execute the next step (executeStep will handle locking and prevent duplicates)
      await this.executeStep(projectId, nextStep, false);
    } catch (error: any) {
      logger.error("Error in nextStep", error, { projectId });
      throw error;
    }
  }

  /**
   * Executes a specific step with locking to prevent concurrent execution
   * @param projectId - Project ID
   * @param step - Step to execute
   * @param isRetry - Whether this is a retry (allows re-execution even if already completed)
   */
  async executeStep(projectId: string, step: ProjectStep, isRetry: boolean = false): Promise<void> {
    // Prevent concurrent execution of the same step
    if (this.executingProjects.has(projectId)) {
      const executingStep = this.executingSteps.get(projectId);
      if (executingStep === step && !isRetry) {
        logger.warn("Step already executing, skipping duplicate call", {
          projectId,
          step,
          executingStep,
        });
        return;
      }
    }

    // Lock this project
    this.executingProjects.add(projectId);
    this.executingSteps.set(projectId, step);

    try {
      // Verify current step matches (unless retry)
      if (!isRetry) {
        const { data: project } = await supabase
          .from("projects")
          .select("current_step")
          .eq("id", projectId)
          .single();

        if (project && project.current_step !== step) {
          logger.warn("Step mismatch, current step is different", {
            projectId,
            requestedStep: step,
            currentStep: project.current_step,
          });
          // Don't execute if we're already past this step
          const stepOrder = this.getStepOrder();
          const requestedIndex = stepOrder.indexOf(step);
          const currentIndex = stepOrder.indexOf(project.current_step as ProjectStep);

          if (currentIndex > requestedIndex) {
            logger.info("Step already completed, skipping", {
              projectId,
              requestedStep: step,
              currentStep: project.current_step,
            });
            return;
          }
        }
      }

      logger.workflow("executeStep", projectId, { step, isRetry });

      // Execute the step
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
          // Move to sourcing after images are complete
          logger.info("Asset images complete, moving to sourcing", { projectId });
          // Verify all images are actually generated before moving forward
          const { data: assetsCheck } = await supabase
            .from("assets")
            .select("id, image_generated")
            .eq("project_id", projectId);

          const allImagesGenerated = assetsCheck?.every((asset) => asset.image_generated) ?? false;

          if (!allImagesGenerated && (assetsCheck?.length ?? 0) > 0) {
            logger.warn("Not all images are generated, but step is assetsImagesGenerated", {
              projectId,
              totalAssets: assetsCheck?.length ?? 0,
              imagesGenerated: assetsCheck?.filter((a) => a.image_generated).length ?? 0,
            });
          }

          // Move to next step (sourcing)
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
          // Move to layout generation after cost analysis
          logger.info("Cost analysis complete, moving to layout generation", { projectId });
          await this.nextStep(projectId);
          break;

        case "layoutGenerating":
          logger.info("Starting layout generation step", { projectId });
          try {
            await layoutGeneratorService.generate2DLayout(projectId);
          } catch (error: any) {
            logger.error("Error in layout generation", error, { projectId });
            // Don't throw - let the step stay at layoutGenerating so user can retry
            console.error(`[STEP ORCHESTRATOR] Layout generation failed:`, error.message);
            throw error; // Re-throw to prevent moving to next step on error
          }
          break;

        case "layoutGenerated":
          logger.workflow("completed", projectId, { action: "mark_complete" });
          logger.db("UPDATE", "projects", { projectId, newStep: "completed" });
          await supabase
            .from("projects")
            .update({ current_step: "completed" })
            .eq("id", projectId);
          logger.info("Project completed", { projectId });
          break;

        case "chat":
        case "completed":
        default:
          logger.debug(`Step ${step} does not require execution`, { projectId, step });
          break;
      }
    } catch (error: any) {
      logger.error("Error executing step", error, { projectId, step, isRetry });
      throw error;
    } finally {
      // Always release lock
      this.executingProjects.delete(projectId);
      this.executingSteps.delete(projectId);
    }
  }
}

export const stepOrchestrator = new StepOrchestrator();
