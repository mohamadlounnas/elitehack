import React from "react";
import { Container, Heading, Text, Badge } from "@medusajs/ui";
import type { Supplier } from "../../types";

interface SuppliersResponseViewProps {
  suppliers: Supplier[];
}

/**
 * Displays all suppliers with their contact information and linked assets
 */
export function SuppliersResponseView({ suppliers }: SuppliersResponseViewProps) {
  if (suppliers.length === 0) return null;

  return (
    <Container className="p-6 border border-ui-border-base">
      <div className="flex items-center gap-2 mb-4">
        <Heading level="h3" className="text-ui-fg-base font-semibold">Suppliers</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle">Step: Sourcing</Text>
        <Badge color="blue" size="small">{suppliers.length} suppliers</Badge>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {suppliers.map((supplier) => {
          const linkedAssets = supplier.asset_suppliers
            ?.map((as: any) => as.assets?.name)
            .filter(Boolean)
            .join(", ") || "Various assets";
          
          return (
            <Container key={supplier.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Text weight="plus" size="small">{supplier.name}</Text>
                    {supplier.rating && (
                      <Badge color="blue" size="small">Rating: {supplier.rating}/5</Badge>
                    )}
                  </div>
                  {supplier.location && (
                    <Text size="small" className="text-ui-fg-subtle mb-2 flex items-center gap-1">
                      <span>📍</span> {supplier.location}
                    </Text>
                  )}
                  <Text size="xsmall" className="text-ui-fg-muted mb-3">
                    <strong>For:</strong> {linkedAssets}
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    {supplier.website && (
                      <a 
                        href={supplier.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-ui-fg-interactive hover:text-ui-fg-base hover:underline transition-colors px-2 py-1 rounded bg-ui-bg-subtle"
                      >
                        🌐 Website
                      </a>
                    )}
                    {supplier.email && (
                      <a 
                        href={`mailto:${supplier.email}`}
                        className="text-xs text-ui-fg-interactive hover:text-ui-fg-base hover:underline transition-colors px-2 py-1 rounded bg-ui-bg-subtle"
                      >
                        ✉️ Email
                      </a>
                    )}
                    {supplier.phone && (
                      <a 
                        href={`tel:${supplier.phone}`}
                        className="text-xs text-ui-fg-interactive hover:text-ui-fg-base hover:underline transition-colors px-2 py-1 rounded bg-ui-bg-subtle"
                      >
                        📞 Phone
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Container>
          );
        })}
      </div>
    </Container>
  );
}

