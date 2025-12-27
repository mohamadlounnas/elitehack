import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;
    logger.info("Creating new project", { name, hasDescription: !!description });

    if (!name) {
      logger.warn("Project creation failed: name is required");
      return res.status(400).json({ error: "Name is required" });
    }

    logger.db("INSERT", "projects", { name });
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        description,
        current_step: "chat",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating project", error, { name });
      return res.status(500).json({ error: error.message });
    }

    logger.info("Project created successfully", { projectId: data.id, name });
    res.json(data);
  } catch (error: any) {
    logger.error("Error in POST /projects", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/layout-progress", async (req, res) => {
  try {
    const { id } = req.params;
    logger.db("SELECT", "projects", { projectId: id });
    const { data: project, error } = await supabase
      .from("projects")
      .select("metadata")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("Error fetching layout progress", error, { projectId: id });
      return res.status(500).json({ error: error.message });
    }

    const progress = project?.metadata?.layout_progress || null;
    res.json({ progress });
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/layout-progress", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    logger.info("Fetching all projects");
    logger.db("SELECT", "projects");
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching projects", error);
      return res.status(500).json({ error: error.message });
    }

    logger.info("Projects fetched successfully", { count: data?.length || 0 });
    res.json(data);
  } catch (error: any) {
    logger.error("Error in GET /projects", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching project", { projectId: id });

    logger.db("SELECT", "projects", { projectId: id });
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        logger.warn("Project not found", { projectId: id });
        return res.status(404).json({ error: "Project not found" });
      }
      logger.error("Error fetching project", error, { projectId: id });
      return res.status(500).json({ error: error.message });
    }

    logger.info("Project fetched successfully", { projectId: id, step: data.current_step });
    res.json(data);
  } catch (error: any) {
    logger.error("Error in GET /projects/:id", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

export default router;

