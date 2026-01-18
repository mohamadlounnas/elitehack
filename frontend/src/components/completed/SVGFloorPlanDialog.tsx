/**
 * Floor Plan Layout Dialog - Display AI-generated SVG/DXF factory layout
 * Test component - generates on-the-fly, not stored
 */

import React, { useState, useEffect } from "react";
import {
  Container,
  Heading,
  Text,
  Button,
  Badge,
  Tabs,
} from "@medusajs/ui";
import { XMark, ArrowDownTray, ArrowPath } from "@medusajs/icons";
import { dataApi } from "../../services/api";

interface SVGFloorPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

type FormatType = "svg" | "dxf";

export function SVGFloorPlanDialog({
  isOpen,
  onClose,
  projectId,
}: SVGFloorPlanDialogProps) {
  const [activeFormat, setActiveFormat] = useState<FormatType>("svg");
  
  // SVG State
  const [isGeneratingSVG, setIsGeneratingSVG] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [svgMetadata, setSvgMetadata] = useState<{
    factory_width: number;
    factory_length: number;
    equipment_count: number;
    generated_at: string;
  } | null>(null);
  const [svgError, setSvgError] = useState<string | null>(null);

  // DXF State
  const [isGeneratingDXF, setIsGeneratingDXF] = useState(false);
  const [isConvertingToDXF, setIsConvertingToDXF] = useState(false);
  const [dxfContent, setDxfContent] = useState<string | null>(null);
  const [dxfMetadata, setDxfMetadata] = useState<{
    factory_width: number;
    factory_length: number;
    equipment_count?: number;
    converted_from?: string;
    generated_at: string;
    format: string;
    units: string;
  } | null>(null);
  const [dxfError, setDxfError] = useState<string | null>(null);

  // Generate SVG when dialog opens or tab switches
  useEffect(() => {
    if (isOpen && activeFormat === "svg" && !svgContent && !isGeneratingSVG) {
      handleGenerateSVG();
    }
  }, [isOpen, activeFormat]);

  const handleGenerateSVG = async () => {
    setIsGeneratingSVG(true);
    setSvgError(null);
    setSvgContent(null);
    
    try {
      const result = await dataApi.generateFloorPlanSVG(projectId);
      setSvgContent(result.svg);
      setSvgMetadata(result.metadata);
    } catch (err: any) {
      console.error("Failed to generate SVG floor plan:", err);
      setSvgError(err.response?.data?.error || err.message || "Failed to generate SVG");
    } finally {
      setIsGeneratingSVG(false);
    }
  };

  const handleGenerateDXF = async () => {
    setIsGeneratingDXF(true);
    setDxfError(null);
    setDxfContent(null);
    
    try {
      const result = await dataApi.generateFloorPlanDXF(projectId);
      setDxfContent(result.dxf);
      setDxfMetadata(result.metadata);
    } catch (err: any) {
      console.error("Failed to generate DXF floor plan:", err);
      setDxfError(err.response?.data?.error || err.message || "Failed to generate DXF");
    } finally {
      setIsGeneratingDXF(false);
    }
  };

  // Convert the AI-generated SVG to DXF format
  const handleConvertSvgToDxf = async () => {
    if (!svgContent) return;
    
    setIsConvertingToDXF(true);
    setDxfError(null);
    
    try {
      const result = await dataApi.convertSvgToDxf(projectId, svgContent);
      setDxfContent(result.dxf);
      setDxfMetadata(result.metadata);
      // Switch to DXF tab to show the result
      setActiveFormat("dxf");
    } catch (err: any) {
      console.error("Failed to convert SVG to DXF:", err);
      setDxfError(err.response?.data?.error || err.message || "Failed to convert SVG to DXF");
    } finally {
      setIsConvertingToDXF(false);
    }
  };

  const handleDownloadSVG = () => {
    if (!svgContent) return;
    
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `factory_floor_plan_${new Date().toISOString().split("T")[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDXF = () => {
    if (!dxfContent) return;
    
    const blob = new Blob([dxfContent], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `factory_floor_plan_${new Date().toISOString().split("T")[0]}.dxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const isGenerating = activeFormat === "svg" ? isGeneratingSVG : isGeneratingDXF;
  const content = activeFormat === "svg" ? svgContent : dxfContent;
  const error = activeFormat === "svg" ? svgError : dxfError;
  const metadata = activeFormat === "svg" ? svgMetadata : dxfMetadata;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </div>
            <div>
              <Heading level="h2" className="text-lg">Floor Plan Layout Generator</Heading>
              <Text size="small" className="text-ui-fg-muted">
                AI-generated equipment layout with connections
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {metadata && (
              <div className="flex items-center gap-2 mr-4">
                <Badge color="blue" size="small">
                  {metadata.factory_width}m × {metadata.factory_length}m
                </Badge>
                <Badge color="green" size="small">
                  {metadata.equipment_count} machines
                </Badge>
                {activeFormat === "dxf" && dxfMetadata && (
                  <Badge color="purple" size="small">
                    {dxfMetadata.format}
                  </Badge>
                )}
              </div>
            )}
            <Button
              variant="transparent"
              size="small"
              onClick={onClose}
              className="ml-2"
            >
              <XMark className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 bg-white border-b border-ui-border-base">
          <Tabs value={activeFormat} onValueChange={(v) => setActiveFormat(v as FormatType)}>
            <Tabs.List>
              <Tabs.Trigger value="svg" className="gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                SVG Format
              </Tabs.Trigger>
              <Tabs.Trigger value="dxf" className="gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                DXF/CAD Format
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 bg-ui-bg-subtle border-b border-ui-border-base flex items-center justify-between">
          <Text size="small" className="text-ui-fg-muted">
            {activeFormat === "svg" 
              ? "SVG format for web viewing and vector graphics software" 
              : "DXF format compatible with AutoCAD and other CAD software"}
          </Text>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={activeFormat === "svg" ? handleGenerateSVG : handleGenerateDXF}
              disabled={isGenerating}
              className="gap-2"
            >
              <ArrowPath className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Generating..." : "Regenerate"}
            </Button>
            {content && (
              <Button
                variant="primary"
                size="small"
                onClick={activeFormat === "svg" ? handleDownloadSVG : handleDownloadDXF}
                className="gap-2"
              >
                <ArrowDownTray className="w-4 h-4" />
                Download {activeFormat.toUpperCase()}
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {isGenerating ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 mb-4 relative">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-200" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              </div>
              <Heading level="h3" className="mb-2">
                Generating {activeFormat.toUpperCase()} Floor Plan...
              </Heading>
              <Text className="text-ui-fg-muted text-center max-w-md">
                {activeFormat === "svg" 
                  ? "AI is creating your factory layout with equipment positions, connections, and material flow paths."
                  : "AI is generating CAD-compatible DXF file with proper layers, dimensions, and equipment positions."}
              </Text>
            </div>
          ) : error ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <Heading level="h3" className="mb-2 text-red-600">Generation Failed</Heading>
              <Text className="text-ui-fg-muted text-center max-w-md mb-4">
                {error}
              </Text>
              <Button variant="primary" onClick={activeFormat === "svg" ? handleGenerateSVG : handleGenerateDXF}>
                Try Again
              </Button>
            </div>
          ) : content ? (
            <Container className="p-4 bg-white rounded-lg shadow-sm">
              {activeFormat === "svg" ? (
                <>
                  {/* SVG Container with proper scaling */}
                  <div 
                    className="w-full overflow-auto border border-ui-border-base rounded-lg bg-white"
                    style={{ minHeight: "500px" }}
                  >
                    <div 
                      className="w-full h-full flex items-center justify-center p-4"
                      dangerouslySetInnerHTML={{ __html: svgContent || "" }}
                      style={{ minWidth: "fit-content" }}
                    />
                  </div>
                  
                  {/* SVG Info Footer */}
                  {svgMetadata && (
                    <div className="mt-4 pt-4 border-t border-ui-border-base">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-blue-500" />
                            <Text size="xsmall" className="text-ui-fg-muted">Production Machines</Text>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-orange-500" />
                            <Text size="xsmall" className="text-ui-fg-muted">Conveyors/Flow</Text>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-green-500" />
                            <Text size="xsmall" className="text-ui-fg-muted">Storage</Text>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-purple-500" />
                            <Text size="xsmall" className="text-ui-fg-muted">Office</Text>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-red-500" />
                            <Text size="xsmall" className="text-ui-fg-muted">Entry/Exit</Text>
                          </div>
                        </div>
                        <Text size="xsmall" className="text-ui-fg-disabled">
                          Generated: {new Date(svgMetadata.generated_at).toLocaleString()}
                        </Text>
                      </div>
                      
                      {/* Convert to DXF Button */}
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                            <div>
                              <Text size="small" weight="plus">Export to CAD Format</Text>
                              <Text size="xsmall" className="text-ui-fg-muted">
                                Convert this SVG layout to DXF for AutoCAD, DraftSight, etc.
                              </Text>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={handleConvertSvgToDxf}
                            disabled={isConvertingToDXF || !svgContent}
                            className="gap-2"
                          >
                            {isConvertingToDXF ? (
                              <>
                                <ArrowPath className="w-4 h-4 animate-spin" />
                                Converting...
                              </>
                            ) : (
                              <>
                                <ArrowDownTray className="w-4 h-4" />
                                Convert to DXF
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* DXF Preview */}
                  <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div>
                        <Text weight="plus">DXF File Ready</Text>
                        <Text size="small" className="text-ui-fg-muted">
                          Compatible with AutoCAD, DraftSight, LibreCAD, and other CAD software
                        </Text>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge color="purple" size="small">Format</Badge>
                        <Text size="small">{dxfMetadata?.format || "DXF R12/R14"}</Text>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color="blue" size="small">Units</Badge>
                        <Text size="small">{dxfMetadata?.units || "meters"}</Text>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color="green" size="small">Size</Badge>
                        <Text size="small">{(dxfContent?.length || 0).toLocaleString()} bytes</Text>
                      </div>
                    </div>
                  </div>

                  {/* DXF Content Preview (code view) */}
                  <div 
                    className="w-full overflow-auto border border-ui-border-base rounded-lg bg-gray-900 text-gray-100 font-mono text-xs"
                    style={{ maxHeight: "400px" }}
                  >
                    <pre className="p-4 whitespace-pre-wrap">
                      {dxfContent?.substring(0, 3000)}
                      {(dxfContent?.length || 0) > 3000 && (
                        <span className="text-gray-500">
                          {"\n\n... ({(dxfContent?.length || 0) - 3000} more characters) ..."}
                        </span>
                      )}
                    </pre>
                  </div>

                  {/* DXF Layer Info */}
                  <div className="mt-4 pt-4 border-t border-ui-border-base">
                    <Text size="small" weight="plus" className="mb-3">DXF Layers:</Text>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                        <div className="w-3 h-3 rounded-sm bg-white border border-gray-300" />
                        <Text size="xsmall">WALLS</Text>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                        <div className="w-3 h-3 rounded-sm bg-blue-500" />
                        <Text size="xsmall">MACHINES</Text>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                        <div className="w-3 h-3 rounded-sm bg-orange-500" />
                        <Text size="xsmall">CONVEYORS</Text>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                        <div className="w-3 h-3 rounded-sm bg-green-500" />
                        <Text size="xsmall">STORAGE</Text>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                        <div className="w-3 h-3 rounded-sm bg-purple-500" />
                        <Text size="xsmall">OFFICE</Text>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                        <div className="w-3 h-3 rounded-sm bg-cyan-500" />
                        <Text size="xsmall">UTILITIES</Text>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                        <div className="w-3 h-3 rounded-sm bg-gray-400" />
                        <Text size="xsmall">PATHWAYS</Text>
                      </div>
                    </div>
                    {dxfMetadata && (
                      <Text size="xsmall" className="text-ui-fg-disabled mt-3">
                        Generated: {new Date(dxfMetadata.generated_at).toLocaleString()}
                      </Text>
                    )}
                  </div>
                </>
              )}
            </Container>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </div>
              <Heading level="h3" className="mb-2">No Layout Generated</Heading>
              <Text className="text-ui-fg-muted text-center max-w-md mb-4">
                Click the button below to generate a {activeFormat.toUpperCase()} floor plan layout.
              </Text>
              <Button variant="primary" onClick={activeFormat === "svg" ? handleGenerateSVG : handleGenerateDXF}>
                Generate {activeFormat.toUpperCase()} Layout
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
