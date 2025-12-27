import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { stepOrchestrator } from "../services/stepOrchestrator.js";

const router = Router();

router.get("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: project, error } = await supabase
      .from("projects")
      .select("current_step, planning_data")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching project status:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({
      current_step: project.current_step,
      planning_data: project.planning_data,
    });
  } catch (error: any) {
    console.error("Error in GET /projects/:id/status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/retry-step", async (req, res) => {
  try {
    const { id } = req.params;

    // Get current step
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("current_step")
      .eq("id", id)
      .single();

    if (fetchError || !project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Retry current step
    await stepOrchestrator.executeStep(id, project.current_step, true);

    res.json({ message: "Step retry initiated", step: project.current_step });
  } catch (error: any) {
    console.error("Error in POST /projects/:id/retry-step:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

