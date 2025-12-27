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
            {(() => {
              // Handle multi-part content (text + images)
              let contentParts: Array<{ type: string; text?: string; inlineData?: any }> = [];
              
              if (typeof message.content === 'string') {
                // Try to parse as JSON (multi-part response)
                try {
                  const parsed = JSON.parse(message.content);
                  if (Array.isArray(parsed)) {
                    contentParts = parsed;
                  } else {
                    contentParts = [{ type: "text", text: message.content }];
                  }
                } catch {
                  // Not JSON, treat as plain text
                  contentParts = [{ type: "text", text: message.content }];
                }
              } else if (Array.isArray(message.content)) {
                contentParts = message.content;
              } else {
                contentParts = [{ type: "text", text: String(message.content) }];
              }

              return (
                <div className="flex flex-col gap-y-2">
                  {contentParts.map((part, idx) => {
                    if (part.type === "text" && part.text) {
                      return (
                        <Text key={idx} size="small" className="whitespace-pre-wrap">
                          {part.text}
                        </Text>
                      );
                    } else if (part.type === "inlineData" && part.inlineData) {
                      const { mimeType, data } = part.inlineData;
                      const imageUrl = `data:${mimeType};base64,${data}`;
                      return (
                        <div key={idx} className="mt-2 relative group">
                          <img 
                            src={imageUrl} 
                            alt="AI generated image" 
                            className="max-w-full h-auto rounded border border-ui-border-base cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ maxHeight: "300px" }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'text-xs text-ui-fg-subtle p-2 bg-ui-bg-subtle rounded';
                              errorDiv.textContent = 'Failed to load image';
                              target.parentElement?.appendChild(errorDiv);
                            }}
                            onClick={() => {
                              window.open(imageUrl, '_blank');
                            }}
                          />
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Badge color="grey" size="xsmall" className="cursor-pointer">
                              View full
                            </Badge>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })()}
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

