/**
 * Completed Dashboard - Full-width industrial dossier view
 * Inspired by Medusa.js dashboard patterns
 */

import React, { useState, useCallback } from "react";
import { 
  Container, 
  Heading, 
  Text, 
  Badge, 
  Button,
  Table,
  Copy,
  StatusBadge,
  Tabs,
  clx,
} from "@medusajs/ui";
import { 
  Check,
  ArrowDownTray,
  ChartBar,
  Buildings,
  CurrencyDollar,
  DocumentText,
  Photo,
  TruckFast,
  TriangleDownMini,
  PencilSquare,
} from "@medusajs/icons";
import type { 
  Project, 
  ProjectMessage, 
  Asset, 
  Supplier, 
  GeneratedFile, 
  TCOCalculation,
  PlanningData 
} from "../../types";
import ReactMarkdown from "react-markdown";
import { FullReportDrawer } from "./FullReportDrawer";

interface CompletedDashboardProps {
  project: Project;
  planningData?: PlanningData;
  assets: Asset[];
  suppliers: Supplier[];
  generatedFiles: GeneratedFile[];
  tco: TCOCalculation | null;
  messages: ProjectMessage[];
  onGenerateReports?: () => Promise<void>;
  onProjectUpdate?: () => void;
}

// KPI Card Component
function KPICard({ 
  label, 
  value, 
  subValue,
  trend,
  variant = "default" 
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "primary" | "success";
}) {
  return (
    <Container className={clx(
      "p-5 transition-all hover:shadow-md",
      variant === "primary" && "bg-ui-bg-interactive text-white",
      variant === "success" && "bg-ui-tag-green-bg"
    )}>
      <Text 
        size="small" 
        className={clx(
          "uppercase tracking-wider mb-1",
          variant === "primary" ? "text-white/70" : "text-ui-fg-muted"
        )}
      >
        {label}
      </Text>
      <div className="flex items-baseline gap-x-2">
        <Text 
          className={clx(
            "text-2xl font-semibold",
            variant === "primary" ? "text-white" : "text-ui-fg-base"
          )}
        >
          {value}
        </Text>
        {subValue && (
          <Text 
            size="small" 
            className={variant === "primary" ? "text-white/60" : "text-ui-fg-subtle"}
          >
            {subValue}
          </Text>
        )}
      </div>
    </Container>
  );
}

// Section Header Component
function SectionHeader({ 
  icon: Icon, 
  title, 
  badge,
  action 
}: { 
  icon: React.ComponentType<any>; 
  title: string; 
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-x-3">
        <div className="w-8 h-8 rounded-lg bg-ui-bg-subtle flex items-center justify-center">
          <Icon className="w-4 h-4 text-ui-fg-subtle" />
        </div>
        <Heading level="h2" className="text-ui-fg-base">{title}</Heading>
        {badge && <Badge color="grey" size="small">{badge}</Badge>}
      </div>
      {action}
    </div>
  );
}

// Document Card Component
const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  red: { bg: "from-red-50 to-red-100", border: "border-red-200", text: "text-red-600" },
  green: { bg: "from-green-50 to-green-100", border: "border-green-200", text: "text-green-600" },
  blue: { bg: "from-blue-50 to-blue-100", border: "border-blue-200", text: "text-blue-600" },
  purple: { bg: "from-purple-50 to-purple-100", border: "border-purple-200", text: "text-purple-600" },
  orange: { bg: "from-orange-50 to-orange-100", border: "border-orange-200", text: "text-orange-600" },
  amber: { bg: "from-amber-50 to-amber-100", border: "border-amber-200", text: "text-amber-600" },
  teal: { bg: "from-teal-50 to-teal-100", border: "border-teal-200", text: "text-teal-600" },
  cyan: { bg: "from-cyan-50 to-cyan-100", border: "border-cyan-200", text: "text-cyan-600" },
  emerald: { bg: "from-emerald-50 to-emerald-100", border: "border-emerald-200", text: "text-emerald-600" },
};

