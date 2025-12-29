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
 * Supports both "first" and "last" frame generation for Veo 3.1 two-frame video
 */
router.get("/:projectId/videos/:videoId/generate-frames/stream", async (req, res) => {
  const { projectId, videoId } = req.params;
  const frameType = req.query.frame as string || "first"; // "first" or "last"

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

    // Validate frame type
    if (frameType !== "first" && frameType !== "last") {
      sendEvent("error", { message: "Invalid frame type. Must be 'first' or 'last'" });
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
        formData.append("file", blob, `frame_${frameType}_${Date.now()}.png`);

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
          frameType,
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
      message: `Generating ${frameType} frame...`,
      frame: frameType,
    });

    // Get prompt from metadata based on frame type
    const promptKey = frameType === "first" ? "first_frame_prompt" : "last_frame_prompt";
    const defaultPrompt = frameType === "first" 
      ? "Create a professional factory exterior or entrance view"
      : "Create a professional factory production floor view showing completion/success";
    const userPrompt = videoProject.metadata?.[promptKey] || videoProject.prompt || defaultPrompt;

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

    // Different prompts for first and last frames to create a narrative
    // NOTE: Industry 5.0 = fully autonomous production line, NO humans on production floor
    if (frameType === "first") {
      framePrompt = `Créez le plan d'OUVERTURE pour une vidéo promotionnelle d'usine Industrie 5.0.

${factoryContext}

Description utilisateur: ${userPrompt}

${layoutImage ? "IMPORTANT: Le plan d'aménagement de l'usine est joint - utilisez-le pour comprendre la structure de l'installation et assurer la précision." : ""}
${logoImage ? "CONTEXTE DE MARQUE: Le logo de l'entreprise est joint - comprenez l'identité de marque, les couleurs et le style. La vidéo doit refléter cette esthétique de marque." : ""}

IMPORTANT - INDUSTRIE 5.0:
- Cette usine représente l'Industrie 5.0 avec une ligne de production ENTIÈREMENT AUTONOME
- AUCUN humain ne doit être visible sur la ligne de production ou l'atelier de fabrication
- Les humains peuvent être présents dans d'autres zones (bureaux, accueil, zones de supervision) mais PAS sur le sol de production
- Montrez des robots, des bras automatisés, des AGV (véhicules à guidage automatique), et des machines intelligentes

Exigences pour la PREMIÈRE IMAGE (Plan d'ouverture):
- Image photoréaliste de haute qualité
- Montrez un plan d'établissement - extérieur, entrée, ou vue large de l'usine
- Créez un sentiment d'anticipation et de professionnalisme
- Éclairage matinal/lumineux suggérant une nouvelle journée de productivité
- Transmettez l'échelle, la modernité et la capacité de l'installation
- Doit ressembler à la scène d'ouverture d'une vidéo d'entreprise professionnelle
- Composition au format 16:9
- NE PAS inclure de texte, logos ou superpositions (le logo est uniquement pour référence, ne pas l'intégrer dans l'image)`;
    } else {
      framePrompt = `Créez le plan de CLÔTURE pour une vidéo promotionnelle d'usine Industrie 5.0.

${factoryContext}

Description utilisateur: ${userPrompt}

${layoutImage ? "IMPORTANT: Le plan d'aménagement de l'usine est joint - utilisez-le pour comprendre la structure de l'installation et assurer la précision." : ""}
${logoImage ? "CONTEXTE DE MARQUE: Le logo de l'entreprise est joint - comprenez l'identité de marque, les couleurs et le style. La vidéo doit refléter cette esthétique de marque." : ""}

IMPORTANT - INDUSTRIE 5.0:
- Cette usine représente l'Industrie 5.0 avec une ligne de production ENTIÈREMENT AUTONOME
- AUCUN humain ne doit être visible sur la ligne de production ou l'atelier de fabrication
- Les humains peuvent être présents dans d'autres zones (bureaux, salles de contrôle, zones de supervision) mais PAS sur le sol de production
- Montrez des robots en pleine action, des bras automatisés travaillant, des AGV transportant des matériaux, et des machines intelligentes synchronisées

Exigences pour la DERNIÈRE IMAGE (Plan de clôture):
- Image photoréaliste de haute qualité
- Montrez l'atelier de production avec les machines en plein fonctionnement AUTONOME
- Angle dynamique montrant la productivité et le succès
- Éclairage chaleureux, heure dorée suggérant l'accomplissement
- Robots et machines automatisées visibles, montrant l'efficacité et la précision
- Transmettez l'achèvement, le succès et l'excellence opérationnelle
- Doit ressembler au finale impressionnant d'une vidéo promotionnelle
- Composition au format 16:9
- NE PAS inclure de texte, logos ou superpositions (le logo est uniquement pour référence, ne pas l'intégrer dans l'image)`;
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
        // Upload image using /tmp/upload API and get public URL
        try {
          const publicUrl = await uploadImageToTmpStorage(imageUrl);
          
          // Update video project with generated frame
          const updateField = frameType === "first" ? "first_frame_url" : "last_frame_url";
          await supabase
            .from("video_projects")
            .update({
              [updateField]: publicUrl,
              status: "frames_ready",
            })
            .eq("id", videoId);

          // Send the public URL
          sendEvent("frame_complete", {
            frame: frameType,
            imageUrl: publicUrl,
          });
        } catch (saveError: any) {
          logger.error(`Error uploading ${frameType} frame`, saveError);
          sendEvent("frame_error", {
            frame: frameType,
            message: `Failed to upload frame: ${saveError.message}`,
          });
        }
      } else {
        sendEvent("frame_error", {
          frame: frameType,
          message: "Failed to generate frame image",
        });
      }
    } catch (frameError: any) {
      logger.error(`Error generating ${frameType} frame`, frameError);
      sendEvent("frame_error", {
        frame: frameType,
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
 * Generate video from frames using Kie.ai Veo 3.1 API (SSE streaming)
 * Uses FIRST_AND_LAST_FRAMES_2_VIDEO generation type for two-frame video generation
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

    // Get video project with all frame URLs
    const { data: videoProject, error: videoError } = await supabase
      .from("video_projects")
      .select("id, metadata, first_frame_url, last_frame_url, prompt")
      .eq("id", videoId)
      .eq("project_id", projectId)
      .single();

    if (videoError || !videoProject) {
      sendEvent("error", { message: "Video project not found" });
      return res.end();
    }

    // Validate frames are available
    if (!videoProject.first_frame_url || !videoProject.last_frame_url) {
      sendEvent("error", { 
        message: "Both first and last frames are required for video generation. Please generate both frames first." 
      });
      return res.end();
    }

    // Update status to generating
    await supabase
      .from("video_projects")
      .update({ status: "video_generating" })
      .eq("id", videoId);

    sendEvent("progress", { message: "Preparing Veo 3.1 video generation...", progress: 5 });

    const firstFrameUrl = videoProject.first_frame_url;
    const lastFrameUrl = videoProject.last_frame_url;
    
    sendEvent("progress", { message: "Using first and last frames for video transition...", progress: 10 });
    
    // Get custom prompt or use default
    const videoPrompt = videoProject.prompt || 
      "Smooth cinematic transition from opening shot to production floor. Professional factory tour video with dynamic camera movement, showing the journey through the facility. High quality industrial footage.";

    sendEvent("progress", { message: "Creating Veo 3.1 video generation task...", progress: 15 });

    // Create generation task with Kie.ai Veo 3.1 API using FIRST_AND_LAST_FRAMES_2_VIDEO mode
    const createTaskResponse = await axios.post(
      "https://api.kie.ai/api/v1/veo/generate",
      {
        prompt: videoPrompt,
        imageUrls: [firstFrameUrl, lastFrameUrl], // First frame and last frame
        model: "veo3_fast", // Use veo3_fast for faster generation, or "veo3" for highest quality
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO", // Two-frame video generation
        aspectRatio: "16:9", // Professional widescreen format
        enableTranslation: true, // Auto-translate prompts to English
      },
      {
        headers: {
          "Authorization": `Bearer ${kieApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (createTaskResponse.data.code !== 200) {
      throw new Error(createTaskResponse.data.msg || "Failed to create Veo 3.1 video generation task");
    }

    const taskId = createTaskResponse.data.data.taskId;
    
    logger.info("Veo 3.1 task created", {
      taskId,
      videoId,
      projectId,
      model: "veo3_fast",
      generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
    });
    
    // Store taskId in metadata for background polling
    await supabase
      .from("video_projects")
      .update({
        metadata: {
          ...videoProject.metadata,
          veo_task_id: taskId,
          veo_task_created_at: new Date().toISOString(),
          veo_model: "veo3_fast",
          veo_generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        },
      })
      .eq("id", videoId);
    
    sendEvent("progress", { message: "Veo 3.1 video generation started, processing...", progress: 20 });

    // Poll for task status using the Veo API status endpoint
    const maxPollAttempts = 180; // 15 minutes max (5 second intervals) - Veo can take longer
    let pollAttempts = 0;
    let videoUrl: string | null = null;

    const pollInterval = setInterval(async () => {
      try {
        pollAttempts++;

        // Use the Veo-specific status endpoint (different from Hailuo)
        const statusResponse = await axios.get(
          `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`,
          {
            headers: {
              "Authorization": `Bearer ${kieApiKey}`,
            },
          }
        );

        if (statusResponse.data.code !== 200) {
          // Code 422 with "record is null" means task is still initializing
          if (statusResponse.data.code === 422 && statusResponse.data.msg?.includes("record is null")) {
            const progress = Math.min(20 + (pollAttempts * 0.3), 40);
            sendEvent("progress", { 
              message: "Veo 3.1 task initializing, please wait...", 
              progress 
            });
            return; // Will retry on next poll
          }
          clearInterval(pollInterval);
          sendEvent("error", { message: statusResponse.data.msg || "Failed to check Veo task status" });
          res.end();
          return;
        }

        const taskData = statusResponse.data.data;
        
        // Handle null taskData - task might still be initializing
        if (!taskData) {
          const progress = Math.min(20 + (pollAttempts * 0.3), 40);
          sendEvent("progress", { 
            message: "Veo 3.1 task initializing, please wait...", 
            progress 
          });
          return; // Will retry on next poll
        }

        // Veo uses successFlag: 0 = Generating, 1 = Success, 2 = Failed, 3 = Generation Failed
        const successFlag = taskData.successFlag;

        // Update progress based on state
        if (successFlag === 0) {
          // Still generating
          const progress = Math.min(20 + (pollAttempts * 0.5), 85);
          sendEvent("progress", { 
            message: "Veo 3.1 is generating your video, please wait...", 
            progress 
          });
        } else if (successFlag === 1) {
          // Success!
          clearInterval(pollInterval);

          // Extract video URL from response
          try {
            const response = taskData.response;
            if (response?.resultUrls && response.resultUrls.length > 0) {
              videoUrl = response.resultUrls[0];
            }
            
            if (!videoUrl) {
              throw new Error("No video URL in Veo result");
            }
          } catch (parseError) {
            clearInterval(pollInterval);
            logger.error("Failed to parse Veo video result", { taskData, parseError });
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
              metadata: {
                ...videoProject.metadata,
                veo_task_id: taskId,
                veo_task_completed_at: new Date().toISOString(),
                veo_fallback_used: taskData.fallbackFlag || false,
              },
            })
            .eq("id", videoId);

          sendEvent("complete", {
            message: "Veo 3.1 video generation complete",
            videoUrl: videoUrl,
          });

          res.end();
        } else if (successFlag === 2 || successFlag === 3) {
          // Failed
          clearInterval(pollInterval);
          const errorMsg = taskData.errorMessage || "Veo video generation failed";
          logger.error("Veo video generation failed", { taskData });
          sendEvent("error", { message: errorMsg });
          
          // Update status
          await supabase
            .from("video_projects")
            .update({ 
              status: "frames_ready",
              metadata: {
                ...videoProject.metadata,
                veo_task_error: errorMsg,
                veo_task_error_code: taskData.errorCode,
              },
            })
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
        logger.error("Error polling Veo video generation status", pollError);
        sendEvent("error", { message: pollError.message || "Error checking video generation status" });
        res.end();
      }
    }, 5000); // Poll every 5 seconds

    // Cleanup on client disconnect
    req.on("close", () => {
      clearInterval(pollInterval);
    });

  } catch (error: any) {
    logger.error("Error generating Veo video", error);
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

