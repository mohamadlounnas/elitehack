/**
 * Chat Interface Component - Apple-inspired design
 * Features:
 * - Markdown rendering (hides code/JSON)
 * - AI-generated suggestions that execute directly
 * - Clean, simple, but informative UI
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button } from '@medusajs/ui';
import { Bot, User, Send, Loader2, Sparkles } from 'lucide-react';
import type { Project, ChatMessage, ProjectStatus } from '@/types';

interface ChatInterfaceProps {
  projectId: string;
}

interface MessageWithSuggestions extends ChatMessage {
  suggestions?: Array<{ action: string; label: string }>;
}

// Loading messages based on project status
const getLoadingMessage = (status: ProjectStatus | null): string => {
  switch (status) {
    case 'DATA_COLLECTING':
      return 'Collecting information about your production line...';
    case 'CREATING_PROCCES':
      return 'Creating production line plan following Industry 5.0 standards...';
    case 'ASSETS_RESEARCH':
      return 'Researching machines and suppliers using Google Search...';
    case 'GENERATING_2D_LAYOUT':
      return 'Generating 2D layout visualization...';
    case 'GENERATING_3D_MODEL':
      return 'Generating 3D model...';
    case 'PROJECT_COMPLETED':
      return 'Processing your request...';
    default:
      return 'Processing...';
  }
};

export default function ChatInterface({ projectId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageWithSuggestions[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processing...');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
    
    const projectChannel = supabase
      .channel(`project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        () => {
          loadProject();
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel(`chat:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      projectChannel.unsubscribe();
      chatChannel.unsubscribe();
    };
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Update loading message when project status changes
  useEffect(() => {
    if (project) {
      setLoadingMessage(getLoadingMessage(project.status));
    }
  }, [project]);

  const loadData = async () => {
    await Promise.all([loadHistory(), loadProject()]);
  };

  const loadProject = async () => {
    try {
      const data = await api.getProject(projectId);
      setProject(data);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = async () => {
    try {
      const history = await api.getChatHistory(projectId);
      setMessages(history as MessageWithSuggestions[]);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  /**
   * Execute suggestion action directly
   * Maps AI-generated actions to actual workflow commands
   */
  const executeSuggestion = async (action: string, label: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadingMessage('Executing action...');

    try {
      // Map common actions to workflow commands
      let message = '';
      let shouldTriggerWorkflow = false;

      switch (action) {
        case 'skip_to_process':
        case 'proceed_to_planning':
          message = 'I have provided all necessary information. Please proceed to create the production plan.';
          shouldTriggerWorkflow = true;
          break;
        case 'skip_to_machines':
        case 'proceed_to_research':
          message = 'Please proceed to machine research phase.';
          shouldTriggerWorkflow = true;
          break;
        case 'generate_plan':
        case 'create_plan':
          message = 'Generate the production plan now based on collected information.';
          break;
        case 'complete_research':
        case 'finish_research':
          message = 'Complete the machine research and provide all assets.';
          break;
        case 'provide_more_info':
        case 'provide_volume':
        case 'provide_budget':
          // These are informational - just send the label as context
          message = label;
          break;
        default:
          // For unknown actions, use the label as the message
          message = label;
      }

      // If it's a workflow trigger, use the workflow API
      if (shouldTriggerWorkflow) {
        await api.triggerWorkflowStep(projectId);
        await loadProject();
      } else {
        // Otherwise, send as a chat message
        const userMessage: MessageWithSuggestions = {
          id: `temp-${Date.now()}`,
          project_id: projectId,
          role: 'user',
          content: message,
          attachments: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);

        const response = await api.sendChatMessage(projectId, message);
        
        const assistantMessage: MessageWithSuggestions = {
          id: `temp-${Date.now() + 1}`,
          project_id: projectId,
          role: 'assistant',
          content: response.message,
          attachments: null,
          created_at: new Date().toISOString(),
          suggestions: (response as any).suggestions,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        await loadHistory();
        await loadProject();
      }
    } catch (error) {
      console.error('Failed to execute suggestion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setLoadingMessage(getLoadingMessage(project?.status || null));

    const tempUserMessage: MessageWithSuggestions = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      role: 'user',
      content: userMessage,
      attachments: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await api.sendChatMessage(projectId, userMessage);
      
      const assistantMessage: MessageWithSuggestions = {
        id: `temp-${Date.now() + 1}`,
        project_id: projectId,
        role: 'assistant',
        content: response.message,
        attachments: null,
        created_at: new Date().toISOString(),
        suggestions: (response as any).suggestions,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      await loadHistory();
      await loadProject();
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-ui-bg-base overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ui-fg-interactive/20 to-ui-fg-interactive/10 flex items-center justify-center mb-6">
                <Bot className="w-10 h-10 text-ui-fg-interactive" />
              </div>
              <div className="text-2xl font-semibold mb-2 text-ui-fg-base">Production Line Planner</div>
              <div className="text-ui-fg-subtle text-base">What would you like to build today?</div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isLastAssistant = 
                  message.role === 'assistant' && 
                  index === messages.length - 1 &&
                  !isLoading;
                const messageSuggestions = isLastAssistant ? (message.suggestions || []) : [];

                return (
                  <div key={message.id} className="space-y-3">
                    <div
                      className={`flex gap-4 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ui-fg-interactive to-ui-fg-interactive/80 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Bot className="w-5 h-5 text-ui-bg-base" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-4 ${
                          message.role === 'user'
                            ? 'bg-ui-fg-interactive text-white shadow-sm'
                            : 'bg-ui-bg-subtle-hover text-ui-fg-base shadow-sm border border-ui-border-base'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                // Hide code blocks and JSON
                                code: ({ node, inline, ...props }: any) => {
                                  if (inline) {
                                    return <code className="px-1.5 py-0.5 bg-ui-bg-base rounded text-sm font-mono" {...props} />;
                                  }
                                  // Hide code blocks
                                  return null;
                                },
                                pre: () => null,
                                // Style other markdown elements
                                p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                                h1: ({ children }) => <h1 className="text-xl font-semibold mb-3 mt-4 first:mt-0">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-2 first:mt-0">{children}</h3>,
                                ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-ui-fg-interactive/30 pl-4 italic my-3 text-ui-fg-subtle">
                                    {children}
                                  </blockquote>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className="w-10 h-10 rounded-full bg-ui-bg-subtle-hover flex items-center justify-center flex-shrink-0 border border-ui-border-base">
                          <User className="w-5 h-5 text-ui-fg-subtle" />
                        </div>
                      )}
                    </div>
                    
                    {/* AI-generated suggestions */}
                    {messageSuggestions.length > 0 && (
                      <div className="flex gap-2 mt-2 ml-14 flex-wrap">
                        {messageSuggestions.map((suggestion, idx) => (
                          <button
                            key={`${suggestion.action}-${idx}`}
                            onClick={() => executeSuggestion(suggestion.action, suggestion.label)}
                            disabled={isLoading}
                            className="group px-4 py-2 text-sm rounded-full border border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-subtle-hover text-ui-fg-base transition-all duration-200 hover:shadow-sm hover:border-ui-fg-interactive/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-ui-fg-interactive group-hover:scale-110 transition-transform" />
                            <span>{suggestion.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ui-fg-interactive to-ui-fg-interactive/80 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Loader2 className="w-5 h-5 text-ui-bg-base animate-spin" />
                  </div>
                  <div className="bg-ui-bg-subtle-hover rounded-2xl px-5 py-4 border border-ui-border-base shadow-sm">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 text-ui-fg-interactive animate-spin" />
                      <div className="text-sm text-ui-fg-subtle">{loadingMessage}</div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area - Apple-inspired clean design */}
      <div className="border-t border-ui-border-base bg-ui-bg-base/80 backdrop-blur-sm p-4">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type your message..."
              className="w-full min-h-[44px] max-h-32 resize-none px-4 py-3 rounded-2xl border border-ui-border-base bg-ui-bg-base text-ui-fg-base placeholder:text-ui-fg-subtle focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive/50 focus:border-ui-fg-interactive/50 disabled:opacity-50 transition-all text-sm leading-relaxed"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            variant="primary"
            className="h-[44px] w-[44px] rounded-full p-0 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
