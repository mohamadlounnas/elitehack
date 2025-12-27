import React from "react";
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui";
import type { TCOCalculation } from "../../types";

interface CostAnalysisResponseViewProps {
  tco: TCOCalculation | null;
  projectId?: string;
}

interface DetailedBreakdown {
  initial_investment?: {
    equipment_purchase?: number;
    installation?: number;
    infrastructure?: number;
    training?: number;
    initial_consulting?: number;
    total?: number;
  };
  operating_costs?: {
    energy?: number;
    maintenance?: number;
    labor?: number;
    insurance?: number;
    consumables?: number;
    utilities?: number;
    total_annual?: number;
  };
  asset_costs?: Array<{
    asset_id: string;
    asset_name: string;
    purchase_price: number;
    installation_cost: number;
    annual_maintenance: number;
    annual_energy: number;
    supplier?: string;
  }>;
  financial_metrics?: {
    total_cost_5_years?: number;
    total_cost_10_years?: number;
    npv_5_years?: number;
    npv_10_years?: number;
    irr?: number;
    roi?: number;
    payback_period_years?: number;
  };
  projections?: Array<{
    year: number;
    revenue: number;
    costs: number;
    net_cash_flow: number;
    cumulative_cash_flow: number;
  }>;
  risk_analysis?: {
    high_risk_factors?: string[];
    mitigation_strategies?: string[];
    sensitivity_analysis?: Array<{
      scenario: string;
      impact: string;
    }>;
  };
}

/**
 * Displays detailed cost analysis (TCO) results with comprehensive breakdown
 */
