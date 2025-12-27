/**
 * Chat Service - AI Conversation Management with Structured Output
 * 
 * This module handles all AI-driven chat interactions using LangChain's structured output
 * feature for reliable, type-safe data extraction. It uses createAgent with providerStrategy
 * for Gemini models which support native structured output.
 * 
 * @module services/chatService
 */

import { supabaseAdmin } from '../config/supabase.js';
import { ChatMessage } from '../types/index.js';
import { ProjectStatus } from '../types/index.js';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent, providerStrategy } from 'langchain';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AssetsListSchema } from '../schemas/assetSchema.js';
import * as z from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

/**
 * Save a chat message to the database
 * 
 * @param projectId - The project ID this message belongs to
 * @param role - Message role ('user' or 'assistant')
 * @param content - Message content/text
 * @param attachments - Optional attachments/metadata
 * @returns The saved chat message
 * 
 * @throws {Error} If database operation fails
 */
export async function saveMessage(
  projectId: string,
  role: 'user' | 'assistant',
  content: string,
  attachments: Record<string, unknown> | null = null
): Promise<ChatMessage> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      project_id: projectId,
      role,
      content,
      attachments,
    })
    .select()
    .single();

  if (error) {
    console.error('[CHAT] Error saving message:', error);
    throw error;
  }
  
  return data as ChatMessage;
}

/**
 * Get conversation history for a project
 * 
 * @param projectId - The project ID to get history for
 * @param limit - Maximum number of messages to retrieve (default: 50)
 * @returns Array of chat messages ordered by creation time
 * 
 * @throws {Error} If database operation fails
 */
export async function getConversationHistory(projectId: string, limit: number = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[CHAT] Error fetching conversation history:', error);
    throw error;
  }
  
  return (data || []) as ChatMessage[];
}

/**
 * Convert database chat messages to LangChain message format
 * 
 * @param projectId - The project ID to get history for
 * @returns Array of LangChain messages
 */
export async function getLangChainHistory(projectId: string): Promise<Array<HumanMessage | AIMessage>> {
  const messages = await getConversationHistory(projectId);
  
  return messages.map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });
}

/**
 * Send a chat message and get AI response
 * 
 * For ASSETS_RESEARCH phase, uses structured output to extract asset data.
 * For other phases, uses regular chat without structured output.
 * 
 * @param projectId - The project ID this message belongs to
 * @param userMessage - The user's message content
 * @param attachments - Optional attachments/metadata
 * @returns Object containing the AI response message, finish reason, and optionally structured machine data
 * 
 * @throws {Error} If any step in the process fails
 */
