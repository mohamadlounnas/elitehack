import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Heading, Text, Badge, StatusBadge, Code, Skeleton, Container } from "@medusajs/ui";
import { Check } from "@medusajs/icons";
import type { ProjectStep } from "../types";

interface StepDetailsProps {
  projectId: string;
  currentStep: ProjectStep;
  planningData?: any;
  assets?: any[];
}

interface StreamUpdate {
  type: string;
  step: string;
  content?: string;
  asset?: { id: string; name: string };
  supplier?: { name: string; location: string; website?: string };
  imageUrl?: string;
  progress?: number;
  total?: number;
  message?: string;
}

export function StepDetails({ projectId, currentStep, planningData, assets = [] }: StepDetailsProps) {
  const [streamContent, setStreamContent] = useState<string>("");
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [streamAssets, setStreamAssets] = useState<Map<string, any>>(new Map());
  const [streamSuppliers, setStreamSuppliers] = useState<Map<string, any[]>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    setStreamContent("");
    setStreamProgress(0);
    setStreamAssets(new Map());
    setStreamSuppliers(new Map());
    setIsStreaming(false);

    const streamableSteps = ["planning", "assetsImagesGenerating", "sourcing", "cost_analysing"];
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
        }
      } catch (error) {
        console.error("Error parsing stream data:", error);
      }
    };

    eventSource.addEventListener("status", handleEvent);
    eventSource.addEventListener("update", handleEvent);
    eventSource.addEventListener("progress", handleEvent);
    eventSource.addEventListener("complete", handleEvent);
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

  const renderContent = () => {
    switch (currentStep) {
      case "planning":
        return (
          <Container className="flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <div className="w-2 h-2 bg-ui-bg-interactive rounded-full animate-pulse" />
              <Text size="small" className="text-ui-fg-subtle">Planning...</Text>
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
          <Container>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{formatPlanningDataAsMarkdown(planningData)}</ReactMarkdown>
            </div>
          </Container>
        ) : null;

      case "assetsImagesGenerating":
        return (
          <Container className="flex flex-col gap-y-3">
            <Text size="small" className="text-ui-fg-subtle">
              Generating {streamAssets.size} / {assets.length} images...
            </Text>
            <div className="grid grid-cols-2 gap-3">
              {Array.from(streamAssets.values()).map((asset) => (
                <Container key={asset.id} className="p-3">
                  <Text weight="plus" size="small" className="mb-2">{asset.name}</Text>
                  {asset.imageUrl && <img src={asset.imageUrl} alt={asset.name} className="w-full h-24 object-cover rounded" />}
                </Container>
              ))}
              {assets.filter((a) => !streamAssets.has(a.id)).map((asset) => (
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
                  {asset.image_url && <img src={asset.image_url} alt={asset.name} className="w-full h-24 object-cover rounded" />}
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
            <Text size="small" className="text-ui-fg-subtle">Analyzing costs...</Text>
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

      case "completed":
        return (
          <div className="flex flex-col gap-y-3">
            <Container className="flex flex-col items-center py-8">
              <div className="w-12 h-12 bg-ui-tag-green-bg rounded-full flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-ui-tag-green-text" />
              </div>
              <Heading level="h2">Project Completed!</Heading>
              <Text className="text-ui-fg-subtle text-center">All steps have been finished successfully.</Text>
            </Container>

            {planningData && (
              <Container>
                <Heading level="h3" className="mb-3">Planning Summary</Heading>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{formatPlanningDataAsMarkdown(planningData)}</ReactMarkdown>
                </div>
              </Container>
            )}

            {assets.length > 0 && (
              <Container>
                <Heading level="h3" className="mb-3">Assets ({assets.length})</Heading>
                <div className="grid grid-cols-2 gap-3">
                  {assets.map((asset) => (
                    <Container key={asset.id} className="p-3">
                      <Text weight="plus" size="small" className="mb-1">{asset.name}</Text>
                      {asset.description && <Text size="small" className="text-ui-fg-subtle mb-2">{asset.description}</Text>}
                      {asset.image_url && <img src={asset.image_url} alt={asset.name} className="w-full h-24 object-cover rounded" />}
                    </Container>
                  ))}
                </div>
              </Container>
            )}
          </div>
        );

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
  let markdown = "# Factory Planning Report\n\n";
  if (data.production_process) markdown += `## Production Process\n${data.production_process}\n\n`;
  if (data.factory_dimensions) {
    markdown += `## Factory Dimensions\n`;
    markdown += `- **Width:** ${data.factory_dimensions.width}m\n`;
    markdown += `- **Length:** ${data.factory_dimensions.length}m\n`;
    markdown += `- **Height:** ${data.factory_dimensions.height}m\n`;
    if (data.factory_dimensions.floors) markdown += `- **Floors:** ${data.factory_dimensions.floors}\n`;
    markdown += `\n`;
  }
  if (data.machinery?.length > 0) {
    markdown += `## Required Machinery\n`;
    data.machinery.forEach((machine: string) => markdown += `- ${machine}\n`);
    markdown += `\n`;
  }
  if (data.assets?.length > 0) {
    markdown += `## Assets & Equipment\n\n`;
    data.assets.forEach((asset: any) => {
      markdown += `### ${asset.name}\n`;
      if (asset.type) markdown += `**Type:** ${asset.type}\n\n`;
      if (asset.description) markdown += `${asset.description}\n\n`;
    });
  }
  if (data.materials?.length > 0) {
    markdown += `## Materials Required\n`;
    data.materials.forEach((material: string) => markdown += `- ${material}\n`);
    markdown += `\n`;
  }
  if (data.capacity) markdown += `## Production Capacity\n${data.capacity}\n\n`;
  return markdown;
}
