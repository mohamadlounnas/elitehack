import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import multer from "multer";
import { chatService } from "../services/ai/chatService.js";
import { logger } from "../utils/logger.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/:id/chat", upload.array("attachments"), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const files = req.files as Express.Multer.File[] || [];

    logger.info("Chat message received", { 
      projectId: id, 
      contentLength: content?.length,
      fileCount: files.length 
    });

    if (!content) {
      logger.warn("Chat message rejected: content is required", { projectId: id });
      return res.status(400).json({ error: "Content is required" });
    }

    // Save user message
    logger.db("INSERT", "project_messages", { projectId: id, role: "user" });
    const { data: userMessage, error: userError } = await supabase
      .from("project_messages")
      .insert({
        project_id: id,
        role: "user",
        content,
        attachments: files.map((f) => ({
          filename: f.originalname,
          file_type: f.mimetype,
          size: f.size,
        })),
      })
      .select()
      .single();

    if (userError) {
      logger.error("Error saving user message", userError, { projectId: id });
      return res.status(500).json({ error: userError.message });
    }

    // Process files and get AI response
    logger.ai("Processing chat message", "gemini-3-pro-preview", { projectId: id });
    const aiResponse = await chatService.processMessage(id, content, files);
    logger.ai("Chat response generated", "gemini-3-pro-preview", { 
      projectId: id, 
      responseLength: aiResponse.length 
    });

    // Save AI response
    logger.db("INSERT", "project_messages", { projectId: id, role: "assistant" });
    const { data: assistantMessage, error: assistantError } = await supabase
      .from("project_messages")
      .insert({
        project_id: id,
        role: "assistant",
        content: aiResponse,
      })
      .select()
      .single();

    if (assistantError) {
      logger.error("Error saving assistant message", assistantError, { projectId: id });
      return res.status(500).json({ error: assistantError.message });
    }

    logger.info("Chat message processed successfully", { projectId: id, messageId: assistantMessage.id });
    res.json(assistantMessage);
  } catch (error: any) {
    logger.error("Error in POST /projects/:id/chat", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Fetching messages", { projectId: id });

    logger.db("SELECT", "project_messages", { projectId: id });
    const { data, error } = await supabase
      .from("project_messages")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Error fetching messages", error, { projectId: id });
      return res.status(500).json({ error: error.message });
    }

    logger.info("Messages fetched successfully", { projectId: id, count: data?.length || 0 });
    res.json(data);
  } catch (error: any) {
    logger.error("Error in GET /projects/:id/messages", error, { projectId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

export default router;

