/**
 * ProjectChat component
 * Main chat interface with real-time updates via Supabase Realtime
 */

import React, { useState, useEffect, useRef } from 'react';
import { Project, ChatMessage, Machine } from '../types/index';
import { chatAPI, machinesAPI, projectsAPI } from '../lib/api';
import { supabase } from '../lib/supabase';
import ChatMessages from './ChatMessages';
import MachineList from './MachineList';
import './ProjectChat.css';

interface ProjectChatProps {
  project: Project;
  onBack: () => void;
  onProjectUpdate: () => void;
}

const ProjectChat: React.FC<ProjectChatProps> = ({ project, onBack, onProjectUpdate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [machines, setMachines] = useState<Machine[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
    loadMachines();
    setupRealtime();

    return () => {
      // Cleanup realtime subscription
      supabase.removeAllChannels();
    };
  }, [project.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const history = await chatAPI.getHistory(project.id);
      setMessages(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadMachines = async () => {
    try {
      const projectMachines = await machinesAPI.getByProject(project.id);
      setMachines(projectMachines);
    } catch (error) {
      console.error('Error loading machines:', error);
    }
  };

  const loadProject = async () => {
    try {
      const updatedProject = await projectsAPI.getById(project.id);
      setCurrentProject(updatedProject);
      onProjectUpdate();
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const setupRealtime = () => {
    // Subscribe to project updates
    const projectChannel = supabase
      .channel(`project:${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${project.id}`,
        },
        () => {
          loadProject();
        }
      )
      .subscribe();

    // Subscribe to chat message inserts
    const chatChannel = supabase
      .channel(`chat:${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          loadChatHistory();
        }
      )
      .subscribe();

    // Subscribe to machine updates (for MACHINES_REASERCH phase)
    const machinesChannel = supabase
      .channel(`machines:${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines',
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          loadMachines();
        }
      )
      .subscribe();

    return () => {
      projectChannel.unsubscribe();
      chatChannel.unsubscribe();
      machinesChannel.unsubscribe();
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    try {
      // Add user message to UI immediately
      const tempUserMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        project_id: project.id,
        role: 'user',
        content: userMessage,
        attachments: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMessage]);

      // Send to API
      const response = await chatAPI.sendMessage(project.id, userMessage);
      
      // Reload messages and project to get updates
      await loadChatHistory();
      await loadProject();

      // If machines were created, reload them
      if (currentProject.status === 'MACHINES_REASERCH') {
        await loadMachines();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStatusLabel = (status: Project['status']): string => {
    const labels: Record<Project['status'], string> = {
      DATA_COLLECTING: 'Collecting Data',
      CREATING_PROCCES: 'Creating Process',
      MACHINES_REASERCH: 'Researching Machines',
      MACHINES_GENERATED: 'Machines Generated',
    };
    return labels[status] || status;
  };

  const showMachinesSection = currentProject.status === 'MACHINES_REASERCH' || 
                               currentProject.status === 'MACHINES_GENERATED';

  return (
    <div className="project-chat">
      <div className="project-chat-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Projects
        </button>
        <div className="project-info">
          <h2>{currentProject.name}</h2>
          <span className="project-status-badge">{getStatusLabel(currentProject.status)}</span>
        </div>
      </div>

      <div className="project-chat-content">
        {showMachinesSection && (
          <div className="machines-section">
            <h3>Machines ({machines.length})</h3>
            <MachineList machines={machines} onRetry={loadMachines} />
          </div>
        )}

        <div className="chat-section">
          <ChatMessages messages={messages} loading={loading} />
          <div ref={messagesEndRef} />

          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                currentProject.status === 'DATA_COLLECTING'
                  ? "What do you wanna build today?"
                  : "Type your message..."
              }
              disabled={loading}
            />
            <button type="submit" disabled={loading || !inputMessage.trim()}>
              {loading ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProjectChat;

