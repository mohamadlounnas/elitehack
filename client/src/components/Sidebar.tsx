/**
 * Sidebar Component - Redesigned to match reference UI
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types';

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => Promise<any>;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DATA_COLLECTING: 'Collecting',
  CREATING_PROCCES: 'Creating',
  MACHINES_REASERCH: 'Researching',
  MACHINES_GENERATED: 'Done',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  DATA_COLLECTING: 'bg-blue-500',
  CREATING_PROCCES: 'bg-yellow-500',
  MACHINES_REASERCH: 'bg-purple-500',
  MACHINES_GENERATED: 'bg-green-500',
};

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
    <div className="w-64 bg-black border-r border-gray-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm"></div>
          </div>
          <span className="text-white font-semibold">Production Line</span>
        </div>
      </div>

      {/* New Project Button */}
      <div className="p-4 border-b border-gray-800">
        <Button
          onClick={() => setIsCreating(true)}
          className="w-full bg-white text-black hover:bg-gray-100 justify-start font-medium"
          disabled={isCreating}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
        
        {isCreating && (
          <div className="mt-2 space-y-2">
            <Input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder="Project name..."
              className="text-sm bg-gray-900 border-gray-700 text-white"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                size="sm"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                Create
              </Button>
              <Button
                onClick={handleCancel}
                size="sm"
                variant="ghost"
                className="flex-1 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">PROJECTS</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 py-2 space-y-1">
            {projects.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No projects yet
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-lg text-left text-sm flex items-center gap-2 transition-colors group",
                    selectedProjectId === project.id
                      ? 'bg-green-500/20 border border-green-500/50'
                      : 'hover:bg-gray-900 text-gray-300'
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded flex-shrink-0",
                    selectedProjectId === project.id ? 'bg-green-500' : 'bg-gray-600'
                  )} />
                  <span className="truncate flex-1 text-white">{project.name}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-gray-800 p-4 space-y-2">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-900 rounded-lg transition-colors">
          <Settings className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-900 rounded-lg transition-colors">
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Sign out</span>
        </button>
        <div className="flex items-center justify-between pt-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-semibold">U</span>
          </div>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-gray-900 rounded">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <button className="p-1 hover:bg-gray-900 rounded">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
