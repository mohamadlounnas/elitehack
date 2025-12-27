/**
 * Right Sidebar Component - Shows workflow status and machines
 * Aligned with original mission: show machines in real-time with progress
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Badge, Button } from '@medusajs/ui';
import { 
  Loader2, 
  CheckCircle2,
} from 'lucide-react';
import type { Project, Machine, MachineStatus, ProjectStatus } from '@/types';

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

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  DATA_COLLECTING: 'Data Collection',
  CREATING_PROCCES: 'Creating Process',
  MACHINES_REASERCH: 'Machine Research',
  MACHINES_GENERATED: 'Completed',
};

export default function RightSidebar({ projectId }: RightSidebarProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringStep, setTriggeringStep] = useState(false);

  useEffect(() => {
    loadData();
    
    const projectChannel = supabase
      .channel(`project-sidebar:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const machinesChannel = supabase
      .channel(`machines-sidebar:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      projectChannel.unsubscribe();
      machinesChannel.unsubscribe();
    };
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

  const getNextStep = (): ProjectStatus | null => {
    if (!project) return null;
    const stepOrder: ProjectStatus[] = [
      'DATA_COLLECTING',
      'CREATING_PROCCES',
      'MACHINES_REASERCH',
      'MACHINES_GENERATED',
    ];
    const currentIndex = stepOrder.indexOf(project.status);
    if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
      return null;
    }
    return stepOrder[currentIndex + 1];
  };

  const getNextStepLabel = (): string => {
    const nextStep = getNextStep();
    if (!nextStep) return '';
    return PROJECT_STATUS_LABELS[nextStep] || '';
  };

  const handleTriggerStep = async () => {
    if (!project || triggeringStep) return;
    
    const nextStep = getNextStep();
    if (!nextStep) return;

    setTriggeringStep(true);
    try {
      await api.triggerWorkflowStep(projectId);
      await loadData();
    } catch (error) {
      console.error('Failed to trigger workflow step:', error);
      alert('Failed to trigger workflow step. Please try again.');
    } finally {
      setTriggeringStep(false);
    }
  };

  if (loading) {
    return (
      <div className="w-80 border-l border-ui-border-base bg-ui-bg-base flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ui-fg-subtle" />
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-ui-border-base bg-ui-bg-base flex flex-col h-screen overflow-hidden">
      <div className="p-4 border-b border-ui-border-base">
        <div className="text-large font-semibold mb-2">Status</div>
        {project && (
          <Badge>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Trigger Step Button */}
        {project && getNextStep() && project.status !== 'MACHINES_REASERCH' && (
          <Button
            onClick={handleTriggerStep}
            disabled={triggeringStep}
            variant="primary"
            className="w-full"
          >
            {triggeringStep ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Triggering...
              </>
            ) : (
              `Move to ${getNextStepLabel()}`
            )}
          </Button>
        )}

        {/* Machines Section - Only show in MACHINES_REASERCH or MACHINES_GENERATED */}
        {(project?.status === 'MACHINES_REASERCH' || project?.status === 'MACHINES_GENERATED') && (
          <div>
            <div className="text-base font-semibold mb-3">Machines</div>
            <div className="space-y-3">
              {machines.length === 0 ? (
                <div className="text-ui-fg-subtle text-small">
                  No machines yet. The AI is researching...
                </div>
              ) : (
                machines.map((machine) => (
                  <div
                    key={machine.id}
                    className="p-3 border border-ui-border-base rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-small font-semibold flex-1">{machine.name}</div>
                      {machine.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-ui-fg-interactive flex-shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-ui-fg-subtle animate-spin flex-shrink-0" />
                      )}
                    </div>
                    {machine.description && (
                      <div className="text-small text-ui-fg-subtle">{machine.description}</div>
                    )}
                    <Badge size="2xsmall">
                      {STATUS_LABELS[machine.status]}
                    </Badge>
                    {machine.generated_image && (
                      <img
                        src={machine.generated_image}
                        alt={machine.name}
                        className="w-full h-24 object-cover rounded border border-ui-border-base"
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
