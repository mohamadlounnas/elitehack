/**
 * Right Sidebar Component - Shows project status, progress, and machines
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Target, 
  Zap, 
  Loader2, 
  CheckCircle2, 
  Image, 
  Box,
  ExternalLink,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project, Machine, MachineStatus } from '@/types';

interface RightSidebarProps {
  projectId: string;
}

const STATUS_LABELS: Record<MachineStatus, string> = {
  pending: 'Pending',
  generating_image: 'Generating Image',
  generating_3d_model: 'Generating 3D Model',
  completed: 'Completed',
  previous: 'Retrying',
};

const STATUS_ICONS: Record<MachineStatus, React.ReactNode> = {
  pending: <Loader2 className="w-4 h-4" />,
  generating_image: <Image className="w-4 h-4 animate-pulse" />,
  generating_3d_model: <Box className="w-4 h-4 animate-pulse" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  previous: <Loader2 className="w-4 h-4 animate-spin" />,
};

export default function RightSidebar({ projectId }: RightSidebarProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projectData, machinesData] = await Promise.all([
        api.getProject(projectId),
        api.getMachines(projectId).catch(() => [])
      ]);
      setProject(projectData);
      setMachines(machinesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = () => {
    if (!machines.length) return 0;
    const completed = machines.filter(m => m.status === 'completed').length;
    return (completed / machines.length) * 100;
  };

  const getStatusLabel = () => {
    if (!project) return 'Idle';
    const labels: Record<Project['status'], string> = {
      DATA_COLLECTING: 'Collecting Data',
      CREATING_PROCCES: 'Creating Process',
      MACHINES_REASERCH: 'Researching',
      MACHINES_GENERATED: 'Completed',
    };
    return labels[project.status];
  };

  const getStatusColor = () => {
    if (!project) return 'text-gray-400';
    const colors: Record<Project['status'], string> = {
      DATA_COLLECTING: 'text-blue-400',
      CREATING_PROCCES: 'text-yellow-400',
      MACHINES_REASERCH: 'text-purple-400',
      MACHINES_GENERATED: 'text-green-400',
    };
    return colors[project.status] || 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="w-80 border-l border-gray-800 bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-gray-800 bg-black flex flex-col h-screen overflow-hidden">
      {/* Avatar */}
      <div className="p-4 border-b border-gray-800 flex justify-center">
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-semibold">PL</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Workflow Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-semibold text-white">Workflow</h3>
              </div>
              <button className="text-gray-400 hover:text-white">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <p className={cn("text-sm", getStatusColor())}>
              {project?.status === 'MACHINES_REASERCH' || project?.status === 'MACHINES_GENERATED' 
                ? 'Running' 
                : getStatusLabel()}
            </p>
          </div>

          <Separator className="bg-gray-800" />

          {/* Goal Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-white">GOAL</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {project?.status === 'DATA_COLLECTING' && 'Collect comprehensive information about the production line requirements'}
              {project?.status === 'CREATING_PROCCES' && 'Create a detailed production line plan following Industry 5.0 standards'}
              {project?.status === 'MACHINES_REASERCH' && 'Research and identify machines, equipment, and suppliers for the production line'}
              {project?.status === 'MACHINES_GENERATED' && 'Complete production line planning with all machines researched and generated'}
              {!project && 'Set up a production line planning project'}
            </p>
          </div>

          <Separator className="bg-gray-800" />

          {/* Progress Section */}
          {(machines.length > 0 || project?.status === 'MACHINES_REASERCH' || project?.status === 'MACHINES_GENERATED') && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white">Progress</h3>
                  <span className="text-xs text-gray-400">
                    {machines.filter(m => m.status === 'completed').length} / {machines.length} machines
                  </span>
                </div>
                <Progress value={getProgress()} className="h-2 bg-gray-800" />
              </div>

              <Separator className="bg-gray-800" />

              {/* Machines/Tasks Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-green-500" />
                  <h3 className="text-sm font-semibold text-white">MACHINES</h3>
                </div>
                <div className="space-y-2">
                  {machines.length === 0 ? (
                    <p className="text-sm text-gray-500">No machines yet. The AI is researching...</p>
                  ) : (
                    machines.map((machine) => (
                      <div key={machine.id} className="flex items-start gap-2 p-2 rounded hover:bg-gray-900 transition-colors">
                        <div className={cn(
                          "mt-1",
                          machine.status === 'completed' ? 'text-green-500' : 'text-gray-500'
                        )}>
                          {machine.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 border-2 border-current rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white leading-relaxed">{machine.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              {STATUS_ICONS[machine.status]}
                              {STATUS_LABELS[machine.status]}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {(project?.status === 'MACHINES_REASERCH' && machines.some(m => m.status !== 'completed')) && (
                    <div className="flex items-center gap-2 text-green-500 text-sm mt-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

