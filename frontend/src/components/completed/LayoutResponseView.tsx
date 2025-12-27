import React, { useState } from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import type { GeneratedFile } from "../../types";

interface LayoutResponseViewProps {
  layoutFiles: GeneratedFile[];
}

/**
 * Displays all 2D layout diagrams with iteration support
 */
export function LayoutResponseView({ layoutFiles }: LayoutResponseViewProps) {
  const [selectedLayout, setSelectedLayout] = useState<GeneratedFile | null>(null);

  if (layoutFiles.length === 0) return null;

  const layoutNames: Record<string, string> = {
    base_grid: "Base Grid",
    floor_plan: "Factory Floor Plan",
    equipment_placement: "Equipment Placement",
    atex_zones: "ATEX Zones",
    agv_routing: "AGV Routing Paths",
  };

  return (
    <>
      <Container className="p-6 border border-ui-border-base">
        <div className="flex items-center gap-2 mb-4">
          <Heading level="h3" className="text-ui-fg-base font-semibold">2D Layout Diagrams</Heading>
          <Text size="xsmall" className="text-ui-fg-subtle">Step: Layout Generation</Text>
          <Badge color="blue" size="small">{layoutFiles.length} layouts</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {layoutFiles.map((file) => {
            const layoutType = file.metadata?.layout_type || "";
            const hasIterations = file.metadata?.iteration_history && file.metadata.iteration_history.length > 0;
            return (
              <div key={file.id} className="flex flex-col gap-y-2">
                <div className="flex items-center justify-between">
                  <Text weight="plus" size="small">{layoutNames[layoutType] || file.filename}</Text>
                  {hasIterations && (
                    <Badge color="blue" size="small">{file.metadata.iteration_history.length} iterations</Badge>
                  )}
                </div>
                {file.file_path && (
                  <div className="w-full h-64 bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden hover:border-ui-border-interactive transition-colors">
                    <img 
                      src={file.file_path} 
                      alt={layoutNames[layoutType] || file.filename} 
                      className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => hasIterations ? setSelectedLayout(file) : window.open(file.file_path, "_blank")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Container>

      {/* Iteration Dialog */}
      {selectedLayout && selectedLayout.metadata?.iteration_history && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLayout(null)}
        >
          <div 
            className="bg-ui-bg-base rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Container className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Heading level="h2">{layoutNames[selectedLayout.metadata?.layout_type || ""] || selectedLayout.filename}</Heading>
                <button
                  onClick={() => setSelectedLayout(null)}
                  className="text-ui-fg-subtle hover:text-ui-fg-base text-xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-ui-bg-subtle transition-colors"
                >
                  ×
                </button>
              </div>
              <Text size="small" className="text-ui-fg-subtle mb-6">
                View the evolution of this layout through {selectedLayout.metadata.iteration_history.length} iterations. 
                Each iteration shows improvements based on AI feedback.
              </Text>
              <div className="space-y-6">
                {selectedLayout.metadata.iteration_history.map((iter: any, idx: number) => (
                  <div key={idx} className="border border-ui-border-base rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge color={iter.iteration === 0 ? "green" : "blue"} size="small">
                        Iteration {iter.iteration}
                      </Badge>
                      {iter.iteration === 0 && (
                        <Text size="xsmall" className="text-ui-fg-subtle">Initial Generation</Text>
                      )}
                    </div>
                    {iter.imageUrl && (
                      <div className="mb-3 w-full bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden" style={{ minHeight: "300px" }}>
                        <img 
                          src={iter.imageUrl} 
                          alt={`Iteration ${iter.iteration}`}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    {iter.feedback && (
                      <div className="mt-3 p-3 bg-ui-bg-subtle rounded">
                        <Text weight="plus" size="small" className="mb-2">AI Feedback:</Text>
                        <Text size="small" className="text-ui-fg-subtle whitespace-pre-wrap">{iter.feedback}</Text>
                      </div>
                    )}
                    {iter.improvements && iter.improvements.length > 0 && (
                      <div className="mt-3">
                        <Text weight="plus" size="small" className="mb-2">Improvements Made:</Text>
                        <ul className="list-disc list-inside space-y-1">
                          {iter.improvements.map((imp: string, i: number) => (
                            <li key={i}>
                              <Text size="small" className="text-ui-fg-subtle">{imp}</Text>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Container>
          </div>
        </div>
      )}
    </>
  );
}

