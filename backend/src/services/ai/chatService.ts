import { createNanoLLM } from "../../utils/langchain.js";
import { supabase } from "../../utils/supabase.js";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

class ChatService {
  async processMessage(projectId: string, userContent: string, files: Express.Multer.File[]): Promise<string> {
    try {
      // Get chat history
      const { data: messages } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(20);

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

      if (messages) {
        for (const msg of messages) {
          if (msg.role === "user") {
            conversationMessages.push(new HumanMessage(msg.content));
          } else {
            conversationMessages.push(new HumanMessage(`Assistant: ${msg.content}`));
          }
        }
      }

      conversationMessages.push(new HumanMessage(userContent));

      const response = await llm.invoke(conversationMessages);

      return response.content as string;
    } catch (error: any) {
      console.error("Error in chatService.processMessage:", error);
      // Fallback response if AI fails
      return "I apologize, but I'm having trouble processing your message right now. Could you please rephrase your question?";
    }
  }
}

export const chatService = new ChatService();

