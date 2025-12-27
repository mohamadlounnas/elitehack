/**
 * Zod Schema for Structured AI Response
 * All AI responses should include suggestions for next actions
 */

import * as z from 'zod';

/**
 * Action suggestion schema
 */
export const ActionSuggestionSchema = z.object({
  action: z.string().describe('Action identifier (e.g., "next_step", "retry", "review")'),
  label: z.string().describe('Human-readable label for the action button'),
  primary: z.boolean().optional().describe('Whether this is the primary action (auto-triggers after 5s)'),
  autoTriggerAfter: z.number().optional().describe('Seconds to wait before auto-triggering (default: 5 for primary actions)'),
});

/**
 * Structured AI response schema
 * All AI responses should follow this format
 */
export const StructuredResponseSchema = z.object({
  message: z.string().describe('The main response message/content'),
  suggestions: z.array(ActionSuggestionSchema).min(0).describe('Array of suggested actions the user can take'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata (e.g., generated URLs, progress info)'),
});

