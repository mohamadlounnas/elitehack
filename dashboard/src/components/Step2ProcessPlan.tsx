/**
 * Step 2: Process Planning
 * Shows process plan with action buttons
 */

import { Button } from '@medusajs/ui';
import { Loader2, ArrowRight, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Project } from '@/types';

interface Step2ProcessPlanProps {
  project: Project;
  suggestions: Array<{ action: string; label: string; primary?: boolean }>;
  onAction: (action: string) => void;
  countdown: number | null;
  isTriggering: boolean;
}

export default function Step2ProcessPlan({
  project,
  suggestions,
  onAction,
  countdown,
  isTriggering,
}: Step2ProcessPlanProps) {
  const processPlan = project.creating_procces_result;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-ui-bg-base">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <FileText className="w-12 h-12 text-ui-fg-interactive mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Process Planning Complete</h2>
          <p className="text-ui-fg-subtle">Production line plan has been created</p>
        </div>

        <div className="bg-ui-bg-subtle rounded-lg border border-ui-border-base p-6 mb-6">
          {processPlan ? (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-small">
                {JSON.stringify(processPlan, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-center text-ui-fg-subtle">
              Process plan will appear here...
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
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
      </div>
    </div>
  );
}

