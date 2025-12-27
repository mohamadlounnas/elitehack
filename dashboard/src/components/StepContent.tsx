/**
 * Step Content Component
 * Renders step-specific UI based on current step
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Button } from '@medusajs/ui';
import { CheckCircle2, Loader2, Download, RefreshCw, ArrowRight } from 'lucide-react';
import type { Project, ProjectStatus } from '@/types';
import Step1ChatInterface from './Step1ChatInterface';
import Step2ProcessPlan from './Step2ProcessPlan';
import Step3AssetsResearch from './Step3AssetsResearch';
import Step4Layout2D from './Step4Layout2D';
import Step5Model3D from './Step5Model3D';
import Step6Completed from './Step6Completed';

interface StepContentProps {
  projectId: string;
  project: Project;
  onProjectUpdate: () => void;
}

interface ActionSuggestion {
  action: string;
  label: string;
  primary?: boolean;
  autoTriggerAfter?: number;
}

interface StepContentData {
  suggestions?: ActionSuggestion[];
  metadata?: Record<string, unknown>;
}

export default function StepContent({ projectId, project, onProjectUpdate }: StepContentProps) {
  const [stepData, setStepData] = useState<StepContentData>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const handleAction = useCallback(async (action: string) => {
    if (isTriggering) return;
    
    setIsTriggering(true);
    try {
      // For Step 1 (DATA_COLLECTING), actions are sent as chat messages
      if (project.status === 'DATA_COLLECTING') {
        const response = await api.sendChatMessage(projectId, action);
        if (response.suggestions) {
          setStepData({ suggestions: response.suggestions });
        }
      } else {
        // For other steps, trigger workflow step
        await api.triggerWorkflowStep(projectId);
      }
      onProjectUpdate();
    } catch (error) {
      console.error('Failed to trigger action:', error);
    } finally {
      setIsTriggering(false);
      setCountdown(null);
    }
  }, [projectId, project.status, isTriggering, onProjectUpdate]);

  // Auto-trigger primary action (only for steps 2-6, not step 1)
  useEffect(() => {
    if (stepData.suggestions && stepData.suggestions.length > 0) {
      const primaryAction = stepData.suggestions.find(s => s.primary);
      if (primaryAction && project.status !== 'DATA_COLLECTING') {
        const delay = primaryAction.autoTriggerAfter || 5;
        setCountdown(delay);
        
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);

        const timeout = setTimeout(() => {
          clearInterval(interval);
          handleAction(primaryAction.action);
        }, delay * 1000);

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      }
    }
  }, [stepData.suggestions, project.status, handleAction]);

  const renderStepContent = () => {
    switch (project.status) {
      case 'DATA_COLLECTING':
        return (
          <Step1ChatInterface
            projectId={projectId}
            onResponse={(data) => setStepData(data)}
          />
        );
      
      case 'CREATING_PROCCES':
        return (
          <Step2ProcessPlan
            project={project}
            suggestions={stepData.suggestions || []}
            onAction={handleAction}
            countdown={countdown}
            isTriggering={isTriggering}
          />
        );
      
      case 'ASSETS_RESEARCH':
        return (
          <Step3AssetsResearch
            projectId={projectId}
            project={project}
            suggestions={stepData.suggestions || []}
            onAction={handleAction}
            countdown={countdown}
            isTriggering={isTriggering}
            onProjectUpdate={onProjectUpdate}
          />
        );
      
      case 'GENERATING_2D_LAYOUT':
        return (
          <Step4Layout2D
            project={project}
            suggestions={stepData.suggestions || []}
            onAction={handleAction}
            countdown={countdown}
            isTriggering={isTriggering}
            onProjectUpdate={onProjectUpdate}
          />
        );
      
      case 'GENERATING_3D_MODEL':
        return (
          <Step5Model3D
            project={project}
            suggestions={stepData.suggestions || []}
            onAction={handleAction}
            countdown={countdown}
            isTriggering={isTriggering}
            onProjectUpdate={onProjectUpdate}
          />
        );
      
      case 'PROJECT_COMPLETED':
        return (
          <Step6Completed
            project={project}
            onProjectUpdate={onProjectUpdate}
          />
        );
      
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {renderStepContent()}
    </div>
  );
}

