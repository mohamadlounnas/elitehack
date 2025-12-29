import { Router } from "express";
import { supabase, supabaseQueryWithRetry } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";

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

    const { data, error } = await supabaseQueryWithRetry<VideoProject[]>(() =>
      supabase
        .from("video_projects")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    );

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

    // Only allow updating specific fields (first_frame_url removed)
    const allowedFields = ["title", "prompt", "last_frame_url", "video_url", "status", "metadata"];
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
 * Generate last frame for a video project (SSE streaming)
 * Note: First frame functionality has been removed
 */
router.get("/:projectId/videos/:videoId/generate-frames/stream", async (req, res) => {
  const { projectId, videoId } = req.params;
  const frameType = req.query.frame as string || "last"; // Only "last" frame is supported now

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

    // Only allow "last" frame generation
    if (frameType !== "last") {
      sendEvent("error", { message: "Only last frame generation is supported" });
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
    `.trim();

    const model = genAI.getGenerativeModel({
      model: "models/gemini-3-pro-image-preview",
    });

    // Helper function to upload image using /tmp/upload API
    const uploadImageToTmpStorage = async (dataUrl: string): Promise<string> => {
      try {
        // Convert data URL to blob
        const base64Data = dataUrl.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid data URL format");
        }
        
        const buffer = Buffer.from(base64Data, "base64");
        const blob = new Blob([buffer], { type: "image/png" });
        
        // Create FormData
        const formData = new FormData();
        formData.append("file", blob, `frame_${Date.now()}.png`);

        // Upload to /tmp/upload API
        const storageServerUrl = process.env.STORAGE_SERVER_URL || "http://localhost:3333";
        const uploadResponse = await fetch(`${storageServerUrl}/api/v1/tmp/upload`, {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`Upload failed: ${uploadResponse.statusText} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json() as { url?: string };
        
        if (!uploadResult.url) {
          throw new Error("Upload API returned invalid response");
        }
        
        logger.info("Image uploaded to tmp storage", {
          url: uploadResult.url,
          videoId,
        });
        
        return uploadResult.url;
      } catch (error: any) {
        logger.error("Error uploading image to tmp storage", error);
        throw error;
      }
    };

    // Helper function to process image URLs (data URLs or file paths) to base64
    // Note: Gemini only supports PNG and JPEG, not SVG
    const processImageToBase64 = (imageUrl: string | null | undefined): { base64Data: string | null; mimeType: string } | null => {
      if (!imageUrl) return null;

      try {
        let base64Data: string | null = null;
        let mimeType: string = "image/png";
        
        if (imageUrl.startsWith("data:")) {
          // Parse data URL: data:image/png;base64,ABC123...
          const commaIndex = imageUrl.indexOf(",");
          if (commaIndex > 0) {
            const header = imageUrl.substring(0, commaIndex);
            base64Data = imageUrl.substring(commaIndex + 1);
            const mimeMatch = header.match(/data:([^;]+)/);
            if (mimeMatch) mimeType = mimeMatch[1];
          } else {
            return null;
          }
        } else {
          // If it's a file path, try to read it
          try {
            const imageBuffer = fs.readFileSync(imageUrl);
            base64Data = imageBuffer.toString("base64");
            // Try to detect mime type from extension
            const ext = path.extname(imageUrl).toLowerCase();
            if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
            else if (ext === ".png") mimeType = "image/png";
            else if (ext === ".svg") {
              // SVG is not supported by Gemini, skip it
              logger.info("Skipping SVG image (not supported by Gemini)", { path: imageUrl });
              return null;
            }
          } catch (fileError) {
            logger.warn("Failed to read image file", { path: imageUrl, error: fileError });
            return null;
          }
        }

        // Skip SVG images (Gemini doesn't support them)
        if (mimeType === "image/svg+xml" || mimeType === "image/svg") {
          logger.info("Skipping SVG image (not supported by Gemini)", { imageUrl: imageUrl.substring(0, 50) + "..." });
          return null;
        }

        // Only return supported formats (PNG, JPEG)
        if (base64Data && (mimeType === "image/png" || mimeType === "image/jpeg")) {
          return { base64Data, mimeType };
        } else if (base64Data) {
          logger.warn("Unsupported image format, skipping", { mimeType, imageUrl: imageUrl.substring(0, 50) + "..." });
          return null;
        }
      } catch (error) {
        logger.warn("Failed to process image", { imageUrl, error });
      }
      
      return null;
    };

    // Process logo for context
    const logoImage = processImageToBase64(project.logo_url);

    sendEvent("progress", { 
      message: "Generating last frame...",
      frame: "last",
    });

    // Get prompt from metadata, fall back to global prompt, then default
    const userPrompt = videoProject.metadata?.last_frame_prompt || videoProject.prompt || "Create a professional factory production floor view";

    let framePrompt: string;
    let imageParts: any[] = [];

    // Add logo to context
    if (logoImage) {
      imageParts.push({
        inlineData: {
          mimeType: logoImage.mimeType,
          data: logoImage.base64Data,
        },
      });
    }

    // Process layout plan image
    const layoutImageUrl = floorPlan?.file_path;
    const layoutImage = processImageToBase64(layoutImageUrl);
    if (layoutImage) {
      imageParts.push({
        inlineData: {
          mimeType: layoutImage.mimeType,
          data: layoutImage.base64Data,
        },
      });
    }

    framePrompt = `Create a cinematic shot for a factory promotional video.

${factoryContext}

User Description: ${userPrompt}

${layoutImage ? "IMPORTANT: The factory layout plan is attached - use it to understand the facility structure and ensure accuracy." : ""}
${logoImage ? "BRAND CONTEXT: The company logo is attached - understand the brand identity, colors, and style. The video should reflect this brand aesthetic." : ""}

Requirements:
- Photorealistic, high-quality image  
- Showcase the main production floor with machinery in operation
- Dynamic angle showing the scale and capability of the facility
- Warm, inviting lighting suggesting productivity and success
- Workers visible but not the main focus
- Should feel like an impressive shot for a promotional video
- 16:9 aspect ratio composition
- DO NOT include any text, logos, or overlays (the logo is for reference only, do not embed it in the image)`;

    try {
      // Combine text prompt with image parts
      const contentParts = [{ text: framePrompt }, ...imageParts];
      const response = await model.generateContent(contentParts);
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
        // Upload image using /tmp/upload API and get public URL
        try {
          const publicUrl = await uploadImageToTmpStorage(imageUrl);
          
          // Update video project with generated frame
          await supabase
            .from("video_projects")
            .update({
              last_frame_url: publicUrl,
              status: "frames_ready",
            })
            .eq("id", videoId);

          // Send the public URL
          sendEvent("frame_complete", {
            frame: "last",
            imageUrl: publicUrl,
          });
        } catch (saveError: any) {
          logger.error("Error uploading last frame", saveError);
          sendEvent("frame_error", {
            frame: "last",
            message: `Failed to upload frame: ${saveError.message}`,
          });
        }
      } else {
        sendEvent("frame_error", {
          frame: "last",
          message: "Failed to generate frame image",
        });
      }
    } catch (frameError: any) {
      logger.error("Error generating last frame", frameError);
      sendEvent("frame_error", {
        frame: "last",
        message: frameError.message,
      });
    }

    sendEvent("complete", {
      message: "Frame generation complete",
    });

    res.end();
  } catch (error: any) {
    logger.error("Error generating frames", error);
    sendEvent("error", { message: error.message });
    res.end();
  }
});

