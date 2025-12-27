/**
 * ChatMessages component
 * Displays chat message history
 */

import React from 'react';
import { ChatMessage } from '../types/index';
import './ChatMessages.css';

interface ChatMessagesProps {
  messages: ChatMessage[];
  loading: boolean;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, loading }) => {
  if (messages.length === 0 && !loading) {
    return (
      <div className="chat-messages-empty">
        <p className="welcome-message">What do you wanna build today?</p>
      </div>
    );
  }

  return (
    <div className="chat-messages">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`chat-message chat-message-${message.role}`}
        >
          <div className="chat-message-content">
            <div className="chat-message-role">
              {message.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="chat-message-text">{message.content}</div>
            <div className="chat-message-time">
              {new Date(message.created_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
      {loading && (
        <div className="chat-message chat-message-assistant">
          <div className="chat-message-content">
            <div className="chat-message-role">AI</div>
            <div className="chat-message-text typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessages;