export function CostAnalysisResponseView({ tco, projectId }: CostAnalysisResponseViewProps) {
  if (!tco) return null;

  const breakdown = tco.breakdown as DetailedBreakdown | undefined;
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(["summary"]));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "N/A";
    return `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const downloadPDF = () => {
    if (projectId) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
      const pdfUrl = `${apiBaseUrl}/projects/${projectId}/cost-analysis-pdf`;
      window.open(pdfUrl, "_blank");
    }
  };

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h3" className="text-ui-fg-base font-semibold mb-1">Cost Analysis (TCO)</Heading>
          <Text size="xsmall" className="text-ui-fg-subtle">Comprehensive Financial Analysis</Text>
        </div>
        {projectId && (
          <Button onClick={downloadPDF} variant="secondary" size="small">
            Download PDF Report
          </Button>
        )}
      </div>

      {/* Executive Summary */}
      <div className="mb-6">
        <div
          className="flex items-center justify-between cursor-pointer p-3 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base transition-colors"
          onClick={() => toggleSection("summary")}
        >
          <Heading level="h4" className="text-ui-fg-base font-semibold">Executive Summary</Heading>
          <Text size="small">{expandedSections.has("summary") ? "−" : "+"}</Text>
        </div>
        {expandedSections.has("summary") && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {breakdown?.initial_investment?.total !== undefined && (
              <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                <Text size="small" className="text-ui-fg-subtle mb-1">Initial Investment</Text>
                <Text weight="plus" size="large" className="text-ui-fg-base">
                  {formatCurrency(breakdown.initial_investment.total)}
                </Text>
              </div>
            )}
            {breakdown?.operating_costs?.total_annual !== undefined && (
              <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                <Text size="small" className="text-ui-fg-subtle mb-1">Annual Operating Costs</Text>
                <Text weight="plus" size="large" className="text-ui-fg-base">
                  {formatCurrency(breakdown.operating_costs.total_annual)}
                </Text>
              </div>
            )}
            {breakdown?.financial_metrics?.total_cost_5_years !== undefined && (
              <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                <Text size="small" className="text-ui-fg-subtle mb-1">5-Year Total Cost</Text>
                <Text weight="plus" size="large" className="text-ui-fg-base">
                  {formatCurrency(breakdown.financial_metrics.total_cost_5_years)}
                </Text>
              </div>
            )}
            {tco.roi !== undefined && (
              <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                <Text size="small" className="text-ui-fg-subtle mb-1">ROI</Text>
                <Text weight="plus" size="large" className="text-ui-fg-base">
                  {tco.roi.toFixed(1)}%
                </Text>
              </div>
            )}
            {tco.payback_period !== undefined && (
              <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                <Text size="small" className="text-ui-fg-subtle mb-1">Payback Period</Text>
                <Text weight="plus" size="large" className="text-ui-fg-base">
                  {tco.payback_period.toFixed(1)} {tco.payback_period === 1 ? "year" : "years"}
                </Text>
              </div>
            )}
            {breakdown?.financial_metrics?.npv_5_years !== undefined && (
              <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                <Text size="small" className="text-ui-fg-subtle mb-1">NPV (5 years)</Text>
                <Text weight="plus" size="large" className="text-ui-fg-base">
                  {formatCurrency(breakdown.financial_metrics.npv_5_years)}
                </Text>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Initial Investment Breakdown */}
      {breakdown?.initial_investment && (
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer p-3 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base transition-colors"
            onClick={() => toggleSection("initial")}
          >
            <Heading level="h4" className="text-ui-fg-base font-semibold">Initial Investment Breakdown</Heading>
            <Text size="small">{expandedSections.has("initial") ? "−" : "+"}</Text>
          </div>
          {expandedSections.has("initial") && (
            <div className="mt-4 space-y-2">
              {breakdown.initial_investment.equipment_purchase !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Equipment Purchase</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.initial_investment.equipment_purchase)}
                  </Text>
                </div>
              )}
              {breakdown.initial_investment.installation !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Installation</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.initial_investment.installation)}
                  </Text>
                </div>
              )}
              {breakdown.initial_investment.infrastructure !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Infrastructure</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.initial_investment.infrastructure)}
                  </Text>
                </div>
              )}
              {breakdown.initial_investment.training !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Training</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.initial_investment.training)}
                  </Text>
                </div>
              )}
              {breakdown.initial_investment.initial_consulting !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Initial Consulting</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.initial_investment.initial_consulting)}
                  </Text>
                </div>
              )}
              {breakdown.initial_investment.total !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-base rounded border-2 border-ui-border-base">
                  <Text weight="plus" className="text-ui-fg-base">Total Initial Investment</Text>
                  <Text weight="plus" size="large" className="text-ui-fg-base">
                    {formatCurrency(breakdown.initial_investment.total)}
                  </Text>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Annual Operating Costs */}
      {breakdown?.operating_costs && (
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer p-3 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base transition-colors"
            onClick={() => toggleSection("operating")}
          >
            <Heading level="h4" className="text-ui-fg-base font-semibold">Annual Operating Costs</Heading>
            <Text size="small">{expandedSections.has("operating") ? "−" : "+"}</Text>
          </div>
          {expandedSections.has("operating") && (
            <div className="mt-4 space-y-2">
              {breakdown.operating_costs.energy !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Energy</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.operating_costs.energy)}
                  </Text>
                </div>
              )}
              {breakdown.operating_costs.maintenance !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Maintenance</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.operating_costs.maintenance)}
                  </Text>
                </div>
              )}
              {breakdown.operating_costs.labor !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Labor</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.operating_costs.labor)}
                  </Text>
                </div>
              )}
              {breakdown.operating_costs.insurance !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Insurance</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.operating_costs.insurance)}
                  </Text>
                </div>
              )}
              {breakdown.operating_costs.consumables !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Consumables</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.operating_costs.consumables)}
                  </Text>
                </div>
              )}
              {breakdown.operating_costs.utilities !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-subtle rounded">
                  <Text className="text-ui-fg-subtle">Utilities</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.operating_costs.utilities)}
                  </Text>
                </div>
              )}
              {breakdown.operating_costs.total_annual !== undefined && (
                <div className="flex justify-between items-center p-3 bg-ui-bg-base rounded border-2 border-ui-border-base">
                  <Text weight="plus" className="text-ui-fg-base">Total Annual Operating Costs</Text>
                  <Text weight="plus" size="large" className="text-ui-fg-base">
                    {formatCurrency(breakdown.operating_costs.total_annual)}
                  </Text>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Asset-by-Asset Breakdown */}
      {breakdown?.asset_costs && breakdown.asset_costs.length > 0 && (
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer p-3 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base transition-colors"
            onClick={() => toggleSection("assets")}
          >
            <Heading level="h4" className="text-ui-fg-base font-semibold">Asset-by-Asset Cost Breakdown</Heading>
            <Text size="small">{expandedSections.has("assets") ? "−" : "+"}</Text>
          </div>
          {expandedSections.has("assets") && (
            <div className="mt-4 space-y-4">
              {breakdown.asset_costs.map((asset, index) => (
                <div key={asset.asset_id || index} className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                  <Heading level="h5" className="text-ui-fg-base font-semibold mb-3">{asset.asset_name}</Heading>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Text size="xsmall" className="text-ui-fg-subtle">Purchase Price</Text>
                      <Text weight="plus" className="text-ui-fg-base">{formatCurrency(asset.purchase_price)}</Text>
                    </div>
                    <div>
                      <Text size="xsmall" className="text-ui-fg-subtle">Installation</Text>
                      <Text weight="plus" className="text-ui-fg-base">{formatCurrency(asset.installation_cost)}</Text>
                    </div>
                    <div>
                      <Text size="xsmall" className="text-ui-fg-subtle">Annual Maintenance</Text>
                      <Text weight="plus" className="text-ui-fg-base">{formatCurrency(asset.annual_maintenance)}</Text>
                    </div>
                    <div>
                      <Text size="xsmall" className="text-ui-fg-subtle">Annual Energy</Text>
                      <Text weight="plus" className="text-ui-fg-base">{formatCurrency(asset.annual_energy)}</Text>
                    </div>
                  </div>
                  {asset.supplier && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-2">Supplier: {asset.supplier}</Text>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Financial Metrics */}
      {breakdown?.financial_metrics && (
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer p-3 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base transition-colors"
            onClick={() => toggleSection("metrics")}
          >
            <Heading level="h4" className="text-ui-fg-base font-semibold">Financial Metrics</Heading>
            <Text size="small">{expandedSections.has("metrics") ? "−" : "+"}</Text>
          </div>
          {expandedSections.has("metrics") && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {breakdown.financial_metrics.total_cost_5_years !== undefined && (
                <div className="p-3 bg-ui-bg-subtle rounded">
                  <Text size="small" className="text-ui-fg-subtle">5-Year Total Cost</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.financial_metrics.total_cost_5_years)}
                  </Text>
                </div>
              )}
              {breakdown.financial_metrics.total_cost_10_years !== undefined && (
                <div className="p-3 bg-ui-bg-subtle rounded">
                  <Text size="small" className="text-ui-fg-subtle">10-Year Total Cost</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.financial_metrics.total_cost_10_years)}
                  </Text>
                </div>
              )}
              {breakdown.financial_metrics.npv_5_years !== undefined && (
                <div className="p-3 bg-ui-bg-subtle rounded">
                  <Text size="small" className="text-ui-fg-subtle">NPV (5 years, 10% discount)</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.financial_metrics.npv_5_years)}
                  </Text>
                </div>
              )}
              {breakdown.financial_metrics.npv_10_years !== undefined && (
                <div className="p-3 bg-ui-bg-subtle rounded">
                  <Text size="small" className="text-ui-fg-subtle">NPV (10 years, 10% discount)</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {formatCurrency(breakdown.financial_metrics.npv_10_years)}
                  </Text>
                </div>
              )}
              {breakdown.financial_metrics.irr !== undefined && (
                <div className="p-3 bg-ui-bg-subtle rounded">
                  <Text size="small" className="text-ui-fg-subtle">IRR</Text>
                  <Text weight="plus" className="text-ui-fg-base">
                    {breakdown.financial_metrics.irr.toFixed(2)}%
                  </Text>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Financial Projections */}
      {breakdown?.projections && breakdown.projections.length > 0 && (
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer p-3 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base transition-colors"
            onClick={() => toggleSection("projections")}
          >
            <Heading level="h4" className="text-ui-fg-base font-semibold">10-Year Financial Projections</Heading>
            <Text size="small">{expandedSections.has("projections") ? "−" : "+"}</Text>
          </div>
          {expandedSections.has("projections") && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-ui-bg-subtle">
                    <th className="p-2 text-left text-sm font-semibold border border-ui-border-base">Year</th>
                    <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Revenue</th>
                    <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Costs</th>
                    <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Net Cash Flow</th>
                    <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.projections.map((proj) => (
                    <tr key={proj.year} className="hover:bg-ui-bg-subtle">
                      <td className="p-2 border border-ui-border-base">{proj.year}</td>
                      <td className="p-2 text-right border border-ui-border-base">{formatCurrency(proj.revenue)}</td>
                      <td className="p-2 text-right border border-ui-border-base">{formatCurrency(proj.costs)}</td>
                      <td className="p-2 text-right border border-ui-border-base">{formatCurrency(proj.net_cash_flow)}</td>
                      <td className="p-2 text-right border border-ui-border-base">{formatCurrency(proj.cumulative_cash_flow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Risk Analysis */}
      {breakdown?.risk_analysis && (
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer p-3 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base transition-colors"
            onClick={() => toggleSection("risk")}
          >
            <Heading level="h4" className="text-ui-fg-base font-semibold">Risk Analysis</Heading>
            <Text size="small">{expandedSections.has("risk") ? "−" : "+"}</Text>
          </div>
          {expandedSections.has("risk") && (
            <div className="mt-4 space-y-4">
              {breakdown.risk_analysis.high_risk_factors && breakdown.risk_analysis.high_risk_factors.length > 0 && (
                <div>
                  <Heading level="h5" className="text-ui-fg-base font-semibold mb-2">High Risk Factors</Heading>
                  <ul className="list-disc list-inside space-y-1">
                    {breakdown.risk_analysis.high_risk_factors.map((risk, index) => (
                      <li key={index} className="text-ui-fg-subtle">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
              {breakdown.risk_analysis.mitigation_strategies && breakdown.risk_analysis.mitigation_strategies.length > 0 && (
                <div>
                  <Heading level="h5" className="text-ui-fg-base font-semibold mb-2">Mitigation Strategies</Heading>
                  <ul className="list-disc list-inside space-y-1">
                    {breakdown.risk_analysis.mitigation_strategies.map((strategy, index) => (
                      <li key={index} className="text-ui-fg-subtle">{strategy}</li>
                    ))}
                  </ul>
                </div>
              )}
              {breakdown.risk_analysis.sensitivity_analysis && breakdown.risk_analysis.sensitivity_analysis.length > 0 && (
                <div>
                  <Heading level="h5" className="text-ui-fg-base font-semibold mb-2">Sensitivity Analysis</Heading>
                  <div className="space-y-2">
                    {breakdown.risk_analysis.sensitivity_analysis.map((scenario, index) => (
                      <div key={index} className="p-2 bg-ui-bg-subtle rounded">
                        <Text weight="plus" size="small" className="text-ui-fg-base">{scenario.scenario}</Text>
                        <Text size="small" className="text-ui-fg-subtle">: {scenario.impact}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Container>
  );
}
