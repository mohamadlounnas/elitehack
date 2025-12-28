import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { planningService } from "../services/ai/planningService.js";
import { identityService } from "../services/ai/identityService.js";
import { imageGenerationService } from "../services/imageGeneration.js";
import { sourcingService } from "../services/ai/sourcingService.js";
import { costAnalysisService } from "../services/ai/costAnalysisService.js";
import { layoutGeneratorService } from "../services/layoutGenerator.js";
import { stepOrchestrator } from "../services/stepOrchestrator.js";
import { logger } from "../utils/logger.js";

const router = Router();

// Track running steps to prevent double execution
const runningSteps = new Set<string>();

/**
 * Server-Sent Events endpoint for streaming step progress
 * Streams real-time updates for each step in the workflow
 */
router.get("/:id/stream", async (req, res) => {
  const { id } = req.params;
  logger.info("SSE stream connection opened", { projectId: id });

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Helper function to send SSE message
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    logger.debug("SSE event sent", { projectId: id, event, step: data.step });
  };

  try {
    // Get current project state
    logger.db("SELECT", "projects", { projectId: id });
    const { data: project } = await supabase
      .from("projects")
      .select("current_step")
      .eq("id", id)
      .single();

    if (!project) {
      logger.warn("Project not found for stream", { projectId: id });
      sendEvent("error", { message: "Project not found" });
      res.end();
      return;
    }

    const currentStep = project.current_step;
    const stepKey = `${id}:${currentStep}`;
    logger.info("Stream initialized for step", { projectId: id, step: currentStep });

    // Check if step is already running
    if (runningSteps.has(stepKey)) {
      logger.info("Step already running, monitoring existing execution", { projectId: id, step: currentStep });
      sendEvent("status", { step: currentStep, message: "Step is already running..." });
      // Just monitor the existing execution
      res.end();
      return;
    }

    // Mark step as running
    runningSteps.add(stepKey);
    logger.debug("Step marked as running", { projectId: id, step: currentStep, stepKey });

    try {
      // Handle different steps - execute them with streaming
      switch (currentStep) {
        case "planning":
          await streamPlanning(id, sendEvent);
          break;
        case "identityGenerating":
          await streamIdentityGeneration(id, sendEvent);
          break;
        case "layoutGenerating":
          await streamLayoutGeneration(id, sendEvent);
          break;
        case "assetsImagesGenerating":
          // Check if images are already generated before starting
          const { data: assetsCheck } = await supabase
            .from("assets")
            .select("id, image_generated, image_url")
            .eq("project_id", id);
          
          const allImagesGenerated = assetsCheck && assetsCheck.length > 0 && 
            assetsCheck.every(asset => asset.image_generated && asset.image_url);
          
          if (allImagesGenerated) {
            logger.info("All images already generated", { projectId: id });
            sendEvent("status", { 
              step: "assetsImagesGenerating", 
              message: "All images already generated." 
            });
            // Transition to next step
            await stepOrchestrator.nextStep(id);
            sendEvent("complete", { 
              step: "assetsImagesGenerating", 
              message: "Image generation complete." 
            });
          } else {
            await streamImageGeneration(id, sendEvent);
          }
          break;
        case "sourcing":
          await streamSourcing(id, sendEvent);
          break;
        case "cost_analysing":
          await streamCostAnalysis(id, sendEvent);
          break;
        default:
          sendEvent("status", { step: currentStep, message: "Step does not require streaming" });
          runningSteps.delete(stepKey);
          res.end();
          return;
      }
    } finally {
      // Remove from running steps
      runningSteps.delete(stepKey);
      logger.debug("Step removed from running steps", { projectId: id, step: currentStep });
    }

    logger.info("SSE stream completed", { projectId: id, step: currentStep });
    res.end();
  } catch (error: any) {
    logger.error("Error in SSE stream", error, { projectId: id });
    sendEvent("error", { message: error.message });
    res.end();
  }
});

/**
 * Stream planning process with real-time text updates
 */
async function streamPlanning(projectId: string, sendEvent: (event: string, data: any) => void) {
  sendEvent("status", { step: "planning", message: "Starting planning process..." });

  try {
    // Call planning service with streaming callback
    await planningService.startPlanningWithStream(projectId, (update) => {
      sendEvent("update", {
        step: "planning",
        type: update.type,
        content: update.content,
        progress: update.progress,
      });
    });

    // Transition to next step after successful completion
    await stepOrchestrator.nextStep(projectId);

    sendEvent("complete", { 
      step: "planning", 
      message: "Planning complete!" 
    });
  } catch (error: any) {
    sendEvent("error", { step: "planning", message: error.message });
  }
}

/**
 * Stream brand identity generation with real-time updates
 */
