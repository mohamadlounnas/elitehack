import { Router } from "express";
import { supabase } from "../utils/supabase.js";

const router = Router();

router.get("/:id/assets", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching assets:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    console.error("Error in GET /projects/:id/assets:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

