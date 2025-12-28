import { useState, useRef, useEffect, DragEvent, useCallback } from "react";
import { Button, Textarea, Text, Badge, clx } from "@medusajs/ui";
import { 
  PaperClip, 
  ArrowUpMini, 
  XMarkMini, 
  DocumentText, 
  Photo, 
  Star,
  BuildingStorefront,
  InformationCircleSolid,
  XCircleSolid,
  Sparkles,
  User,
} from "@medusajs/icons";
import type { ProjectMessage } from "../types";

// Custom SVG Icons
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function WaveformIcon({ className, animate }: { className?: string; animate?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <rect x="2" y="12" width="3" height="8" rx="1.5" className={animate ? "animate-waveform-1" : ""} />
      <rect x="7" y="8" width="3" height="16" rx="1.5" className={animate ? "animate-waveform-2" : ""} />
      <rect x="12" y="4" width="3" height="24" rx="1.5" className={animate ? "animate-waveform-3" : ""} />
      <rect x="17" y="8" width="3" height="16" rx="1.5" className={animate ? "animate-waveform-2" : ""} />
      <rect x="22" y="10" width="3" height="12" rx="1.5" className={animate ? "animate-waveform-1" : ""} />
      <rect x="27" y="12" width="3" height="8" rx="1.5" className={animate ? "animate-waveform-3" : ""} />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

// Speech Recognition Types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

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
  { text: "Build a solar panel factory", icon: "☀️" },
  { text: "Design an olive oil processing plant", icon: "🫒" },
  { text: "Create a pharmaceutical facility", icon: "💊" },
  { text: "Plan an EV battery factory", icon: "🔋" },
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
  
  // Voice input states
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasMessages = messages.length > 0;
  const hasUserMessage = messages.some(m => m.role === "user");

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hide welcome when messages exist
  useEffect(() => {
    if (hasMessages) setShowWelcome(false);
  }, [hasMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Recording duration timer
  useEffect(() => {
    if (isListening) {
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isListening]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognitionAPI) {
      setVoiceSupported(true);
      
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      
      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimText = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimText += transcript;
          }
        }
        
        if (finalTranscript) {
          setInput(prev => prev + (prev && !prev.endsWith(" ") ? " " : "") + finalTranscript);
          setInterimTranscript("");
        } else {
          setInterimTranscript(interimText);
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        setInterimTranscript("");
        
        const errorMessages: Record<string, string> = {
          "not-allowed": "Microphone access denied",
          "no-speech": "No speech detected",
          "audio-capture": "No microphone found",
          "network": "Network error",
        };
        setVoiceError(errorMessages[event.error] || "Voice error");
        setTimeout(() => setVoiceError(null), 3000);
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => recognitionRef.current?.abort();
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setVoiceError(null);
      setInterimTranscript("");
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
      }
    }
  }, [isListening]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const newPreviews: FilePreview[] = Array.from(files).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      type: file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "other",
    }));
    setSelectedFiles(prev => [...prev, ...newPreviews]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) URL.revokeObjectURL(newFiles[index].preview!);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleDragEnter = (e: DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const handleDragOver = (e: DragEvent) => e.preventDefault();
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
  };

  const handleSend = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;
    if (isListening) recognitionRef.current?.stop();
    
    const content = input.trim();
    const files = selectedFiles.map(fp => fp.file);
    
    setInput("");
    setInterimTranscript("");
    selectedFiles.forEach(fp => fp.preview && URL.revokeObjectURL(fp.preview));
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    await onSendMessage(content, files.length > 0 ? files : undefined);
  };

  const renderMessageContent = (message: ProjectMessage) => {
    let contentParts: Array<{ type: string; text?: string; inlineData?: any }> = [];
    
    if (typeof message.content === "string") {
      try {
        const parsed = JSON.parse(message.content);
        contentParts = Array.isArray(parsed) ? parsed : [{ type: "text", text: message.content }];
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
            const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return (
              <img 
                key={idx}
                src={imageUrl} 
                alt="AI generated" 
                className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-all"
                style={{ maxHeight: "400px" }}
                onClick={() => window.open(imageUrl, "_blank")}
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div 
      ref={dropZoneRef}
      className={clx(
        "flex flex-col h-full relative bg-ui-bg-base",
        isDragOver && "ring-2 ring-ui-fg-interactive ring-inset"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ui-bg-overlay/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 bg-ui-bg-base rounded-2xl border-2 border-dashed border-ui-fg-interactive shadow-xl">
            <div className="w-16 h-16 bg-ui-bg-subtle rounded-full flex items-center justify-center">
              <Photo className="w-8 h-8 text-ui-fg-interactive" />
            </div>
            <Text weight="plus" className="text-ui-fg-base">Drop files here</Text>
            <Text size="small" className="text-ui-fg-subtle">Images, PDFs</Text>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Welcome State */}
        {showWelcome && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500">
            {/* Logo */}
            <div className="relative mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-violet-500/30">
                <BuildingStorefront className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <Text className="text-2xl font-semibold text-ui-fg-base mb-2">
              Industrial Project Consultant
            </Text>
            <Text className="text-ui-fg-subtle text-center max-w-md mb-10">
              Describe your factory project and I'll help with planning, equipment sourcing, and cost analysis.
            </Text>
            
            {/* Suggestions */}
            <div className="w-full max-w-xl">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <InformationCircleSolid className="w-4 h-4 text-ui-fg-muted" />
                <Text size="small" className="text-ui-fg-muted">Quick prompts to get started</Text>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SUGGESTION_PROMPTS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setInput(suggestion.text); textareaRef.current?.focus(); }}
                    className="flex items-center gap-3 p-4 rounded-xl border border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover hover:border-ui-border-strong hover:shadow-md transition-all group text-left"
                  >
                    <span className="text-2xl">{suggestion.icon}</span>
                    <Text size="small" className="text-ui-fg-subtle group-hover:text-ui-fg-base transition-colors">
                      {suggestion.text}
                    </Text>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((message, idx) => (
            <div 
              key={message.id} 
              className={clx(
                "flex gap-3 animate-in slide-in-from-bottom-3 duration-300",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              {/* Avatar */}
              <div className={clx(
                "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                message.role === "user" 
                  ? "bg-ui-button-neutral" 
                  : "bg-gradient-to-br from-violet-500 to-indigo-600"
              )}>
                {message.role === "user" ? (
                  <User className="w-5 h-5 text-ui-fg-on-color" />
                ) : (
                  <Sparkles className="w-5 h-5 text-white" />
                )}
              </div>
              
              {/* Message Bubble */}
              <div className={clx(
                "max-w-[75%] flex flex-col",
                message.role === "user" ? "items-end" : "items-start"
              )}>
                <div
                  className={clx(
                    "rounded-2xl px-4 py-3 shadow-sm",
                    message.role === "user"
                      ? "bg-ui-button-neutral text-ui-fg-on-color rounded-tr-sm"
                      : "bg-ui-bg-subtle border border-ui-border-base text-ui-fg-base rounded-tl-sm"
                  )}
                >
                  {renderMessageContent(message)}
                  
                  {/* Attachments */}
                  {message.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-ui-border-base/30">
                      {message.attachments.map((att, i) => (
                        <Badge key={i} color="grey" size="small" className="gap-1">
                          {att.file_type?.startsWith("image/") ? <Photo className="w-3 h-3" /> : <DocumentText className="w-3 h-3" />}
                          {att.filename}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Timestamp */}
                <Text size="xsmall" className="text-ui-fg-muted mt-1 px-1">
                  {formatTime(message.created_at)}
                </Text>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="bg-ui-bg-subtle border border-ui-border-base rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-ui-fg-interactive rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-ui-fg-interactive rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-ui-fg-interactive rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <Text size="small" className="text-ui-fg-subtle">Thinking...</Text>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div ref={messagesEndRef} />
      </div>

      {/* File Previews */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-3 border-t border-ui-border-base bg-ui-bg-subtle">
          <div className="flex flex-wrap gap-2 max-w-3xl mx-auto">
            {selectedFiles.map((fp, index) => (
              <div key={index} className="relative group animate-in zoom-in-95 duration-200">
                {fp.type === "image" && fp.preview ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-ui-border-base shadow-sm">
                    <img src={fp.preview} alt={fp.file.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-ui-tag-red-bg rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <XMarkMini className="w-3 h-3 text-ui-tag-red-text" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-ui-border-base bg-ui-bg-base shadow-sm">
                    <DocumentText className="w-4 h-4 text-ui-tag-red-text" />
                    <Text size="small" className="max-w-[100px] truncate">{fp.file.name}</Text>
                    <button onClick={() => removeFile(index)} className="hover:bg-ui-bg-subtle rounded-full p-0.5">
                      <XMarkMini className="w-3 h-3 text-ui-fg-muted" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-ui-border-base bg-ui-bg-base p-4">
        <div className="max-w-3xl mx-auto">
          {/* Voice Error */}
          {voiceError && (
            <div className="mb-3 p-3 bg-ui-tag-red-bg border border-ui-tag-red-border rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
              <XCircleSolid className="w-4 h-4 text-ui-tag-red-icon" />
              <Text size="small" className="text-ui-tag-red-text">{voiceError}</Text>
            </div>
          )}
          
          {/* Recording Indicator - Full width prominent banner */}
          {isListening && (
            <div className="mb-4 p-5 bg-gradient-to-r from-red-500 via-rose-500 to-red-600 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-xl shadow-red-500/30">
              <div className="flex items-center gap-4">
                {/* Animated Waveform Circle */}
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                    <WaveformIcon className="w-8 h-8 text-white" animate />
                  </div>
                  <div className="absolute inset-0 w-14 h-14 bg-white/30 rounded-full animate-ping" />
                  <div className="absolute inset-2 w-10 h-10 bg-white/20 rounded-full animate-pulse" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-full">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <Text size="small" weight="plus" className="text-white">RECORDING</Text>
                    </span>
                    <Text className="text-white/90 font-mono text-lg font-semibold">
                      {formatDuration(recordingDuration)}
                    </Text>
                  </div>
                  {interimTranscript ? (
                    <Text className="text-white/90 truncate text-sm">
                      "{interimTranscript}"
                    </Text>
                  ) : (
                    <Text className="text-white/70 text-sm">🎤 Speak now... your voice is being captured</Text>
                  )}
                </div>
                
                {/* Stop Button */}
                <button
                  onClick={toggleVoiceInput}
                  className="w-12 h-12 bg-white hover:bg-ui-bg-subtle rounded-xl flex items-center justify-center shadow-lg transition-all hover:scale-105 flex-shrink-0"
                >
                  <StopIcon className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>
          )}
          
          {/* Input Row */}
          <div className="flex items-end gap-3">
            {/* Attachment Button - Prominent like mic button */}
            <input 
              ref={fileInputRef} 
              type="file" 
              multiple 
              accept=".pdf,.txt,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf" 
              onChange={handleFileSelect} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 relative group"
              title="Attach files (images, PDFs)"
            >
              <PaperClip className="w-6 h-6 text-white" />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-ui-bg-base rounded-lg flex items-center justify-center shadow-sm border border-ui-border-base">
                <span className="text-xs text-ui-fg-base">+</span>
              </span>
            </button>
            
            {/* Record Button - Always visible, prominent */}
            {!isListening && (
              <button 
                onClick={() => {
                  if (voiceSupported) {
                    toggleVoiceInput();
                  } else {
                    setVoiceError("Voice input not supported in this browser. Try Chrome or Edge.");
                  }
                }}
                className={clx(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 relative group",
                  voiceSupported 
                    ? "bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:scale-105"
                    : "bg-ui-bg-disabled cursor-not-allowed"
                )}
                title={voiceSupported ? "Click to start voice recording" : "Voice not supported"}
              >
                <MicrophoneIcon className={clx("w-6 h-6", voiceSupported ? "text-white" : "text-ui-fg-disabled")} />
                {voiceSupported && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-ui-bg-base animate-pulse" />
                )}
              </button>
            )}
            
            {/* Text Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input + (interimTranscript ? ` ${interimTranscript}` : "")}
                onChange={(e) => {
                  if (!interimTranscript) {
                    setInput(e.target.value);
                  } else {
                    setInterimTranscript("");
                    setInput(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? "Listening..." : "Describe your factory project..."}
                className={clx(
                  "min-h-[48px] max-h-[160px] resize-none pr-14 rounded-xl transition-all",
                  isListening && "border-red-300 bg-red-50/30 dark:bg-red-900/20"
                )}
                rows={1}
              />
              
              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
                className={clx(
                  "absolute right-2 bottom-2 w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                  input.trim() || selectedFiles.length > 0
                    ? "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25 hover:shadow-xl"
                    : "bg-ui-bg-disabled cursor-not-allowed"
                )}
              >
                <SendIcon className={clx(
                  "w-4 h-4",
                  input.trim() || selectedFiles.length > 0 ? "text-white" : "text-ui-fg-disabled"
                )} />
              </button>
            </div>
          </div>

          {/* Start Building Button */}
          {hasUserMessage && (
            <div className="mt-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
              <Button 
                onClick={onStartPlanning} 
                variant="primary" 
                className="w-full gap-2"
                disabled={isLoading}
              >
                <Sparkles className="w-4 h-4" />
                Start Building Project
              </Button>
              <Text size="xsmall" className="text-ui-fg-muted text-center mt-2">
                Ready? Click to begin the automated planning process
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* CSS for waveform animation */}
      <style>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
        .animate-waveform-1 { animation: waveform 0.4s ease-in-out infinite; }
        .animate-waveform-2 { animation: waveform 0.6s ease-in-out infinite 0.1s; }
        .animate-waveform-3 { animation: waveform 0.5s ease-in-out infinite 0.2s; }
      `}</style>
    </div>
  );
}
