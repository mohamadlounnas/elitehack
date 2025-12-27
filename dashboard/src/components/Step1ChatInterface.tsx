/**
 * Step 1: Data Collection - Chat Interface
 * This is the only step that uses chat input
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button } from '@medusajs/ui';
import { Bot, User, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/types';

interface Step1ChatInterfaceProps {
  projectId: string;
  onResponse?: (data: { suggestions?: Array<{ action: string; label: string; primary?: boolean }> }) => void;
}

export default function Step1ChatInterface({ projectId, onResponse }: Step1ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadHistory();
    
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
      chatChannel.unsubscribe();
    };
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadHistory = async () => {
    try {
      const history = await api.getChatHistory(projectId);
      setMessages(history);
      
      // Extract suggestions from last assistant message if available
      if (history.length > 0) {
        const lastMessage = history[history.length - 1];
        if (lastMessage.role === 'assistant' && onResponse) {
          // Parse suggestions from message attachments or structured response
          const suggestions = (lastMessage.attachments as any)?.suggestions || [];
          if (suggestions.length > 0) {
            onResponse({ suggestions });
          }
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage(projectId, userMessage);
      
      // Extract suggestions from response
      if (response.suggestions && onResponse) {
        onResponse({ suggestions: response.suggestions });
      }
      
      await loadHistory();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = async (action: string) => {
    // Suggestions in Step 1 should still use chat
    // But they send the action directly
    setIsLoading(true);
    try {
      const response = await api.sendChatMessage(projectId, action);
      if (response.suggestions && onResponse) {
        onResponse({ suggestions: response.suggestions });
      }
      await loadHistory();
    } catch (error) {
      console.error('Failed to execute suggestion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-ui-bg-base overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <Bot className="w-16 h-16 text-ui-fg-subtle mb-4" />
              <div className="text-large font-semibold mb-2 text-ui-fg-base">Production Line Planner</div>
              <div className="text-ui-fg-subtle">What do you want to build today?</div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isLastAssistant = 
                  message.role === 'assistant' && 
                  index === messages.length - 1 &&
                  !isLoading;
                const suggestions = isLastAssistant 
                  ? ((message.attachments as any)?.suggestions || [])
                  : [];

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
                        <div className="text-small whitespace-pre-wrap break-words prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-ui-bg-subtle-hover flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-4 h-4 text-ui-fg-subtle" />
                        </div>
                      )}
                    </div>
                    
                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                      <div className="flex gap-2 mt-2 ml-11 flex-wrap">
                        {suggestions.map((suggestion: any, idx: number) => (
                          <Button
                            key={idx}
                            onClick={() => handleSuggestionClick(suggestion.action)}
                            variant={suggestion.primary ? 'primary' : 'secondary'}
                            size="small"
                            disabled={isLoading}
                          >
                            {suggestion.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-ui-fg-interactive flex items-center justify-center flex-shrink-0 mt-1">
                    <Loader2 className="w-4 h-4 text-ui-bg-base animate-spin" />
                  </div>
                  <div className="bg-ui-bg-subtle-hover rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 text-ui-fg-subtle animate-spin" />
                      <div className="text-small text-ui-fg-subtle">Collecting information...</div>
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

