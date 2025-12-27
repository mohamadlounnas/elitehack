import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../utils/supabase.js";
import { stepOrchestrator } from "./stepOrchestrator.js";
import { logger } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY || "AIzaSyDoflplqtb52hrNrFB3OWZ7JRxdshCdGbo";

type ImageGenerationStreamCallback = (update: {
  type: "starting" | "generating" | "complete";
  asset?: { id: string; name: string };
  imageUrl?: string;
  progress: number;
  total: number;
}) => void;

/**
 * Image Generation Service
 * Uses Gemini 2.5 Flash Image model for generating images of factory assets
 */
class ImageGenerationService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
  }

  /**
   * Generates images with streaming updates
   */
  async generateImagesForProjectWithStream(
    projectId: string,
    onUpdate: ImageGenerationStreamCallback
  ): Promise<void> {
    try {
      // Find assets that need images
      const { data: assets } = await supabase
        .from("assets")
        .select("*")
        .eq("project_id", projectId)
        .eq("image_generated", false);

      if (!assets || assets.length === 0) {
        // All images generated, move to next step
        await stepOrchestrator.nextStep(projectId);
        return;
      }

      const total = assets.length;
      onUpdate({ type: "starting", progress: 0, total });

      // Process each asset
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        try {
          onUpdate({
            type: "generating",
            asset: { id: asset.id, name: asset.name },
            progress: i,
            total,
          });

          // Generate image using Gemini 2.5 Flash Image model
          // Prioritize appearance field which contains AI-generated detailed description
          const imageDescription = asset.appearance || asset.description || asset.name;
          const imageUrl = await this.generateImage(imageDescription);

          // Update asset with image
          await supabase
            .from("assets")
            .update({
              image_url: imageUrl,
              image_generated: true,
            })
            .eq("id", asset.id);

          onUpdate({
            type: "complete",
            asset: { id: asset.id, name: asset.name },
            imageUrl,
            progress: i + 1,
            total,
          });

          // Small delay between generations to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error generating image for asset ${asset.id}:`, error);
          // Continue with next asset even if one fails
        }
      }

      // Check if all assets are done
      const { data: remainingAssets } = await supabase
        .from("assets")
        .select("id")
        .eq("project_id", projectId)
        .eq("image_generated", false);

      if (!remainingAssets || remainingAssets.length === 0) {
        await supabase
          .from("projects")
          .update({ current_step: "assetsImagesGenerated" })
          .eq("id", projectId);
        await stepOrchestrator.nextStep(projectId);
      }
    } catch (error: any) {
      console.error("Error in imageGenerationService.generateImagesForProjectWithStream:", error);
      throw error;
    }
  }

  /**
   * Generates images for all assets in a project that haven't been generated yet
   * @param projectId - The project ID to generate images for
   */
  async generateImagesForProject(projectId: string): Promise<void> {
    try {
      logger.info("Starting image generation for project", { projectId });
      logger.db("SELECT", "assets", { projectId, image_generated: false });
      
      // Find assets that need images
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("*")
        .eq("project_id", projectId)
        .eq("image_generated", false);

      if (assetsError) {
        logger.error("Error fetching assets for image generation", assetsError, { projectId });
        throw assetsError;
      }

      if (!assets || assets.length === 0) {
        logger.info("No assets found that need image generation, checking all assets", { projectId });
        
        // Check if there are any assets at all
        const { data: allAssets } = await supabase
          .from("assets")
          .select("id, name, image_generated")
          .eq("project_id", projectId);
        
        logger.info("Total assets in project", { 
          projectId, 
          totalAssets: allAssets?.length || 0,
          assetsWithImages: allAssets?.filter(a => a.image_generated).length || 0,
          assetsWithoutImages: allAssets?.filter(a => !a.image_generated).length || 0
        });
        
        // All images generated, move to next step
        await stepOrchestrator.nextStep(projectId);
        return;
      }

      logger.info("Found assets needing image generation", { 
        projectId, 
        assetCount: assets.length,
        assetNames: assets.map(a => a.name)
      });

      // Process each asset
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        try {
          logger.info("Generating image for asset", { 
            projectId, 
            assetId: asset.id, 
            assetName: asset.name,
            progress: `${i + 1}/${assets.length}`
          });
          
          // Generate image using Gemini 2.5 Flash Image model
          // Prioritize appearance field which contains AI-generated detailed description
          const imageDescription = asset.appearance || asset.description || asset.name;
          logger.ai("Generating asset image", "gemini-2.5-flash-image", { 
            projectId, 
            assetId: asset.id,
            descriptionLength: imageDescription.length 
          });
          
          const imageUrl = await this.generateImage(imageDescription);

          logger.db("UPDATE", "assets", { projectId, assetId: asset.id });
          // Update asset with image
          await supabase
            .from("assets")
            .update({
              image_url: imageUrl,
              image_generated: true,
            })
            .eq("id", asset.id);

          logger.info("Asset image generated successfully", { 
            projectId, 
            assetId: asset.id,
            hasImageUrl: !!imageUrl
          });

          // Small delay between generations to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: any) {
          logger.error("Error generating image for asset", error, { 
            projectId, 
            assetId: asset.id,
            assetName: asset.name
          });
          // Continue with next asset even if one fails
        }
      }

      // Check if all assets are done
      logger.db("SELECT", "assets", { projectId, image_generated: false });
      const { data: remainingAssets } = await supabase
        .from("assets")
        .select("id")
        .eq("project_id", projectId)
        .eq("image_generated", false);

      if (!remainingAssets || remainingAssets.length === 0) {
        logger.info("All asset images generated, moving to next step", { projectId });
        logger.db("UPDATE", "projects", { projectId, newStep: "assetsImagesGenerated" });
        await supabase
          .from("projects")
          .update({ current_step: "assetsImagesGenerated" })
          .eq("id", projectId);
        await stepOrchestrator.nextStep(projectId);
      } else {
        logger.info("Some assets still need images", { 
          projectId, 
          remainingCount: remainingAssets.length 
        });
      }
    } catch (error: any) {
      logger.error("Error in imageGenerationService.generateImagesForProject", error, { projectId });
      throw error;
    }
  }

  /**
   * Generates an image using Gemini 2.5 Flash Image model
   * @param description - Description of the asset to generate an image for
   * @returns Data URL of the generated image (base64 encoded)
   */
  private async generateImage(description: string): Promise<string> {
    try {
      // Use Gemini 2.5 Flash Image model for image generation
      const model = this.genAI.getGenerativeModel({
        model: "models/gemini-2.5-flash-image",
      });

      // Create a prompt for image generation with white background requirement
      // The description parameter contains the AI-generated appearance description
      const prompt = `Generate a realistic, professional product image based on this exact description: "${description}"

CRITICAL REQUIREMENTS:
- The asset must be isolated on a pure white background (RGB: 255, 255, 255) with no shadows, gradients, or background elements
- The asset should be clearly visible and identifiable exactly as described in the appearance description
- Professional product photography style, similar to e-commerce product images with clean, isolated presentation
- High quality, detailed, and accurate representation matching the description precisely
- The image should be suitable for factory planning documentation and technical specifications
- Ensure every detail mentioned in the description is accurately represented in the image
- The asset must appear exactly as it would in real life based on the provided appearance description`;

      // Generate content (image)
      const result = await model.generateContent(prompt);
      const response = result.response;

      // Extract image data from response
      // The response structure: response.candidates[0].content.parts[].inlineData
      const candidates = response.candidates;
      
      if (candidates && candidates.length > 0) {
        const candidate = candidates[0];
        const content = candidate.content;
        const parts = content.parts;

        if (parts && parts.length > 0) {
          // Look for image data in the parts
          for (const part of parts) {
            // Check if this part contains inline image data
            if ("inlineData" in part && part.inlineData) {
              const imageData = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || "image/png";
              // Return as data URL for direct use in img tags
              return `data:${mimeType};base64,${imageData}`;
            }
            // Some models might return text with URLs
            if ("text" in part && part.text) {
              const urlMatch = part.text.match(/https?:\/\/[^\s]+/);
              if (urlMatch) {
                return urlMatch[0];
              }
            }
          }
        }
      }

      // Fallback: If image generation doesn't return expected format,
      // return a placeholder
      logger.warn("Image generation returned unexpected format, using placeholder", { descriptionLength: description.length });
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(description.substring(0, 50))}`;
    } catch (error: any) {
      logger.error("Error generating image with Gemini", error, { descriptionLength: description.length });
      // Fallback to placeholder on error
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(description.substring(0, 50))}`;
    }
  }
}

export const imageGenerationService = new ImageGenerationService();

