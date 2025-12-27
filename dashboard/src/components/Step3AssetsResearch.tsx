/**
 * Step 3: Assets Research
 * Shows assets research progress with action buttons
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '@medusajs/ui';
import { Loader2, ArrowRight, RefreshCw, Package } from 'lucide-react';
import type { Project } from '@/types';

interface Step3AssetsResearchProps {
  projectId: string;
  project: Project;
  suggestions: Array<{ action: string; label: string; primary?: boolean }>;
  onAction: (action: string) => void;
  countdown: number | null;
  isTriggering: boolean;
  onProjectUpdate: () => void;
}

export default function Step3AssetsResearch({
  projectId,
  project,
  suggestions,
  onAction,
  countdown,
  isTriggering,
  onProjectUpdate,
}: Step3AssetsResearchProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssets();
    const interval = setInterval(loadAssets, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadAssets = async () => {
    try {
      // TODO: Update to use assets API when ready
      // const data = await api.getAssets(projectId);
      // setAssets(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load assets:', error);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-ui-bg-base">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <Package className="w-12 h-12 text-ui-fg-interactive mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Assets Research</h2>
          <p className="text-ui-fg-subtle">Researching machines, equipment, and suppliers</p>
        </div>

        <div className="bg-ui-bg-subtle rounded-lg border border-ui-border-base p-6 mb-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-ui-fg-interactive" />
              <span className="text-ui-fg-subtle">Researching assets...</span>
            </div>
          ) : assets.length > 0 ? (
            <div className="space-y-4">
              {assets.map((asset: any, idx: number) => (
                <div key={idx} className="p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                  <div className="font-medium">{asset.name}</div>
                  {asset.description && (
                    <div className="text-small text-ui-fg-subtle mt-1">{asset.description}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-ui-fg-subtle py-8">
              Assets will appear here once research is complete...
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
                    {suggestion.action === 'retry' && <RefreshCw className="w-4 h-4 ml-2" />}
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