function DocumentCard({
  title,
  description,
  format,
  color,
  available,
  href,
  compact = false,
  badge,
}: {
  title: string;
  description: string;
  format: string;
  color: string;
  available: boolean;
  href: string;
  compact?: boolean;
  badge?: string;
}) {
  const colors = colorClasses[color] || colorClasses.blue;
  
  if (!available) {
    return (
      <Container className={clx("text-center bg-ui-bg-subtle", compact ? "p-4" : "p-6")}>
        <DocumentText className={clx("text-ui-fg-muted mx-auto mb-2", compact ? "w-6 h-6" : "w-8 h-8")} />
        <Text size="small" className="text-ui-fg-muted">{title}</Text>
        <Text size="xsmall" className="text-ui-fg-muted mt-1">Not available yet</Text>
      </Container>
    );
  }

  if (badge) {
    return (
      <Container className="p-0 overflow-hidden">
        <div className={clx(`bg-gradient-to-br ${colors.bg} flex items-center justify-center`, compact ? "p-4" : "p-6")}>
          <div className={clx(`bg-white rounded shadow-sm flex items-center justify-center ${colors.border}`, compact ? "w-12 h-14" : "w-16 h-20")}>
            <Text className={clx(colors.text, "font-bold", compact ? "text-xs" : "text-sm")}>{format}</Text>
          </div>
        </div>
        <div className={clx("border-t border-ui-border-base", compact ? "p-3" : "p-4")}>
          <Text weight="plus" size="small">{title}</Text>
          <Text size="xsmall" className="text-ui-fg-muted">{description}</Text>
          <div className="mt-2">
            <Badge color="blue" size="small">{badge}</Badge>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="p-0 overflow-hidden hover:shadow-md transition-shadow">
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        <div className={clx(`bg-gradient-to-br ${colors.bg} flex items-center justify-center`, compact ? "p-4" : "p-6")}>
          <div className={clx(`bg-white rounded shadow-sm flex items-center justify-center ${colors.border}`, compact ? "w-12 h-14" : "w-16 h-20")}>
            <Text className={clx(colors.text, "font-bold", compact ? "text-xs" : "text-sm")}>{format}</Text>
          </div>
        </div>
        <div className={clx("border-t border-ui-border-base", compact ? "p-3" : "p-4")}>
          <Text weight="plus" size="small">{title}</Text>
          <Text size="xsmall" className="text-ui-fg-muted">{description}</Text>
          <div className={clx("flex items-center gap-x-2", compact ? "mt-2" : "mt-3")}>
            <ArrowDownTray className="w-3 h-3 text-ui-fg-interactive" />
            <Text size="xsmall" className="text-ui-fg-interactive">Download {format}</Text>
          </div>
        </div>
      </a>
    </Container>
  );
}

// Collapsible Section
function CollapsibleSection({ 
  title, 
  defaultOpen = false,
  children 
}: { 
  title: string; 
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-ui-border-base last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-ui-bg-subtle-hover transition-colors px-4"
      >
        <Text weight="plus" size="small">{title}</Text>
        <TriangleDownMini 
          className={clx(
            "text-ui-fg-muted transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function CompletedDashboard({
  project,
  planningData,
  assets,
  suppliers,
  generatedFiles,
  tco,
  messages,
  onGenerateReports,
  onProjectUpdate,
}: CompletedDashboardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  
  const layoutFiles = generatedFiles.filter(f => f.metadata?.type === "2d_layout");
  const analysis = tco?.breakdown;
  const exec = planningData?.executive_summary;
  const identity = planningData?.industrial_identity;

  // Handle full report generation complete
  const handleReportGenerated = useCallback(() => {
    onProjectUpdate?.();
  }, [onProjectUpdate]);
  
  // Handle generate reports
  const handleGenerateReports = async () => {
    if (!onGenerateReports) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      await onGenerateReports();
    } catch (error: any) {
      setGenerationError(error.message || "Failed to generate reports");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Calculate metrics
  const totalInvestment = analysis?.initial_investment?.total || 0;
  const annualOpex = analysis?.operating_costs?.total_annual || 0;
  const roi = analysis?.financial_metrics?.roi || 0;
  const paybackYears = analysis?.financial_metrics?.payback_period_years || 0;
  const npv = analysis?.financial_metrics?.npv_5_years || 0;
  const irr = analysis?.financial_metrics?.irr || 0;

  return (
    <div className="flex flex-col gap-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-x-4">
          {/* Brand Logo */}
          {project.logo_url && (
            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center shadow-sm border border-ui-border-base overflow-hidden"
              style={{ backgroundColor: project.primary_color || "#0F172A" }}
            >
              <img 
                src={project.logo_url} 
                alt="Brand Logo" 
                className="w-12 h-12 object-contain"
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-x-3 mb-2">
              <Heading level="h1">{identity?.factory_name || project.name}</Heading>
              <StatusBadge color="green">Completed</StatusBadge>
              {/* Brand Colors Indicator */}
              {project.primary_color && (
                <div className="flex items-center gap-x-1">
                  <div 
                    className="w-4 h-4 rounded-full border border-ui-border-base" 
                    style={{ backgroundColor: project.primary_color }}
                    title={`Primary: ${project.primary_color}`}
                  />
                  {project.secondary_color && (
                    <div 
                      className="w-4 h-4 rounded-full border border-ui-border-base" 
                      style={{ backgroundColor: project.secondary_color }}
                      title={`Secondary: ${project.secondary_color}`}
                    />
                  )}
                </div>
              )}
            </div>
            <Text className="text-ui-fg-subtle max-w-2xl">
              {exec?.strategic_positioning || project.description || "Industrial Investment Dossier"}
            </Text>
            <div className="flex items-center gap-x-4 mt-3">
              <div className="flex items-center gap-x-1">
                <Text size="small" className="text-ui-fg-muted">Category:</Text>
                <Badge color="grey" size="small">{identity?.industrial_category || "Manufacturing"}</Badge>
              </div>
              <div className="flex items-center gap-x-1">
                <Text size="small" className="text-ui-fg-muted">Scope:</Text>
                <Badge color="blue" size="small">{identity?.operating_scope || "National"}</Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-x-2">
          {/* Generate Full Report Button - Primary CTA */}
          <Button 
            variant="primary" 
            size="small" 
            onClick={() => setIsReportDrawerOpen(true)}
          >
            <PencilSquare className="mr-2" />
            {project.full_report_pdf_url ? "Full Report" : "Generate Full Report"}
          </Button>
          
          {project.cost_analysis_pdf && (
            <Button variant="secondary" size="small" asChild>
              <a 
                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/projects/${project.id}/cost-analysis-pdf`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ArrowDownTray className="mr-2" />
                PDF Report
              </a>
            </Button>
          )}
          {project.business_plan_excel && (
            <Button variant="secondary" size="small" asChild>
              <a 
                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/projects/${project.id}/business-plan-excel`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ArrowDownTray className="mr-2" />
                Excel Plan
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard 
          label="Total Investment" 
          value={`$${totalInvestment.toLocaleString()}`}
          variant="primary"
        />
        <KPICard 
          label="Annual OPEX" 
          value={`$${annualOpex.toLocaleString()}`}
        />
        <KPICard 
          label="ROI" 
          value={`${roi.toFixed(1)}%`}
          variant="success"
        />
        <KPICard 
          label="Payback" 
          value={`${paybackYears.toFixed(1)}`}
          subValue="years"
        />
        <KPICard 
          label="NPV (5yr)" 
          value={`$${Math.round(npv / 1000)}K`}
        />
        <KPICard 
          label="IRR" 
          value={`${irr.toFixed(1)}%`}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="financial">Financial Analysis</Tabs.Trigger>
          <Tabs.Trigger value="equipment">Equipment ({assets.length})</Tabs.Trigger>
          <Tabs.Trigger value="suppliers">Suppliers ({suppliers.length})</Tabs.Trigger>
          <Tabs.Trigger value="layouts">Layouts ({layoutFiles.length})</Tabs.Trigger>
          <Tabs.Trigger value="documents">Documents</Tabs.Trigger>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Content value="overview" className="mt-4">
          {/* Brand Identity Section - Full Width */}
          {(project.logo_url || project.primary_color) && (
            <Container className="p-0 overflow-hidden mb-4">
              <div 
                className="h-2 w-full"
                style={{ 
                  background: `linear-gradient(90deg, ${project.primary_color || '#0F172A'} 0%, ${project.secondary_color || '#3B82F6'} 100%)` 
                }}
              />
              <div className="p-5">
                <div className="flex items-center gap-x-2 mb-4">
                  <Photo className="w-4 h-4 text-ui-fg-muted" />
                  <Heading level="h2" className="text-sm">Brand Identity</Heading>
                </div>
                <div className="flex items-center gap-x-6">
                  {/* Logo */}
                  {project.logo_url && (
                    <div 
                      className="w-20 h-20 rounded-xl flex items-center justify-center shadow-md"
                      style={{ backgroundColor: project.primary_color || '#0F172A' }}
                    >
                      <img 
                        src={project.logo_url} 
                        alt="Brand Logo" 
                        className="w-14 h-14 object-contain"
                      />
                    </div>
                  )}
                  
                  {/* Colors */}
                  <div className="flex flex-col gap-y-2">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">Color Palette</Text>
                    <div className="flex items-center gap-x-3">
                      <div className="flex flex-col items-center gap-y-1">
                        <div 
                          className="w-12 h-12 rounded-lg shadow-sm border border-ui-border-base" 
                          style={{ backgroundColor: project.primary_color || '#0F172A' }}
                        />
                        <Text size="xsmall" className="font-mono text-ui-fg-muted">
                          {project.primary_color || '#0F172A'}
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">Primary</Text>
                      </div>
                      <div className="flex flex-col items-center gap-y-1">
                        <div 
                          className="w-12 h-12 rounded-lg shadow-sm border border-ui-border-base" 
                          style={{ backgroundColor: project.secondary_color || '#3B82F6' }}
                        />
                        <Text size="xsmall" className="font-mono text-ui-fg-muted">
                          {project.secondary_color || '#3B82F6'}
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">Secondary</Text>
                      </div>
                    </div>
                  </div>
                  
                  {/* Brand Values/Tagline */}
                  {project.brand_identity?.tagline && (
                    <div className="flex-1">
                      <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-1">Tagline</Text>
                      <Text size="small" weight="plus" className="italic">
                        "{project.brand_identity.tagline}"
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            </Container>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Executive Summary */}
            <Container className="p-0 overflow-hidden">
              <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                <div className="flex items-center gap-x-2">
                  <DocumentText className="w-4 h-4 text-ui-fg-muted" />
                  <Heading level="h2" className="text-sm">Executive Summary</Heading>
                </div>
              </div>
              <div className="p-5">
                {exec?.key_highlights?.length ? (
                  <div className="space-y-2">
                    {exec.key_highlights.map((highlight: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-x-2">
                        <Check className="w-4 h-4 text-ui-tag-green-icon mt-0.5 flex-shrink-0" />
                        <Text size="small">{highlight}</Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text size="small" className="text-ui-fg-muted">
                    Project analysis complete. Download the full report for detailed insights.
                  </Text>
                )}
              </div>
            </Container>

            {/* Factory Details */}
            <Container className="p-0 overflow-hidden">
              <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                <div className="flex items-center gap-x-2">
                  <Buildings className="w-4 h-4 text-ui-fg-muted" />
                  <Heading level="h2" className="text-sm">Factory Specifications</Heading>
                </div>
              </div>
              <div className="divide-y divide-ui-border-base">
                {planningData?.factory_dimensions && (
                  <>
                    <div className="px-5 py-3 flex justify-between">
                      <Text size="small" className="text-ui-fg-muted">Dimensions</Text>
                      <Text size="small" weight="plus">
                        {planningData.factory_dimensions.width}m × {planningData.factory_dimensions.length}m × {planningData.factory_dimensions.height}m
                      </Text>
                    </div>
                    <div className="px-5 py-3 flex justify-between">
                      <Text size="small" className="text-ui-fg-muted">Total Area</Text>
                      <Text size="small" weight="plus">
                        {(planningData.factory_dimensions.total_area_sqm || 
                          (planningData.factory_dimensions.width * planningData.factory_dimensions.length)).toLocaleString()} m²
                      </Text>
                    </div>
                    <div className="px-5 py-3 flex justify-between">
                      <Text size="small" className="text-ui-fg-muted">Floors</Text>
                      <Text size="small" weight="plus">{planningData.factory_dimensions.floors || 1}</Text>
                    </div>
                  </>
                )}
                {planningData?.location_justification?.recommended_region && (
                  <div className="px-5 py-3 flex justify-between">
                    <Text size="small" className="text-ui-fg-muted">Location</Text>
                    <Text size="small" weight="plus">{planningData.location_justification.recommended_region}</Text>
                  </div>
                )}
              </div>
            </Container>

            {/* Production Lines */}
            {planningData?.production_lines?.length && (
              <Container className="p-0 overflow-hidden lg:col-span-2">
                <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                  <div className="flex items-center gap-x-2">
                    <ChartBar className="w-4 h-4 text-ui-fg-muted" />
                    <Heading level="h2" className="text-sm">Production Lines</Heading>
                    <Badge color="grey" size="small">{planningData.production_lines.length}</Badge>
                  </div>
                </div>
                <div className="divide-y divide-ui-border-base">
                  {planningData.production_lines.map((line, idx) => (
                    <CollapsibleSection key={idx} title={line.line_name || `Line ${idx + 1}`}>
                      <div className="space-y-2">
                        {line.function && (
                          <div>
                            <Text size="xsmall" className="text-ui-fg-muted uppercase">Function</Text>
                            <Text size="small">{line.function}</Text>
                          </div>
                        )}
                        {line.capacity && (
                          <div>
                            <Text size="xsmall" className="text-ui-fg-muted uppercase">Capacity</Text>
                            <Text size="small">{line.capacity}</Text>
                          </div>
                        )}
                        {line.process_logic && (
                          <div>
                            <Text size="xsmall" className="text-ui-fg-muted uppercase">Process</Text>
                            <Text size="small" className="text-ui-fg-subtle">{line.process_logic}</Text>
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>
                  ))}
                </div>
              </Container>
            )}

            {/* Digital Transformation */}
            {planningData?.digital_transformation && (
              <Container className="p-0 overflow-hidden lg:col-span-2">
                <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                  <div className="flex items-center gap-x-2">
                    <ChartBar className="w-4 h-4 text-ui-fg-muted" />
                    <Heading level="h2" className="text-sm">Industry 4.0 Integration</Heading>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ui-border-base">
                  {Object.entries(planningData.digital_transformation).map(([key, value]) => (
                    value && (
                      <div key={key} className="px-5 py-4">
                        <Text size="xsmall" className="text-ui-fg-muted uppercase mb-1">
                          {key.replace(/_/g, ' ')}
                        </Text>
                        <Text size="small">{value as string}</Text>
                      </div>
                    )
                  ))}
                </div>
              </Container>
            )}
          </div>
        </Tabs.Content>

        {/* Financial Analysis Tab */}
        <Tabs.Content value="financial" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* CAPEX Breakdown */}
            <Container className="p-0 overflow-hidden">
              <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                <Heading level="h2" className="text-sm">Initial Investment (CAPEX)</Heading>
              </div>
              <div className="divide-y divide-ui-border-base">
                {analysis?.initial_investment && Object.entries(analysis.initial_investment)
                  .filter(([key]) => key !== 'total')
                  .map(([key, value]) => (
                    <div key={key} className="px-5 py-3 flex justify-between">
                      <Text size="small" className="text-ui-fg-muted capitalize">
                        {key.replace(/_/g, ' ')}
                      </Text>
                      <Text size="small">${(value as number).toLocaleString()}</Text>
                    </div>
                  ))}
                <div className="px-5 py-3 flex justify-between bg-ui-bg-subtle">
                  <Text size="small" weight="plus">Total CAPEX</Text>
                  <Text size="small" weight="plus">${totalInvestment.toLocaleString()}</Text>
                </div>
              </div>
            </Container>

            {/* OPEX Breakdown */}
            <Container className="p-0 overflow-hidden">
              <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                <Heading level="h2" className="text-sm">Operating Costs (OPEX/Year)</Heading>
              </div>
              <div className="divide-y divide-ui-border-base">
                {analysis?.operating_costs && Object.entries(analysis.operating_costs)
                  .filter(([key]) => key !== 'total_annual')
                  .map(([key, value]) => (
                    <div key={key} className="px-5 py-3 flex justify-between">
                      <Text size="small" className="text-ui-fg-muted capitalize">
                        {key.replace(/_/g, ' ')}
                      </Text>
                      <Text size="small">${(value as number).toLocaleString()}</Text>
                    </div>
                  ))}
                <div className="px-5 py-3 flex justify-between bg-ui-bg-subtle">
                  <Text size="small" weight="plus">Total Annual OPEX</Text>
                  <Text size="small" weight="plus">${annualOpex.toLocaleString()}</Text>
                </div>
              </div>
            </Container>

            {/* Financial Metrics */}
            <Container className="p-0 overflow-hidden">
              <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                <Heading level="h2" className="text-sm">Financial Metrics</Heading>
              </div>
              <div className="divide-y divide-ui-border-base">
                <div className="px-5 py-3 flex justify-between">
                  <Text size="small" className="text-ui-fg-muted">5-Year TCO</Text>
                  <Text size="small">${(analysis?.financial_metrics?.total_cost_5_years || 0).toLocaleString()}</Text>
                </div>
                <div className="px-5 py-3 flex justify-between">
                  <Text size="small" className="text-ui-fg-muted">10-Year TCO</Text>
                  <Text size="small">${(analysis?.financial_metrics?.total_cost_10_years || 0).toLocaleString()}</Text>
                </div>
                <div className="px-5 py-3 flex justify-between">
                  <Text size="small" className="text-ui-fg-muted">NPV (10%)</Text>
                  <Text size="small" className={npv >= 0 ? "text-ui-tag-green-text" : "text-ui-tag-red-text"}>
                    ${npv.toLocaleString()}
                  </Text>
                </div>
                <div className="px-5 py-3 flex justify-between">
                  <Text size="small" className="text-ui-fg-muted">IRR</Text>
                  <Text size="small">{irr.toFixed(1)}%</Text>
                </div>
                <div className="px-5 py-3 flex justify-between bg-ui-bg-subtle">
                  <Text size="small" weight="plus">Payback Period</Text>
                  <Text size="small" weight="plus">{paybackYears.toFixed(1)} years</Text>
                </div>
              </div>
            </Container>

            {/* Cash Flow Projections */}
            {analysis?.projections?.length && (
              <Container className="p-0 overflow-hidden lg:col-span-3">
                <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
                  <Heading level="h2" className="text-sm">10-Year Cash Flow Projections</Heading>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Year</Table.HeaderCell>
                        <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
                        <Table.HeaderCell className="text-right">Costs</Table.HeaderCell>
                        <Table.HeaderCell className="text-right">Net Cash Flow</Table.HeaderCell>
                        <Table.HeaderCell className="text-right">Cumulative</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {analysis.projections.map((proj) => (
                        <Table.Row key={proj.year}>
                          <Table.Cell className="font-medium">{proj.year}</Table.Cell>
                          <Table.Cell className="text-right">${proj.revenue.toLocaleString()}</Table.Cell>
                          <Table.Cell className="text-right">${proj.costs.toLocaleString()}</Table.Cell>
                          <Table.Cell className={clx(
                            "text-right",
                            proj.net_cash_flow >= 0 ? "text-ui-tag-green-text" : "text-ui-tag-red-text"
                          )}>
                            ${proj.net_cash_flow.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell className={clx(
                            "text-right font-medium",
                            proj.cumulative_cash_flow >= 0 ? "text-ui-tag-green-text" : "text-ui-tag-red-text"
                          )}>
                            ${proj.cumulative_cash_flow.toLocaleString()}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              </Container>
            )}
          </div>
        </Tabs.Content>

        {/* Equipment Tab */}
        <Tabs.Content value="equipment" className="mt-4">
          <Container className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Equipment</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Description</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Est. Cost</Table.HeaderCell>
                    <Table.HeaderCell>Image</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {assets.map((asset) => (
                    <Table.Row key={asset.id}>
                      <Table.Cell className="font-medium">{asset.name}</Table.Cell>
                      <Table.Cell>
                        <Badge color="grey" size="small">{asset.type || "Equipment"}</Badge>
                      </Table.Cell>
                      <Table.Cell className="max-w-xs truncate text-ui-fg-subtle">
                        {asset.description || "-"}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {asset.specifications?.estimated_cost_usd 
                          ? `$${asset.specifications.estimated_cost_usd.toLocaleString()}`
                          : "-"}
                      </Table.Cell>
                      <Table.Cell>
                        {asset.image_url ? (
                          <a href={asset.image_url} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={asset.image_url} 
                              alt={asset.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          </a>
                        ) : (
                          <div className="w-10 h-10 bg-ui-bg-subtle rounded flex items-center justify-center">
                            <Photo className="w-4 h-4 text-ui-fg-muted" />
                          </div>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </Tabs.Content>

        {/* Suppliers Tab */}
        <Tabs.Content value="suppliers" className="mt-4">
          <Container className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Supplier</Table.HeaderCell>
                    <Table.HeaderCell>Location</Table.HeaderCell>
                    <Table.HeaderCell>Contact</Table.HeaderCell>
                    <Table.HeaderCell>Rating</Table.HeaderCell>
                    <Table.HeaderCell>Verified</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {suppliers.map((supplier) => (
                    <Table.Row key={supplier.id}>
                      <Table.Cell className="font-medium">
                        {supplier.website ? (
                          <a 
                            href={supplier.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-ui-fg-interactive hover:underline"
                          >
                            {supplier.name}
                          </a>
                        ) : supplier.name}
                      </Table.Cell>
                      <Table.Cell>{supplier.location || supplier.country || "-"}</Table.Cell>
                      <Table.Cell>
                        {supplier.email && (
                          <a 
                            href={`mailto:${supplier.email}`}
                            className="text-ui-fg-interactive hover:underline text-sm"
                          >
                            {supplier.email}
                          </a>
                        )}
                        {supplier.phone && (
                          <Text size="xsmall" className="text-ui-fg-muted">{supplier.phone}</Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {supplier.rating ? (
                          <Badge color="blue" size="small">{supplier.rating}/5</Badge>
                        ) : "-"}
                      </Table.Cell>
                      <Table.Cell>
                        {supplier.verified ? (
                          <StatusBadge color="green">Verified</StatusBadge>
                        ) : (
                          <StatusBadge color="grey">Pending</StatusBadge>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </Tabs.Content>

        {/* Layouts Tab */}
        <Tabs.Content value="layouts" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {layoutFiles.map((file) => {
              // file_path contains the data URL (data:image/png;base64,...)
              const imageUrl = file.file_path || file.storage_url || "";
              const layoutTypeName = file.metadata?.layout_type || file.metadata?.layoutType || "Layout";
              
              return (
                <Container key={file.id} className="p-0 overflow-hidden group">
                  <a 
                    href={imageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="aspect-video bg-ui-bg-subtle relative overflow-hidden">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={file.filename}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Photo className="w-8 h-8 text-ui-fg-muted" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <Text weight="plus" size="small">{file.filename}</Text>
                      <Text size="xsmall" className="text-ui-fg-muted capitalize">
                        {layoutTypeName.replace(/_/g, ' ')}
                      </Text>
                    </div>
                  </a>
                </Container>
              );
            })}
            {layoutFiles.length === 0 && (
              <Container className="p-8 lg:col-span-3 text-center">
                <Photo className="w-8 h-8 text-ui-fg-muted mx-auto mb-2" />
                <Text className="text-ui-fg-muted">No layouts generated yet</Text>
              </Container>
            )}
          </div>
        </Tabs.Content>

        {/* Documents Tab - PDF & Images Only */}
        <Tabs.Content value="documents" className="mt-4">
          {/* Generate Reports Banner - Show when reports not generated */}
          {(!project.cost_analysis_pdf || !project.business_plan_excel) && onGenerateReports && (
            <Container className="mb-6 p-0 overflow-hidden border-2 border-dashed border-ui-border-strong">
              <div className="p-6 bg-gradient-to-r from-ui-bg-subtle to-ui-bg-base flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-ui-tag-purple-bg flex items-center justify-center">
                    <DocumentText className="w-6 h-6 text-ui-tag-purple-icon" />
                  </div>
                  <div>
                    <Text weight="plus">Generate Investment Reports</Text>
                    <Text size="small" className="text-ui-fg-muted">
                      Create professional PDF dossier and Excel business plan
                    </Text>
                  </div>
                </div>
                <Button 
                  variant="primary" 
                  onClick={handleGenerateReports}
                  isLoading={isGenerating}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Generate Reports"}
                </Button>
              </div>
              {generationError && (
                <div className="px-6 py-3 bg-ui-tag-red-bg border-t border-ui-tag-red-border">
                  <Text size="small" className="text-ui-tag-red-text">{generationError}</Text>
                </div>
              )}
            </Container>
          )}

          {/* Main Report Section */}
          <div className="mb-8">
            <Text weight="plus" size="small" className="text-ui-fg-muted uppercase tracking-wide mb-4">
              Investment Reports
            </Text>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PDF Investment Dossier - Featured Card */}
              <Container className={clx(
                "p-0 overflow-hidden border-2 transition-all",
                project.cost_analysis_pdf 
                  ? "border-ui-border-strong hover:shadow-lg cursor-pointer" 
                  : "border-ui-border-base"
              )}>
                {project.cost_analysis_pdf ? (
                  <a 
                    href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/projects/${project.id}/cost-analysis-pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="p-8 bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <Text size="xsmall" className="text-slate-400 uppercase tracking-widest mb-2">
                            Professional Report
                          </Text>
                          <Heading level="h3" className="text-white text-xl">
                            Investment Dossier
                          </Heading>
                        </div>
                        <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                          <DocumentText className="w-7 h-7 text-white" />
                        </div>
                      </div>
                      <Text size="small" className="text-slate-300 leading-relaxed">
                        Complete 12-section industrial investment report with executive summary, 
                        financial analysis, risk assessment, and strategic recommendations.
                      </Text>
                    </div>
                    <div className="p-4 bg-ui-bg-base flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge color="red" size="small">PDF</Badge>
                        <Text size="small" className="text-ui-fg-muted">
                          Medusa-style professional format
                        </Text>
                      </div>
                      <div className="flex items-center gap-2 text-ui-fg-interactive">
                        <ArrowDownTray className="w-4 h-4" />
                        <Text size="small" weight="plus">Download</Text>
                      </div>
                    </div>
                  </a>
                ) : (
                  <div>
                    <div className="p-8 bg-gradient-to-br from-slate-100 to-slate-200">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <Text size="xsmall" className="text-slate-400 uppercase tracking-widest mb-2">
                            Professional Report
                          </Text>
                          <Heading level="h3" className="text-slate-600 text-xl">
                            Investment Dossier
                          </Heading>
                        </div>
                        <div className="w-14 h-14 rounded-lg bg-slate-300/50 flex items-center justify-center">
                          <DocumentText className="w-7 h-7 text-slate-400" />
                        </div>
                      </div>
                      <Text size="small" className="text-slate-500 leading-relaxed">
                        Complete 12-section industrial investment report with executive summary, 
                        financial analysis, risk assessment, and strategic recommendations.
                      </Text>
                    </div>
                    <div className="p-4 bg-ui-bg-subtle flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge color="grey" size="small">PDF</Badge>
                        <Text size="small" className="text-ui-fg-muted">
                          Medusa-style professional format
                        </Text>
                      </div>
                      {onGenerateReports ? (
                        <Button 
                          variant="secondary" 
                          size="small"
                          onClick={handleGenerateReports}
                          isLoading={isGenerating}
                          disabled={isGenerating}
                        >
                          Generate
                        </Button>
                      ) : (
                        <Text size="small" className="text-ui-fg-muted">Not generated</Text>
                      )}
                    </div>
                  </div>
                )}
              </Container>

              {/* Excel Business Plan */}
              <Container className={clx(
                "p-0 overflow-hidden border-2 transition-all",
                project.business_plan_excel 
                  ? "border-ui-border-strong hover:shadow-lg cursor-pointer" 
                  : "border-ui-border-base"
              )}>
                {project.business_plan_excel ? (
                  <a 
                    href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/projects/${project.id}/business-plan-excel`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="p-8 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <Text size="xsmall" className="text-emerald-200 uppercase tracking-widest mb-2">
                            Financial Model
                          </Text>
                          <Heading level="h3" className="text-white text-xl">
                            Business Plan
                          </Heading>
                        </div>
                        <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                          <ChartBar className="w-7 h-7 text-white" />
                        </div>
                      </div>
                      <Text size="small" className="text-emerald-100 leading-relaxed">
                        Comprehensive Excel workbook with cost breakdowns, 10-year projections, 
                        cash flow analysis, and investment scenarios.
                      </Text>
                    </div>
                    <div className="p-4 bg-ui-bg-base flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge color="green" size="small">XLSX</Badge>
                        <Text size="small" className="text-ui-fg-muted">
                          Interactive spreadsheet
                        </Text>
                      </div>
                      <div className="flex items-center gap-2 text-ui-fg-interactive">
                        <ArrowDownTray className="w-4 h-4" />
                        <Text size="small" weight="plus">Download</Text>
                      </div>
                    </div>
                  </a>
                ) : (
                  <div>
                    <div className="p-8 bg-gradient-to-br from-emerald-50 to-emerald-100">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <Text size="xsmall" className="text-emerald-400 uppercase tracking-widest mb-2">
                            Financial Model
                          </Text>
                          <Heading level="h3" className="text-emerald-700 text-xl">
                            Business Plan
                          </Heading>
                        </div>
                        <div className="w-14 h-14 rounded-lg bg-emerald-200/50 flex items-center justify-center">
                          <ChartBar className="w-7 h-7 text-emerald-400" />
                        </div>
                      </div>
                      <Text size="small" className="text-emerald-600 leading-relaxed">
                        Comprehensive Excel workbook with cost breakdowns, 10-year projections, 
                        cash flow analysis, and investment scenarios.
                      </Text>
                    </div>
                    <div className="p-4 bg-ui-bg-subtle flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge color="grey" size="small">XLSX</Badge>
                        <Text size="small" className="text-ui-fg-muted">
                          Interactive spreadsheet
                        </Text>
                      </div>
                      {onGenerateReports ? (
                        <Button 
                          variant="secondary" 
                          size="small"
                          onClick={handleGenerateReports}
                          isLoading={isGenerating}
                          disabled={isGenerating}
                        >
                          Generate
                        </Button>
                      ) : (
                        <Text size="small" className="text-ui-fg-muted">Not generated</Text>
                      )}
                    </div>
                  </div>
                )}
              </Container>
            </div>
          </div>

          {/* Layout Images Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Text weight="plus" size="small" className="text-ui-fg-muted uppercase tracking-wide">
                Factory Layout Images
              </Text>
              <Badge color="blue" size="small">{layoutFiles.length} images</Badge>
            </div>
            
            {layoutFiles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {layoutFiles.map((file) => {
                  const imageUrl = file.file_path || file.storage_url || "";
                  const layoutTypeName = file.metadata?.layout_type || file.metadata?.layoutType || "Layout";
                  const layoutLabel = layoutTypeName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                  
                  return (
                    <Container key={file.id} className="p-0 overflow-hidden group hover:shadow-md transition-all">
                      <a 
                        href={imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        download={file.filename}
                        className="block"
                      >
                        <div className="aspect-[4/3] bg-ui-bg-subtle relative overflow-hidden">
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={layoutLabel}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Photo className="w-8 h-8 text-ui-fg-muted" />
                            </div>
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-3 shadow-lg">
                              <ArrowDownTray className="w-5 h-5 text-ui-fg-base" />
                            </div>
                          </div>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                          <div>
                            <Text weight="plus" size="small">{layoutLabel}</Text>
                            <Text size="xsmall" className="text-ui-fg-muted">PNG Image</Text>
                          </div>
                          <Badge color="cyan" size="small">Download</Badge>
                        </div>
                      </a>
                    </Container>
                  );
                })}
              </div>
            ) : (
              <Container className="p-12 text-center bg-ui-bg-subtle">
                <Photo className="w-12 h-12 text-ui-fg-muted mx-auto mb-3" />
                <Text className="text-ui-fg-muted mb-1">No layout images generated</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  Layout images will appear here once generated
                </Text>
              </Container>
            )}
          </div>
        </Tabs.Content>
      </Tabs>

      {/* Risk Assessment */}
      {(planningData?.risk_assessment || analysis?.risk_analysis) && (
        <Container className="p-0 overflow-hidden">
          <div className="px-5 py-4 bg-ui-bg-subtle border-b border-ui-border-base">
            <Heading level="h2" className="text-sm">Risk Assessment</Heading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-ui-border-base">
            {planningData?.risk_assessment?.market_risks?.length && (
              <div className="p-5">
                <Text size="xsmall" className="text-ui-fg-muted uppercase mb-2">Market Risks</Text>
                <ul className="space-y-1">
                  {planningData.risk_assessment.market_risks.slice(0, 3).map((risk, idx) => (
                    <li key={idx} className="text-sm text-ui-fg-subtle">• {risk}</li>
                  ))}
                </ul>
              </div>
            )}
            {planningData?.risk_assessment?.technical_risks?.length && (
              <div className="p-5">
                <Text size="xsmall" className="text-ui-fg-muted uppercase mb-2">Technical Risks</Text>
                <ul className="space-y-1">
                  {planningData.risk_assessment.technical_risks.slice(0, 3).map((risk, idx) => (
                    <li key={idx} className="text-sm text-ui-fg-subtle">• {risk}</li>
                  ))}
                </ul>
              </div>
            )}
            {planningData?.risk_assessment?.supply_risks?.length && (
              <div className="p-5">
                <Text size="xsmall" className="text-ui-fg-muted uppercase mb-2">Supply Risks</Text>
                <ul className="space-y-1">
                  {planningData.risk_assessment.supply_risks.slice(0, 3).map((risk, idx) => (
                    <li key={idx} className="text-sm text-ui-fg-subtle">• {risk}</li>
                  ))}
                </ul>
              </div>
            )}
            {planningData?.risk_assessment?.mitigation_strategies?.length && (
              <div className="p-5">
                <Text size="xsmall" className="text-ui-fg-muted uppercase mb-2">Mitigation</Text>
                <ul className="space-y-1">
                  {planningData.risk_assessment.mitigation_strategies.slice(0, 3).map((strategy, idx) => (
                    <li key={idx} className="text-sm text-ui-fg-subtle">• {strategy}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Container>
      )}

      {/* Footer */}
      <div className="text-center py-4">
        <Text size="xsmall" className="text-ui-fg-muted">
          Generated by Elite Industrial Strategy AI • {new Date().toLocaleDateString()}
        </Text>
      </div>

      {/* Full Report Generation Drawer */}
      <FullReportDrawer
        projectId={project.id}
        projectName={identity?.factory_name || project.name}
        open={isReportDrawerOpen}
        onOpenChange={setIsReportDrawerOpen}
        existingReportUrl={project.full_report_pdf_url}
        onReportGenerated={handleReportGenerated}
      />
    </div>
  );
}

