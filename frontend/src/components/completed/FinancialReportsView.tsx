import React from "react";
import { Container, Heading, Text, Button, Badge } from "@medusajs/ui";
import type { TCOCalculation, Project } from "../../types";

interface FinancialReportsViewProps {
  tco: TCOCalculation | null;
  project: Project | null;
}

/**
 * Displays Financial Reports section with downloadable files
 */
export function FinancialReportsView({ tco, project }: FinancialReportsViewProps) {
  if (!tco && !project) return null;

  const breakdown = tco?.breakdown as any;
  const hasExcel = project?.business_plan_excel;
  const hasPDF = project?.cost_analysis_pdf;

  const downloadExcel = () => {
    if (project?.id) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
      const excelUrl = `${apiBaseUrl}/projects/${project.id}/business-plan-excel`;
      window.open(excelUrl, "_blank");
    }
  };

  const downloadPDF = () => {
    if (project?.id) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
      const pdfUrl = `${apiBaseUrl}/projects/${project.id}/cost-analysis-pdf`;
      window.open(pdfUrl, "_blank");
    }
  };

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h3" className="text-ui-fg-base font-semibold mb-1">Financial Reports</Heading>
          <Text size="xsmall" className="text-ui-fg-subtle">Comprehensive financial analysis and business planning documents</Text>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Business Plan Excel */}
        <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
          <div className="flex items-center justify-between mb-2">
            <Heading level="h4" className="text-ui-fg-base font-semibold">Business Plan Excel</Heading>
            {hasExcel && <Badge color="green" size="small">Available</Badge>}
          </div>
          <Text size="small" className="text-ui-fg-subtle mb-3">
            Comprehensive Excel workbook with multiple sheets including:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Executive Summary</li>
              <li>Initial Investment Breakdown</li>
              <li>Annual Operating Costs</li>
              <li>5-Year ROI Projections</li>
              <li>Asset-by-Asset Breakdown</li>
              <li>ANDI/AAPI Compliant Format</li>
            </ul>
          </Text>
          {hasExcel ? (
            <Button onClick={downloadExcel} variant="secondary" size="small" className="w-full">
              Download Excel File
            </Button>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted">File not available</Text>
          )}
        </div>

        {/* TCO Analysis PDF */}
        <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
          <div className="flex items-center justify-between mb-2">
            <Heading level="h4" className="text-ui-fg-base font-semibold">TCO Analysis PDF</Heading>
            {hasPDF && <Badge color="green" size="small">Available</Badge>}
          </div>
          <Text size="small" className="text-ui-fg-subtle mb-3">
            Detailed Total Cost of Ownership analysis report including:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Executive Summary</li>
              <li>Initial Investment Breakdown</li>
              <li>Annual Operating Costs</li>
              <li>Financial Metrics (NPV, IRR, ROI)</li>
              <li>10-Year Financial Projections</li>
              <li>Risk Analysis</li>
            </ul>
          </Text>
          {hasPDF ? (
            <Button onClick={downloadPDF} variant="secondary" size="small" className="w-full">
              Download PDF Report
            </Button>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted">File not available</Text>
          )}
        </div>
      </div>

      {/* ROI Projections (5 Years) */}
      {breakdown?.projections && breakdown.projections.length > 0 && (
        <div className="mt-6">
          <Heading level="h4" className="text-ui-fg-base font-semibold mb-4">5-Year ROI Projections</Heading>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-ui-bg-subtle">
                  <th className="p-2 text-left text-sm font-semibold border border-ui-border-base">Year</th>
                  <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Revenue</th>
                  <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Costs</th>
                  <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Net Cash Flow</th>
                  <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">Cumulative</th>
                  <th className="p-2 text-right text-sm font-semibold border border-ui-border-base">ROI %</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.projections.slice(0, 5).map((proj: any) => {
                  const cumulativeROI = proj.cumulative_cash_flow > 0 && breakdown?.initial_investment?.total
                    ? ((proj.cumulative_cash_flow / breakdown.initial_investment.total) * 100).toFixed(1)
                    : "0.0";
                  
                  return (
                    <tr key={proj.year} className="hover:bg-ui-bg-subtle">
                      <td className="p-2 border border-ui-border-base">{proj.year}</td>
                      <td className="p-2 text-right border border-ui-border-base">
                        €{proj.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-2 text-right border border-ui-border-base">
                        €{proj.costs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-2 text-right border border-ui-border-base">
                        €{proj.net_cash_flow.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-2 text-right border border-ui-border-base">
                        €{proj.cumulative_cash_flow.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-2 text-right border border-ui-border-base font-semibold">
                        {cumulativeROI}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANDI/AAPI Compliance Info */}
      <div className="mt-6 p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
        <div className="flex items-center gap-2 mb-2">
          <Heading level="h4" className="text-ui-fg-base font-semibold">ANDI/AAPI Compliant Format</Heading>
          <Badge color="blue" size="small">Compliant</Badge>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          All financial reports are generated in ANDI/AAPI (Association Nationale des Directeurs d'Investissement / 
          Association des Analystes de Projets Industriels) compliant format. The Excel file includes a dedicated 
          "ANDI/AAPI Format" sheet with standardized fields for industrial project analysis and reporting.
        </Text>
      </div>
    </Container>
  );
}

