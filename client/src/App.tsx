/**
 * Main App Component - Updated layout
 */

import { useState, useEffect } from 'react';
import { api } from './lib/api';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import type { Project } from './types';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
    const interval = setInterval(loadProjects, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (name: string) => {
    try {
      const newProject = await api.createProject({ name, description: '' });
      setProjects([newProject, ...projects]);
      setSelectedProjectId(newProject.id);
      return newProject;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <div className="text-lg font-medium mb-2 text-white">Loading...</div>
          <div className="text-sm text-gray-400">Setting up Production Line Planner</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={handleCreateProject}
      />
      {selectedProjectId ? (
        <>
          <ChatInterface projectId={selectedProjectId} />
          <RightSidebar projectId={selectedProjectId} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <h1 className="text-2xl font-semibold mb-2 text-white">Welcome to Production Line Planner</h1>
            <p className="text-gray-400">
              Create a new project to get started with autonomous production line planning
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
