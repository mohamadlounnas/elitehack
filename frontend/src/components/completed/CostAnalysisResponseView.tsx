import React from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import type { TCOCalculation } from "../../types";

interface CostAnalysisResponseViewProps {
  tco: TCOCalculation | null;
}

/**
 * Displays cost analysis (TCO) results with breakdown
 */
export function CostAnalysisResponseView({ tco }: CostAnalysisResponseViewProps) {
  if (!tco) return null;

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center gap-2 mb-4">
        <Heading level="h3" className="text-ui-fg-base font-semibold">Cost Analysis (TCO)</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle">Step: Cost Analysis</Text>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {tco.total_cost !== undefined && (
          <div className="p-4 bg-ui-bg-subtle rounded-lg">
            <Text size="small" className="text-ui-fg-subtle mb-1">Total Cost</Text>
            <Text weight="plus" size="large" className="text-ui-fg-base">
              €{tco.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </div>
        )}
        {tco.roi !== undefined && (
          <div className="p-4 bg-ui-bg-subtle rounded-lg">
            <Text size="small" className="text-ui-fg-subtle mb-1">ROI</Text>
            <Text weight="plus" size="large" className="text-ui-fg-base">
              {tco.roi.toFixed(1)}%
            </Text>
          </div>
        )}
        {tco.payback_period !== undefined && (
          <div className="p-4 bg-ui-bg-subtle rounded-lg">
            <Text size="small" className="text-ui-fg-subtle mb-1">Payback Period</Text>
            <Text weight="plus" size="large" className="text-ui-fg-base">
              {tco.payback_period} {tco.payback_period === 1 ? "year" : "years"}
            </Text>
          </div>
        )}
      </div>

      {tco.breakdown && typeof tco.breakdown === "object" && Object.keys(tco.breakdown).length > 0 && (
        <div>
          <Heading level="h4" className="mb-3 text-ui-fg-base font-semibold">Cost Breakdown</Heading>
          <div className="space-y-2">
            {Object.entries(tco.breakdown).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center p-2 bg-ui-bg-subtle rounded hover:bg-ui-bg-base transition-colors">
                <Text className="text-ui-fg-subtle capitalize">
                  {key.replace(/_/g, " ")}
                </Text>
                <Text weight="plus" className="text-ui-fg-base">
                  {typeof value === "number" 
                    ? `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : String(value)
                  }
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {tco.business_plan && (
        <div className="mt-6 p-4 bg-ui-bg-subtle rounded">
          <Heading level="h4" className="mb-2 text-ui-fg-base font-semibold">Business Plan</Heading>
          <Text size="small" className="text-ui-fg-subtle whitespace-pre-wrap">
            {typeof tco.business_plan === "string" ? tco.business_plan : JSON.stringify(tco.business_plan, null, 2)}
          </Text>
        </div>
      )}
    </Container>
  );
}

