import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Heading, Text, Badge, StatusBadge, Code, Skeleton, Container, Button } from "@medusajs/ui";
import { Check } from "@medusajs/icons";
import type { ProjectStep } from "../types";
import { useStepTimer } from "../hooks/useStepTimer";
import { planningApi } from "../services/api";

import type { Supplier, GeneratedFile, TCOCalculation, ProjectMessage, Asset } from "../types";
import { PlanningResponseView } from "./completed/PlanningResponseView";
import { LayoutResponseView } from "./completed/LayoutResponseView";
import { AssetsResponseView } from "./completed/AssetsResponseView";
import { SuppliersResponseView } from "./completed/SuppliersResponseView";
import { CostAnalysisResponseView } from "./completed/CostAnalysisResponseView";
import { ChatResponseView } from "./completed/ChatResponseView";
import { FinancialReportsView } from "./completed/FinancialReportsView";

interface StepDetailsProps {
  projectId: string;
  currentStep: ProjectStep;
  planningData?: any;
  assets?: Asset[];
  suppliers?: Supplier[];
  generatedFiles?: GeneratedFile[];
  tco?: TCOCalculation | null | undefined;
  messages?: ProjectMessage[];
  project?: any; // Project data including business_plan_excel
}

interface StreamUpdate {
  type: string;
  step: string;
  content?: string;
  asset?: { id: string; name: string };
  supplier?: { name: string; location: string; website?: string };
  imageUrl?: string;
  layoutType?: "floor_plan" | "atex_zones" | "agv_routing";
  progress?: number;
  total?: number;
  message?: string;
}

