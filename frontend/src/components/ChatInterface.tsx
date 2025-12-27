import { useState, useRef, useEffect } from "react";
import { Button, Textarea, Text, IconButton, Badge } from "@medusajs/ui";
import { PaperClip, ArrowRight, XMark } from "@medusajs/icons";
import type { ProjectMessage } from "../types";

interface ChatInterfaceProps {
  projectId: string;
  messages: ProjectMessage[];
  onSendMessage: (content: string, files?: File[]) => Promise<void>;
  onStartPlanning: () => void;
  isLoading?: boolean;
}

export function ChatInterface({ projectId, messages, onSendMessage, onStartPlanning, isLoading = false }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;
    const content = input.trim();
    const files = [...selectedFiles];
    setInput("");
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await onSendMessage(content, files.length > 0 ? files : undefined);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Text className="text-ui-fg-subtle">Start a conversation about your factory planning needs...</Text>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-ui-bg-interactive text-ui-fg-on-color"
                  : "bg-ui-bg-subtle text-ui-fg-base"
              }`}
            >
              <Text className="whitespace-pre-wrap">{message.content}</Text>
              {message.attachments?.length > 0 && (
                <div className="flex flex-col gap-y-1 mt-2">
                  {message.attachments.map((att, idx) => (
                    <Text key={idx} size="small" className="opacity-75">📎 {att.filename}</Text>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-ui-bg-subtle rounded-lg p-3">
              <div className="flex gap-x-1">
                <div className="w-2 h-2 bg-ui-fg-muted rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-ui-fg-muted rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-ui-fg-muted rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {selectedFiles.length > 0 && (
        <div className="px-3 py-2 border-t">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <Badge key={index} className="flex items-center gap-x-2">
                <Text size="small">{file.name}</Text>
                <IconButton variant="transparent" size="small" onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))}>
                  <XMark />
                </IconButton>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="border-t p-3 flex flex-col gap-y-3">
        <div className="flex gap-x-2 items-end">
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" />
          <IconButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <PaperClip />
          </IconButton>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 min-h-[60px] max-h-[200px] resize-none"
            rows={2}
          />
          <IconButton onClick={handleSend} disabled={isLoading}>
            <ArrowRight />
          </IconButton>
        </div>
        <Button onClick={onStartPlanning} variant="primary" className="w-full">
          Start Planning
        </Button>
      </div>
    </div>
  );
}
