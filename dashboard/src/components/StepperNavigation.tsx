/**
 * Stepper Navigation Component
 * Shows the current step and allows navigation between steps
 */

import { Badge } from '@medusajs/ui';
import type { ProjectStatus } from '@/types';

interface StepperNavigationProps {
  currentStep: ProjectStatus;
  onStepClick?: (step: ProjectStatus) => void;
}

const STEP_ORDER: ProjectStatus[] = [
  'DATA_COLLECTING',
  'CREATING_PROCCES',
  'ASSETS_RESEARCH',
  'GENERATING_2D_LAYOUT',
  'GENERATING_3D_MODEL',
  'PROJECT_COMPLETED',
];

const STEP_LABELS: Record<ProjectStatus, string> = {
  DATA_COLLECTING: 'Step 1: Data Collection',
  CREATING_PROCCES: 'Step 2: Process Planning',
  ASSETS_RESEARCH: 'Step 3: Assets Research',
  GENERATING_2D_LAYOUT: 'Step 4: 2D Layout',
  GENERATING_3D_MODEL: 'Step 5: 3D Model',
  PROJECT_COMPLETED: 'Step 6: Completed',
};

export default function StepperNavigation({ currentStep, onStepClick }: StepperNavigationProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  
  return (
    <div className="flex items-center gap-2 px-6 py-4 border-b border-ui-border-base bg-ui-bg-base">
      {STEP_ORDER.map((step, index) => {
        const isActive = step === currentStep;
        const isCompleted = index < currentIndex;
        const isClickable = onStepClick && (isCompleted || isActive);
        
        return (
          <div key={step} className="flex items-center gap-2">
            <button
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-ui-fg-interactive text-ui-bg-base'
                  : isCompleted
                  ? 'bg-ui-bg-subtle-hover text-ui-fg-base hover:bg-ui-bg-subtle cursor-pointer'
                  : 'bg-ui-bg-subtle text-ui-fg-subtle cursor-not-allowed'
              }`}
            >
              <span className="text-small font-medium">
                {STEP_LABELS[step].replace(/^Step \d+: /, '')}
              </span>
              {isCompleted && (
                <span className="text-xs">✓</span>
              )}
            </button>
            {index < STEP_ORDER.length - 1 && (
              <div className={`w-8 h-0.5 ${
                index < currentIndex ? 'bg-ui-fg-interactive' : 'bg-ui-border-base'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

