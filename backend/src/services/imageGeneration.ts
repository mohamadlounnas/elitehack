import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../utils/supabase.js";
import { stepOrchestrator } from "./stepOrchestrator.js";
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
          const imageUrl = await this.generateImage(
            asset.appearance || asset.description || asset.name
          );

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

      // Process each asset
      for (const asset of assets) {
        try {
          // Generate image using Gemini 2.5 Flash Image model
          const imageUrl = await this.generateImage(
            asset.appearance || asset.description || asset.name
          );

          // Update asset with image
          await supabase
            .from("assets")
            .update({
              image_url: imageUrl,
              image_generated: true,
            })
            .eq("id", asset.id);

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
      console.error("Error in imageGenerationService.generateImagesForProject:", error);
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

      // Create a prompt for image generation
      const prompt = `Generate a realistic, professional image of: ${description}. 
      The image should be suitable for factory planning documentation and show the asset clearly. 
      Make it detailed and accurate.`;

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
      console.warn("Image generation returned unexpected format, using placeholder");
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(description.substring(0, 50))}`;
    } catch (error: any) {
      console.error("Error generating image with Gemini:", error);
      // Fallback to placeholder on error
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(description.substring(0, 50))}`;
    }
  }
}

export const imageGenerationService = new ImageGenerationService();

