import { useState, useRef, useEffect, DragEvent, useCallback } from "react";
import { Button, Textarea, Text, IconButton, Badge, clx } from "@medusajs/ui";
import { 
  PaperClip, 
  ArrowUpMini, 
  XMarkMini, 
  DocumentText, 
  Photo, 
  Star,
  BuildingStorefront,
  ChatBubble,
  InformationCircleSolid
} from "@medusajs/icons";
import type { ProjectMessage } from "../types";

interface ChatInterfaceProps {
  projectId: string;
  messages: ProjectMessage[];
  onSendMessage: (content: string, files?: File[]) => Promise<void>;
  onStartPlanning: () => void;
  isLoading?: boolean;
}

interface FilePreview {
  file: File;
  preview: string | null;
  type: "image" | "pdf" | "other";
}

const SUGGESTION_PROMPTS = [
  "I want to build a solar panel manufacturing factory",
  "Design a food processing plant for olive oil",
  "Create a pharmaceutical packaging facility",
  "Plan an automotive parts assembly factory",
];

export function ChatInterface({ 
  projectId, 
  messages, 
  onSendMessage, 
  onStartPlanning, 
  isLoading = false 
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Check if we have any messages to show "Start Building"
  const hasMessages = messages.length > 0;
  const hasUserMessage = messages.some(m => m.role === "user");

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hide welcome when first message is sent
  useEffect(() => {
    if (hasMessages) {
      setShowWelcome(false);
    }
  }, [hasMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newPreviews: FilePreview[] = [];

    fileArray.forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";
      
      const filePreview: FilePreview = {
        file,
        preview: null,
        type: isImage ? "image" : isPDF ? "pdf" : "other",
      };

      if (isImage) {
        filePreview.preview = URL.createObjectURL(file);
      }

      newPreviews.push(filePreview);
    });

    setSelectedFiles((prev) => [...prev, ...newPreviews]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      // Revoke object URL to prevent memory leaks
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;
    
    const content = input.trim();
    const files = selectedFiles.map((fp) => fp.file);
    
    // Clear input immediately for better UX
    setInput("");
    
    // Cleanup previews
    selectedFiles.forEach((fp) => {
      if (fp.preview) URL.revokeObjectURL(fp.preview);
    });
    setSelectedFiles([]);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    await onSendMessage(content, files.length > 0 ? files : undefined);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  const renderMessageContent = (message: ProjectMessage) => {
    let contentParts: Array<{ type: string; text?: string; inlineData?: any }> = [];
    
    if (typeof message.content === "string") {
      try {
        const parsed = JSON.parse(message.content);
        if (Array.isArray(parsed)) {
          contentParts = parsed;
        } else {
          contentParts = [{ type: "text", text: message.content }];
        }
      } catch {
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
              <Text key={idx} className="whitespace-pre-wrap leading-relaxed">
                {part.text}
              </Text>
            );
          } else if (part.type === "inlineData" && part.inlineData) {
            const { mimeType, data } = part.inlineData;
            const imageUrl = `data:${mimeType};base64,${data}`;
            return (
              <div key={idx} className="mt-2">
                <img 
                  src={imageUrl} 
                  alt="AI generated" 
                  className="max-w-full h-auto rounded-lg border border-ui-border-base cursor-pointer hover:opacity-90 transition-all hover:shadow-lg"
                  style={{ maxHeight: "400px" }}
                  onClick={() => window.open(imageUrl, "_blank")}
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div 
      ref={dropZoneRef}
      className={clx(
        "flex flex-col h-full relative transition-all duration-200",
        isDragOver && "ring-2 ring-ui-border-interactive ring-inset bg-ui-bg-subtle-hover"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ui-bg-overlay/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 bg-ui-bg-base rounded-xl border-2 border-dashed border-ui-border-interactive">
            <Photo className="w-12 h-12 text-ui-fg-interactive" />
            <Text weight="plus" className="text-ui-fg-base">Drop files here</Text>
            <Text size="small" className="text-ui-fg-subtle">PDF, Images (JPG, PNG)</Text>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-y-4">
        {/* Welcome State */}
        {showWelcome && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-gradient-to-br from-ui-tag-blue-bg to-ui-tag-purple-bg rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <BuildingStorefront className="w-8 h-8 text-ui-tag-blue-text" />
            </div>
            <Text weight="plus" size="large" className="text-ui-fg-base mb-2">
              Industrial Project Consultant
            </Text>
            <Text className="text-ui-fg-subtle text-center max-w-md mb-8">
              Describe your factory project and I'll help you plan everything from equipment to layout, sourcing, and cost analysis.
            </Text>
            
            {/* Suggestion chips */}
            <div className="w-full max-w-lg">
              <div className="flex items-center gap-2 mb-3">
                <InformationCircleSolid className="w-4 h-4 text-ui-fg-muted" />
                <Text size="small" className="text-ui-fg-muted">Try one of these:</Text>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTION_PROMPTS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-left p-3 rounded-lg border border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover hover:border-ui-border-strong transition-all group"
                  >
                    <Text size="small" className="text-ui-fg-subtle group-hover:text-ui-fg-base transition-colors">
                      {suggestion}
                    </Text>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, idx) => (
          <div 
            key={message.id} 
            className={clx(
              "flex animate-in slide-in-from-bottom-2 duration-300",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div
              className={clx(
                "max-w-[85%] rounded-2xl p-4 shadow-sm",
                message.role === "user"
                  ? "bg-ui-button-neutral text-ui-fg-on-color rounded-br-md"
                  : "bg-ui-bg-subtle text-ui-fg-base rounded-bl-md border border-ui-border-base"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-ui-border-base">
                  <Star className="w-4 h-4 text-ui-fg-interactive" />
                  <Text size="xsmall" weight="plus" className="text-ui-fg-muted">AI Consultant</Text>
                </div>
              )}
              {renderMessageContent(message)}
              
              {/* Attachments indicator */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-ui-border-base/50">
                  {message.attachments.map((att, idx) => (
                    <Badge key={idx} color="grey" size="small" className="gap-1">
                      {att.file_type?.startsWith("image/") ? (
                        <Photo className="w-3 h-3" />
                      ) : (
                        <DocumentText className="w-3 h-3" />
                      )}
                      {att.filename}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-ui-bg-subtle rounded-2xl rounded-bl-md p-4 border border-ui-border-base shadow-sm">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-ui-fg-interactive animate-pulse" />
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-ui-fg-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-ui-fg-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-ui-fg-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* File Previews */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-3 border-t border-ui-border-base bg-ui-bg-subtle">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((fp, index) => (
              <div 
                key={index} 
                className="relative group animate-in zoom-in-95 duration-200"
              >
                {fp.type === "image" && fp.preview ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-ui-border-base">
                    <img 
                      src={fp.preview} 
                      alt={fp.file.name} 
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 w-5 h-5 bg-ui-bg-base/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-ui-bg-base"
                    >
                      <XMarkMini className="w-3 h-3 text-ui-fg-subtle" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-ui-border-base bg-ui-bg-base">
                    {fp.type === "pdf" ? (
                      <DocumentText className="w-4 h-4 text-ui-tag-red-text" />
                    ) : (
                      <PaperClip className="w-4 h-4 text-ui-fg-muted" />
                    )}
                    <Text size="small" className="max-w-[120px] truncate">{fp.file.name}</Text>
                    <button
                      onClick={() => removeFile(index)}
                      className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-ui-bg-subtle transition-colors"
                    >
                      <XMarkMini className="w-3 h-3 text-ui-fg-subtle" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-ui-border-base p-4 bg-ui-bg-base">
        <div className="flex gap-3 items-end">
          {/* File upload button */}
          <input 
            ref={fileInputRef} 
            type="file" 
            multiple 
            accept=".pdf,.txt,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf" 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          <IconButton 
            variant="secondary" 
            size="base"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0"
          >
            <PaperClip className="w-5 h-5" />
          </IconButton>
          
          {/* Text input */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your factory project..."
              className="min-h-[48px] max-h-[200px] resize-none pr-12 rounded-xl"
              rows={1}
            />
            {/* Send button inside textarea */}
            <IconButton
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
              className="absolute right-2 bottom-2"
              size="small"
            >
              <ArrowUpMini className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        {/* Start Building Button - Only show after user has sent at least one message */}
        {hasUserMessage && (
          <div className="mt-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <Button 
              onClick={onStartPlanning} 
              variant="primary" 
              className="w-full gap-2"
              disabled={isLoading}
            >
              <Star className="w-4 h-4" />
              Start Building Project
            </Button>
            <Text size="xsmall" className="text-ui-fg-muted text-center mt-2">
              Ready to proceed? Click to start the automated planning process.
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
