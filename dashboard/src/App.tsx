/**
 * Main App Component with Stepper System
 */

import { useState, useEffect } from 'react';
import { api } from './lib/api';
import Sidebar from './components/Sidebar';
import StepperNavigation from './components/StepperNavigation';
import StepContent from './components/StepContent';
import RightSidebar from './components/RightSidebar';
import type { Project, ProjectStatus } from './types';
import { supabase } from './lib/supabase';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
    const interval = setInterval(loadProjects, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProject(selectedProjectId);
      
      // Subscribe to project updates
      const projectChannel = supabase
        .channel(`project:${selectedProjectId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${selectedProjectId}`,
          },
          () => {
            loadProject(selectedProjectId);
          }
        )
        .subscribe();

      return () => {
        projectChannel.unsubscribe();
      };
    }
  }, [selectedProjectId]);

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

  const loadProject = async (projectId: string) => {
    try {
      const project = await api.getProject(projectId);
      setSelectedProject(project);
    } catch (error) {
      console.error('Failed to load project:', error);
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

  const handleProjectUpdate = () => {
    if (selectedProjectId) {
      loadProject(selectedProjectId);
      loadProjects();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-ui-bg-base">
        <div className="text-center">
          <div className="text-large font-medium mb-2">Loading...</div>
          <div className="text-small text-ui-fg-subtle">Setting up Production Line Planner</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ui-bg-base">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={handleCreateProject}
      />
      {selectedProjectId && selectedProject ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <StepperNavigation currentStep={selectedProject.status} />
          <div className="flex-1 flex overflow-hidden">
            <StepContent
              projectId={selectedProjectId}
              project={selectedProject}
              onProjectUpdate={handleProjectUpdate}
            />
            <RightSidebar projectId={selectedProjectId} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-large font-semibold mb-2">Welcome to Production Line Planner</div>
            <div className="text-ui-fg-subtle">Create a new project to get started</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
