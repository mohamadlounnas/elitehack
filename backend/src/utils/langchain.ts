import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY || "AIzaSyDoflplqtb52hrNrFB3OWZ7JRxdshCdGbo";

if (!geminiApiKey) {
  console.warn("GEMINI_API_KEY not set. AI features will not work.");
}

/**
 * Creates a Google Gemini LLM instance for AI processing
 * Uses Gemini 3 Pro Preview for complex tasks (planning, analysis, negotiations)
 * According to requirements: Gemini 3 Pro for complex reasoning
 */
export const createLLM = () => {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new ChatGoogleGenerativeAI({
    model: "models/gemini-3-pro-preview",
    temperature: 0.7,
    apiKey: geminiApiKey,
  });
};

/**
 * Creates a lightweight Gemini instance for quick responses
 * Useful for chat interactions and real-time operations
 * Uses Gemini 2.5 Flash (text-only) for chat - faster and has higher token limits
 */
export const createNanoLLM = () => {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new ChatGoogleGenerativeAI({
    model: "models/gemini-3-pro-preview",
    temperature: 0.5,
    apiKey: geminiApiKey,
  });
};

/**
 * Creates a Gemini instance for image generation
 * Uses Gemini 2.5 Flash Image model for multi-modal tasks
 */
export const createImageLLM = () => {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new ChatGoogleGenerativeAI({
    model: "models/gemini-3-pro-image-preview",
    temperature: 0.5,
    apiKey: geminiApiKey,
  });
};

