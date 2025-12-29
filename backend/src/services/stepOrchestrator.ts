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
  | "identityGenerating"
  | "assetSelection"
  | "assetsImagesGenerating"
  | "sourcing"
  | "negotiating"
  | "cost_analysing"
  | "layoutGenerating"
  | "3dGenerating"
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
   * Simplified flow without intermediate "complete" states
   */
  private readonly stepFlow: Record<ProjectStep, ProjectStep | null> = {
    chat: "planning",
    planning: "identityGenerating",
    identityGenerating: "assetSelection",
    assetSelection: "assetsImagesGenerating",
    assetsImagesGenerating: "sourcing",
    sourcing: "negotiating",
    negotiating: "cost_analysing",
    cost_analysing: "layoutGenerating",
    layoutGenerating: "3dGenerating",
    "3dGenerating": "completed",
    completed: null,
  };

  /**
   * Gets the ordered list of steps (for reference)
   * Simplified flow without intermediate "complete" states
   */
  getStepOrder(): ProjectStep[] {
    return [
      "chat",
      "planning",
      "identityGenerating",
      "assetSelection",
      "assetsImagesGenerating",
      "sourcing",
      "negotiating",
      "cost_analysing",
      "layoutGenerating",
      "3dGenerating",
      "completed",
    ];
  }

  /**
   * Gets the previous step in the workflow
   */
  private getPrevStep(currentStep: ProjectStep): ProjectStep | null {
    const stepOrder = this.getStepOrder();
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex <= 0) return null;
    return stepOrder[currentIndex - 1];
  }

  /**
   * Moves to the previous step in the workflow (without executing it)
   */
  async prevStep(projectId: string): Promise<void> {
    try {
      // Fetch current step from database
      logger.db("SELECT", "projects", { projectId });
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("current_step")
        .eq("id", projectId)
        .single();

      if (projectError) {
        logger.error("Error fetching project in prevStep", projectError, { projectId });
        throw new Error(`Failed to fetch project: ${projectError.message}`);
      }

      if (!project) {
        logger.error("Project not found in prevStep", undefined, { projectId });
        throw new Error("Project not found");
      }

      const currentStep = project.current_step as ProjectStep;
      logger.workflow("prevStep", projectId, { currentStep });

      const prevStep = this.getPrevStep(currentStep);
      if (!prevStep) {
        logger.info("No previous step available", { projectId, currentStep });
        return;
      }

      // Atomic transition: Update step in database (without executing)
      logger.workflow("transitioning", projectId, { from: currentStep, to: prevStep });
      logger.db("UPDATE", "projects", { projectId, currentStep, prevStep });

      const { error: updateError } = await supabase
        .from("projects")
        .update({ current_step: prevStep })
        .eq("id", projectId);

      if (updateError) {
        logger.error("Error updating project step", updateError, {
          projectId,
          currentStep,
          prevStep,
        });
        throw new Error(`Failed to update step: ${updateError.message}`);
      }

      logger.info("Step updated successfully (previous step)", {
        projectId,
        from: currentStep,
        to: prevStep,
      });
    } catch (error: any) {
      logger.error("Error in prevStep", error, { projectId });
      throw error;
    }
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

      logger.info("Step updated successfully", {
        projectId,
        from: currentStep,
        to: nextStep,
      });

      // NOTE: We do NOT automatically execute the step here anymore.
      // Steps are executed via the streaming endpoint when the frontend connects.
      // This prevents duplicate execution (once from nextStep, once from stream).
      // The frontend will connect to /api/stream/:projectId which handles execution.
      
      // Only execute non-streaming steps automatically
      // assetSelection is interactive (user selects assets), so don't auto-execute
      const streamingSteps: ProjectStep[] = [
        "planning",
        "identityGenerating", 
        "assetsImagesGenerating",
        "sourcing",
        "layoutGenerating",
        "cost_analysing",
        "3dGenerating"
      ];
      
      // Interactive steps that require user input - don't auto-execute
      const interactiveSteps: ProjectStep[] = ["assetSelection"];
      
      if (!streamingSteps.includes(nextStep) && !interactiveSteps.includes(nextStep)) {
        // Execute non-streaming, non-interactive steps (like negotiating which is bypassed)
        await this.executeStep(projectId, nextStep, false);
      }
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

        case "assetsImagesGenerating":
          logger.info("Starting asset image generation step", { projectId });
          await imageGenerationService.generateImagesForProject(projectId);
          break;

        case "sourcing":
          logger.info("Starting sourcing step", { projectId });
          await sourcingService.startSourcing(projectId);
          break;

        case "negotiating":
          logger.info("Starting negotiation step (bypassed)", { projectId });
          // Bypassed for now - just wait 3 seconds
          await new Promise((resolve) => setTimeout(resolve, 3000));
          break;

        case "cost_analysing":
          logger.info("Starting cost analysis step", { projectId });
          await costAnalysisService.analyzeCosts(projectId);
          break;

        case "layoutGenerating":
          logger.info("Starting layout generation step", { projectId });
          try {
            await layoutGeneratorService.generate2DLayout(projectId);
          } catch (error: any) {
            logger.error("Error in layout generation", error, { projectId });
            console.error(`[STEP ORCHESTRATOR] Layout generation failed:`, error.message);
            throw error; // Re-throw to prevent moving to next step on error
          }
          break;

        case "3dGenerating":
          logger.info("Starting 3D model generation step", { projectId });
          // Trigger 3D generation - fire and forget, don't wait for completion
          this.trigger3DGeneration(projectId).catch((error) => {
            logger.error("Error triggering 3D generation", error, { projectId });
            // Don't throw - we want to move forward even if this fails
          });
          break;

        case "assetSelection":
          // Asset selection is handled by the frontend - user picks which assets to process
          // No automatic execution needed, user will click "Continue" when done
          logger.info("Asset selection step - awaiting user input", { projectId });
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

  /**
   * Triggers 3D model generation for a project (fire and forget)
   */
  private async trigger3DGeneration(projectId: string): Promise<void> {
    try {
      // Lazy import to avoid module loading issues
      const { meshy3dService } = await import("./meshy3dService.js");

      // Get the project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        logger.error("Project not found for 3D generation", projectError, { projectId });
        return;
      }

      // Check if already started
      if (project.meshy_id) {
        logger.info("3D generation already started", { projectId, meshy_id: project.meshy_id });
        return;
      }

      // Get isometric layout
      const { data: isometricFile, error: fileError } = await supabase
        .from("generated_files")
        .select("*")
        .eq("project_id", projectId)
        .eq("metadata->>layout_type", "isometric")
        .limit(1)
        .maybeSingle();

      if (fileError || !isometricFile) {
        logger.warn("Isometric layout not found for 3D generation", fileError, { projectId });
        return;
      }

      const imageUrl = isometricFile.file_path || isometricFile.storage_url;
      if (!imageUrl) {
        logger.warn("Isometric layout image not available", { projectId });
        return;
      }

      // Create Meshy3D task
      const taskId = await meshy3dService.createTask(imageUrl);

      // Update project with meshy_id
      const { error: updateError } = await supabase
        .from("projects")
        .update({ meshy_id: taskId })
        .eq("id", projectId);

      if (updateError) {
        logger.error("Error updating project with meshy_id", updateError, { projectId, taskId });
      } else {
        logger.info("3D model generation task created", { projectId, taskId });
      }
    } catch (error: any) {
      logger.error("Error in trigger3DGeneration", error, { projectId });
      // Don't throw - this is fire and forget
    }
  }
}

export const stepOrchestrator = new StepOrchestrator();
