import React, { useState } from "react";
import { Container, Heading, Text, Badge, StatusBadge } from "@medusajs/ui";
import { Check, Buildings, TriangleDownMini } from "@medusajs/icons";

interface PlanningResponseViewProps {
  planningData: any;
}

/**
 * Elite Planning Response View - Displays comprehensive industrial dossier
 */
export function PlanningResponseView({ planningData }: PlanningResponseViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["summary", "identity", "dimensions"])
  );

  if (!planningData) return null;

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const SectionHeader = ({ 
    id, 
    title, 
    badge 
  }: { 
    id: string; 
    title: string; 
    badge?: string;
  }) => (
    <div
      className="flex items-center justify-between cursor-pointer p-4 bg-ui-bg-subtle rounded-lg hover:bg-ui-bg-base-hover transition-colors border border-ui-border-base"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-3">
        <Heading level="h4" className="text-ui-fg-base font-semibold">{title}</Heading>
        {badge && <Badge color="blue" size="small">{badge}</Badge>}
      </div>
      <TriangleDownMini 
        className={`text-ui-fg-muted transition-transform ${expandedSections.has(id) ? 'rotate-180' : ''}`} 
      />
    </div>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
    value ? (
      <div className="flex justify-between items-center py-2 border-b border-ui-border-base last:border-b-0">
        <Text size="small" className="text-ui-fg-subtle">{label}</Text>
        <Text size="small" weight="plus" className="text-ui-fg-base">{value}</Text>
      </div>
    ) : null
  );

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-ui-tag-blue-bg rounded-lg flex items-center justify-center">
          <Buildings className="w-5 h-5 text-ui-tag-blue-text" />
        </div>
        <div>
          <Heading level="h3" className="text-ui-fg-base font-semibold">Industrial Project Dossier</Heading>
          <Text size="xsmall" className="text-ui-fg-subtle">Comprehensive Planning Analysis</Text>
        </div>
        <StatusBadge color="green" className="ml-auto">
          <Check className="w-3 h-3" /> Complete
        </StatusBadge>
      </div>

      <div className="space-y-4">
        {/* Executive Summary */}
        {planningData.executive_summary && (
          <div>
            <SectionHeader id="summary" title="Executive Summary" badge="Overview" />
            {expandedSections.has("summary") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                {planningData.executive_summary.factory_identity && (
                  <div className="mb-4">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">Factory Identity</Text>
                    <Text size="base" weight="plus" className="text-ui-fg-base mt-1">
                      {planningData.executive_summary.factory_identity}
                    </Text>
                  </div>
                )}
                {planningData.executive_summary.strategic_positioning && (
                  <div className="mb-4">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">Strategic Positioning</Text>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                      {planningData.executive_summary.strategic_positioning}
                    </Text>
                  </div>
                )}
                {planningData.executive_summary.industry_positioning && (
                  <div className="mb-4">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">Industry 5.0/5.0 Positioning</Text>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                      {planningData.executive_summary.industry_positioning}
                    </Text>
                  </div>
                )}
                {planningData.executive_summary.key_highlights && planningData.executive_summary.key_highlights.length > 0 && (
                  <div>
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-2">Key Highlights</Text>
                    <div className="flex flex-wrap gap-2">
                      {planningData.executive_summary.key_highlights.map((highlight: string, idx: number) => (
                        <Badge key={idx} color="green" size="small">✓ {highlight}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Industrial Identity */}
        {planningData.industrial_identity && (
          <div>
            <SectionHeader id="identity" title="Industrial Identity & Legal Scope" />
            {expandedSections.has("identity") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <InfoRow label="Factory Name" value={planningData.industrial_identity.factory_name} />
                <InfoRow label="Industrial Category" value={planningData.industrial_identity.industrial_category} />
                <InfoRow label="Legal Nature" value={planningData.industrial_identity.legal_nature} />
                <InfoRow label="Operating Scope" value={planningData.industrial_identity.operating_scope} />
                <InfoRow label="Industry Ambition" value={planningData.industrial_identity.industry_ambition} />
                {planningData.industrial_identity.certifications_required && (
                  <div className="pt-3 mt-3 border-t border-ui-border-base">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-2">Required Certifications</Text>
                    <div className="flex flex-wrap gap-2">
                      {planningData.industrial_identity.certifications_required.map((cert: string, idx: number) => (
                        <Badge key={idx} color="grey" size="small">{cert}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Location Justification */}
        {planningData.location_justification && (
          <div>
            <SectionHeader id="location" title="Location & Land Justification" />
            {expandedSections.has("location") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <InfoRow label="Recommended Region" value={planningData.location_justification.recommended_region} />
                <InfoRow label="Industrial Zone Type" value={planningData.location_justification.industrial_zone_type} />
                {planningData.location_justification.land_requirements && (
                  <div className="py-3 border-b border-ui-border-base">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-2">Land Requirements</Text>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-ui-bg-subtle rounded">
                        <Text size="xsmall" className="text-ui-fg-muted">Total Area</Text>
                        <Text size="base" weight="plus">{planningData.location_justification.land_requirements.total_area_sqm?.toLocaleString()} m²</Text>
                      </div>
                      <div className="text-center p-3 bg-ui-bg-subtle rounded">
                        <Text size="xsmall" className="text-ui-fg-muted">Built Area</Text>
                        <Text size="base" weight="plus">{planningData.location_justification.land_requirements.built_area_sqm?.toLocaleString()} m²</Text>
                      </div>
                      <div className="text-center p-3 bg-ui-bg-subtle rounded">
                        <Text size="xsmall" className="text-ui-fg-muted">Expansion Reserve</Text>
                        <Text size="base" weight="plus">{planningData.location_justification.land_requirements.expansion_reserve_sqm?.toLocaleString()} m²</Text>
                      </div>
                    </div>
                  </div>
                )}
                {planningData.location_justification.logistics_access && (
                  <div className="py-3 border-b border-ui-border-base">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-2">Logistics Access</Text>
                    <InfoRow label="Nearest Port" value={planningData.location_justification.logistics_access.nearest_port} />
                    <InfoRow label="Highway Access" value={planningData.location_justification.logistics_access.highway_access} />
                    <InfoRow label="Railway Access" value={planningData.location_justification.logistics_access.railway_access} />
                    <InfoRow label="Supplier Proximity" value={planningData.location_justification.logistics_access.supplier_proximity} />
                  </div>
                )}
                {planningData.location_justification.site_justification && (
                  <div className="pt-3">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-1">Site Justification</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {planningData.location_justification.site_justification}
                    </Text>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Factory Dimensions */}
        {planningData.factory_dimensions && (
          <div>
            <SectionHeader id="dimensions" title="Factory Dimensions" />
            {expandedSections.has("dimensions") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-4 bg-ui-bg-subtle rounded-lg">
                    <Text size="xsmall" className="text-ui-fg-muted">Width</Text>
                    <Text size="xlarge" weight="plus" className="text-ui-fg-base">{planningData.factory_dimensions.width}m</Text>
                  </div>
                  <div className="text-center p-4 bg-ui-bg-subtle rounded-lg">
                    <Text size="xsmall" className="text-ui-fg-muted">Length</Text>
                    <Text size="xlarge" weight="plus" className="text-ui-fg-base">{planningData.factory_dimensions.length}m</Text>
                  </div>
                  <div className="text-center p-4 bg-ui-bg-subtle rounded-lg">
                    <Text size="xsmall" className="text-ui-fg-muted">Height</Text>
                    <Text size="xlarge" weight="plus" className="text-ui-fg-base">{planningData.factory_dimensions.height}m</Text>
                  </div>
                  <div className="text-center p-4 bg-ui-bg-subtle rounded-lg">
                    <Text size="xsmall" className="text-ui-fg-muted">Floors</Text>
                    <Text size="xlarge" weight="plus" className="text-ui-fg-base">{planningData.factory_dimensions.floors}</Text>
                  </div>
                </div>
                {(planningData.factory_dimensions.total_area_sqm || planningData.factory_dimensions.production_area_sqm) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {planningData.factory_dimensions.total_area_sqm && (
                      <div className="p-3 border border-ui-border-base rounded">
                        <Text size="xsmall" className="text-ui-fg-muted">Total Area</Text>
                        <Text size="small" weight="plus">{planningData.factory_dimensions.total_area_sqm.toLocaleString()} m²</Text>
                      </div>
                    )}
                    {planningData.factory_dimensions.production_area_sqm && (
                      <div className="p-3 border border-ui-border-base rounded">
                        <Text size="xsmall" className="text-ui-fg-muted">Production</Text>
                        <Text size="small" weight="plus">{planningData.factory_dimensions.production_area_sqm.toLocaleString()} m²</Text>
                      </div>
                    )}
                    {planningData.factory_dimensions.storage_area_sqm && (
                      <div className="p-3 border border-ui-border-base rounded">
                        <Text size="xsmall" className="text-ui-fg-muted">Storage</Text>
                        <Text size="small" weight="plus">{planningData.factory_dimensions.storage_area_sqm.toLocaleString()} m²</Text>
                      </div>
                    )}
                    {planningData.factory_dimensions.office_area_sqm && (
                      <div className="p-3 border border-ui-border-base rounded">
                        <Text size="xsmall" className="text-ui-fg-muted">Office</Text>
                        <Text size="small" weight="plus">{planningData.factory_dimensions.office_area_sqm.toLocaleString()} m²</Text>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Production Process */}
        {planningData.production_process && (
          <div>
            <SectionHeader id="process" title="Production Process" />
            {expandedSections.has("process") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <Text size="base" className="text-ui-fg-base">{planningData.production_process}</Text>
                {planningData.capacity && (
                  <div className="mt-4 p-3 bg-ui-tag-green-bg rounded-lg">
                    <Text size="xsmall" className="text-ui-tag-green-text uppercase tracking-wider">Production Capacity</Text>
                    <Text size="small" weight="plus" className="text-ui-tag-green-text mt-1">{planningData.capacity}</Text>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Production Lines */}
        {planningData.production_lines && planningData.production_lines.length > 0 && (
          <div>
            <SectionHeader id="lines" title="Production Lines" badge={`${planningData.production_lines.length} lines`} />
            {expandedSections.has("lines") && (
              <div className="mt-3 space-y-3">
                {planningData.production_lines.map((line: any, idx: number) => (
                  <div key={idx} className="p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge color="blue" size="small">Line {idx + 1}</Badge>
                      <Text size="base" weight="plus" className="text-ui-fg-base">{line.line_name}</Text>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Text size="xsmall" className="text-ui-fg-muted">Function</Text>
                        <Text size="small" className="text-ui-fg-subtle">{line.function}</Text>
                      </div>
                      <div>
                        <Text size="xsmall" className="text-ui-fg-muted">Role in Chain</Text>
                        <Text size="small" className="text-ui-fg-subtle">{line.role_in_chain}</Text>
                      </div>
                      <div>
                        <Text size="xsmall" className="text-ui-fg-muted">Capacity</Text>
                        <Text size="small" className="text-ui-fg-subtle">{line.capacity}</Text>
                      </div>
                      <div>
                        <Text size="xsmall" className="text-ui-fg-muted">Industrial Importance</Text>
                        <Text size="small" className="text-ui-fg-subtle">{line.industrial_importance}</Text>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assets & Equipment */}
        {planningData.assets && planningData.assets.length > 0 && (
          <div>
            <SectionHeader id="assets" title="Assets & Equipment" badge={`${planningData.assets.length} items`} />
            {expandedSections.has("assets") && (
              <div className="mt-3 space-y-3">
                {planningData.assets.map((asset: any, idx: number) => (
                  <div key={idx} className="p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                    <div className="flex items-center justify-between mb-2">
                      <Text size="base" weight="plus" className="text-ui-fg-base">{asset.name}</Text>
                      {asset.type && <Badge color="grey" size="small">{asset.type}</Badge>}
                    </div>
                    {asset.description && (
                      <Text size="small" className="text-ui-fg-subtle mb-2">{asset.description}</Text>
                    )}
                    {asset.estimated_cost_usd && (
                      <Text size="small" className="text-ui-fg-interactive">Est. Cost: ${asset.estimated_cost_usd.toLocaleString()}</Text>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Digital Transformation */}
        {planningData.digital_transformation && (
          <div>
            <SectionHeader id="digital" title="Digital Twin & AI Integration" badge="Industry 5.0" />
            {expandedSections.has("digital") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(planningData.digital_transformation).map(([key, value]) => (
                    value && (
                      <div key={key} className="p-3 bg-ui-bg-subtle rounded">
                        <Text size="xsmall" className="text-ui-fg-muted uppercase">{key.replace(/_/g, ' ')}</Text>
                        <Text size="small" className="text-ui-fg-subtle mt-1">{value as string}</Text>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Risk Assessment */}
        {planningData.risk_assessment && (
          <div>
            <SectionHeader id="risks" title="Risk Assessment" />
            {expandedSections.has("risks") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {planningData.risk_assessment.market_risks && (
                    <div>
                      <Text size="xsmall" className="text-ui-tag-orange-text uppercase tracking-wider mb-2">Market Risks</Text>
                      <ul className="space-y-1">
                        {planningData.risk_assessment.market_risks.map((risk: string, idx: number) => (
                          <li key={idx} className="text-sm text-ui-fg-subtle">• {risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {planningData.risk_assessment.technical_risks && (
                    <div>
                      <Text size="xsmall" className="text-ui-tag-red-text uppercase tracking-wider mb-2">Technical Risks</Text>
                      <ul className="space-y-1">
                        {planningData.risk_assessment.technical_risks.map((risk: string, idx: number) => (
                          <li key={idx} className="text-sm text-ui-fg-subtle">• {risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {planningData.risk_assessment.mitigation_strategies && (
                    <div className="md:col-span-2">
                      <Text size="xsmall" className="text-ui-tag-green-text uppercase tracking-wider mb-2">Mitigation Strategies</Text>
                      <div className="flex flex-wrap gap-2">
                        {planningData.risk_assessment.mitigation_strategies.map((strategy: string, idx: number) => (
                          <Badge key={idx} color="green" size="small">→ {strategy}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scalability */}
        {planningData.scalability && (
          <div>
            <SectionHeader id="scalability" title="Scalability & Future Expansion" />
            {expandedSections.has("scalability") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                {planningData.scalability.expansion_phases && (
                  <div className="mb-4">
                    <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider mb-2">Expansion Phases</Text>
                    <div className="flex flex-wrap gap-2">
                      {planningData.scalability.expansion_phases.map((phase: string, idx: number) => (
                        <Badge key={idx} color="purple" size="small">Phase {idx + 1}: {phase}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {planningData.scalability.capacity_growth && (
                  <div className="p-3 bg-ui-tag-blue-bg rounded">
                    <Text size="xsmall" className="text-ui-tag-blue-text uppercase">Capacity Growth Potential</Text>
                    <Text size="small" weight="plus" className="text-ui-tag-blue-text">{planningData.scalability.capacity_growth}</Text>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Machinery (Legacy support) */}
        {planningData.machinery && planningData.machinery.length > 0 && !planningData.production_lines && (
          <div>
            <SectionHeader id="machinery" title="Required Machinery" badge={`${planningData.machinery.length} items`} />
            {expandedSections.has("machinery") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <div className="flex flex-wrap gap-2">
                  {planningData.machinery.map((machine: string, idx: number) => (
                    <Badge key={idx} color="grey" size="small">{machine}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Materials */}
        {planningData.materials && planningData.materials.length > 0 && (
          <div>
            <SectionHeader id="materials" title="Required Materials" badge={`${planningData.materials.length} items`} />
            {expandedSections.has("materials") && (
              <div className="mt-3 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
                <div className="flex flex-wrap gap-2">
                  {planningData.materials.map((material: string, idx: number) => (
                    <Badge key={idx} color="orange" size="small">{material}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Container>
  );
}
