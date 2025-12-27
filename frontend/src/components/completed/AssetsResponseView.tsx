import React from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import type { Asset } from "../../types";

interface AssetsResponseViewProps {
  assets: Asset[];
}

/**
 * Displays all assets and equipment with their images
 */
export function AssetsResponseView({ assets }: AssetsResponseViewProps) {
  if (assets.length === 0) return null;

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center gap-2 mb-4">
        <Heading level="h3" className="text-ui-fg-base font-semibold">Assets & Equipment</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle">Step: Asset Generation</Text>
        <Badge color="blue" size="small">{assets.length} assets</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Container key={asset.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <Text weight="plus" size="small" className="flex-1">{asset.name}</Text>
              {asset.type && (
                <Badge color="gray" size="small" className="ml-2">{asset.type}</Badge>
              )}
            </div>
            {asset.description && (
              <Text size="small" className="text-ui-fg-subtle mb-3 line-clamp-2">{asset.description}</Text>
            )}
            {asset.image_url && (
              <div className="w-full h-40 bg-white rounded border border-ui-border-base flex items-center justify-center overflow-hidden mb-2">
                <img 
                  src={asset.image_url} 
                  alt={asset.name} 
                  className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(asset.image_url, "_blank")}
                />
              </div>
            )}
            {asset.specifications && (
              <details className="mt-2">
                <summary className="text-xs text-ui-fg-subtle cursor-pointer hover:text-ui-fg-base">
                  View Specifications
                </summary>
                <pre className="mt-2 text-xs text-ui-fg-subtle overflow-auto max-h-32 p-2 bg-ui-bg-subtle rounded">
                  {JSON.stringify(asset.specifications, null, 2)}
                </pre>
              </details>
            )}
          </Container>
        ))}
      </div>
    </Container>
  );
}

