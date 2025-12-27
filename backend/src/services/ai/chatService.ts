import { createNanoLLM } from "../../utils/langchain.js";
import { supabase } from "../../utils/supabase.js";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

class ChatService {
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

      // Build context from messages
      const systemPrompt = `You are an AI assistant helping with factory planning. 
Your role is to gather useful information from the user about their factory planning needs, 
but be conversational and not too intrusive. Ask clarifying questions when needed, but keep 
the conversation engaging and friendly.

You can ask about:
- Product specifications
- Production requirements
- Budget constraints
- Timeline
- Compliance requirements
- Materials needed
- Production processes

Be helpful, concise, and professional.`;

      const conversationMessages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
      ];

      if (conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          if (msg.role === "user") {
            // Only include text content from user messages (skip images for history)
            let userContent = msg.content;
            if (typeof userContent === 'string') {
              try {
                const parsed = JSON.parse(userContent);
                if (Array.isArray(parsed)) {
                  // Extract only text parts
                  userContent = parsed
                    .filter((p: any) => p.type === "text" && p.text)
                    .map((p: any) => p.text)
                    .join("\n");
                }
              } catch {
                // Not JSON, use as-is
              }
            }
            conversationMessages.push(new HumanMessage(userContent));
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
            conversationMessages.push(new HumanMessage(`Assistant: ${assistantContent}`));
          }
        }
      }

      conversationMessages.push(new HumanMessage(userContent));

      const response = await llm.invoke(conversationMessages);

      // Handle multi-part responses (text + images)
      const content = response.content;
      
      // If content is an array (multi-part response), convert to structured format
      if (Array.isArray(content)) {
        return JSON.stringify(content);
      }
      
      // If content is an object with parts, extract and format
      if (typeof content === 'object' && content !== null && 'parts' in content) {
        return JSON.stringify(content.parts);
      }
      
      // Otherwise return as string
      return typeof content === 'string' ? content : JSON.stringify(content);
    } catch (error: any) {
      console.error("Error in chatService.processMessage:", error);
      
      // Provide more specific error messages
      if (error.message?.includes("token") || error.message?.includes("exceed")) {
        return "I apologize, but the conversation has become too long. Please start a new conversation or summarize your requirements more concisely.";
      }
      
      if (error.message?.includes("rate limit") || error.status === 429) {
        return "I'm receiving too many requests right now. Please wait a moment and try again.";
      }
      
      // Fallback response if AI fails
      return "I apologize, but I'm having trouble processing your message right now. Could you please rephrase your question?";
    }
  }
}

export const chatService = new ChatService();

