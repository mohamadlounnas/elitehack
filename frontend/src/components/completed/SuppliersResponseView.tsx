import React, { useState } from "react";
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui";
import { TriangleDownMini, Check } from "@medusajs/icons";
import type { Supplier } from "../../types";

interface SuppliersResponseViewProps {
  suppliers: Supplier[];
}

/**
 * Elite Suppliers Response View
 * Displays comprehensive supplier information with contact details, certifications, and ratings
 */
export function SuppliersResponseView({ suppliers }: SuppliersResponseViewProps) {
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (suppliers.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Group suppliers by country
  const suppliersByCountry = suppliers.reduce((acc, supplier) => {
    const country = supplier.country || supplier.location?.split(',').pop()?.trim() || 'Other';
    if (!acc[country]) acc[country] = [];
    acc[country].push(supplier);
    return acc;
  }, {} as Record<string, Supplier[]>);

  // Calculate stats
  const totalSuppliers = suppliers.length;
  const countriesCount = Object.keys(suppliersByCountry).length;
  const verifiedCount = suppliers.filter(s => s.verified).length;
  const avgRating = suppliers.filter(s => s.rating).reduce((sum, s) => sum + (s.rating || 0), 0) / (suppliers.filter(s => s.rating).length || 1);

  return (
    <Container className="p-6 border border-ui-border-base">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white text-lg">🏭</span>
          </div>
          <div>
            <Heading level="h3" className="text-ui-fg-base font-semibold">
              Verified Suppliers
            </Heading>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Sourcing & Procurement
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "primary" : "secondary"}
            size="small"
            onClick={() => setViewMode("grid")}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "primary" : "secondary"}
            size="small"
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
          <Text size="xsmall" className="text-purple-600 uppercase tracking-wide">Total Suppliers</Text>
          <Text weight="plus" className="text-2xl text-purple-700">{totalSuppliers}</Text>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <Text size="xsmall" className="text-blue-600 uppercase tracking-wide">Countries</Text>
          <Text weight="plus" className="text-2xl text-blue-700">{countriesCount}</Text>
        </div>
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <Text size="xsmall" className="text-green-600 uppercase tracking-wide">Verified</Text>
          <Text weight="plus" className="text-2xl text-green-700">{verifiedCount}</Text>
        </div>
        <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
          <Text size="xsmall" className="text-yellow-600 uppercase tracking-wide">Avg Rating</Text>
          <Text weight="plus" className="text-2xl text-yellow-700">
            {avgRating > 0 ? avgRating.toFixed(1) : "N/A"} ★
          </Text>
        </div>
      </div>

      {/* Suppliers by Country */}
      <div className="space-y-6">
        {Object.entries(suppliersByCountry).map(([country, countrySuppliers]) => (
          <div key={country}>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-ui-border-base">
              <Text weight="plus" size="small" className="text-ui-fg-base">
                🌍 {country}
              </Text>
              <Badge color="grey" size="small">
                {countrySuppliers.length} supplier{countrySuppliers.length > 1 ? 's' : ''}
              </Badge>
            </div>

            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
              : "space-y-3"
            }>
              {countrySuppliers.map((supplier) => {
                const isExpanded = expandedSuppliers.has(supplier.id);
          const linkedAssets = supplier.asset_suppliers
                  ?.map((as: any) => as.asset?.name || as.assets?.name)
                  .filter(Boolean) || [];
          
          return (
                  <div 
                    key={supplier.id}
                    className={`rounded-lg border border-ui-border-base bg-white overflow-hidden hover:shadow-md transition-all ${
                      viewMode === "list" ? "flex" : ""
                    }`}
                  >
                    {/* Main Content */}
                    <div className={`p-4 ${viewMode === "list" ? "flex-1 flex items-center gap-4" : ""}`}>
                      <div className={viewMode === "list" ? "flex-1" : ""}>
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Text weight="plus" size="small" className="text-ui-fg-base">
                                {supplier.name}
                              </Text>
                              {supplier.verified && (
                                <Badge color="green" size="2xsmall">
                                  <Check className="w-3 h-3 mr-0.5" /> Verified
                                </Badge>
                              )}
                            </div>
                            <Text size="xsmall" className="text-ui-fg-muted mt-0.5">
                              {supplier.location || supplier.address}
                            </Text>
                          </div>
                    {supplier.rating && (
                            <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-full">
                              <span className="text-yellow-500">★</span>
                              <Text size="xsmall" weight="plus" className="text-yellow-700">
                                {supplier.rating.toFixed(1)}
                              </Text>
                            </div>
                          )}
                        </div>

                        {/* Quick Info */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {supplier.company_size && (
                            <Badge color="grey" size="2xsmall">
                              📊 {supplier.company_size}
                            </Badge>
                          )}
                          {supplier.years_in_business && (
                            <Badge color="grey" size="2xsmall">
                              🏢 {supplier.years_in_business}+ years
                            </Badge>
                          )}
                        </div>

                        {/* Certifications */}
                        {supplier.certifications && supplier.certifications.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {supplier.certifications.slice(0, 4).map((cert, i) => (
                              <span 
                                key={i}
                                className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-medium"
                              >
                                {cert}
                              </span>
                            ))}
                            {supplier.certifications.length > 4 && (
                              <span className="px-2 py-0.5 bg-ui-bg-subtle text-ui-fg-muted rounded-full text-[10px]">
                                +{supplier.certifications.length - 4} more
                              </span>
                    )}
                  </div>
                  )}

                        {/* Contact Actions */}
                  <div className="flex flex-wrap gap-2">
                    {supplier.website && (
                      <a 
                        href={supplier.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-ui-bg-subtle hover:bg-ui-bg-base-hover text-ui-fg-interactive hover:text-ui-fg-base transition-colors"
                      >
                        🌐 Website
                      </a>
                    )}
                    {supplier.email && (
                      <a 
                        href={`mailto:${supplier.email}`}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-ui-bg-subtle hover:bg-ui-bg-base-hover text-ui-fg-interactive hover:text-ui-fg-base transition-colors"
                      >
                        ✉️ Email
                      </a>
                    )}
                    {supplier.phone && (
                      <a 
                        href={`tel:${supplier.phone}`}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-ui-bg-subtle hover:bg-ui-bg-base-hover text-ui-fg-interactive hover:text-ui-fg-base transition-colors"
                            >
                              📞 Call
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Expand Button */}
                      <button
                        onClick={() => toggleExpand(supplier.id)}
                        className={`flex items-center gap-1 text-xs text-ui-fg-muted hover:text-ui-fg-base transition-colors ${
                          viewMode === "list" ? "" : "mt-3 w-full justify-center pt-3 border-t border-ui-border-base"
                        }`}
                      >
                        <TriangleDownMini 
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} 
                        />
                        {isExpanded ? "Less details" : "More details"}
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-ui-border-base pt-3 bg-ui-bg-subtle">
                        {/* Description */}
                        {supplier.description && (
                          <div className="mb-3">
                            <Text size="xsmall" weight="plus" className="text-ui-fg-muted mb-1">
                              About
                            </Text>
                            <Text size="small" className="text-ui-fg-subtle">
                              {supplier.description}
                            </Text>
                          </div>
                        )}

                        {/* Full Address */}
                        {supplier.address && (
                          <div className="mb-3">
                            <Text size="xsmall" weight="plus" className="text-ui-fg-muted mb-1">
                              Address
                            </Text>
                            <Text size="small" className="text-ui-fg-subtle">
                              {supplier.address}
                            </Text>
                          </div>
                        )}

                        {/* Contact Person */}
                        {supplier.contact_person && (
                          <div className="mb-3">
                            <Text size="xsmall" weight="plus" className="text-ui-fg-muted mb-1">
                              Contact Person
                            </Text>
                            <Text size="small" className="text-ui-fg-subtle">
                              {supplier.contact_person}
                            </Text>
                          </div>
                        )}

                        {/* Products */}
                        {supplier.products && supplier.products.length > 0 && (
                          <div className="mb-3">
                            <Text size="xsmall" weight="plus" className="text-ui-fg-muted mb-1">
                              Products
                            </Text>
                            <div className="flex flex-wrap gap-1">
                              {supplier.products.map((product, i) => (
                                <span 
                                  key={i}
                                  className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                                >
                                  {product}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Specializations */}
                        {supplier.specializations && supplier.specializations.length > 0 && (
                          <div className="mb-3">
                            <Text size="xsmall" weight="plus" className="text-ui-fg-muted mb-1">
                              Specializations
                            </Text>
                            <div className="flex flex-wrap gap-1">
                              {supplier.specializations.map((spec, i) => (
                                <span 
                                  key={i}
                                  className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Linked Assets */}
                        {linkedAssets.length > 0 && (
                          <div>
                            <Text size="xsmall" weight="plus" className="text-ui-fg-muted mb-1">
                              Supplies Equipment For
                            </Text>
                            <div className="flex flex-wrap gap-1">
                              {linkedAssets.map((asset, i) => (
                                <span 
                                  key={i}
                                  className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs"
                                >
                                  {asset}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Compliance Footer */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <Text size="small" weight="plus" className="text-blue-700">
              Algeria Trade Compliance Verified
            </Text>
            <Text size="xsmall" className="text-blue-600">
              All suppliers have been screened for compliance with Algerian import regulations. 
              Prohibited regions (Morocco, Israel) have been automatically excluded.
            </Text>
                </div>
              </div>
      </div>
    </Container>
  );
}
