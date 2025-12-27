import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import multer from "multer";
import { chatService } from "../services/ai/chatService.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/:id/chat", upload.array("attachments"), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const files = req.files as Express.Multer.File[] || [];

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Save user message
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
      console.error("Error saving user message:", userError);
      return res.status(500).json({ error: userError.message });
    }

    // Process files and get AI response
    const aiResponse = await chatService.processMessage(id, content, files);

    // Save AI response
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
      console.error("Error saving assistant message:", assistantError);
      return res.status(500).json({ error: assistantError.message });
    }

    res.json(assistantMessage);
  } catch (error: any) {
    console.error("Error in POST /projects/:id/chat:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("project_messages")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error("Error in GET /projects/:id/messages:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

