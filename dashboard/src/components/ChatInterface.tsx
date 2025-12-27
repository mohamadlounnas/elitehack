/**
 * Chat Interface Component - Using Medusa UI components and design system
 * Enhanced with detailed loading states and suggestion chips
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button, Badge } from '@medusajs/ui';
import { Bot, User, Send, Loader2, CheckCircle2 } from 'lucide-react';
import type { Project, ChatMessage, ProjectStatus } from '@/types';

interface ChatInterfaceProps {
  projectId: string;
}

// Loading messages based on project status
const getLoadingMessage = (status: ProjectStatus | null): string => {
  switch (status) {
    case 'DATA_COLLECTING':
      return 'Collecting information about your production line...';
    case 'CREATING_PROCCES':
      return 'Creating production line plan following Industry 5.0 standards...';
    case 'MACHINES_REASERCH':
      return 'Researching machines and suppliers using Google Search...';
    case 'MACHINES_GENERATED':
      return 'Processing your request...';
    default:
      return 'Processing...';
  }
};

// Get suggestion chips based on project status
const getSuggestions = (status: ProjectStatus | null): Array<{ text: string; action: string }> => {
  switch (status) {
    case 'DATA_COLLECTING':
      return [
        { text: 'Skip to Process Creation', action: 'skip_to_process' },
        { text: 'I have all information', action: 'complete_data_collection' },
      ];
    case 'CREATING_PROCCES':
      return [
        { text: 'Skip to Machine Research', action: 'skip_to_machines' },
        { text: 'Generate plan now', action: 'generate_plan' },
      ];
    case 'MACHINES_REASERCH':
      return [
        { text: 'Complete research', action: 'complete_research' },
      ];
    case 'MACHINES_GENERATED':
      return [
        { text: 'Regenerate machines', action: 'regenerate_machines' },
        { text: 'Export results', action: 'export_results' },
      ];
    default:
      return [];
  }
};

export default function ChatInterface({ projectId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSuggestion = async (action: string) => {
    if (isLoading) return;

    let message = '';
    switch (action) {
      case 'skip_to_process':
        message = 'I have provided all necessary information. Please proceed to create the production plan.';
        break;
      case 'complete_data_collection':
        message = 'All information has been collected. Please move to the next phase.';
        break;
      case 'skip_to_machines':
        message = 'Please skip to machine research phase.';
        break;
      case 'generate_plan':
        message = 'Generate the production plan now based on collected information.';
        break;
      case 'complete_research':
        message = 'Complete the machine research and provide all machines in JSON format.';
        break;
      case 'regenerate_machines':
        message = 'Retry and generate full machine data with all alternatives.';
        break;
      case 'export_results':
        message = 'Please provide a summary of all machines and suppliers.';
        break;
      default:
        return;
    }

    setInput(message);
    // Auto-send the suggestion
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSend(fakeEvent);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setLoadingMessage(getLoadingMessage(project?.status || null));

    const tempUserMessage: ChatMessage = {
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
      
      const assistantMessage: ChatMessage = {
        id: `temp-${Date.now() + 1}`,
        project_id: projectId,
        role: 'assistant',
        content: response.message,
        attachments: null,
        created_at: new Date().toISOString(),
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

  const suggestions = project ? getSuggestions(project.status) : [];

  return (
    <div className="flex-1 flex flex-col h-screen bg-ui-bg-base overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <Bot className="w-16 h-16 text-ui-fg-subtle mb-4" />
              <div className="text-large font-semibold mb-2 text-ui-fg-base">Production Line Planner</div>
              <div className="text-ui-fg-subtle">What do you wanna build today?</div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isLastAssistant = 
                  message.role === 'assistant' && 
                  index === messages.length - 1 &&
                  !isLoading;
                const messageSuggestions = isLastAssistant ? suggestions : [];

                return (
                  <div key={message.id}>
                    <div
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-ui-fg-interactive flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-ui-bg-base" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-ui-bg-subtle text-ui-fg-base'
                            : 'bg-ui-bg-subtle-hover text-ui-fg-base'
                        }`}
                      >
                        <div className="text-small whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-ui-bg-subtle-hover flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-4 h-4 text-ui-fg-subtle" />
                        </div>
                      )}
                    </div>
                    
                    {/* Suggestion chips after last assistant message */}
                    {messageSuggestions.length > 0 && (
                      <div className="flex gap-2 mt-2 ml-11 flex-wrap">
                        {messageSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.action}
                            onClick={() => handleSuggestion(suggestion.action)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-subtle-hover text-ui-fg-base transition-colors"
                          >
                            {suggestion.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Loading indicator with status message */}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-ui-fg-interactive flex items-center justify-center flex-shrink-0 mt-1">
                    <Loader2 className="w-4 h-4 text-ui-bg-base animate-spin" />
                  </div>
                  <div className="bg-ui-bg-subtle-hover rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 text-ui-fg-subtle animate-spin" />
                      <div className="text-small text-ui-fg-subtle">{loadingMessage}</div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-ui-border-base bg-ui-bg-base p-4">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-2">
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
            className="flex-1 min-h-[44px] max-h-32 resize-none px-3 py-2 rounded-lg border border-ui-border-base bg-ui-bg-base text-ui-fg-base placeholder:text-ui-fg-subtle focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive disabled:opacity-50"
            rows={1}
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            variant="primary"
          >
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}
