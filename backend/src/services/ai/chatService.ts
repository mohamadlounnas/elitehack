import { createNanoLLM } from "../../utils/langchain.js";
import { supabase } from "../../utils/supabase.js";
import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { ELITE_CHAT_CONSULTANT_PROMPT } from "./prompts/eliteSystemPrompts.js";
import { logger } from "../../utils/logger.js";

// Supported file types for Gemini
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const SUPPORTED_DOCUMENT_TYPES = ["application/pdf"];
const SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_DOCUMENT_TYPES];

// LangChain standard content block types
interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image_url";
  image_url: string | { url: string };
}

interface FileContent {
  type: "file";
  source_type: "base64";
  data: string;
  mime_type: string;
}

type ContentPart = TextContent | ImageContent | FileContent;

class ChatService {
  /**
   * Build multi-modal content parts from text and files
   * Uses LangChain standard format for multimodal content
   */
  private buildContentParts(text: string, files: Express.Multer.File[]): ContentPart[] {
    const parts: ContentPart[] = [];

    // Add file parts first (Gemini processes them in order)
    for (const file of files) {
      if (!SUPPORTED_TYPES.includes(file.mimetype)) {
        logger.warn("Unsupported file type, skipping", { 
          filename: file.originalname, 
          mimetype: file.mimetype 
        });
        continue;
      }

      const base64Data = file.buffer.toString("base64");

      if (SUPPORTED_IMAGE_TYPES.includes(file.mimetype)) {
        // Image format - use data URL for LangChain Google Generative AI
        const dataUrl = `data:${file.mimetype};base64,${base64Data}`;
        parts.push({
          type: "image_url",
          image_url: dataUrl,
        });
        logger.info("Added image to message", { 
          filename: file.originalname, 
          size: file.size 
        });
      } else if (SUPPORTED_DOCUMENT_TYPES.includes(file.mimetype)) {
        // PDF/Document format - use LangChain standard file content block
        parts.push({
          type: "file",
          source_type: "base64",
          data: base64Data,
          mime_type: file.mimetype,
        });
        logger.info("Added document to message", { 
          filename: file.originalname, 
          mimetype: file.mimetype,
          size: file.size 
        });
      }
    }

    // Add text part last
    if (text) {
      parts.push({
        type: "text",
        text: text,
      });
    }

    return parts;
  }

  async processMessage(projectId: string, userContent: string, files: Express.Multer.File[]): Promise<string> {
    try {
      // Get chat history (limit to last 8 messages to avoid token limits)
      // We extract only text from previous messages to reduce token usage
      const { data: messages } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(8);
      
      // Reverse to get chronological order
      const conversationHistory = messages ? [...messages].reverse() : [];

      const llm = createNanoLLM();

      // Build context from messages - Use Elite Consultant Prompt
      const systemPrompt = ELITE_CHAT_CONSULTANT_PROMPT;

      const conversationMessages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
      ];

      if (conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          if (msg.role === "user") {
            // Only include text content from user messages (skip images for history)
            let msgContent = msg.content;
            if (typeof msgContent === 'string') {
              try {
                const parsed = JSON.parse(msgContent);
                if (Array.isArray(parsed)) {
                  // Extract only text parts
                  msgContent = parsed
                    .filter((p: any) => p.type === "text" && p.text)
                    .map((p: any) => p.text)
                    .join("\n");
                }
              } catch {
                // Not JSON, use as-is
              }
            }
            conversationMessages.push(new HumanMessage(msgContent));
          } else {
            // Only include text content from assistant messages (skip images for history)
            let assistantContent = msg.content;
            if (typeof assistantContent === 'string') {
              try {
                const parsed = JSON.parse(assistantContent);
                if (Array.isArray(parsed)) {
                  // Extract only text parts
                  assistantContent = parsed
                    .filter((p: any) => p.type === "text" && p.text)
                    .map((p: any) => p.text)
                    .join("\n");
                }
              } catch {
                // Not JSON, use as-is
              }
            }
            conversationMessages.push(new AIMessage(assistantContent));
          }
        }
      }

      // Build the current user message with files if present
      if (files && files.length > 0) {
        const contentParts = this.buildContentParts(userContent, files);
        logger.info("Sending multi-modal message to Gemini", { 
          projectId, 
          textLength: userContent.length,
          fileCount: files.length,
          partCount: contentParts.length 
        });
        conversationMessages.push(new HumanMessage({ content: contentParts as any }));
      } else {
        conversationMessages.push(new HumanMessage(userContent));
      }

      const response = await llm.invoke(conversationMessages);

      // Handle multi-part responses (text + images)
      const content = response.content;
      
      // If content is an array (multi-part response), convert to structured format
      if (Array.isArray(content)) {
        return JSON.stringify(content);
      }
      
      // If content is an object with parts, extract and format
      if (typeof content === 'object' && content !== null && 'parts' in (content as Record<string, unknown>)) {
        return JSON.stringify((content as Record<string, unknown>).parts);
      }
      
      // Otherwise return as string
      return typeof content === 'string' ? content : JSON.stringify(content);
    } catch (error: any) {
      console.error("Error in chatService.processMessage:", error);
      
      // Provide more specific error messages
      if (error.message?.includes("token") || error.message?.includes("exceed")) {
        return "I apologize, but the conversation has become quite extensive. To continue effectively, I recommend we focus on the most critical requirements. Could you summarize your key project objectives?";
      }
      
      if (error.message?.includes("rate limit") || error.status === 429) {
        return "Our system is experiencing high demand. Please allow a moment before continuing our consultation.";
      }
      
      // Fallback response if AI fails - maintain professional tone
      return "I apologize for the interruption. As your industrial strategy consultant, I want to ensure we capture all requirements accurately. Could you please restate your key project needs?";
    }
  }
}

export const chatService = new ChatService();
