import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Heading, Text, Badge, StatusBadge, Code, Skeleton, Container, Button, Checkbox, Label } from "@medusajs/ui";
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
  onStreamingStatusChange?: (isStreaming: boolean) => void;
  onErrorStatusChange?: (hasError: boolean) => void;
}

interface StreamUpdate {
  type: string;
  step: string;
  content?: string;
  asset?: { id: string; name: string; type?: string };
  supplier?: SupplierStreamData;
  suppliers?: SupplierStreamData[];
  imageUrl?: string;
  layoutType?: "floor_plan" | "atex_zones" | "agv_routing";
  progress?: number;
  total?: number;
  message?: string;
  // Identity generation fields
  colors?: { primary: string; secondary: string };
  logoUrl?: string;
}

interface SupplierStreamData {
  name: string;
  website?: string;
  email?: string;
  phone?: string;
  location: string;
  country: string;
  address?: string;
  contact_person?: string;
  products?: string[];
  specializations?: string[];
  certifications?: string[];
  years_in_business?: number;
  company_size?: string;
  description?: string;
  rating?: number;
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
  project,
  onStreamingStatusChange,
  onErrorStatusChange
}: StepDetailsProps) {
  const [streamContent, setStreamContent] = useState<string>("");
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [streamAssets, setStreamAssets] = useState<Map<string, any>>(new Map());
  const [streamSuppliers, setStreamSuppliers] = useState<Map<string, any[]>>(new Map());
  const [streamLayouts, setStreamLayouts] = useState<Map<string, string>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [isForcingNext, setIsForcingNext] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Asset selection state (for assetSelection step)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [isSelectionSaving, setIsSelectionSaving] = useState(false);
  
  // Initialize selected assets when assets prop changes
  useEffect(() => {
    if (currentStep === "assetSelection" && assets.length > 0) {
      // Check if any asset has selected_for_processing defined
      const hasSelectionData = assets.some(a => a.selected_for_processing !== undefined);
      if (hasSelectionData) {
        // Use existing selection from database
        setSelectedAssets(new Set(assets.filter(a => a.selected_for_processing !== false).map(a => a.id)));
      } else {
        // Default to all selected
        setSelectedAssets(new Set(assets.map(a => a.id)));
      }
    }
  }, [assets, currentStep]);
  
  // Determine if current step involves text streaming
  const textStreamingSteps: ProjectStep[] = ["planning", "identityGenerating", "cost_analysing", "layoutGenerating"];
  const isTextStreamingStep = textStreamingSteps.includes(currentStep);
  const { formattedTime } = useStepTimer(isStreaming && isTextStreamingStep);

  // Notify parent when streaming status changes
  useEffect(() => {
    onStreamingStatusChange?.(isStreaming);
  }, [isStreaming, onStreamingStatusChange]);

  // Notify parent when error status changes
  useEffect(() => {
    onErrorStatusChange?.(hasError);
  }, [hasError, onErrorStatusChange]);

  useEffect(() => {
    setStreamContent("");
    setStreamProgress(0);
    setStreamAssets(new Map());
    setStreamSuppliers(new Map());
    setStreamLayouts(new Map());
    setIsStreaming(false);
    setIsForcingNext(false);
    setHasError(false); // Reset error state when step changes

    const streamableSteps = ["planning", "identityGenerating", "layoutGenerating", "assetsImagesGenerating", "sourcing", "cost_analysing"];
    if (!streamableSteps.includes(currentStep)) return;

    setIsStreaming(true);
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api"}/projects/${projectId}/stream`
    );

    const handleEvent = (event: MessageEvent) => {
      try {
        const data: StreamUpdate = JSON.parse(event.data);
        console.log("[StepDetails] SSE event received:", { 
          eventType: event.type, 
          step: data.step, 
          type: data.type, 
          layoutType: data.layoutType, 
          hasImageUrl: !!data.imageUrl,
          hasSuppliers: !!data.suppliers,
          message: data.message
        });
        
        if (data.step === currentStep) {
          // Update message/content
          if (data.message) setStreamContent(data.message);
          else if (data.content) setStreamContent(data.content);
          
          // Update progress
          if (data.progress !== undefined) setStreamProgress(data.progress);
          
          // Handle asset image updates
          if (data.asset && data.imageUrl) {
            setStreamAssets((prev) => new Map(prev).set(data.asset!.id, { ...data.asset, imageUrl: data.imageUrl }));
          }
          
          // Handle supplier updates - single supplier
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
          
          // Handle supplier updates - multiple suppliers (asset_complete)
          if (data.asset && data.suppliers && data.suppliers.length > 0) {
            console.log("[StepDetails] Received suppliers for asset:", data.asset.name, data.suppliers.length);
            setStreamSuppliers((prev) => {
              const newMap = new Map(prev);
              newMap.set(data.asset!.id, data.suppliers!);
              return newMap;
            });
          }
          
          // Handle layout updates - update as each layout completes
          if (data.layoutType) {
            console.log("[StepDetails] Layout update:", { layoutType: data.layoutType, type: data.type, hasImageUrl: !!data.imageUrl });
            if (data.imageUrl) {
              console.log("[StepDetails] Setting layout image for:", data.layoutType);
              setStreamLayouts((prev) => {
                const newMap = new Map(prev);
                newMap.set(data.layoutType!, data.imageUrl!);
                console.log("[StepDetails] streamLayouts updated, size:", newMap.size);
                return newMap;
              });
            }
            if (data.progress !== undefined) {
              setStreamProgress(data.progress);
            }
          }
          
          // Handle identity generation updates (colors and logo)
          if (data.step === "identityGenerating") {
            // Update status message
            if (data.content) {
              setStreamContent(data.content);
            }
            // Update progress
            if (data.progress !== undefined) {
              setStreamProgress(data.progress);
            }
            // Update colors
            if (data.colors) {
              setStreamAssets((prev) => new Map(prev).set("colors", data.colors));
            }
            // Update logo
            if (data.logoUrl) {
              setStreamAssets((prev) => new Map(prev).set("logoUrl", data.logoUrl));
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
    
    // Handle error events from the server
    const handleError = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.error("[StepDetails] SSE error event:", data);
        setStreamContent(`Error: ${data.message || "An error occurred"}`);
        // Set error state to prevent auto-advance
        setHasError(true);
        setIsStreaming(false);
      } catch (e) {
        console.error("[StepDetails] Error parsing error event:", e);
        setHasError(true);
        setIsStreaming(false);
      }
    };
    
    eventSource.addEventListener("complete", handleComplete);
    eventSource.addEventListener("error", handleError);
    eventSource.onmessage = handleEvent;
    eventSource.onerror = (e) => {
      console.error("[StepDetails] EventSource connection error:", e);
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

      case "identityGenerating": {
        const colorsData = streamAssets.get("colors");
        const logoUrlData = streamAssets.get("logoUrl");
        const displayPrimaryColor = colorsData?.primary || project?.primary_color;
        const displaySecondaryColor = colorsData?.secondary || project?.secondary_color;
        const displayLogoUrl = logoUrlData || project?.logo_url;
        
        return (
          <Container className="flex flex-col gap-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
              <div className="flex items-center gap-x-3">
                {isStreaming && streamProgress < 100 && (
                  <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" />
                )}
                {streamProgress === 100 && <Check className="w-5 h-5 text-green-500" />}
                <Text weight="plus" size="base">Brand Identity Generation</Text>
              </div>
              <Badge color={streamProgress === 100 ? "green" : "purple"} size="small">
                {streamProgress || 0}%
              </Badge>
            </div>

            {/* Status Message */}
            <div className="flex items-center gap-x-2 p-3 bg-ui-bg-subtle rounded-lg">
              {isStreaming && streamProgress < 100 ? (
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              ) : (
                <Check className="w-4 h-4 text-green-500" />
              )}
              <Text size="small" className="text-ui-fg-subtle">
                {streamContent || "Initializing brand identity generation..."}
              </Text>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-ui-bg-subtle rounded-full h-2.5">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${streamProgress || 0}%` }} 
              />
            </div>

            {/* Steps Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Step 1: Analysis */}
              <div className={`p-4 rounded-lg border ${streamProgress >= 10 ? 'bg-green-50 border-green-200' : 'bg-ui-bg-subtle border-ui-border-base'}`}>
                <div className="flex items-center gap-x-2 mb-2">
                  {streamProgress >= 10 ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-ui-border-base" />
                  )}
                  <Text size="small" weight="plus">1. Analysis</Text>
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Analyzing project requirements
                </Text>
              </div>

              {/* Step 2: Colors */}
              <div className={`p-4 rounded-lg border ${streamProgress >= 50 ? 'bg-green-50 border-green-200' : streamProgress >= 30 ? 'bg-purple-50 border-purple-200' : 'bg-ui-bg-subtle border-ui-border-base'}`}>
                <div className="flex items-center gap-x-2 mb-2">
                  {streamProgress >= 50 ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : streamProgress >= 30 ? (
                    <div className="w-4 h-4 rounded-full bg-purple-500 animate-pulse" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-ui-border-base" />
                  )}
                  <Text size="small" weight="plus">2. Color Palette</Text>
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Creating professional colors
                </Text>
              </div>

              {/* Step 3: Logo */}
              <div className={`p-4 rounded-lg border ${streamProgress >= 80 ? 'bg-green-50 border-green-200' : streamProgress >= 60 ? 'bg-purple-50 border-purple-200' : 'bg-ui-bg-subtle border-ui-border-base'}`}>
                <div className="flex items-center gap-x-2 mb-2">
                  {streamProgress >= 80 ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : streamProgress >= 60 ? (
                    <div className="w-4 h-4 rounded-full bg-purple-500 animate-pulse" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-ui-border-base" />
                  )}
                  <Text size="small" weight="plus">3. Logo Design</Text>
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Generating professional logo
                </Text>
              </div>
            </div>

            {/* Results Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Color Preview */}
              <div className={`p-4 rounded-lg border ${displayPrimaryColor ? 'bg-white border-ui-border-base' : 'bg-ui-bg-subtle border-dashed border-ui-border-base'}`}>
                <Text weight="plus" size="small" className="mb-3 flex items-center gap-x-2">
                  {displayPrimaryColor ? <Check className="w-3 h-3 text-green-500" /> : null}
                  Color Palette
                </Text>
                {displayPrimaryColor ? (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <div 
                        className="w-16 h-16 rounded-xl shadow-lg border-2 border-white" 
                        style={{ backgroundColor: displayPrimaryColor }}
                      />
                      <Text size="xsmall" className="text-ui-fg-muted">Primary</Text>
                      <Text size="xsmall" className="font-mono text-ui-fg-subtle bg-ui-bg-subtle px-2 py-0.5 rounded">
                        {displayPrimaryColor}
                      </Text>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div 
                        className="w-16 h-16 rounded-xl shadow-lg border-2 border-white" 
                        style={{ backgroundColor: displaySecondaryColor || "#3B82F6" }}
                      />
                      <Text size="xsmall" className="text-ui-fg-muted">Secondary</Text>
                      <Text size="xsmall" className="font-mono text-ui-fg-subtle bg-ui-bg-subtle px-2 py-0.5 rounded">
                        {displaySecondaryColor || "#3B82F6"}
                      </Text>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24">
                    <Text size="small" className="text-ui-fg-muted">
                      {streamProgress >= 30 ? "Generating colors..." : "Waiting..."}
                    </Text>
                  </div>
                )}
              </div>

              {/* Logo Preview */}
              <div className={`p-4 rounded-lg border ${displayLogoUrl ? 'bg-white border-ui-border-base' : 'bg-ui-bg-subtle border-dashed border-ui-border-base'}`}>
                <Text weight="plus" size="small" className="mb-3 flex items-center gap-x-2">
                  {displayLogoUrl ? <Check className="w-3 h-3 text-green-500" /> : null}
                  Generated Logo
                </Text>
                {displayLogoUrl ? (
                  <div 
                    className="flex justify-center items-center p-4 rounded-lg"
                    style={{ backgroundColor: displayPrimaryColor || '#0F172A' }}
                  >
                    <img 
                      src={displayLogoUrl} 
                      alt="Brand Logo"
                      className="max-w-[120px] max-h-[120px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24">
                    <Text size="small" className="text-ui-fg-muted">
                      {streamProgress >= 60 ? "Generating logo..." : "Waiting for colors..."}
                    </Text>
                  </div>
                )}
              </div>
            </div>

            {/* Completion Message */}
            {streamProgress === 100 && (
              <div className="flex items-center gap-x-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <Text size="small" className="text-green-700 font-medium">
                    Brand identity generated successfully!
                  </Text>
                  <Text size="xsmall" className="text-green-600">
                    Moving to next step...
                  </Text>
                </div>
              </div>
            )}
          </Container>
        );
      }

      case "assetSelection": {
        // Asset selection step - user selects which assets to process
        // State is managed at component level: selectedAssets, isSelectionSaving
        
        const toggleAsset = (assetId: string) => {
          setSelectedAssets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(assetId)) {
              newSet.delete(assetId);
            } else {
              newSet.add(assetId);
            }
            return newSet;
          });
        };
        
        const selectAll = () => setSelectedAssets(new Set(assets.map(a => a.id)));
        const deselectAll = () => setSelectedAssets(new Set());
        
        const handleContinue = async () => {
          setIsSelectionSaving(true);
          try {
            // Save selected assets to backend
            await planningApi.saveSelectedAssets(projectId, Array.from(selectedAssets));
            // Trigger next step
            await planningApi.nextStep(projectId);
            window.location.reload();
          } catch (error) {
            console.error("Error saving asset selection:", error);
            setIsSelectionSaving(false);
          }
        };
        
        // Group assets by type
        const assetsByType = assets.reduce((acc, asset) => {
          const type = asset.type || "Other";
          if (!acc[type]) acc[type] = [];
          acc[type].push(asset);
          return acc;
        }, {} as Record<string, typeof assets>);
        
        return (
          <Container className="flex flex-col gap-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ui-border-base pb-4">
              <div>
                <Text weight="plus" size="large">Select Assets to Process</Text>
                <Text size="small" className="text-ui-fg-muted mt-1">
                  Choose which equipment and machinery to include in image generation, sourcing, and cost analysis
                </Text>
              </div>
              <Badge color="blue" size="small">
                {selectedAssets.size} / {assets.length} selected
              </Badge>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-x-2">
              <Button variant="secondary" size="small" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="secondary" size="small" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
            
            {/* Assets grouped by type */}
            <div className="space-y-4">
              {Object.entries(assetsByType).map(([type, typeAssets]) => (
                <div key={type} className="border border-ui-border-base rounded-lg overflow-hidden">
                  {/* Type Header */}
                  <div className="bg-ui-bg-subtle px-4 py-2 border-b border-ui-border-base flex items-center justify-between">
                    <Text weight="plus" size="small">{type}</Text>
                    <Badge color="grey" size="2xsmall">{typeAssets.length} items</Badge>
                  </div>
                  
                  {/* Assets */}
                  <div className="divide-y divide-ui-border-base">
                    {typeAssets.map((asset) => {
                      const isSelected = selectedAssets.has(asset.id);
                      return (
                        <div 
                          key={asset.id}
                          className={`flex items-center gap-x-4 px-4 py-3 cursor-pointer hover:bg-ui-bg-subtle-hover transition-colors ${
                            isSelected ? "bg-blue-50/50" : ""
                          }`}
                          onClick={() => toggleAsset(asset.id)}
                        >
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleAsset(asset.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-x-2">
                              <Text weight="plus" size="small">{asset.name}</Text>
                              {asset.specifications?.estimated_cost_usd && (
                                <Badge color="green" size="2xsmall">
                                  ${asset.specifications.estimated_cost_usd.toLocaleString()}
                                </Badge>
                              )}
                            </div>
                            {asset.description && (
                              <Text size="xsmall" className="text-ui-fg-muted line-clamp-1 mt-0.5">
                                {asset.description}
                              </Text>
                            )}
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-x-1">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <Text size="xsmall" className="text-green-600">Selected</Text>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            {assets.length === 0 && (
              <div className="text-center py-8 bg-ui-bg-subtle rounded-lg border border-dashed border-ui-border-base">
                <Text className="text-ui-fg-muted">No assets found from planning.</Text>
                <Text size="small" className="text-ui-fg-muted mt-1">
                  Please go back to the planning step to generate assets.
                </Text>
              </div>
            )}
            
            {/* Info Panel */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-x-3">
                <span className="text-blue-500 text-lg">💡</span>
                <div>
                  <Text size="small" weight="plus" className="text-blue-700">
                    What happens next?
                  </Text>
                  <Text size="xsmall" className="text-blue-600 mt-1">
                    Selected assets will be processed through:
                  </Text>
                  <ul className="text-blue-600 text-xs mt-2 space-y-1">
                    <li>• <strong>Image Generation:</strong> AI-generated visuals for each asset</li>
                    <li>• <strong>Supplier Sourcing:</strong> Finding 3-5 suppliers per asset</li>
                    <li>• <strong>Cost Analysis:</strong> Detailed TCO calculations</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Continue Button */}
            <div className="flex justify-end pt-4 border-t border-ui-border-base">
              <Button 
                variant="primary"
                onClick={handleContinue}
                disabled={selectedAssets.size === 0 || isSelectionSaving}
              >
                {isSelectionSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue with {selectedAssets.size} assets
                  </>
                )}
              </Button>
            </div>
          </Container>
        );
      }

      case "layoutGenerating": {
        // Determine current generating layout based on progress
        const currentLayoutIndex = Math.max(0, streamProgress - 1);
        const currentlyGenerating = streamProgress > 0 && streamProgress <= layoutOrder.length 
          ? layoutOrder[currentLayoutIndex] 
          : null;
        const completedCount = streamLayouts.size;
        
        return (
          <Container className="flex flex-col gap-y-4">
            {/* Header with progress */}
            <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
              <div className="flex items-center gap-x-3">
                {isStreaming && (
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                )}
                <Text weight="plus" size="base">
                  Layout Generation
                </Text>
                <Badge color={completedCount === layoutOrder.length ? "green" : "blue"} size="small">
                  {completedCount} / {layoutOrder.length}
                </Badge>
              </div>
              <div className="flex items-center gap-x-3">
                {isStreaming && (
                  <Text size="xsmall" className="text-ui-fg-muted font-mono bg-ui-bg-subtle px-2 py-1 rounded">
                      {formattedTime}
                    </Text>
                )}
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-ui-bg-subtle rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${(completedCount / layoutOrder.length) * 100}%` }} 
              />
            </div>
            
            {/* Layout Cards */}
            <div className="space-y-4">
              {layoutOrder.map((layoutType, index) => {
                const imageUrl = streamLayouts.get(layoutType);
                const isCurrentlyGenerating = currentlyGenerating === layoutType && !imageUrl;
                const isCompleted = !!imageUrl;
                const isPending = index > streamProgress - 1 && !imageUrl;
                
                return (
                  <div 
                    key={layoutType} 
                    className={`rounded-lg border transition-all duration-300 ${
                      isCompleted 
                        ? "border-ui-border-base bg-white" 
                        : isCurrentlyGenerating 
                          ? "border-blue-300 bg-blue-50/30" 
                          : "border-ui-border-base bg-ui-bg-subtle opacity-60"
                    }`}
                  >
                    {/* Layout Header */}
                    <div className="flex items-center justify-between p-3 border-b border-ui-border-base">
                      <div className="flex items-center gap-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCompleted 
                            ? "bg-green-100 text-green-700" 
                            : isCurrentlyGenerating 
                              ? "bg-blue-100 text-blue-700" 
                              : "bg-ui-bg-subtle text-ui-fg-muted"
                        }`}>
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                        </div>
                        <Text weight="plus" size="small">{layoutNames[layoutType]}</Text>
                      </div>
                      {isCompleted && (
                        <Badge color="green" size="small">Complete</Badge>
                      )}
                      {isCurrentlyGenerating && (
                        <div className="flex items-center gap-x-2">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          <Badge color="blue" size="small">Generating...</Badge>
                        </div>
                      )}
                      {isPending && (
                        <Badge color="grey" size="small">Pending</Badge>
                      )}
                    </div>
                    
                    {/* Image Display */}
                    <div className="p-3">
                      {isCompleted ? (
                        <div 
                          className="w-full bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden relative group cursor-pointer hover:shadow-md transition-shadow" 
                          style={{ minHeight: "300px" }}
                          onClick={() => window.open(imageUrl, '_blank')}
                        >
                        <img 
                          src={imageUrl} 
                          alt={layoutNames[layoutType]} 
                            className="max-w-full max-h-[400px] object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'text-sm text-ui-fg-subtle p-4 text-center';
                              errorDiv.textContent = 'Failed to load image';
                            target.parentElement?.appendChild(errorDiv);
                          }}
                        />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                            <Badge color="grey" size="small" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to view full size
                          </Badge>
                        </div>
                      </div>
                      ) : isCurrentlyGenerating ? (
                        <div 
                          className="w-full rounded border border-blue-200 flex flex-col items-center justify-center gap-y-3 bg-gradient-to-br from-blue-50 to-white" 
                          style={{ minHeight: "200px" }}
                        >
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                          <Text size="small" className="text-blue-600 font-medium">
                            AI is generating {layoutNames[layoutType].toLowerCase()}...
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-muted">
                            This may take 30-60 seconds
                          </Text>
                        </div>
                      ) : (
                        <div 
                          className="w-full rounded border border-dashed border-ui-border-base flex items-center justify-center bg-ui-bg-subtle" 
                          style={{ minHeight: "120px" }}
                        >
                          <Text size="small" className="text-ui-fg-muted">
                            Waiting for previous layouts to complete
                          </Text>
                      </div>
                    )}
                    </div>
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

      case "sourcing": {
        const sourcedAssetIds = Array.from(streamSuppliers.keys());
        const completedAssets = sourcedAssetIds.length;
        const totalAssets = assets.length;
        const progressPercent = totalAssets > 0 ? (completedAssets / totalAssets) * 100 : 0;
        
        return (
          <Container className="flex flex-col gap-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
              <div className="flex items-center gap-x-3">
                {isStreaming && (
                  <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" />
                )}
                <Text weight="plus" size="base">
                  Elite Supplier Sourcing
                </Text>
                <Badge color={completedAssets === totalAssets ? "green" : "purple"} size="small">
                  {completedAssets} / {totalAssets} Assets
                </Badge>
                    </div>
              {isStreaming && (
                <Text size="xsmall" className="text-ui-fg-muted font-mono bg-ui-bg-subtle px-2 py-1 rounded">
                  {formattedTime}
                </Text>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-ui-bg-subtle rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>

            {/* Status message */}
            {streamContent && (
              <div className="flex items-center gap-x-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                <Text size="small" className="text-purple-700">{streamContent}</Text>
              </div>
            )}

            {/* Assets with their suppliers */}
            <div className="space-y-4">
              {assets.map((asset, index) => {
                const assetSuppliers = streamSuppliers.get(asset.id) || [];
                const isSearching = isStreaming && sourcedAssetIds.length === index;
                const isComplete = sourcedAssetIds.includes(asset.id);
                const isPending = !isSearching && !isComplete;
                
        return (
                  <div 
                    key={asset.id}
                    className={`rounded-lg border transition-all duration-300 ${
                      isComplete 
                        ? "border-ui-border-base bg-white" 
                        : isSearching 
                          ? "border-purple-300 bg-purple-50/30" 
                          : "border-ui-border-base bg-ui-bg-subtle opacity-60"
                    }`}
                  >
                    {/* Asset Header */}
                    <div className="flex items-center justify-between p-3 border-b border-ui-border-base">
                      <div className="flex items-center gap-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          isComplete 
                            ? "bg-green-100 text-green-700" 
                            : isSearching 
                              ? "bg-purple-100 text-purple-700" 
                              : "bg-ui-bg-subtle text-ui-fg-muted"
                        }`}>
                          {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                        </div>
                        <div>
                          <Text weight="plus" size="small">{asset.name}</Text>
                          {asset.type && (
                            <Text size="xsmall" className="text-ui-fg-muted">{asset.type}</Text>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-x-2">
                        {isComplete && (
                          <Badge color="green" size="small">
                            {assetSuppliers.length} Suppliers
                          </Badge>
                        )}
                        {isSearching && (
                          <>
                            <div className="flex space-x-1">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                            <Badge color="purple" size="small">Searching...</Badge>
                          </>
                        )}
                        {isPending && (
                          <Badge color="grey" size="small">Pending</Badge>
                        )}
                      </div>
                    </div>

                    {/* Suppliers Grid */}
                    {isComplete && assetSuppliers.length > 0 && (
                      <div className="p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {assetSuppliers.map((supplier: SupplierStreamData, idx: number) => (
                            <div 
                              key={idx}
                              className={`p-3 rounded-lg border ${
                                idx === 0 
                                  ? "border-green-300 bg-green-50/50" 
                                  : "border-ui-border-base bg-ui-bg-subtle"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-x-2">
                                    <Text weight="plus" size="small" className="line-clamp-1">
                                      {supplier.name}
                                    </Text>
                                    {idx === 0 && (
                                      <Badge color="green" size="2xsmall">Preferred</Badge>
                                    )}
                                  </div>
                                  <Text size="xsmall" className="text-ui-fg-muted">
                                    {supplier.location}
                                  </Text>
                                </div>
                                {supplier.rating && (
                                  <div className="flex items-center gap-x-1 bg-yellow-100 px-1.5 py-0.5 rounded">
                                    <span className="text-yellow-600 text-xs">★</span>
                                    <Text size="xsmall" className="font-medium text-yellow-700">
                                      {supplier.rating.toFixed(1)}
                                    </Text>
                                  </div>
                                )}
                              </div>

                              {/* Contact Info */}
                              <div className="space-y-1 text-xs">
                                {supplier.website && (
                                  <a 
                                    href={supplier.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:underline flex items-center gap-x-1 truncate"
                                  >
                                    🌐 {supplier.website.replace(/^https?:\/\//, '')}
                                  </a>
                                )}
                                {supplier.email && (
                                  <a 
                                    href={`mailto:${supplier.email}`}
                                    className="text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-x-1"
                                  >
                                    ✉️ {supplier.email}
                                  </a>
                                )}
                                {supplier.phone && (
                                  <a 
                                    href={`tel:${supplier.phone}`}
                                    className="text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-x-1"
                                  >
                                    📞 {supplier.phone}
                                  </a>
                                )}
                              </div>

                              {/* Certifications */}
                              {supplier.certifications && supplier.certifications.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {supplier.certifications.slice(0, 3).map((cert: string, i: number) => (
                                    <span 
                                      key={i}
                                      className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium"
                                    >
                                      {cert}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Company Size & Years */}
                              <div className="flex items-center gap-x-3 mt-2 text-[10px] text-ui-fg-muted">
                                {supplier.company_size && (
                                  <span>📊 {supplier.company_size}</span>
                                )}
                                {supplier.years_in_business && (
                                  <span>🏢 {supplier.years_in_business}+ years</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Searching Animation */}
                    {isSearching && (
                      <div className="p-6 flex flex-col items-center justify-center gap-y-2">
                        <div className="w-12 h-12 border-3 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                        <Text size="small" className="text-purple-600 font-medium">
                          Searching global supplier networks...
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-muted">
                          Filtering for Algeria-compliant suppliers
                        </Text>
                      </div>
                    )}

                    {/* Pending State */}
                    {isPending && (
                      <div className="p-4 flex items-center justify-center">
                        <Text size="small" className="text-ui-fg-muted">
                          Waiting for previous assets...
                        </Text>
                      </div>
                    )}
                  </div>
              );
            })}
            </div>

            {/* Compliance Notice */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-x-2">
                <span className="text-blue-500">🛡️</span>
                <div>
                  <Text size="small" weight="plus" className="text-blue-700">Compliance Verified</Text>
                  <Text size="xsmall" className="text-blue-600">
                    All suppliers are pre-screened for Algeria trade compliance. Prohibited regions automatically excluded.
                  </Text>
                </div>
              </div>
            </div>
          </Container>
        );
      }

      case "negotiating":
        return (
          <Container>
            <Text className="text-ui-fg-subtle">Negotiating with suppliers...</Text>
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

      case "completed": {
        const layoutFiles = generatedFiles.filter(f => f.metadata?.type === "2d_layout");
        
        // Calculate summary stats
        const totalAssets = assets.length;
        const totalSuppliers = suppliers.length;
        const totalInvestment = tco?.breakdown?.initial_investment?.total || 0;
        const roi = tco?.breakdown?.financial_metrics?.roi || 0;
        const paybackYears = tco?.breakdown?.financial_metrics?.payback_period_years || 0;

        return (
          <div className="flex flex-col gap-y-4">
            {/* Hero Section - Success Banner */}
            <Container className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10" />
              <div className="relative flex items-center justify-between px-6 py-6">
                <div className="flex items-center gap-x-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <Check className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <Heading level="h2" className="text-ui-fg-base">
                      Industrial Dossier Complete
                    </Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      All analysis phases completed successfully • Ready for investment review
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-x-2">
                  <Badge color="green" size="small" className="px-3 py-1">
                    Investment Ready
                  </Badge>
                </div>
              </div>
            </Container>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Container className="p-4 hover:shadow-md transition-shadow">
                <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide mb-1">
                  Total Investment
                </Text>
                <Text weight="plus" className="text-lg text-ui-fg-base">
                  ${totalInvestment.toLocaleString()}
                </Text>
              </Container>
              <Container className="p-4 hover:shadow-md transition-shadow">
                <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide mb-1">
                  ROI
                </Text>
                <Text weight="plus" className="text-lg text-emerald-600">
                  {roi.toFixed(1)}%
                </Text>
              </Container>
              <Container className="p-4 hover:shadow-md transition-shadow">
                <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide mb-1">
                  Payback Period
                </Text>
                <Text weight="plus" className="text-lg text-ui-fg-base">
                  {paybackYears.toFixed(1)} years
                </Text>
              </Container>
              <Container className="p-4 hover:shadow-md transition-shadow">
                <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide mb-1">
                  Equipment
                </Text>
                <Text weight="plus" className="text-lg text-ui-fg-base">
                  {totalAssets} assets
                </Text>
              </Container>
              <Container className="p-4 hover:shadow-md transition-shadow">
                <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide mb-1">
                  Suppliers
                </Text>
                <Text weight="plus" className="text-lg text-ui-fg-base">
                  {totalSuppliers} verified
                </Text>
              </Container>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-4">
              {/* Main Content */}
              <div className="flex flex-col gap-y-4">
                {/* Planning & Strategy */}
                <PlanningResponseView planningData={planningData} />
                
                {/* Factory Layouts */}
                <LayoutResponseView layoutFiles={layoutFiles} />
                
                {/* Cost Analysis & Financials */}
                <CostAnalysisResponseView tco={tco ?? null} projectId={projectId} />
              </div>

              {/* Sidebar */}
              <div className="flex flex-col gap-y-4">
                {/* Quick Actions */}
                <Container className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <Heading level="h3" className="text-sm">Quick Actions</Heading>
                  </div>
                  <div className="space-y-2">
                    {project?.cost_analysis_pdf && (
                      <a 
                        href={project.cost_analysis_pdf} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg border border-ui-border-base hover:bg-ui-bg-subtle hover:border-ui-border-strong transition-colors group"
                      >
                        <div className="flex items-center gap-x-3">
                          <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center">
                            <span className="text-red-600 text-sm">PDF</span>
                          </div>
                          <div>
                            <Text size="small" weight="plus">Investment Dossier</Text>
                            <Text size="xsmall" className="text-ui-fg-muted">Download PDF Report</Text>
                          </div>
                        </div>
                        <Badge color="grey" size="small" className="group-hover:bg-ui-bg-base">
                          Download
                        </Badge>
                      </a>
                    )}
                    {project?.business_plan_excel && (
                      <a 
                        href={project.business_plan_excel} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg border border-ui-border-base hover:bg-ui-bg-subtle hover:border-ui-border-strong transition-colors group"
                      >
                        <div className="flex items-center gap-x-3">
                          <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
                            <span className="text-green-600 text-sm">XLS</span>
                          </div>
                          <div>
                            <Text size="small" weight="plus">Business Plan</Text>
                            <Text size="xsmall" className="text-ui-fg-muted">Download Excel Workbook</Text>
                          </div>
                        </div>
                        <Badge color="grey" size="small" className="group-hover:bg-ui-bg-base">
                          Download
                        </Badge>
                      </a>
                    )}
                  </div>
                </Container>

                {/* Assets Summary */}
                <AssetsResponseView assets={assets} />

                {/* Suppliers */}
                <SuppliersResponseView suppliers={suppliers} />

                {/* Chat History */}
                <ChatResponseView messages={messages} />
                
                {/* Financial Reports */}
                <FinancialReportsView tco={tco ?? null} project={project ?? null} />
              </div>
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
    identityGenerating: "Brand Identity",
    assetSelection: "Select Assets",
    assetsImagesGenerating: "Asset Images",
    sourcing: "Sourcing Suppliers",
    negotiating: "Negotiating",
    cost_analysing: "Cost Analysis",
    layoutGenerating: "Layout Generation",
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
