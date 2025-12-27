/**
 * Sidebar Component - Simple project list and create button
 * Aligned with original mission
 */

import { useState } from 'react';
import { Button, Input } from '@medusajs/ui';
import { Plus } from 'lucide-react';
import type { Project } from '@/types';

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => Promise<any>;
}

export default function Sidebar({ projects, selectedProjectId, onSelectProject, onCreateProject }: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    try {
      await onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewProjectName('');
  };

  return (
    <div className="w-64 border-r border-ui-border-base bg-ui-bg-base flex flex-col h-screen">
      {/* Create Project Button */}
      <div className="p-4 border-b border-ui-border-base">
        {!isCreating ? (
          <Button
            onClick={() => setIsCreating(true)}
            variant="primary"
            className="w-full"
          >
            <Plus />
            Create Project
          </Button>
        ) : (
          <div className="space-y-2">
            <Input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder="Project name..."
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                size="small"
                variant="primary"
                className="flex-1"
              >
                Create
              </Button>
              <Button
                onClick={handleCancel}
                size="small"
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {projects.length === 0 ? (
          <div className="text-center text-ui-fg-subtle text-small py-8">
            No projects yet
          </div>
        ) : (
          projects.map((project) => (
            <Button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              variant={selectedProjectId === project.id ? 'primary' : 'secondary'}
              className="w-full justify-start"
            >
              {project.name}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
