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
    `.trim();

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash-image",
    });

    // Helper function to save base64 image to file system and return URL
    const saveImageToFileSystem = async (projectId: string, frameType: string, dataUrl: string): Promise<string> => {
      try {
        const base64Data = dataUrl.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid data URL format");
        }

        const imageBuffer = Buffer.from(base64Data, "base64");
        const filename = `${frameType}_frame_${Date.now()}.png`;
        const projectDir = path.join(process.cwd(), "tmp", "projects", projectId);
        
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        const filePath = path.join(projectDir, filename);
        await fs.promises.writeFile(filePath, imageBuffer);
        
        // Return relative path that frontend can use to construct full URL
        return `/tmp/projects/${projectId}/${filename}`;
      } catch (error: any) {
        logger.error("Error saving image to file system", error);
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

    const framesToGenerate = frameType === "both" ? ["first", "last"] : [frameType];
    const results: { first_frame_url?: string; last_frame_url?: string } = {};

    for (const frame of framesToGenerate) {
      sendEvent("progress", { 
        message: `Generating ${frame} frame...`,
        frame,
      });

      // Get specific prompt from metadata, fall back to global prompt, then default
      const specificPrompt = frame === "first" 
        ? videoProject.metadata?.first_frame_prompt 
        : videoProject.metadata?.last_frame_prompt;
      
      const userPrompt = specificPrompt || videoProject.prompt || (frame === "first" ? "Create a professional factory entrance view" : "Create a professional factory production floor view");

      let framePrompt: string;
      let imageParts: any[] = [];

      // Add logo to context for both frames
      if (logoImage) {
        imageParts.push({
          inlineData: {
            mimeType: logoImage.mimeType,
            data: logoImage.base64Data,
          },
        });
      }

      if (frame === "first") {
        framePrompt = `Create a cinematic opening shot for a factory promotional video.

${factoryContext}

User Description: ${userPrompt}

${logoImage ? "BRAND CONTEXT: The company logo is attached - understand the brand identity, colors, and style. The video should reflect this brand aesthetic." : ""}

Requirements:
- Photorealistic, high-quality image
- Wide establishing shot showing the factory exterior or impressive interior entrance
- Professional lighting, early morning or golden hour aesthetic
- Clean, modern industrial architecture
- Should feel like the opening frame of a high-budget corporate video
- Pure white or transparent background elements where applicable
- 16:9 aspect ratio composition
- DO NOT include any text, logos, or overlays (the logo is for reference only, do not embed it in the image)`;
      } else {
        // For last frame, include layout plan and first frame as references
        const layoutImageUrl = floorPlan?.file_path;
        const firstFrameImageUrl = videoProject.first_frame_url;

        // Process first frame image
        const firstFrameImage = processImageToBase64(firstFrameImageUrl);
        if (firstFrameImage) {
          imageParts.push({
            inlineData: {
              mimeType: firstFrameImage.mimeType,
              data: firstFrameImage.base64Data,
            },
          });
        }

        // Process layout plan image
        const layoutImage = processImageToBase64(layoutImageUrl);
        if (layoutImage) {
          imageParts.push({
            inlineData: {
              mimeType: layoutImage.mimeType,
              data: layoutImage.base64Data,
            },
          });
        }

        framePrompt = `Create a cinematic closing shot for a factory promotional video.

${factoryContext}

User Description: ${userPrompt}

IMPORTANT CONTEXT:
- This is the CLOSING shot that should follow the opening shot (first frame)
- The first frame image is attached - use it as a reference for style, lighting, and visual continuity
${layoutImage ? "- The factory layout plan is attached - use it to understand the facility structure and ensure accuracy" : ""}
${logoImage ? "- The company logo is attached - understand the brand identity, colors, and style. The video should reflect this brand aesthetic." : ""}
- This closing shot should show the interior production floor in action
- It should feel like a natural continuation from the opening shot

Requirements:
- Photorealistic, high-quality image  
- Showcase the main production floor with machinery in operation
- Dynamic angle showing the scale and capability of the facility
- Warm, inviting lighting suggesting productivity and success
- Workers visible but not the main focus
- Should feel like the final impressive shot before the company logo appears
- Must be consistent with the style and setting of the first frame
- 16:9 aspect ratio composition
- DO NOT include any text, logos, or overlays (the logo is for reference only, do not embed it in the image)`;
      }

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
          // Save image to file system instead of storing base64 in database
          try {
            const filePath = await saveImageToFileSystem(projectId, frame, imageUrl);
            
            if (frame === "first") {
              results.first_frame_url = filePath;
            } else {
              results.last_frame_url = filePath;
            }

            // Send the file path (frontend will need to construct the full URL)
            sendEvent("frame_complete", {
              frame,
              imageUrl: filePath, // Send file path instead of data URL
            });
          } catch (saveError: any) {
            logger.error(`Error saving ${frame} frame to file system`, saveError);
            sendEvent("frame_error", {
              frame,
              message: `Failed to save frame: ${saveError.message}`,
            });
          }
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

