/**
 * Step 6: Project Completed
 * Shows PDF report with download button
 */

import { useState, useEffect } from 'react';
import { Button } from '@medusajs/ui';
import { Download, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import type { Project } from '@/types';

interface Step6CompletedProps {
  project: Project;
  onProjectUpdate: () => void;
}

export default function Step6Completed({ project, onProjectUpdate }: Step6CompletedProps) {
  const [isGenerating, setIsGenerating] = useState(!project.report_pdf_url);
  const hasReport = !!project.report_pdf_url;

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        onProjectUpdate();
        if (project.report_pdf_url) {
          setIsGenerating(false);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isGenerating, project.report_pdf_url, onProjectUpdate]);

  const handleDownload = () => {
    if (project.report_pdf_url) {
      window.open(project.report_pdf_url, '_blank');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-ui-bg-base">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-ui-fg-success/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-ui-fg-success" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Project Completed!</h2>
          <p className="text-ui-fg-subtle">Your production line plan is ready</p>
        </div>

        <div className="bg-ui-bg-subtle rounded-lg border border-ui-border-base p-8 mb-6">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-ui-fg-interactive mb-4" />
              <div className="text-lg font-medium mb-2">Generating Final Report</div>
              <div className="text-ui-fg-subtle">Creating comprehensive PDF report...</div>
            </div>
          ) : hasReport ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="w-16 h-16 text-ui-fg-interactive mb-4" />
              <div className="text-lg font-medium mb-2">Report Ready</div>
              <div className="text-ui-fg-subtle mb-6">
                Your complete production line plan is available for download
              </div>
              <Button
                variant="primary"
                size="large"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="w-5 h-5" />
                Download PDF Report
              </Button>
            </div>
          ) : (
            <div className="text-center text-ui-fg-subtle py-12">
              Report will be available here once generation is complete...
            </div>
          )}
        </div>

        {hasReport && (
          <div className="bg-ui-bg-base rounded-lg border border-ui-border-base p-6">
            <h3 className="font-semibold mb-4">Project Summary</h3>
            <div className="space-y-2 text-small">
              <div className="flex justify-between">
                <span className="text-ui-fg-subtle">Project Name:</span>
                <span className="font-medium">{project.name}</span>
              </div>
              {project.description && (
                <div className="flex justify-between">
                  <span className="text-ui-fg-subtle">Description:</span>
                  <span className="font-medium">{project.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ui-fg-subtle">Status:</span>
                <span className="font-medium text-ui-fg-success">Completed</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

