import { Router } from "express";
import { supabase } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Initialize Gemini AI for frame generation
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

interface VideoProject {
  id: string;
  project_id: string;
  title: string;
  prompt: string | null;
  first_frame_url: string | null;
  last_frame_url: string | null;
  video_url: string | null;
  status: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

/**
 * Get all video projects for a factory project
 */
router.get("/:projectId/videos", async (req, res) => {
  try {
    const { projectId } = req.params;
    logger.info("Fetching video projects", { projectId });

    const { data, error } = await supabase
      .from("video_projects")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching video projects", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    logger.error("Error in GET /videos", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a single video project
 */
router.get("/:projectId/videos/:videoId", async (req, res) => {
  try {
    const { projectId, videoId } = req.params;

    const { data, error } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", videoId)
      .eq("project_id", projectId)
      .single();

    if (error) {
      return res.status(404).json({ error: "Video project not found" });
    }

    res.json(data);
  } catch (error: any) {
    logger.error("Error in GET /videos/:videoId", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new video project
 */
router.post("/:projectId/videos", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, prompt } = req.body;

    const { data, error } = await supabase
      .from("video_projects")
      .insert({
        project_id: projectId,
        title: title || "Untitled Video",
        prompt: prompt || null,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating video project", error);
      return res.status(500).json({ error: error.message });
    }

    logger.info("Created video project", { videoId: data.id, projectId });
    res.status(201).json(data);
  } catch (error: any) {
    logger.error("Error in POST /videos", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a video project
 */
router.patch("/:projectId/videos/:videoId", async (req, res) => {
  try {
    const { projectId, videoId } = req.params;
    const updates = req.body;

    // Only allow updating specific fields
    const allowedFields = ["title", "prompt", "first_frame_url", "last_frame_url", "video_url", "status", "metadata"];
    const filteredUpdates: any = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from("video_projects")
      .update(filteredUpdates)
      .eq("id", videoId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      logger.error("Error updating video project", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    logger.error("Error in PATCH /videos/:videoId", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a video project
 */
router.delete("/:projectId/videos/:videoId", async (req, res) => {
  try {
    const { projectId, videoId } = req.params;

    const { error } = await supabase
      .from("video_projects")
      .delete()
      .eq("id", videoId)
      .eq("project_id", projectId);

    if (error) {
      logger.error("Error deleting video project", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(204).send();
  } catch (error: any) {
    logger.error("Error in DELETE /videos/:videoId", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate frames for a video project (SSE streaming)
 */
router.get("/:projectId/videos/:videoId/generate-frames/stream", async (req, res) => {
  const { projectId, videoId } = req.params;
  const frameType = req.query.frame as string || "both"; // "first", "last", or "both"

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    if (!genAI) {
      sendEvent("error", { message: "AI service not configured" });
      return res.end();
    }

    // Get video project
    const { data: videoProject, error: videoError } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", videoId)
      .eq("project_id", projectId)
      .single();

    if (videoError || !videoProject) {
      sendEvent("error", { message: "Video project not found" });
      return res.end();
    }

    // Get factory project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, planning_data, logo_url")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      sendEvent("error", { message: "Factory project not found" });
      return res.end();
    }

    // Get floor plan for context
    const { data: floorPlan } = await supabase
      .from("generated_files")
      .select("file_path")
      .eq("project_id", projectId)
      .or("metadata->>layout_type.eq.floor_plan,filename.ilike.%floor_plan%")
      .limit(1)
      .single();

    // Get assets for context
    const { data: assets } = await supabase
      .from("assets")
      .select("name, type, description")
      .eq("project_id", projectId)
      .limit(10);

    const identity = project.planning_data?.industrial_identity;
    const factoryName = identity?.brand_name || identity?.company_name || project.name;
    const industrySector = identity?.industry_sector || "manufacturing";

    // Build context for AI
    const factoryContext = `
Factory Name: ${factoryName}
Industry: ${industrySector}
${identity?.tagline ? `Tagline: ${identity.tagline}` : ""}
${project.planning_data?.facility_specifications ? `
Facility Size: ${project.planning_data.facility_specifications.total_area || "N/A"} sqm
Dimensions: ${project.planning_data.facility_specifications.dimensions?.length || "N/A"}m x ${project.planning_data.facility_specifications.dimensions?.width || "N/A"}m
` : ""}
${assets && assets.length > 0 ? `
Key Equipment: ${assets.map((a: any) => a.name).join(", ")}
` : ""}
User Prompt: ${videoProject.prompt || "Create a professional factory promotional video"}
    `.trim();

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash-image",
    });

    const framesToGenerate = frameType === "both" ? ["first", "last"] : [frameType];
    const results: { first_frame_url?: string; last_frame_url?: string } = {};

    for (const frame of framesToGenerate) {
      sendEvent("progress", { 
        message: `Generating ${frame} frame...`,
        frame,
      });

      const framePrompt = frame === "first"
        ? `Create a cinematic opening shot for a factory promotional video.

${factoryContext}

Requirements:
- Photorealistic, high-quality image
- Wide establishing shot showing the factory exterior or impressive interior entrance
- Professional lighting, early morning or golden hour aesthetic
- Clean, modern industrial architecture
- Should feel like the opening frame of a high-budget corporate video
- Pure white or transparent background elements where applicable
- 16:9 aspect ratio composition
- DO NOT include any text, logos, or overlays`
        : `Create a cinematic closing shot for a factory promotional video.

${factoryContext}

Requirements:
- Photorealistic, high-quality image  
- Showcase the main production floor with machinery in operation
- Dynamic angle showing the scale and capability of the facility
- Warm, inviting lighting suggesting productivity and success
- Workers visible but not the main focus
- Should feel like the final impressive shot before the company logo appears
- 16:9 aspect ratio composition
- DO NOT include any text, logos, or overlays`;

      try {
        const response = await model.generateContent(framePrompt);
        const parts = response.response.candidates?.[0]?.content?.parts || [];
        
        let imageUrl: string | null = null;
        
        for (const part of parts) {
          if ((part as any).inlineData) {
            const inlineData = (part as any).inlineData;
            imageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          if (frame === "first") {
            results.first_frame_url = imageUrl;
          } else {
            results.last_frame_url = imageUrl;
          }

          sendEvent("frame_complete", {
            frame,
            imageUrl,
          });
        } else {
          sendEvent("frame_error", {
            frame,
            message: "Failed to generate frame image",
          });
        }
      } catch (frameError: any) {
        logger.error(`Error generating ${frame} frame`, frameError);
        sendEvent("frame_error", {
          frame,
          message: frameError.message,
        });
      }
    }

    // Update video project with generated frames
    const updateData: any = {
      status: "frames_ready",
    };
    if (results.first_frame_url) {
      updateData.first_frame_url = results.first_frame_url;
    }
    if (results.last_frame_url) {
      updateData.last_frame_url = results.last_frame_url;
    }

    await supabase
      .from("video_projects")
      .update(updateData)
      .eq("id", videoId);

    sendEvent("complete", {
      message: "Frame generation complete",
      ...results,
    });

    res.end();
  } catch (error: any) {
    logger.error("Error generating frames", error);
    sendEvent("error", { message: error.message });
    res.end();
  }
});

/**
 * Generate video from frames (SSE streaming)
 * For now, returns a mock video URL
 */
router.get("/:projectId/videos/:videoId/generate-video/stream", async (req, res) => {
  const { projectId, videoId } = req.params;

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    // Get video project
    const { data: videoProject, error: videoError } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", videoId)
      .eq("project_id", projectId)
      .single();

    if (videoError || !videoProject) {
      sendEvent("error", { message: "Video project not found" });
      return res.end();
    }

    if (!videoProject.first_frame_url || !videoProject.last_frame_url) {
      sendEvent("error", { message: "Please generate both frames first" });
      return res.end();
    }

    // Update status to generating
    await supabase
      .from("video_projects")
      .update({ status: "video_generating" })
      .eq("id", videoId);

    sendEvent("progress", { message: "Preparing video generation...", progress: 10 });

    // Simulate video generation steps
    await new Promise(resolve => setTimeout(resolve, 1000));
    sendEvent("progress", { message: "Analyzing frames...", progress: 25 });

    await new Promise(resolve => setTimeout(resolve, 1500));
    sendEvent("progress", { message: "Generating transitions...", progress: 50 });

    await new Promise(resolve => setTimeout(resolve, 1500));
    sendEvent("progress", { message: "Rendering video...", progress: 75 });

    await new Promise(resolve => setTimeout(resolve, 1000));
    sendEvent("progress", { message: "Finalizing...", progress: 90 });

    // For now, return mock video URL
    // TODO: Integrate with Google Veo when available
    const mockVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4";

    // Update video project with video URL
    await supabase
      .from("video_projects")
      .update({
        video_url: mockVideoUrl,
        status: "completed",
      })
      .eq("id", videoId);

    sendEvent("complete", {
      message: "Video generation complete",
      videoUrl: mockVideoUrl,
    });

    res.end();
  } catch (error: any) {
    logger.error("Error generating video", error);
    sendEvent("error", { message: error.message });
    res.end();
  }
});

export default router;