async function streamIdentityGeneration(projectId: string, sendEvent: (event: string, data: any) => void) {
  sendEvent("status", { step: "identityGenerating", message: "Starting brand identity generation..." });

  try {
    await identityService.generateIdentityWithStream(projectId, (update) => {
      sendEvent("update", {
        step: "identityGenerating",
        type: update.type,
        content: update.content,
        progress: update.progress,
        colors: update.colors,
        logoUrl: update.logoUrl,
      });
    });

    // Transition to next step after successful completion
    await stepOrchestrator.nextStep(projectId);

    sendEvent("complete", { 
      step: "identityGenerating", 
      message: "Brand identity generated successfully!" 
    });
  } catch (error: any) {
    logger.error("Error in identity generation stream", error, { projectId });
    sendEvent("error", { step: "identityGenerating", message: error.message });
  }
}

/**
 * Stream image generation progress for each asset
 */
async function streamImageGeneration(projectId: string, sendEvent: (event: string, data: any) => void) {
  sendEvent("status", { step: "assetsImagesGenerating", message: "Starting image generation..." });

  try {
    await imageGenerationService.generateImagesForProjectWithStream(projectId, (update) => {
      sendEvent("update", {
        step: "assetsImagesGenerating",
        type: update.type,
        asset: update.asset,
        imageUrl: update.imageUrl,
        progress: update.progress,
        total: update.total,
      });
    });

    // Transition to next step after successful completion
    await stepOrchestrator.nextStep(projectId);

    logger.info("Image generation stream completed, sending completion event", { projectId });
    sendEvent("complete", { 
      step: "assetsImagesGenerating", 
      message: "All images generated! Moving to next step..." 
    });
  } catch (error: any) {
    logger.error("Error in image generation stream", error, { projectId });
    sendEvent("error", { step: "assetsImagesGenerating", message: error.message });
  }
}

/**
 * Stream sourcing progress for each supplier
 */
async function streamSourcing(projectId: string, sendEvent: (event: string, data: any) => void) {
  logger.info("Starting sourcing stream", { projectId });
  sendEvent("status", { step: "sourcing", message: "Starting elite supplier sourcing..." });

  try {
    await sourcingService.startSourcingWithStream(projectId, (update) => {
      logger.debug("Sourcing update", { projectId, type: update.type, asset: update.asset?.name });
      
      sendEvent("update", {
        step: "sourcing",
        type: update.type,
        asset: update.asset,
        supplier: update.supplier,
        suppliers: update.suppliers,
        progress: update.progress,
        total: update.total,
        message: update.message,
      });
    });

    // Transition to next step after successful completion
    await stepOrchestrator.nextStep(projectId);

    sendEvent("complete", { 
      step: "sourcing", 
      message: "Elite sourcing complete! All suppliers identified and verified." 
    });
    
    logger.info("Sourcing stream completed", { projectId });
  } catch (error: any) {
    logger.error("Error in sourcing stream", error, { projectId });
    sendEvent("error", { step: "sourcing", message: error.message });
  }
}

/**
 * Stream layout generation progress
 */
async function streamLayoutGeneration(projectId: string, sendEvent: (event: string, data: any) => void) {
  logger.info("Starting layout generation stream", { projectId });
  sendEvent("status", { step: "layoutGenerating", message: "Starting layout generation..." });

  try {
    await layoutGeneratorService.generate2DLayoutWithStream(projectId, (update) => {
      logger.debug("Layout generation update", { projectId, type: update.type, layoutType: update.layoutType });
      sendEvent("update", {
        step: "layoutGenerating",
        type: update.type,
        layoutType: update.layoutType,
        imageUrl: update.imageUrl,
        progress: update.progress,
        total: update.total,
      });
    });

    // Transition to next step after successful completion
    await stepOrchestrator.nextStep(projectId);

    sendEvent("complete", { 
      step: "layoutGenerating", 
      message: "Layout generation complete!" 
    });
  } catch (error: any) {
    sendEvent("error", { step: "layoutGenerating", message: error.message });
  }
}

/**
 * Stream cost analysis progress
 */
async function streamCostAnalysis(projectId: string, sendEvent: (event: string, data: any) => void) {
  sendEvent("status", { step: "cost_analysing", message: "Starting cost analysis..." });

  try {
    await costAnalysisService.analyzeCostsWithStream(projectId, (update) => {
      sendEvent("update", {
        step: "cost_analysing",
        type: update.type,
        content: update.content,
        progress: update.progress,
      });
    });

    // Transition to next step after successful completion
    await stepOrchestrator.nextStep(projectId);

    sendEvent("complete", { 
      step: "cost_analysing", 
      message: "Cost analysis complete!" 
    });
  } catch (error: any) {
    sendEvent("error", { step: "cost_analysing", message: error.message });
  }
}

export default router;