/**
 * Generate video from frames using Kie.ai Hailuo 2-3 Image To Video Standard API (SSE streaming)
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
    const kieApiKey = process.env.KIE_API_KEY;
    if (!kieApiKey) {
      sendEvent("error", { message: "Kie.ai API key not configured" });
      return res.end();
    }

    // Get video project (minimal check)
    const { data: videoProject, error: videoError } = await supabase
      .from("video_projects")
      .select("id, metadata")
      .eq("id", videoId)
      .eq("project_id", projectId)
      .single();

    if (videoError || !videoProject) {
      sendEvent("error", { message: "Video project not found" });
      return res.end();
    }

    // Update status to generating
    await supabase
      .from("video_projects")
      .update({ status: "video_generating" })
      .eq("id", videoId);

    sendEvent("progress", { message: "Preparing video generation...", progress: 5 });

    // Get the last frame URL from the video project
    const { data: videoProjectWithFrame } = await supabase
      .from("video_projects")
      .select("last_frame_url")
      .eq("id", videoId)
      .eq("project_id", projectId)
      .single();

    if (!videoProjectWithFrame?.last_frame_url) {
      sendEvent("error", { message: "Last frame not found. Please generate the last frame first." });
      return res.end();
    }

    const lastFrameUrl = videoProjectWithFrame.last_frame_url;
    sendEvent("progress", { message: "Using last frame for video generation...", progress: 10 });
    
    const videoPrompt = "Smooth cinematic transition showing the factory production floor in action, professional lighting, dynamic camera movement";

    sendEvent("progress", { message: "Creating video generation task...", progress: 15 });

    // Step 1: Create generation task with Kie.ai using the last frame
    const createTaskResponse = await axios.post(
      "https://api.kie.ai/api/v1/jobs/createTask",
      {
        model: "hailuo/2-3-image-to-video-standard",
        input: {
          prompt: videoPrompt,
          image_url: lastFrameUrl,
          duration: "6", // 6 seconds
          resolution: "1080P", // High quality
        },
      },
      {
        headers: {
          "Authorization": `Bearer ${kieApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (createTaskResponse.data.code !== 200) {
      throw new Error(createTaskResponse.data.msg || "Failed to create video generation task");
    }

    const taskId = createTaskResponse.data.data.taskId;
    
    // Store taskId in metadata for background polling
    await supabase
      .from("video_projects")
      .update({
        metadata: {
          ...videoProject.metadata,
          kie_task_id: taskId,
          kie_task_created_at: new Date().toISOString(),
        },
      })
      .eq("id", videoId);
    
    sendEvent("progress", { message: "Video generation task created, processing...", progress: 20 });

    // Step 2: Poll for task status
    const maxPollAttempts = 120; // 10 minutes max (5 second intervals)
    let pollAttempts = 0;
    let videoUrl: string | null = null;

    const pollInterval = setInterval(async () => {
      try {
        pollAttempts++;

        const statusResponse = await axios.get(
          `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
          {
            headers: {
              "Authorization": `Bearer ${kieApiKey}`,
            },
          }
        );

        if (statusResponse.data.code !== 200) {
          clearInterval(pollInterval);
          sendEvent("error", { message: statusResponse.data.msg || "Failed to check task status" });
          res.end();
          return;
        }

        const taskData = statusResponse.data.data;
        const state = taskData.state;

        // Update progress based on state
        if (state === "waiting") {
          const progress = Math.min(20 + (pollAttempts * 2), 80);
          sendEvent("progress", { 
            message: "Video is being generated, please wait...", 
            progress 
          });
        } else if (state === "success") {
          clearInterval(pollInterval);

          // Extract video URL from result
          try {
            const resultJson = JSON.parse(taskData.resultJson);
            if (resultJson.resultUrls && resultJson.resultUrls.length > 0) {
              videoUrl = resultJson.resultUrls[0];
            } else {
              throw new Error("No video URL in result");
            }
          } catch (parseError) {
            clearInterval(pollInterval);
            sendEvent("error", { message: "Failed to parse video result" });
            res.end();
            return;
          }

          // Update video project with video URL
          await supabase
            .from("video_projects")
            .update({
              video_url: videoUrl,
              status: "completed",
            })
            .eq("id", videoId);

          sendEvent("complete", {
            message: "Video generation complete",
            videoUrl: videoUrl,
          });

          res.end();
        } else if (state === "fail") {
          clearInterval(pollInterval);
          const errorMsg = taskData.failMsg || "Video generation failed";
          sendEvent("error", { message: errorMsg });
          
          // Update status
          await supabase
            .from("video_projects")
            .update({ status: "frames_ready" }) // Reset to frames_ready so user can retry
            .eq("id", videoId);
          
          res.end();
        } else if (pollAttempts >= maxPollAttempts) {
          clearInterval(pollInterval);
          sendEvent("error", { message: "Video generation timeout. Please try again." });
          
          // Update status
          await supabase
            .from("video_projects")
            .update({ status: "frames_ready" })
            .eq("id", videoId);
          
          res.end();
        }
      } catch (pollError: any) {
        clearInterval(pollInterval);
        logger.error("Error polling video generation status", pollError);
        sendEvent("error", { message: pollError.message || "Error checking video generation status" });
        res.end();
      }
    }, 5000); // Poll every 5 seconds

    // Cleanup on client disconnect
    req.on("close", () => {
      clearInterval(pollInterval);
    });

  } catch (error: any) {
    logger.error("Error generating video", error);
    sendEvent("error", { message: error.message || "Failed to generate video" });
    
    // Reset status on error
    try {
      await supabase
        .from("video_projects")
        .update({ status: "frames_ready" })
        .eq("id", videoId);
    } catch (updateError) {
      // Ignore update errors
    }
    
    res.end();
  }
});

export default router;

