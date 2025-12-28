/**
 * Full Report Generation Drawer
 * Shows step-by-step progress when generating the comprehensive industrial report
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Drawer,
  Heading,
  Text,
  Button,
  Badge,
  clx,
  ProgressTabs,
} from "@medusajs/ui";
import {
  Check,
  XMark,
  ArrowDownTray,
  Spinner,
  DocumentText,
  CheckCircleSolid,
  XCircleSolid,
  EllipseMiniSolid,
} from "@medusajs/icons";
import { dataApi } from "../../services/api";

interface ReportSection {
  id: string;
  title: string;
  subtitle: string;
}

interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  message?: string;
}

interface FullReportDrawerProps {
  projectId: string;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingReportUrl?: string;
  onReportGenerated?: () => void;
}

export function FullReportDrawer({
  projectId,
  projectName,
  open,
  onOpenChange,
  existingReportUrl,
  onReportGenerated,
}: FullReportDrawerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>([
    { id: "planning", label: "Planning Report Structure", status: "pending" },
    { id: "cover", label: "Creating Cover Page", status: "pending" },
    { id: "toc", label: "Building Table of Contents", status: "pending" },
    { id: "sections", label: "Generating Sections", status: "pending" },
    { id: "finalizing", label: "Finalizing Document", status: "pending" },
  ]);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [tocItems, setTocItems] = useState<ReportSection[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(existingReportUrl || null);
  const [isComplete, setIsComplete] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Update step status helper
  const updateStepStatus = useCallback(
    (stepId: string, status: GenerationStep["status"], message?: string) => {
      setSteps((prev) =>
        prev.map((step) =>
          step.id === stepId ? { ...step, status, message } : step
        )
      );
    },
    []
  );

  // Reset state
  const resetState = useCallback(() => {
    setIsGenerating(false);
    setSteps([
      { id: "planning", label: "Planning Report Structure", status: "pending" },
      { id: "cover", label: "Creating Cover Page", status: "pending" },
      { id: "toc", label: "Building Table of Contents", status: "pending" },
      { id: "sections", label: "Generating Sections", status: "pending" },
      { id: "finalizing", label: "Finalizing Document", status: "pending" },
    ]);
    setCurrentSection(null);
    setTocItems([]);
    setProgress(0);
    setError(null);
    setIsComplete(false);
  }, []);

  // Start report generation
  const startGeneration = useCallback(() => {
    if (isGenerating) return;

    resetState();
    setIsGenerating(true);
    setError(null);

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const streamUrl = dataApi.getFullReportStreamUrl(projectId);
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      console.log("Status:", data);
    });

    eventSource.addEventListener("planning", (e) => {
      const data = JSON.parse(e.data);
      updateStepStatus("planning", "active", data.message);
      setProgress(data.progress || 0);

      if (data.tocItems) {
        setTocItems(data.tocItems);
        // Once TOC is received, mark planning as complete
        updateStepStatus("planning", "completed");
        updateStepStatus("cover", "active", "Creating cover page...");
      }
    });

    eventSource.addEventListener("section", (e) => {
      const data = JSON.parse(e.data);
      setCurrentSection(data.section);
      setProgress(data.progress || 0);

      // Update step statuses based on section
      if (data.section === "Cover Page") {
        updateStepStatus("cover", "active", "Creating cover page...");
      } else if (data.section === "Table of Contents") {
        updateStepStatus("cover", "completed");
        updateStepStatus("toc", "active", "Building table of contents...");
      } else {
        // It's a content section
        updateStepStatus("toc", "completed");
        updateStepStatus("sections", "active", `Generating: ${data.section}`);
      }
    });

    eventSource.addEventListener("generating", (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.progress || 0);
      if (data.progress >= 95) {
        updateStepStatus("sections", "completed");
        updateStepStatus("finalizing", "active", data.message);
      }
    });

    eventSource.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setProgress(100);
      updateStepStatus("finalizing", "active", data.message);
    });

    eventSource.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      console.log("Done event received:", data);
      if (data.success) {
        updateStepStatus("finalizing", "completed");
        const url = dataApi.getFullReportDownloadUrl(projectId);
        console.log("Setting download URL:", url);
        setDownloadUrl(url);
        setIsComplete(true);
        setIsGenerating(false);
        onReportGenerated?.();
      } else {
        setIsGenerating(false);
      }
      eventSource.close();
    });

    eventSource.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setError(data.message || "An error occurred");
      } catch {
        setError("Connection lost. Please try again.");
      }
      setIsGenerating(false);

      // Mark current step as error
      setSteps((prev) =>
        prev.map((step) =>
          step.status === "active" ? { ...step, status: "error" } : step
        )
      );

      eventSource.close();
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        // Normal close, ignore
        return;
      }
      setError("Connection lost. Please try again.");
      setIsGenerating(false);
      eventSource.close();
    };
  }, [projectId, isGenerating, resetState, updateStepStatus, onReportGenerated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Update downloadUrl when existingReportUrl changes
  useEffect(() => {
    if (existingReportUrl) {
      setDownloadUrl(dataApi.getFullReportDownloadUrl(projectId));
      setIsComplete(true);
    }
  }, [existingReportUrl, projectId]);

  // Get step icon
  const getStepIcon = (status: GenerationStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircleSolid className="w-5 h-5 text-ui-tag-green-icon" />;
      case "active":
        return <Spinner className="w-5 h-5 text-ui-tag-blue-icon animate-spin" />;
      case "error":
        return <XCircleSolid className="w-5 h-5 text-ui-tag-red-icon" />;
      default:
        return <EllipseMiniSolid className="w-5 h-5 text-ui-fg-muted" />;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-lg">
        <Drawer.Header>
          <Drawer.Title>
            <div className="flex items-center gap-x-3">
              <div className="w-10 h-10 rounded-lg bg-ui-tag-purple-bg flex items-center justify-center">
                <DocumentText className="w-5 h-5 text-ui-tag-purple-icon" />
              </div>
              <div>
                <Heading level="h2">Full Industrial Report</Heading>
                <Text size="small" className="text-ui-fg-muted">
                  Comprehensive financial & industrial analysis
                </Text>
              </div>
            </div>
          </Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="p-6">
          {/* Progress Bar */}
          {isGenerating && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <Text size="small" className="text-ui-fg-subtle">
                  Generation Progress
                </Text>
                <Badge color="blue" size="small">
                  {progress}%
                </Badge>
              </div>
              <div className="w-full h-2 bg-ui-bg-subtle rounded-full overflow-hidden">
                <div
                  className="h-full bg-ui-tag-purple-icon transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-3 mb-6">
            {steps.map((step) => (
              <div
                key={step.id}
                className={clx(
                  "flex items-start gap-x-3 p-3 rounded-lg transition-colors",
                  step.status === "active" && "bg-ui-bg-subtle",
                  step.status === "completed" && "bg-ui-tag-green-bg/30",
                  step.status === "error" && "bg-ui-tag-red-bg/30"
                )}
              >
                <div className="flex-shrink-0 mt-0.5">{getStepIcon(step.status)}</div>
                <div className="flex-1 min-w-0">
                  <Text
                    weight="plus"
                    size="small"
                    className={clx(
                      step.status === "completed" && "text-ui-tag-green-text",
                      step.status === "error" && "text-ui-tag-red-text"
                    )}
                  >
                    {step.label}
                  </Text>
                  {step.message && (
                    <Text size="xsmall" className="text-ui-fg-muted truncate">
                      {step.message}
                    </Text>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Current Section */}
          {currentSection && isGenerating && (
            <div className="mb-6 p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
              <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-1">
                Currently Generating
              </Text>
              <Text weight="plus" className="text-ui-fg-base">
                {currentSection}
              </Text>
            </div>
          )}

          {/* TOC Preview */}
          {tocItems.length > 0 && (
            <div className="mb-6">
              <Text
                size="small"
                weight="plus"
                className="text-ui-fg-muted mb-3"
              >
                Report Sections ({tocItems.length})
              </Text>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {tocItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={clx(
                      "flex items-center gap-x-2 text-sm py-1",
                      currentSection === item.title && "text-ui-fg-interactive font-medium"
                    )}
                  >
                    <span className="text-ui-fg-muted w-5 text-right">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ui-fg-subtle">—</span>
                    <span className="truncate">{item.title}</span>
                    {currentSection === item.title && (
                      <Badge color="blue" size="2xsmall">
                        Active
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-ui-tag-red-bg rounded-lg border border-ui-tag-red-border">
              <div className="flex items-start gap-x-2">
                <XCircleSolid className="w-5 h-5 text-ui-tag-red-icon flex-shrink-0" />
                <div>
                  <Text weight="plus" size="small" className="text-ui-tag-red-text">
                    Generation Failed
                  </Text>
                  <Text size="xsmall" className="text-ui-tag-red-text/80">
                    {error}
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {isComplete && !isGenerating && (
            <div className="mb-6 p-4 bg-ui-tag-green-bg rounded-lg border border-ui-tag-green-border">
              <div className="flex items-start gap-x-3">
                <CheckCircleSolid className="w-6 h-6 text-ui-tag-green-icon flex-shrink-0" />
                <div>
                  <Text weight="plus" className="text-ui-tag-green-text">
                    Report Ready!
                  </Text>
                  <Text size="small" className="text-ui-tag-green-text/80">
                    Your comprehensive industrial report has been generated successfully.
                  </Text>
                </div>
              </div>
            </div>
          )}
        </Drawer.Body>

        <Drawer.Footer>
          <div className="flex items-center gap-x-3 w-full">
            {/* Close button */}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {isComplete ? "Close" : "Cancel"}
            </Button>

            {/* Generate or Download button */}
            {isComplete ? (
              <Button variant="primary" className="flex-1" asChild>
                <a 
                  href={downloadUrl || dataApi.getFullReportDownloadUrl(projectId)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ArrowDownTray className="mr-2" />
                  Download Report (PDF)
                </a>
              </Button>
            ) : (
              <Button
                variant="primary"
                className="flex-1"
                onClick={startGeneration}
                disabled={isGenerating}
                isLoading={isGenerating}
              >
                {isGenerating ? "Generating..." : existingReportUrl ? "Regenerate Report" : "Generate Report"}
              </Button>
            )}
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

