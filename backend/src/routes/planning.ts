import { Router } from "express";
import { supabase } from "../utils/supabase.js";

const router = Router();

/**
 * Start the planning step
 * This only updates the step - actual execution happens via the /stream endpoint
 * The frontend should connect to /stream after calling this to receive updates
 */
router.post("/:id/start-planning", async (req, res) => {
  try {
    const { id } = req.params;

    // Just update project step to planning
    // The stream endpoint will handle the actual execution
    const { error: updateError } = await supabase
      .from("projects")
      .update({ current_step: "planning" })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating project step:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ message: "Planning step activated. Connect to /stream for updates.", project_id: id });
  } catch (error: any) {
    console.error("Error in POST /projects/:id/start-planning:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