export function StepDetails({ 
  projectId, 
  currentStep, 
  planningData, 
  assets = [], 
  suppliers = [], 
  generatedFiles = [], 
  tco,
  messages = [],
  project
}: StepDetailsProps) {
  const [streamContent, setStreamContent] = useState<string>("");
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [streamAssets, setStreamAssets] = useState<Map<string, any>>(new Map());
  const [streamSuppliers, setStreamSuppliers] = useState<Map<string, any[]>>(new Map());
  const [streamLayouts, setStreamLayouts] = useState<Map<string, string>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [isForcingNext, setIsForcingNext] = useState(false);
  
  // Determine if current step involves text streaming
  const textStreamingSteps: ProjectStep[] = ["planning", "cost_analysing", "layoutGenerating"];
  const isTextStreamingStep = textStreamingSteps.includes(currentStep);
  const { formattedTime } = useStepTimer(isStreaming && isTextStreamingStep);

  useEffect(() => {
    setStreamContent("");
    setStreamProgress(0);
    setStreamAssets(new Map());
    setStreamSuppliers(new Map());
    setStreamLayouts(new Map());
    setIsStreaming(false);
    setIsForcingNext(false);

    const streamableSteps = ["planning", "layoutGenerating", "assetsImagesGenerating", "sourcing", "cost_analysing"];
    if (!streamableSteps.includes(currentStep)) return;

    setIsStreaming(true);
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api"}/projects/${projectId}/stream`
    );

    const handleEvent = (event: MessageEvent) => {
      try {
        const data: StreamUpdate = JSON.parse(event.data);
        if (data.step === currentStep) {
          if (data.content) setStreamContent(data.content);
          if (data.progress !== undefined) setStreamProgress(data.progress);
          if (data.asset && data.imageUrl) {
            setStreamAssets((prev) => new Map(prev).set(data.asset!.id, { ...data.asset, imageUrl: data.imageUrl }));
          }
          if (data.asset && data.supplier) {
            setStreamSuppliers((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(data.asset!.id) || [];
              if (!existing.find((s) => s.name === data.supplier!.name)) {
                newMap.set(data.asset!.id, [...existing, data.supplier!]);
              }
              return newMap;
            });
          }
          if (data.layoutType && data.imageUrl) {
            setStreamLayouts((prev) => new Map(prev).set(data.layoutType!, data.imageUrl!));
            if (data.progress !== undefined) {
              setStreamProgress(data.progress);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing stream data:", error);
      }
    };

    eventSource.addEventListener("status", handleEvent);
    eventSource.addEventListener("update", handleEvent);
    eventSource.addEventListener("progress", handleEvent);
    const handleComplete = (event: MessageEvent) => {
      handleEvent(event);
      setIsStreaming(false);
    };
    
    eventSource.addEventListener("complete", handleComplete);
    eventSource.onmessage = handleEvent;
    eventSource.onerror = () => {
      eventSource.close();
      setIsStreaming(false);
    };

    return () => {
      eventSource.close();
      setIsStreaming(false);
    };
  }, [projectId, currentStep]);

  // Layout names and order - shared between layoutGenerating and layoutGenerated cases
  const layoutNames: Record<string, string> = {
    floor_plan: "Factory Floor Plan",
    atex_zones: "ATEX Zones",
    agv_routing: "AGV Routing",
  };
  const layoutOrder = ["floor_plan", "atex_zones", "agv_routing"];

  const renderContent = () => {
    switch (currentStep) {
      case "planning":
        return (
          <Container className="flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <div className="w-2 h-2 bg-ui-bg-interactive rounded-full animate-pulse" />
                <Text size="small" className="text-ui-fg-subtle">Planning...</Text>
              </div>
              {isStreaming && (
                <div className="flex items-center gap-x-2">
                  <div className="w-1.5 h-1.5 bg-ui-bg-interactive rounded-full animate-pulse" />
                  <Text size="xsmall" className="text-ui-fg-muted font-mono">
                    {formattedTime}
                  </Text>
                </div>
              )}
            </div>
            {streamContent && (
              <Code className="whitespace-pre-wrap text-sm block p-3 bg-ui-bg-subtle rounded">
                {streamContent}
              </Code>
            )}
            {streamProgress > 0 && (
              <div className="w-full bg-ui-bg-subtle rounded-full h-1.5">
                <div className="bg-ui-bg-interactive h-1.5 rounded-full transition-all" style={{ width: `${streamProgress}%` }} />
              </div>
            )}
          </Container>
        );

      case "planed":
        return planningData ? (
          <Container className="p-6 border border-ui-border-base">
            <div className="prose prose-sm max-w-none 
              prose-headings:text-ui-fg-base prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
              prose-p:text-ui-fg-subtle prose-p:leading-relaxed prose-p:my-2
              prose-strong:text-ui-fg-base prose-strong:font-semibold
              prose-ul:text-ui-fg-subtle prose-ul:my-2 prose-ul:pl-4
              prose-li:text-ui-fg-subtle prose-li:my-1
              prose-h1:text-xl prose-h1:text-ui-fg-base
              prose-h2:text-lg prose-h2:text-ui-fg-base
              prose-h3:text-base prose-h3:text-ui-fg-base
              dark:prose-invert">
              <ReactMarkdown>{formatPlanningDataAsMarkdown(planningData)}</ReactMarkdown>
            </div>
          </Container>
        ) : (
          <Container className="p-6 border border-ui-border-base">
            <Text className="text-ui-fg-subtle">Planning data will be available once planning is complete.</Text>
          </Container>
        );

      case "layoutGenerating":
        return (
          <Container className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <div className="w-2 h-2 bg-ui-bg-interactive rounded-full animate-pulse" />
                <Text size="small" className="text-ui-fg-subtle">
                  Generating layouts... {streamLayouts.size} / {layoutOrder.length}
                </Text>
              </div>
              <div className="flex items-center gap-x-3">
                {isStreaming && (
                  <div className="flex items-center gap-x-2">
                    <div className="w-1.5 h-1.5 bg-ui-bg-interactive rounded-full animate-pulse" />
                    <Text size="xsmall" className="text-ui-fg-muted font-mono">
                      {formattedTime}
                    </Text>
                  </div>
                )}
                {streamProgress > 0 && (
                  <div className="w-48 bg-ui-bg-subtle rounded-full h-1.5">
                    <div className="bg-ui-bg-interactive h-1.5 rounded-full transition-all" style={{ width: `${(streamProgress / layoutOrder.length) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-6">
              {layoutOrder.map((layoutType) => {
                const imageUrl = streamLayouts.get(layoutType);
                
                return (
                  <div key={layoutType} className="flex flex-col gap-y-3">
                    {/* Layout Header */}
                    <div className="flex items-center justify-between">
                      <Text weight="plus" size="small">{layoutNames[layoutType]}</Text>
                      {imageUrl && (
                        <Badge color="green" size="small">Generated</Badge>
                      )}
                    </div>
                    
                    {/* Image Display */}
                    {imageUrl ? (
                      <div className="w-full bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden relative group" style={{ minHeight: "400px" }}>
                        <img 
                          src={imageUrl} 
                          alt={layoutNames[layoutType]} 
                          className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'text-sm text-ui-fg-subtle p-4 text-center';
                            errorDiv.textContent = 'Failed to load image. Please refresh the page.';
                            target.parentElement?.appendChild(errorDiv);
                          }}
                          onClick={() => {
                            window.open(imageUrl, '_blank');
                          }}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge color="grey" size="small" className="cursor-pointer">
                            Click to view full size
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full bg-ui-bg-subtle rounded border border-ui-border-base flex items-center justify-center" style={{ minHeight: "400px" }}>
                        <Skeleton className="w-full" style={{ minHeight: "400px" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Container>
        );

      case "layoutGenerated": {
        // Get layout files from generatedFiles
        const layoutFiles = generatedFiles.filter(f => f.metadata?.type === "2d_layout");
        
        // Create a map of layout type to file for easy lookup
        const layoutFileMap = new Map<string, GeneratedFile>();
        layoutFiles.forEach(file => {
          const layoutType = file.metadata?.layout_type;
          if (layoutType) {
            layoutFileMap.set(layoutType, file);
          }
        });
        
        return (
          <Container className="flex flex-col gap-y-4">
            <div className="flex items-center gap-x-2">
              <StatusBadge color="green"><Check /> Layouts Generated</StatusBadge>
              <Text size="small" className="text-ui-fg-subtle">
                All {layoutFiles.length} layout diagrams have been generated.
              </Text>
            </div>
            
            <div className="space-y-6">
              {layoutOrder.map((layoutType) => {
                const file = layoutFileMap.get(layoutType);
                const imageUrl = file?.file_path;
                
                return (
                  <div key={layoutType} className="flex flex-col gap-y-3">
                    {/* Layout Header */}
                    <div className="flex items-center justify-between">
                      <Text weight="plus" size="small">{layoutNames[layoutType]}</Text>
                      {imageUrl && (
                        <Badge color="green" size="small">Complete</Badge>
                      )}
                    </div>
                    
                    {/* Image Display */}
                    {imageUrl ? (
                      <div className="w-full bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden relative group" style={{ minHeight: "400px" }}>
                        <img 
                          src={imageUrl} 
                          alt={layoutNames[layoutType]} 
                          className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'text-sm text-ui-fg-subtle p-4 text-center';
                            errorDiv.textContent = 'Failed to load image. Please refresh the page.';
                            target.parentElement?.appendChild(errorDiv);
                          }}
                          onClick={() => {
                            window.open(imageUrl, '_blank');
                          }}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge color="grey" size="small" className="cursor-pointer">
                            Click to view full size
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full bg-ui-bg-subtle rounded border border-ui-border-base flex items-center justify-center" style={{ minHeight: "400px" }}>
                        <Text size="small" className="text-ui-fg-muted">Layout not available</Text>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Container>
        );
      }

      case "assetsImagesGenerating":
        // Combine stream assets with existing assets from database
        const displayedAssets = new Map<string, any>();
        
        // First, add assets from database that already have images
        assets.forEach(asset => {
          if (asset.image_url && asset.image_generated) {
            displayedAssets.set(asset.id, {
              id: asset.id,
              name: asset.name,
              imageUrl: asset.image_url
            });
          }
        });
        
        // Then, add/update with stream assets (these take precedence if streaming)
        streamAssets.forEach((streamAsset, id) => {
          displayedAssets.set(id, streamAsset);
        });
        
        const allImagesGenerated = displayedAssets.size >= assets.length && assets.length > 0;
        const hasExistingImages = assets.some(a => a.image_url && a.image_generated);
        
        const handleForceNext = async () => {
          setIsForcingNext(true);
          try {
            await planningApi.retryStep(projectId);
            // Reload the page after a short delay to show the new step
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } catch (error) {
            console.error("Error forcing next step:", error);
            setIsForcingNext(false);
          }
        };
        
        return (
          <Container className="flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <Text size="small" className="text-ui-fg-subtle">
                {hasExistingImages && !isStreaming 
                  ? `Loaded ${displayedAssets.size} / ${assets.length} images...`
                  : `Generating ${displayedAssets.size} / ${assets.length} images...`
                }
              </Text>
              {allImagesGenerated && !isStreaming && (
                <Button 
                  onClick={handleForceNext} 
                  variant="secondary" 
                  size="small"
                  disabled={isForcingNext}
                >
                  {isForcingNext ? "Moving to next step..." : "Force Next Step"}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from(displayedAssets.values()).map((asset) => (
                <Container key={asset.id} className="p-3">
                  <Text weight="plus" size="small" className="mb-2">{asset.name}</Text>
                  {asset.imageUrl && (
                    <div className="w-full h-24 bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden">
                      <img src={asset.imageUrl} alt={asset.name} className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                </Container>
              ))}
              {assets.filter((a) => !displayedAssets.has(a.id)).map((asset) => (
                <Container key={asset.id} className="p-3 opacity-50">
                  <Text weight="plus" size="small" className="mb-2">{asset.name}</Text>
                  <Skeleton className="w-full h-24 rounded" />
                </Container>
              ))}
            </div>
          </Container>
        );

      case "assetsImagesGenerated":
        return (
          <Container className="flex flex-col gap-y-3">
            <StatusBadge color="green"><Check /> Complete</StatusBadge>
            <div className="grid grid-cols-2 gap-3">
              {assets.map((asset) => (
                <Container key={asset.id} className="p-3">
                  <Text weight="plus" size="small" className="mb-1">{asset.name}</Text>
                  {asset.description && <Text size="small" className="text-ui-fg-subtle mb-2">{asset.description}</Text>}
                  {asset.image_url && (
                    <div className="w-full h-24 bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden">
                      <img src={asset.image_url} alt={asset.name} className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                </Container>
              ))}
            </div>
          </Container>
        );

      case "sourcing":
        return (
          <Container className="flex flex-col gap-y-3">
            <Text size="small" className="text-ui-fg-subtle">Sourcing suppliers...</Text>
            {Array.from(streamSuppliers.entries()).map(([assetId, suppliers]) => {
              const asset = assets.find((a) => a.id === assetId);
              return (
                <Container key={assetId} className="p-3">
                  <Text weight="plus" size="small" className="mb-2">{asset?.name || "Asset"}</Text>
                  <div className="flex flex-col gap-y-1">
                    {suppliers.map((supplier, idx) => (
                      <Container key={idx} className="p-2 bg-ui-bg-subtle">
                        <Text weight="plus" size="small">{supplier.name}</Text>
                        <Text size="small" className="text-ui-fg-subtle">{supplier.location}</Text>
                        {supplier.website && (
                          <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-xs text-ui-fg-interactive hover:underline block mt-1">
                            {supplier.website}
                          </a>
                        )}
                      </Container>
                    ))}
                  </div>
                </Container>
              );
            })}
          </Container>
        );

      case "sourced":
        return (
          <Container>
            <StatusBadge color="green"><Check /> Sourcing complete</StatusBadge>
          </Container>
        );

      case "negotiating":
        return (
          <Container>
            <Text className="text-ui-fg-subtle">Negotiating with suppliers...</Text>
          </Container>
        );

      case "negotiated":
        return (
          <Container>
            <StatusBadge color="green"><Check /> Negotiation complete</StatusBadge>
          </Container>
        );

      case "cost_analysing":
        return (
          <Container className="flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <div className="w-2 h-2 bg-ui-bg-interactive rounded-full animate-pulse" />
                <Text size="small" className="text-ui-fg-subtle">Analyzing costs...</Text>
              </div>
              {isStreaming && (
                <div className="flex items-center gap-x-2">
                  <div className="w-1.5 h-1.5 bg-ui-bg-interactive rounded-full animate-pulse" />
                  <Text size="xsmall" className="text-ui-fg-muted font-mono">
                    {formattedTime}
                  </Text>
                </div>
              )}
            </div>
            {streamContent && (
              <Code className="whitespace-pre-wrap text-sm block p-3 bg-ui-bg-subtle rounded">
                {streamContent}
              </Code>
            )}
            {streamProgress > 0 && (
              <div className="w-full bg-ui-bg-subtle rounded-full h-1.5">
                <div className="bg-ui-bg-interactive h-1.5 rounded-full transition-all" style={{ width: `${streamProgress}%` }} />
              </div>
            )}
          </Container>
        );

      case "cost_analysed":
        return (
          <Container>
            <StatusBadge color="green"><Check /> Cost analysis complete</StatusBadge>
          </Container>
        );

      case "completed": {
        const layoutFiles = generatedFiles.filter(f => f.metadata?.type === "2d_layout");

        return (
          <div className="flex flex-col gap-y-6">
            {/* Completion Header */}
            <Container className="flex flex-col items-center py-8 bg-ui-bg-subtle rounded-lg">
              <div className="w-16 h-16 bg-ui-tag-green-bg rounded-full flex items-center justify-center mb-4 shadow-lg">
                <Check className="w-8 h-8 text-ui-tag-green-text" />
              </div>
              <Heading level="h2" className="mb-2">Project Completed!</Heading>
              <Text className="text-ui-fg-subtle text-center max-w-md">
                All steps have been finished successfully. Review the complete project data below.
              </Text>
            </Container>

            {/* Step Responses - Organized by workflow order */}
            <div className="space-y-6">
              {/* 1. Chat/Requirements */}
              <ChatResponseView messages={messages} />

              {/* 2. Planning Response */}
              <PlanningResponseView planningData={planningData} />

              {/* 3. Layout Generation Response */}
              <LayoutResponseView layoutFiles={layoutFiles} />

              {/* 4. Assets Response */}
              <AssetsResponseView assets={assets} />

              {/* 5. Suppliers Response */}
              <SuppliersResponseView suppliers={suppliers} />

              {/* 6. Cost Analysis Response */}
              <CostAnalysisResponseView tco={tco ?? null} projectId={projectId} />

              {/* 7. Financial Reports */}
              <FinancialReportsView tco={tco ?? null} project={project ?? null} />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center gap-x-2">
        <Heading level="h2">{getStepTitle(currentStep)}</Heading>
        {isStreaming && <Badge color="blue" size="small">Live</Badge>}
      </div>
      {renderContent()}
    </div>
  );
}

function getStepTitle(step: ProjectStep): string {
  const titles: Record<ProjectStep, string> = {
    chat: "Chat & Requirements",
    planning: "Planning",
    planed: "Plan Complete",
    layoutGenerating: "Generating Layouts",
    layoutGenerated: "Layouts Complete",
    assetsImagesGenerating: "Generating Images",
    assetsImagesGenerated: "Images Complete",
    sourcing: "Sourcing Suppliers",
    sourced: "Sourcing Complete",
    negotiating: "Negotiating",
    negotiated: "Negotiation Complete",
    cost_analysing: "Cost Analysis",
    cost_analysed: "Analysis Complete",
    completed: "Completed",
  };
  return titles[step] || step;
}

function formatPlanningDataAsMarkdown(data: any): string {
  if (!data || typeof data !== 'object') {
    return "No planning data available.";
  }

  let markdown = "# Factory Planning Report\n\n";
  let hasContent = false;

  if (data.production_process) {
    markdown += `## Production Process\n\n${data.production_process}\n\n`;
    hasContent = true;
  }
  
  if (data.factory_dimensions && (data.factory_dimensions.width || data.factory_dimensions.length || data.factory_dimensions.height)) {
    markdown += `## Factory Dimensions\n\n`;
    if (data.factory_dimensions.width) markdown += `- **Width:** ${data.factory_dimensions.width}m\n`;
    if (data.factory_dimensions.length) markdown += `- **Length:** ${data.factory_dimensions.length}m\n`;
    if (data.factory_dimensions.height) markdown += `- **Height:** ${data.factory_dimensions.height}m\n`;
    if (data.factory_dimensions.floors) markdown += `- **Floors:** ${data.factory_dimensions.floors}\n`;
    markdown += `\n`;
    hasContent = true;
  }
  
  if (Array.isArray(data.machinery) && data.machinery.length > 0) {
    markdown += `## Required Machinery\n\n`;
    data.machinery.forEach((machine: string) => markdown += `- ${machine}\n`);
    markdown += `\n`;
    hasContent = true;
  }
  
  if (Array.isArray(data.assets) && data.assets.length > 0) {
    markdown += `## Assets & Equipment\n\n`;
    data.assets.forEach((asset: any) => {
      if (asset && asset.name) {
        markdown += `### ${asset.name}\n\n`;
        if (asset.type) markdown += `**Type:** ${asset.type}\n\n`;
        if (asset.description) markdown += `${asset.description}\n\n`;
      }
    });
    hasContent = true;
  }
  
  if (Array.isArray(data.materials) && data.materials.length > 0) {
    markdown += `## Materials Required\n\n`;
    data.materials.forEach((material: string) => markdown += `- ${material}\n`);
    markdown += `\n`;
    hasContent = true;
  }
  
  if (data.capacity) {
    markdown += `## Production Capacity\n\n${data.capacity}\n\n`;
    hasContent = true;
  }

  // Handle any other properties that might exist
  Object.keys(data).forEach((key) => {
    if (!['production_process', 'factory_dimensions', 'machinery', 'assets', 'materials', 'capacity'].includes(key)) {
      const value = data[key];
      if (value && (typeof value === 'string' || Array.isArray(value))) {
        markdown += `## ${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}\n\n`;
        if (typeof value === 'string') {
          markdown += `${value}\n\n`;
        } else if (Array.isArray(value)) {
          value.forEach((item: any) => markdown += `- ${item}\n`);
          markdown += `\n`;
        }
        hasContent = true;
      }
    }
  });

  if (!hasContent) {
    return "Planning data is available but no details have been generated yet.";
  }

  return markdown;
}
