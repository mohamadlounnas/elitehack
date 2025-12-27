import React from "react";
import { Container, Heading, Text } from "@medusajs/ui";
import ReactMarkdown from "react-markdown";

interface PlanningResponseViewProps {
  planningData: any;
}

/**
 * Displays the planning step response with formatted markdown
 */
export function PlanningResponseView({ planningData }: PlanningResponseViewProps) {
  if (!planningData) return null;

  const formatPlanningDataAsMarkdown = (data: any): string => {
    let markdown = "";

    if (data.factory_dimensions) {
      markdown += "## Factory Dimensions\n\n";
      markdown += `- **Width**: ${data.factory_dimensions.width || "N/A"}m\n`;
      markdown += `- **Length**: ${data.factory_dimensions.length || "N/A"}m\n`;
      markdown += `- **Height**: ${data.factory_dimensions.height || "N/A"}m\n`;
      markdown += `- **Floors**: ${data.factory_dimensions.floors || "N/A"}\n\n`;
    }

    if (data.production_process) {
      markdown += "## Production Process\n\n";
      markdown += `${data.production_process}\n\n`;
    }

    if (data.assets && Array.isArray(data.assets) && data.assets.length > 0) {
      markdown += "## Assets & Equipment\n\n";
      data.assets.forEach((asset: any) => {
        markdown += `### ${asset.name || "Unnamed Asset"}\n`;
        if (asset.type) markdown += `**Type**: ${asset.type}\n`;
        if (asset.description) markdown += `**Description**: ${asset.description}\n`;
        if (asset.specifications) {
          markdown += `**Specifications**: ${JSON.stringify(asset.specifications, null, 2)}\n`;
        }
        markdown += "\n";
      });
    }

    if (data.summary) {
      markdown += "## Summary\n\n";
      markdown += `${data.summary}\n\n`;
    }

    if (data.recommendations && Array.isArray(data.recommendations)) {
      markdown += "## Recommendations\n\n";
      data.recommendations.forEach((rec: string) => {
        markdown += `- ${rec}\n`;
      });
      markdown += "\n";
    }

    return markdown || "No planning data available.";
  };

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center gap-2 mb-4">
        <Heading level="h3" className="text-ui-fg-base font-semibold">Planning Response</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle">Step: Planning</Text>
      </div>
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
  );
}