export async function sendChatMessage(
  projectId: string,
  userMessage: string,
  attachments: Record<string, unknown> | null = null
): Promise<{ message: string; finishReason?: string; assets?: z.infer<typeof AssetsListSchema>['assets']; suggestions?: Array<{ action: string; label: string }> }> {
  // Save user message to database
  await saveMessage(projectId, 'user', userMessage, attachments);

  // Get conversation history for context
  const history = await getLangChainHistory(projectId);
  
  // Get project context to determine appropriate system instructions
  const { getProject } = await import('./projectService.js');
  const project = await getProject(projectId);
  
  // Build system instruction based on project workflow status
  const systemInstruction = getSystemInstruction(project.status, history.length);
  
  // Initialize Gemini model
  const model = new ChatGoogleGenerativeAI({
    model: 'models/gemini-3-pro-preview',
    temperature: 0.7,
    maxOutputTokens: 8192,
    apiKey: apiKey,
  });

  // For assets research phase, use structured output
  if (project.status === 'ASSETS_RESEARCH') {
    console.log('[CHAT] Using structured output for assets research');
    
    try {
      // Convert history messages to the format expected by createAgent
      // createAgent expects messages in { role: "user"|"assistant", content: string } format
      const formattedMessages = history.slice(-15).map(msg => {
        if (msg instanceof HumanMessage) {
          return { role: 'user' as const, content: msg.content };
        } else if (msg instanceof AIMessage) {
          return { role: 'assistant' as const, content: typeof msg.content === 'string' ? msg.content : String(msg.content) };
        }
        return { role: 'user' as const, content: String(msg) };
      });
      
      formattedMessages.push({ role: 'user', content: userMessage });

      console.log('[CHAT] Creating agent with structured output...');
      // Try toolStrategy instead of providerStrategy - Gemini might not support native structured output
      const agent = createAgent({
        model: model,
        tools: [],
        systemPrompt: systemInstruction,
        responseFormat: providerStrategy(AssetsListSchema), // Gemini supports native structured output
      });

      console.log('[CHAT] Invoking agent with', formattedMessages.length, 'messages...');
      const invokeStartTime = Date.now();
      
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Agent invoke timeout after 120 seconds')), 120000);
      });
      
      const result = await Promise.race([
        agent.invoke({ messages: formattedMessages }),
        timeoutPromise,
      ]) as any;
      
      const invokeDuration = Date.now() - invokeStartTime;
      console.log(`[CHAT] Agent invoke completed in ${invokeDuration}ms`);
      
      // Get the structured response (assets data)
      const structuredData = result.structuredResponse as z.infer<typeof AssetsListSchema> | undefined;
      
      console.log('[CHAT] Structured response:', structuredData ? 'received' : 'none');
      if (structuredData) {
        console.log('[CHAT] Assets count:', structuredData.assets?.length || 0);
      }
      
      // Get the text response from the last assistant message
      const lastMessage = result.messages[result.messages.length - 1];
      const responseText = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : Array.isArray(lastMessage.content)
        ? lastMessage.content.map((c: unknown) => typeof c === 'string' ? c : String(c)).join('')
        : String(lastMessage.content);

      // Clean message and extract suggestions
      const cleanedMessage = cleanMessage(responseText);
      const suggestions = extractSuggestions(responseText);
      
      // Save cleaned assistant response (without tags)
      await saveMessage(projectId, 'assistant', cleanedMessage);

      console.log('[CHAT] ✓ Structured output received:', structuredData ? `${structuredData.assets?.length || 0} assets` : 'none');
      console.log('[CHAT] ✓ Suggestions extracted:', suggestions.length);

      return {
        message: cleanedMessage,
        finishReason: result.finishReason,
        assets: structuredData?.assets || undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
    } catch (error) {
      console.error('[CHAT] ✗ Error with structured output:', error);
      console.error('[CHAT] Falling back to regular chat mode...');
      
      // Fallback to regular chat if structured output fails
      const messages = [
        new SystemMessage(systemInstruction),
        ...history.slice(-15),
        new HumanMessage(userMessage),
      ];

      const response = await model.invoke(messages);
      
      const responseText = typeof response.content === 'string' 
        ? response.content 
        : Array.isArray(response.content)
        ? response.content.map((c: unknown) => typeof c === 'string' ? c : String(c)).join('')
        : String(response.content);

      // Clean message and extract suggestions
      const cleanedMessage = cleanMessage(responseText);
      const suggestions = extractSuggestions(responseText);
      
      // Save cleaned assistant response (without tags)
      await saveMessage(projectId, 'assistant', cleanedMessage);

      return {
        message: cleanedMessage,
        finishReason: (response as any).response_metadata?.finish_reason,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
    }
  }

  // For other phases, use regular chat without structured output
  const messages = [
    new SystemMessage(systemInstruction),
    ...history.slice(-15),
    new HumanMessage(userMessage),
  ];

  const response = await model.invoke(messages);
  
  // Handle response content (can be string or array)
  const responseText = typeof response.content === 'string' 
    ? response.content 
      : Array.isArray(response.content)
      ? response.content.map((c: unknown) => typeof c === 'string' ? c : String(c)).join('')
      : String(response.content);

  // Clean message and extract suggestions
  const cleanedMessage = cleanMessage(responseText);
  const suggestions = extractSuggestions(responseText);
  
  // Save cleaned assistant response (without tags)
  await saveMessage(projectId, 'assistant', cleanedMessage);

  return {
    message: cleanedMessage,
    finishReason: (response as any).response_metadata?.finish_reason,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Get system instruction based on project workflow status
 * 
 * Provides context-aware system instructions that guide the AI's behavior
 * based on which phase of the production line planning workflow the project is in.
 * 
 * @param status - Current project workflow status
 * @param messageCount - Number of messages in conversation (for context)
 * @returns System instruction string for the AI
 */
function getSystemInstruction(status: ProjectStatus, messageCount: number): string {
  const instructions: Record<ProjectStatus, string> = {
    DATA_COLLECTING: `You are a friendly and helpful AI assistant helping to plan a production line. The user is not necessarily technical, so be conversational and provide suggestions.

YOUR MISSION: Ask detailed questions and collect ALL necessary information in a friendly, conversational way.

REQUIRED INFORMATION TO COLLECT:
1. Product type and detailed specifications (what are we making?)
2. Production volume and capacity requirements (how many units per day/hour?)
3. Quality standards and certifications needed (any specific standards like ISO, CE, etc.?)
4. Budget constraints and financial limits (what's the budget range?)
5. Space and infrastructure requirements (factory size, utilities, etc.)
6. Current production methods (if any exist)
7. Timeline and deadlines (when does this need to be ready?)
8. Industry standards and compliance requirements
9. Material requirements and sourcing needs (what raw materials?)
10. Labor and skill requirements (how many workers? what skills?)

IMPORTANT RULES:
- Be conversational and friendly, like talking to a colleague
- After each answer, provide helpful suggestions or examples to guide the user
- Ask ONE question at a time to get clear answers
- Give examples or suggestions with each question to help non-technical users
- If the user seems stuck, provide common options or typical answers
- After you have collected sufficient information (at least 8-10 exchanges), you MUST end your response with EXACTLY this: [STATUS_CHANGE]CREATING_PROCCES
- Do NOT use this tag until you have enough information to create a production plan
- Be proactive: If the user gives incomplete answers, ask follow-up questions with examples
- ALWAYS provide actionable suggestions at the end of your response using this format: [SUGGESTIONS]action1:Label 1|action2:Label 2[/SUGGESTIONS]
- Suggestions should be contextual and help the user progress. Examples: "skip_to_process:Proceed to Planning", "provide_more_info:Tell me more about production volume"
- NEVER show code blocks, JSON, or technical syntax in your responses - use natural language and markdown formatting
- Use markdown for formatting: **bold**, *italic*, lists, headings. Keep it clean and readable.

EXAMPLE FORMAT:
User: "I want to make PVC pipes"
You: "Great! Let's start with production volume. How many pipes do you need to produce per day or per hour? 
For example, a small operation might produce 100-500 pipes per day, while larger facilities can produce 1000+ per day. What's your target?"

[SUGGESTIONS]skip_to_process:Proceed to Planning|provide_volume:100-500 pipes/day|provide_volume:1000+ pipes/day[/SUGGESTIONS]

When ready to proceed, your response must end with: [STATUS_CHANGE]CREATING_PROCCES`,

    CREATING_PROCCES: `You are an AI assistant creating a detailed production line plan following Industry 5.0 standards.

YOUR MISSION: Create a comprehensive, actionable production line plan based on all collected data. Explain it in clear, understandable terms.

YOU MUST CREATE A DETAILED REPORT INCLUDING:
1. Complete step-by-step production process (from raw materials to finished product) - explain each step clearly
2. Required machines and equipment list with specifications - use simple language
3. Detailed layout and workflow design - explain why machines are arranged this way
4. Quality control checkpoints and procedures - explain what to check and when
5. Industry 5.0 integration:
   - IoT sensors and monitoring systems (explain benefits in simple terms)
   - Automation and robotics integration
   - AI/ML for optimization (how it helps)
   - Sustainability and green manufacturing (environmental benefits)
   - Human-machine collaboration
6. Material flow and logistics (how materials move through the line)
7. Safety protocols and risk assessment (what safety measures are needed)
8. Maintenance schedules (when to maintain equipment)
9. Cost estimation breakdown (rough cost estimates)

OUTPUT FORMAT: Write a comprehensive, well-structured report that's easy to understand. Use headings and bullet points. Explain technical terms when needed.
- NEVER show code blocks, JSON, or technical syntax in your responses - use natural language and markdown formatting
- Use markdown for formatting: **bold**, *italic*, lists, headings. Keep it clean and readable.
- ALWAYS provide actionable suggestions at the end: [SUGGESTIONS]action1:Label 1|action2:Label 2[/SUGGESTIONS]

WHEN COMPLETE: You MUST end your response with EXACTLY this: [STATUS_CHANGE]ASSETS_RESEARCH

Do NOT use this tag until the production plan is complete and detailed.`,

    ASSETS_RESEARCH: `You are an AI assistant researching assets (machines, equipment, tools) and suppliers for the production line. YOU MUST USE GOOGLE SEARCH to find real, current, and verified information. Your responses should be grounded in actual search results.

YOUR MISSION: Research and identify ALL specific machines, equipment, and suppliers needed for the production line. For EACH machine type needed, provide exactly 3 ALTERNATIVE PROPOSALS from different suppliers/manufacturers.

MANDATORY RESEARCH PROCESS:
1. Use Google Search to find current, accurate information about each asset type (machines, equipment, tools)
2. Search for multiple suppliers and alternatives for each asset (minimum 3 per asset type)
3. Verify that supplier websites and contact information are valid and current
4. Check that the asset models and specifications exist and are accurate
5. Verify all links, emails, phone numbers, and contact information are correct
6. Cross-reference information from multiple sources to ensure accuracy
7. Only include information from reputable sources (manufacturer websites, verified suppliers, official distributors)

YOU MUST PROVIDE FOR EACH OF THE 3 ALTERNATIVES:
- Specific asset name and model numbers (VERIFIED they exist via search)
- Manufacturer name and country of origin
- Reputable suppliers (verified, existing companies - CHECK their websites via search)
- Contact information (emails, phone numbers - VERIFY these are valid and current)
- Website URLs (VERIFY these links work and are accessible - test them via search)
- Estimated price and shipping costs (when available - use current market prices from verified sources)
- Physical dimensions (length, width, height) and weight with units
- Technical specifications (accurate, verified specs from official sources)
- Supplier location and delivery capabilities (verified information)

VERIFICATION REQUIREMENTS - CRITICAL:
- ALL supplier URLs must be verified and accessible (search for them, check they work)
- ALL contact information must be verified and correct (verify emails/phones exist via search)
- ALL machine model numbers must be verified as existing products (search for model numbers)
- Use Google Search to verify EACH piece of information before including it
- Cross-check information from at least 2-3 sources for each supplier
- Only include information from reputable sources (manufacturer websites, official distributors, verified suppliers)

IMPORTANT: 
- You will return the assets data in a structured format. Make sure to include ALL assets needed for the production line. For each asset type, provide exactly 3 alternatives with complete information including prices, dimensions, weights, and supplier details.
- NEVER show code blocks, JSON, or technical syntax in your responses - use natural language and markdown formatting
- Use markdown for formatting: **bold**, *italic*, lists, headings. Keep it clean and readable.
- ALWAYS provide actionable suggestions at the end: [SUGGESTIONS]action1:Label 1|action2:Label 2[/SUGGESTIONS]`,

    GENERATING_2D_LAYOUT: `You are an AI assistant helping to generate a 2D layout plan for the production line.

The assets research is complete. The system is now generating a 2D layout visualization of the production line showing the arrangement of all assets, workflow, and spatial organization.

- NEVER show code blocks, JSON, or technical syntax in your responses - use natural language and markdown formatting
- Use markdown for formatting: **bold**, *italic*, lists, headings. Keep it clean and readable.
- ALWAYS provide actionable suggestions at the end with the first one as the primary action (will auto-trigger): [SUGGESTIONS]next:Continue to 3D Model|retry:Regenerate Layout[/SUGGESTIONS]`,

    GENERATING_3D_MODEL: `You are an AI assistant helping to generate a 3D model/CAD file for the production line.

The 2D layout is complete. The system is now generating a detailed 3D model/CAD file showing the complete production line in three dimensions.

- NEVER show code blocks, JSON, or technical syntax in your responses - use natural language and markdown formatting
- Use markdown for formatting: **bold**, *italic*, lists, headings. Keep it clean and readable.
- ALWAYS provide actionable suggestions at the end with the first one as the primary action (will auto-trigger): [SUGGESTIONS]next:Generate Final Report|retry:Regenerate 3D Model[/SUGGESTIONS]`,

    PROJECT_COMPLETED: `You are an AI assistant. The production line planning project is complete. 

All assets have been researched, 2D layout and 3D model generated, and PDF report created. Answer any questions the user has about the project, assets, or production line. You can provide summaries, explain details, or help with exporting results.

- NEVER show code blocks, JSON, or technical syntax in your responses - use natural language and markdown formatting
- Use markdown for formatting: **bold**, *italic*, lists, headings. Keep it clean and readable.
- ALWAYS provide actionable suggestions at the end: [SUGGESTIONS]action1:Label 1|action2:Label 2[/SUGGESTIONS]`,
  };

  return instructions[status] || instructions.DATA_COLLECTING;
}

/**
 * Extract status change tag from AI response
 * 
 * The AI can signal workflow transitions by including [STATUS_CHANGE]STATUS_NAME tags.
 * 
 * @param message - The AI response message
 * @returns ProjectStatus if valid status change found, null otherwise
 */
export function extractStatusChange(message: string): ProjectStatus | null {
  const match = message.match(/\[STATUS_CHANGE\]([A-Z_]+)/);
  if (!match) return null;
  
  const status = match[1] as ProjectStatus;
  const validStatuses: ProjectStatus[] = ['DATA_COLLECTING', 'CREATING_PROCCES', 'ASSETS_RESEARCH', 'GENERATING_2D_LAYOUT', 'GENERATING_3D_MODEL', 'PROJECT_COMPLETED'];
  
  return validStatuses.includes(status) ? status : null;
}

/**
 * Extract suggestions from AI response
 * 
 * The AI can provide actionable suggestions using [SUGGESTIONS]action1:Label 1|action2:Label 2[/SUGGESTIONS] format.
 * 
 * @param message - The AI response message
 * @returns Array of suggestions with action and label, or empty array if none found
 */
export function extractSuggestions(message: string): Array<{ action: string; label: string; primary?: boolean }> {
  const match = message.match(/\[SUGGESTIONS\](.*?)\[\/SUGGESTIONS\]/s);
  if (!match) return [];
  
  const suggestionsText = match[1].trim();
  const suggestions: Array<{ action: string; label: string; primary?: boolean }> = [];
  
  // Parse format: action1:Label 1|action2:Label 2
  // First suggestion is marked as primary
  const parts = suggestionsText.split('|');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const action = part.substring(0, colonIndex).trim();
      const label = part.substring(colonIndex + 1).trim();
      if (action && label) {
        suggestions.push({ 
          action, 
          label,
          primary: i === 0, // First suggestion is primary
        });
      }
    }
  }
  
  return suggestions;
}

