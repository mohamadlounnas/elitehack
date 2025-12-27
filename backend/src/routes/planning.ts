import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { planningService } from "../services/ai/planningService.js";

const router = Router();

router.post("/:id/start-planning", async (req, res) => {
  try {
    const { id } = req.params;

    // Update project step to planning
    const { error: updateError } = await supabase
      .from("projects")
      .update({ current_step: "planning" })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating project step:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // Start planning process (async)
    // Note: For real-time streaming updates, the frontend should connect to /stream endpoint
    // This will execute with streaming if a connection is made, otherwise it runs normally
    planningService.startPlanning(id).catch((error) => {
      console.error("Error in planning process:", error);
    });

    res.json({ message: "Planning started", project_id: id });
  } catch (error: any) {
    console.error("Error in POST /projects/:id/start-planning:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

