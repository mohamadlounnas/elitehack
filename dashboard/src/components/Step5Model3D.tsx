/**
 * Step 5: 3D Model Generation
 * Shows 3D model with download/view options
 */

import { useState, useEffect } from 'react';
import { Button } from '@medusajs/ui';
import { Loader2, ArrowRight, RefreshCw, CheckCircle2, Download, Eye } from 'lucide-react';
import type { Project } from '@/types';

interface Step5Model3DProps {
  project: Project;
  suggestions: Array<{ action: string; label: string; primary?: boolean }>;
  onAction: (action: string) => void;
  countdown: number | null;
  isTriggering: boolean;
  onProjectUpdate: () => void;
}

export default function Step5Model3D({
  project,
  suggestions,
  onAction,
  countdown,
  isTriggering,
  onProjectUpdate,
}: Step5Model3DProps) {
  const [isGenerating, setIsGenerating] = useState(!project.model_3d_url);
  const hasModel = !!project.model_3d_url;

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        onProjectUpdate();
        if (project.model_3d_url) {
          setIsGenerating(false);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isGenerating, project.model_3d_url, onProjectUpdate]);

  const primarySuggestion = suggestions.find(s => s.primary) || suggestions[0];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-ui-bg-base">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">3D Model Generation</h2>
          <p className="text-ui-fg-subtle">3D CAD model of your production line</p>
        </div>

        <div className="bg-ui-bg-subtle rounded-lg border border-ui-border-base p-8 mb-6 min-h-[400px] flex items-center justify-center">
          {isGenerating || !hasModel ? (
            <div className="w-full">
              <div className="animate-pulse space-y-4">
                <div className="h-64 bg-ui-bg-subtle-hover rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-ui-bg-subtle-hover rounded w-3/4"></div>
                  <div className="h-4 bg-ui-bg-subtle-hover rounded w-1/2"></div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Loader2 className="w-5 h-5 animate-spin text-ui-fg-interactive" />
                <span className="text-ui-fg-subtle">Generating 3D model...</span>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <div className="bg-ui-bg-base rounded-lg p-8 border-2 border-dashed border-ui-border-base text-center">
                <Eye className="w-16 h-16 text-ui-fg-subtle mx-auto mb-4" />
                <div className="text-lg font-medium mb-2">3D Model Ready</div>
                <div className="text-ui-fg-subtle mb-4">CAD file generated successfully</div>
                <div className="flex items-center justify-center gap-2 text-ui-fg-subtle">
                  <CheckCircle2 className="w-5 h-5 text-ui-fg-success" />
                  <span>Model URL: {project.model_3d_url}</span>
                </div>
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => window.open(project.model_3d_url || '', '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download 3D Model
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isGenerating && hasModel && suggestions.length > 0 && (
          <div className="flex items-center justify-center gap-3">
            {suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                onClick={() => onAction(suggestion.action)}
                variant={suggestion.primary ? 'primary' : 'secondary'}
                disabled={isTriggering}
              >
                {isTriggering && suggestion.primary ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {suggestion.label}
                    {suggestion.primary && countdown !== null && countdown > 0 && (
                      <span className="ml-2 text-xs opacity-75">({countdown}s)</span>
                    )}
                    {suggestion.action === 'next' && <ArrowRight className="w-4 h-4 ml-2" />}
                  </>
                )}
              </Button>
            ))}
          </div>
        )}

        {isGenerating && primarySuggestion && (
          <div className="text-center">
            <p className="text-ui-fg-subtle mb-4">
              3D model generation in progress. This may take a few moments...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

