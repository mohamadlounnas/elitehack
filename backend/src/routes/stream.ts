import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { planningService } from "../services/ai/planningService.js";
import { imageGenerationService } from "../services/imageGeneration.js";
import { sourcingService } from "../services/ai/sourcingService.js";
import { costAnalysisService } from "../services/ai/costAnalysisService.js";
import { stepOrchestrator } from "../services/stepOrchestrator.js";

const router = Router();

// Track running steps to prevent double execution
const runningSteps = new Set<string>();

/**
 * Server-Sent Events endpoint for streaming step progress
 * Streams real-time updates for each step in the workflow
 */
router.get("/:id/stream", async (req, res) => {
  const { id } = req.params;

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Helper function to send SSE message
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Get current project state
    const { data: project } = await supabase
      .from("projects")
      .select("current_step")
      .eq("id", id)
      .single();

    if (!project) {
      sendEvent("error", { message: "Project not found" });
      res.end();
      return;
    }

    const currentStep = project.current_step;
    const stepKey = `${id}:${currentStep}`;

    // Check if step is already running
    if (runningSteps.has(stepKey)) {
      sendEvent("status", { step: currentStep, message: "Step is already running..." });
      // Just monitor the existing execution
      res.end();
      return;
    }

    // Mark step as running
    runningSteps.add(stepKey);

    try {
      // Handle different steps - execute them with streaming
      switch (currentStep) {
        case "planning":
          await streamPlanning(id, sendEvent);
          break;
        case "assetsImagesGenerating":
          await streamImageGeneration(id, sendEvent);
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
    }

    res.end();
  } catch (error: any) {
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

    sendEvent("complete", { 
      step: "planning", 
      message: "Planning complete!" 
    });
  } catch (error: any) {
    sendEvent("error", { step: "planning", message: error.message });
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

    sendEvent("complete", { 
      step: "assetsImagesGenerating", 
      message: "All images generated!" 
    });
  } catch (error: any) {
    sendEvent("error", { step: "assetsImagesGenerating", message: error.message });
  }
}

/**
 * Stream sourcing progress for each supplier
 */
async function streamSourcing(projectId: string, sendEvent: (event: string, data: any) => void) {
  sendEvent("status", { step: "sourcing", message: "Starting supplier sourcing..." });

  try {
    await sourcingService.startSourcingWithStream(projectId, (update) => {
      sendEvent("update", {
        step: "sourcing",
        type: update.type,
        asset: update.asset,
        supplier: update.supplier,
        progress: update.progress,
        total: update.total,
      });
    });

    sendEvent("complete", { 
      step: "sourcing", 
      message: "Sourcing complete!" 
    });
  } catch (error: any) {
    sendEvent("error", { step: "sourcing", message: error.message });
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

    sendEvent("complete", { 
      step: "cost_analysing", 
      message: "Cost analysis complete!" 
    });
  } catch (error: any) {
    sendEvent("error", { step: "cost_analysing", message: error.message });
  }
}

export default router;