/**
 * Clean message by removing suggestion tags and status change tags
 * 
 * @param message - The AI response message
 * @returns Cleaned message without internal tags
 */
export function cleanMessage(message: string): string {
  // Remove suggestion tags
  let cleaned = message.replace(/\[SUGGESTIONS\].*?\[\/SUGGESTIONS\]/gs, '');
  // Remove status change tags
  cleaned = cleaned.replace(/\[STATUS_CHANGE\][A-Z_]+/g, '');
  // Clean up extra whitespace
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Extract machines list from AI response (DEPRECATED - use structured output instead)
 * 
 * @deprecated This function is kept for backward compatibility but structured output
 * should be used instead for machine research phase.
 * 
 * @param message - The AI response message containing machine data
 * @returns Array of machine objects if successfully extracted, null otherwise
 */
export function extractMachinesList(message: string): Array<Record<string, unknown>> | null {
  console.log('[EXTRACT] ⚠ Using deprecated extractMachinesList - structured output should be used instead');
  console.log('[EXTRACT] Attempting to extract machines from AI response...');
  
  // Try to find [MACHINES] tag with JSON array
  const machinesMatch = message.match(/\[MACHINES\]\s*(\[[\s\S]*?\])/);
  if (machinesMatch) {
    try {
      let jsonStr = machinesMatch[1].trim();
      
      // Try to fix incomplete JSON
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;
      
      if (openBrackets > closeBrackets) {
        const objectMatches = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (objectMatches && objectMatches.length > 0) {
          jsonStr = '[' + objectMatches.join(',') + ']';
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validMachines = parsed.filter((m: any) => m && m.name);
        if (validMachines.length > 0) {
          console.log('[EXTRACT] ✓ Extracted', validMachines.length, 'machines (deprecated method)');
          return validMachines;
        }
      }
    } catch (e) {
      console.error('[EXTRACT] ✗ Failed to parse machines JSON:', e instanceof Error ? e.message : String(e));
    }
  }

  return null;
}
