/**
 * FloorPlanDrawer - View floor plan and generate realistic factory render
 */

import React, { useState, useEffect } from "react";
import { 
  Drawer, 
  Button, 
  Text, 
  Badge,
  clx,
} from "@medusajs/ui";
import { 
  Photo,
  Sparkles,
  ArrowDownTray,
  BuildingStorefront,
} from "@medusajs/icons";
import type { GeneratedFile, PlanningData } from "../../types";
import { dataApi } from "../../services/api";

interface FloorPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  floorPlan: GeneratedFile | null;
  planningData?: PlanningData;
  projectId: string;
}

// Custom icons
function CubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function FloorPlanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
    </svg>
  );
}

export function FloorPlanDrawer({ 
  isOpen, 
  onClose, 
  floorPlan,
  planningData,
  projectId,
}: FloorPlanDrawerProps) {
  const [activeTab, setActiveTab] = useState<"2d" | "3d">("2d");
  const [isGenerating, setIsGenerating] = useState(false);
  const [realisticImage, setRealisticImage] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const floorPlanUrl = floorPlan?.file_path || floorPlan?.storage_url || "";
  const identity = planningData?.industrial_identity;
  const factoryName = identity?.brand_name || identity?.company_name || "Factory";

  // Fetch existing realistic render when drawer opens
  useEffect(() => {
    if (isOpen && projectId) {
      setError(null);
      
      // Fetch existing realistic renders
      const fetchExistingRender = async () => {
        setIsLoadingExisting(true);
        try {
          const files = await dataApi.getGeneratedFiles(projectId);
          // Find the most recent realistic render
          const realisticRender = files
            .filter((f: GeneratedFile) => f.metadata?.type === "realistic_render")
            .sort((a: GeneratedFile, b: GeneratedFile) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
          
          if (realisticRender) {
            const imageUrl = realisticRender.file_path || realisticRender.storage_url;
            if (imageUrl) {
              setRealisticImage(imageUrl);
              // If we have a realistic image, default to 3D tab
              setActiveTab("3d");
            }
          } else {
            setActiveTab("2d");
          }
        } catch (err) {
          console.error("Failed to fetch existing render:", err);
          setActiveTab("2d");
        } finally {
          setIsLoadingExisting(false);
        }
      };

      fetchExistingRender();
    }
  }, [isOpen, projectId]);

  const handleGenerateRealistic = async () => {
    if (!floorPlan || !projectId) return;

    setIsGenerating(true);
    setError(null);
    setProgress("Analyzing floor plan...");

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
      
      const eventSource = new EventSource(
        `${apiBase}/projects/${projectId}/generate-realistic-render/stream`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "progress") {
          setProgress(data.message);
        } else if (data.type === "complete") {
          setRealisticImage(data.imageUrl);
          setIsGenerating(false);
          setProgress("");
          eventSource.close();
        } else if (data.type === "error") {
          setError(data.message);
          setIsGenerating(false);
          setProgress("");
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setError("Connection lost. Please try again.");
        setIsGenerating(false);
        setProgress("");
        eventSource.close();
      };

    } catch (err: any) {
      setError(err.message || "Failed to generate realistic view");
      setIsGenerating(false);
      setProgress("");
    }
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    link.click();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content className="max-w-4xl">
        <Drawer.Header>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <BuildingStorefront className="w-5 h-5 text-white" />
            </div>
            <div>
              <Drawer.Title>Factory Layout Viewer</Drawer.Title>
              <Text size="small" className="text-ui-fg-subtle">
                {factoryName}
              </Text>
            </div>
          </div>
        </Drawer.Header>

        <Drawer.Body className="p-0">
          {/* Tabs */}
          <div className="border-b border-ui-border-base bg-ui-bg-subtle">
            <div className="flex">
              <button
                onClick={() => setActiveTab("2d")}
                className={clx(
                  "flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative",
                  activeTab === "2d"
                    ? "text-ui-fg-base bg-ui-bg-base"
                    : "text-ui-fg-muted hover:text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                )}
              >
                <FloorPlanIcon className="w-4 h-4" />
                2D Floor Plan
                {activeTab === "2d" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ui-fg-interactive" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("3d")}
                className={clx(
                  "flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative",
                  activeTab === "3d"
                    ? "text-ui-fg-base bg-ui-bg-base"
                    : "text-ui-fg-muted hover:text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                )}
              >
                <CubeIcon className="w-4 h-4" />
                3D Realistic View
                {isLoadingExisting ? (
                  <Badge color="grey" size="small" className="ml-2">Loading...</Badge>
                ) : realisticImage ? (
                  <Badge color="green" size="small" className="ml-2">Ready</Badge>
                ) : null}
                {activeTab === "3d" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ui-fg-interactive" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* 2D Floor Plan Tab */}
            {activeTab === "2d" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Floor Plan Image */}
                <div className="rounded-xl border border-ui-border-base overflow-hidden bg-ui-bg-subtle">
                  <div className="p-3 border-b border-ui-border-base bg-ui-bg-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge color="blue" size="small">2D Layout</Badge>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {floorPlan?.filename}
                      </Text>
                    </div>
                    {floorPlanUrl && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleDownload(floorPlanUrl, floorPlan?.filename || "floor_plan.png")}
                        >
                          <ArrowDownTray className="w-4 h-4" />
                          Download PNG
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={async () => {
                            try {
                              const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
                              const response = await fetch(`${apiBase}/projects/${projectId}/floor-plan-dwg`);
                              
                              if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(errorText || "Failed to download DWG file");
                              }
                              
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `floor_plan_${projectId}.zip`;
                              link.click();
                              window.URL.revokeObjectURL(url);
                            } catch (error: any) {
                              console.error("Error downloading DWG:", error);
                              alert(error.message || "Failed to download DWG file");
                            }
                          }}
                          title="Downloads a ZIP file containing the DXF file and PNG image. Extract the ZIP and open the DXF file in AutoCAD."
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          </svg>
                          Download DWG
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="aspect-[16/10] bg-ui-bg-subtle flex items-center justify-center p-4">
                    {floorPlanUrl ? (
                      <img 
                        src={floorPlanUrl} 
                        alt="Floor Plan" 
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="text-center p-8">
                        <Photo className="w-12 h-12 text-ui-fg-muted mx-auto mb-2" />
                        <Text className="text-ui-fg-muted">No floor plan available</Text>
                      </div>
                    )}
                  </div>
                </div>

                {/* Factory Specs */}
                {planningData && (
                  <div className="rounded-xl border border-ui-border-base p-4 bg-ui-bg-subtle">
                    <Text size="small" weight="plus" className="text-ui-fg-muted uppercase tracking-wide mb-3">
                      Factory Specifications
                    </Text>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {planningData.facility_specifications?.dimensions && (
                        <div>
                          <Text size="xsmall" className="text-ui-fg-muted">Dimensions</Text>
                          <Text size="small" weight="plus">
                            {planningData.facility_specifications.dimensions.length}m × {planningData.facility_specifications.dimensions.width}m
                          </Text>
                        </div>
                      )}
                      {planningData.facility_specifications?.total_area && (
                        <div>
                          <Text size="xsmall" className="text-ui-fg-muted">Total Area</Text>
                          <Text size="small" weight="plus">
                            {planningData.facility_specifications.total_area.toLocaleString()} m²
                          </Text>
                        </div>
                      )}
                      {identity?.industry_sector && (
                        <div>
                          <Text size="xsmall" className="text-ui-fg-muted">Industry</Text>
                          <Text size="small" weight="plus">{identity.industry_sector}</Text>
                        </div>
                      )}
                      {planningData.production_lines?.length > 0 && (
                        <div>
                          <Text size="xsmall" className="text-ui-fg-muted">Production Lines</Text>
                          <Text size="small" weight="plus">{planningData.production_lines.length}</Text>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CTA to generate 3D */}
                {!realisticImage && (
                  <div className="rounded-xl border-2 border-dashed border-ui-border-strong p-6 text-center bg-gradient-to-br from-ui-bg-subtle to-ui-bg-base">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <CubeIcon className="w-7 h-7 text-white" />
                    </div>
                    <Text weight="plus" className="mb-1">Want to see it in 3D?</Text>
                    <Text size="small" className="text-ui-fg-subtle mb-4">
                      Generate a photorealistic visualization of your factory
                    </Text>
                    <Button
                      variant="secondary"
                      onClick={() => setActiveTab("3d")}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Go to 3D View
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 3D Realistic View Tab */}
            {activeTab === "3d" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {isLoadingExisting ? (
                  /* Loading existing render */
                  <div className="rounded-xl border border-ui-border-base p-12 text-center bg-ui-bg-subtle">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-ui-border-base border-t-ui-fg-interactive animate-spin" />
                    <Text className="text-ui-fg-subtle">Loading saved render...</Text>
                  </div>
                ) : realisticImage ? (
                  /* Show Generated Image */
                  <div className="space-y-4">
                    <div className="rounded-xl overflow-hidden border border-ui-border-base shadow-lg">
                      <div className="p-3 border-b border-ui-border-base bg-ui-bg-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge color="green" size="small" className="gap-1">
                            <SparkleIcon className="w-3 h-3" />
                            AI Generated
                          </Badge>
                          <Text size="xsmall" className="text-ui-fg-muted">
                            Photorealistic Factory View
                          </Text>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleDownload(realisticImage, `${factoryName.replace(/\s+/g, '_')}_3d_render.png`)}
                          >
                            <ArrowDownTray className="w-4 h-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="aspect-[16/10] bg-ui-bg-subtle">
                        <img 
                          src={realisticImage} 
                          alt="Realistic Factory Render" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                    {/* Regenerate Button */}
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRealisticImage(null);
                          setError(null);
                        }}
                        className="gap-2"
                      >
                        Generate New View
                      </Button>
                    </div>
                  </div>
                ) : isGenerating ? (
                  /* Generating State */
                  <div className="rounded-xl border border-ui-border-base p-12 text-center bg-gradient-to-br from-ui-bg-subtle to-ui-bg-base">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600 animate-spin" style={{ animationDuration: "2s" }} />
                      <div className="absolute inset-1 rounded-full bg-ui-bg-base flex items-center justify-center">
                        <SparkleIcon className="w-10 h-10 text-violet-500 animate-pulse" />
                      </div>
                    </div>
                    <Text className="text-lg font-semibold mb-2">Generating 3D Visualization</Text>
                    <Text className="text-ui-fg-subtle mb-4">{progress || "Please wait..."}</Text>
                    <div className="w-64 mx-auto h-2 bg-ui-bg-subtle-hover rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full animate-pulse" style={{ width: "60%" }} />
                    </div>
                  </div>
                ) : (
                  /* Generate Button */
                  <div className="rounded-xl border-2 border-dashed border-ui-border-strong p-12 text-center bg-gradient-to-br from-ui-bg-subtle to-ui-bg-base">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <CubeIcon className="w-10 h-10 text-white" />
                    </div>
                    <Text className="text-xl font-semibold mb-2">Generate 3D Realistic View</Text>
                    <Text className="text-ui-fg-subtle mb-6 max-w-md mx-auto">
                      Transform your 2D floor plan into a stunning photorealistic visualization of your factory interior using AI.
                    </Text>
                    <Button
                      variant="primary"
                      onClick={handleGenerateRealistic}
                      disabled={!floorPlanUrl}
                      className="gap-2 px-8"
                      size="large"
                    >
                      <Sparkles className="w-5 h-5" />
                      Generate Realistic View
                    </Button>
                    <Text size="xsmall" className="text-ui-fg-muted mt-4">
                      ⏱️ Takes approximately 15-30 seconds
                    </Text>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="p-4 rounded-xl bg-ui-tag-red-bg border border-ui-tag-red-border">
                    <Text className="text-ui-tag-red-text font-medium">{error}</Text>
                    <Button
                      variant="secondary"
                      size="small"
                      className="mt-3"
                      onClick={() => setError(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}

                {/* Info Box */}
                <div className="rounded-xl border border-ui-border-base p-4 bg-ui-bg-subtle">
                  <Text size="small" weight="plus" className="text-ui-fg-muted uppercase tracking-wide mb-2">
                    About 3D Rendering
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    The AI generates a photorealistic interior visualization based on your factory specifications including dimensions, industry type, production lines, and zones. Each generation creates a unique view of how your factory could look when built.
                  </Text>
                </div>
              </div>
            )}
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {realisticImage && (
                <Badge color="green" size="small">3D View Ready</Badge>
              )}
            </div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}
