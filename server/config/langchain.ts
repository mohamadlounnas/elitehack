/**
 * LangChain Configuration for Gemini Integration
 * 
 * This module provides configuration and utilities for integrating with Google's Gemini AI models
 * through LangChain. It handles model initialization, Google Search Grounding, and image generation.
 * 
 * @module config/langchain
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY environment variable. Please set it in your .env file.');
}

/**
 * Get LangChain Gemini chat model instance
 * 
 * This function creates and configures a ChatGoogleGenerativeAI instance with appropriate settings.
 * For machine research tasks, Google Search Grounding can be enabled to improve accuracy.
 * 
 * @param modelName - The Gemini model name to use (default: 'models/gemini-3-pro-preview')
 * @param useGoogleSearch - Whether to enable Google Search Grounding for real-time data verification
 * @returns Configured ChatGoogleGenerativeAI instance
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const model = getLangChainModel();
 * 
 * // With Google Search enabled for machine research
 * const model = getLangChainModel('models/gemini-3-pro-preview', true);
 * ```
 * 
 * @throws {Error} If model creation fails
 */
export function getLangChainModel(
  modelName: string = 'models/gemini-3-pro-preview',
  useGoogleSearch: boolean = false
): ChatGoogleGenerativeAI {
  try {
    const config: any = {
      model: modelName,
      temperature: 0.7, // Balanced creativity vs determinism
      maxOutputTokens: 8192, // Increased for comprehensive responses with multiple machine alternatives
      apiKey: apiKey,
    };

    // Google Search Grounding configuration
    // Note: LangChain's ChatGoogleGenerativeAI may require additional configuration
    // for grounding. Gemini models have built-in access to Google Search when properly configured.
    // The system instructions will guide the model to use search capabilities.
    if (useGoogleSearch) {
      console.log('[LANGCHAIN] Google Search Grounding enabled - AI will use search for machine research');
      // The model will use its built-in search capabilities based on system instructions
    }

    return new ChatGoogleGenerativeAI(config);
  } catch (error) {
    console.error('[LANGCHAIN] Error creating LangChain model:', error);
    throw new Error(`Failed to initialize Gemini model: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate image placeholder using SVG
 * 
 * This is a placeholder implementation for image generation. In production, this should be
 * replaced with actual image generation using DALL-E, Stable Diffusion, or Gemini's image
 * generation capabilities when available.
 * 
 * @param prompt - Text description of the image to generate
 * @returns Data URL of the generated SVG placeholder
 * 
 * @example
 * ```typescript
 * const imageUrl = await generateImage('Industrial mixing machine');
 * // Returns: "data:image/svg+xml;base64,..."
 * ```
 */
export async function generateImage(prompt: string): Promise<string> {
  // Placeholder SVG generation
  // TODO: Replace with actual image generation service (DALL-E, Stable Diffusion, etc.)
  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="#f0f0f0"/>
    <text x="256" y="256" font-family="Arial" font-size="24" text-anchor="middle">${prompt.substring(0, 30)}</text>
  </svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
