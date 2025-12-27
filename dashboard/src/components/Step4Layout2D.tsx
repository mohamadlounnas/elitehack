/**
 * Step 4: 2D Layout Generation
 * Shows layout image with shimmer effect while generating
 */

import { useState, useEffect } from 'react';
import { Button } from '@medusajs/ui';
import { Loader2, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { Project } from '@/types';

interface Step4Layout2DProps {
  project: Project;
  suggestions: Array<{ action: string; label: string; primary?: boolean }>;
  onAction: (action: string) => void;
  countdown: number | null;
  isTriggering: boolean;
  onProjectUpdate: () => void;
}

export default function Step4Layout2D({
  project,
  suggestions,
  onAction,
  countdown,
  isTriggering,
  onProjectUpdate,
}: Step4Layout2DProps) {
  const [isGenerating, setIsGenerating] = useState(!project.layout_2d_url);
  const hasLayout = !!project.layout_2d_url;

  useEffect(() => {
    // Poll for layout updates
    if (isGenerating) {
      const interval = setInterval(() => {
        onProjectUpdate();
        if (project.layout_2d_url) {
          setIsGenerating(false);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isGenerating, project.layout_2d_url, onProjectUpdate]);

  const primarySuggestion = suggestions.find(s => s.primary) || suggestions[0];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-ui-bg-base">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">2D Layout Generation</h2>
          <p className="text-ui-fg-subtle">Visual layout of your production line</p>
        </div>

        {/* Layout Display Area */}
        <div className="bg-ui-bg-subtle rounded-lg border border-ui-border-base p-8 mb-6 min-h-[400px] flex items-center justify-center">
          {isGenerating || !hasLayout ? (
            <div className="w-full">
              {/* Shimmer Effect */}
              <div className="animate-pulse space-y-4">
                <div className="h-64 bg-ui-bg-subtle-hover rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-ui-bg-subtle-hover rounded w-3/4"></div>
                  <div className="h-4 bg-ui-bg-subtle-hover rounded w-1/2"></div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Loader2 className="w-5 h-5 animate-spin text-ui-fg-interactive" />
                <span className="text-ui-fg-subtle">Generating 2D layout...</span>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <img
                src={project.layout_2d_url || ''}
                alt="2D Layout"
                className="w-full h-auto rounded-lg"
                onError={() => setIsGenerating(true)}
              />
              <div className="mt-4 flex items-center justify-center gap-2 text-ui-fg-subtle">
                <CheckCircle2 className="w-5 h-5 text-ui-fg-success" />
                <span>Layout generated successfully</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isGenerating && hasLayout && suggestions.length > 0 && (
          <div className="flex items-center justify-center gap-3">
            {suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                onClick={() => onAction(suggestion.action)}
                variant={suggestion.primary ? 'primary' : 'secondary'}
                disabled={isTriggering}
                className="relative"
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
                    {suggestion.action === 'retry' && <RefreshCw className="w-4 h-4 ml-2" />}
                  </>
                )}
              </Button>
            ))}
          </div>
        )}

        {isGenerating && primarySuggestion && (
          <div className="text-center">
            <p className="text-ui-fg-subtle mb-4">
              Layout generation in progress. This may take a few moments...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

