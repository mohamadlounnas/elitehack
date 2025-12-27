import React from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import type { ProjectMessage } from "../../types";

interface ChatResponseViewProps {
  messages: ProjectMessage[];
}

/**
 * Displays the initial chat conversation
 */
export function ChatResponseView({ messages }: ChatResponseViewProps) {
  if (messages.length === 0) return null;

  const userMessages = messages.filter(m => m.role === "user");
  const assistantMessages = messages.filter(m => m.role === "assistant");

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center gap-2 mb-4">
        <Heading level="h3" className="text-ui-fg-base font-semibold">Initial Requirements</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle">Step: Chat</Text>
        <Badge color="blue" size="small">{messages.length} messages</Badge>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {messages.map((message, idx) => (
          <div 
            key={message.id || idx} 
            className={`p-3 rounded-lg ${
              message.role === "user" 
                ? "bg-ui-bg-interactive text-ui-fg-on-interactive ml-8" 
                : "bg-ui-bg-subtle text-ui-fg-subtle mr-8"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Text size="xsmall" weight="plus">
                {message.role === "user" ? "You" : "Assistant"}
              </Text>
              {message.created_at && (
                <Text size="xsmall" className="opacity-70">
                  {new Date(message.created_at).toLocaleString()}
                </Text>
              )}
            </div>
            <Text size="small" className="whitespace-pre-wrap">
              {message.content}
            </Text>
            {message.files && message.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.files.map((file: any, fileIdx: number) => (
                  <Badge key={fileIdx} color="gray" size="small">
                    📎 {file.filename || "File"}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Container>
  );
}

