/**
 * Asset Detail Drawer
 * Shows detailed asset information with supplier comparison and scoring
 */

import { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  Heading,
  Text,
  Button,
  Badge,
  Container,
  clx,
} from "@medusajs/ui";
import {
  XMark,
  Buildings,
  CurrencyDollar,
  Clock,
  Photo,
  Link as LinkIcon,
  Phone,
  EnvelopeSolid,
  CheckCircleSolid,
  ShieldCheck,
  ExclamationCircle,
  Star,
  Swatch,
  MagnifyingGlass,
  ArrowPath,
  GlobeEurope,
} from "@medusajs/icons";
import type { Asset, Supplier, AssetSupplier } from "../../types";
import { assetsApi } from "../../services/api";
import ModelViewer from "./ModelViewer";

// API base URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

interface AssetDetailDrawerProps {
  asset: Asset | null;
  projectId: string;
  allSuppliers: Supplier[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SupplierScore {
  supplier: Supplier;
  assetSupplier?: AssetSupplier;
  totalScore: number;
  scores: {
    price: number;
    delivery: number;
    quality: number;
    reliability: number;
    location: number;
  };
}

export function AssetDetailDrawer({
  asset,
  projectId,
  allSuppliers,
  open,
  onOpenChange,
}: AssetDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [supplierScores, setSupplierScores] = useState<SupplierScore[]>([]);
  const [fullAsset, setFullAsset] = useState<Asset | null>(asset);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);
  
  // Sourcing state
  const [isSourcing, setIsSourcing] = useState(false);
  const [sourcingProgress, setSourcingProgress] = useState<string[]>([]);
  const [sourcingError, setSourcingError] = useState<string | null>(null);
  const [foundSuppliersFromSourcing, setFoundSuppliersFromSourcing] = useState<any[]>([]);

  // Load full asset with image when drawer opens
  useEffect(() => {
    if (open && asset && !fullAsset?.image_url) {
      setIsLoadingAsset(true);
      assetsApi.getAsset(projectId, asset.id)
        .then((loadedAsset) => {
          setFullAsset(loadedAsset);
        })
        .catch((error) => {
          console.error("Error loading asset with image:", error);
          // Fallback to asset without image
          setFullAsset(asset);
        })
        .finally(() => {
          setIsLoadingAsset(false);
        });
    } else if (asset) {
      setFullAsset(asset);
    }
  }, [open, asset?.id, projectId]);

  // Reset to details tab when asset changes
  useEffect(() => {
    setActiveTab("details");
    setSourcingProgress([]);
    setSourcingError(null);
    setFoundSuppliersFromSourcing([]);
  }, [asset?.id]);

  // Function to start sourcing for this specific asset
  const startSourcingForAsset = useCallback(async () => {
    if (!fullAsset || !projectId) return;
    
    setIsSourcing(true);
    setSourcingProgress([]);
    setSourcingError(null);
    setFoundSuppliersFromSourcing([]);
    
    try {
      // Call the backend API to source suppliers for this specific asset
      const response = await fetch(`${API_BASE}/projects/${projectId}/assets/${fullAsset.id}/source`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Sourcing failed: ${response.statusText}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        let buffer = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Parse SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.message) {
                  setSourcingProgress(prev => [...prev, data.message]);
                }
                
                if (data.supplier) {
                  setFoundSuppliersFromSourcing(prev => [...prev, data.supplier]);
                }
                
                if (data.suppliers) {
                  setFoundSuppliersFromSourcing(data.suppliers);
                }
                
                if (data.error) {
                  setSourcingError(data.error);
                }
              } catch {
                // Not JSON, just add as message
                setSourcingProgress(prev => [...prev, line.slice(6)]);
              }
            }
          }
        }
      } else {
        // Non-streaming response
        const data = await response.json();
        if (data.suppliers) {
          setFoundSuppliersFromSourcing(data.suppliers);
          setSourcingProgress(prev => [...prev, `Found ${data.suppliers.length} suppliers`]);
        }
      }
      
      setSourcingProgress(prev => [...prev, "✅ Sourcing complete!"]);
    } catch (error: any) {
      console.error("Sourcing error:", error);
      setSourcingError(error.message || "Failed to source suppliers");
      setSourcingProgress(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      setIsSourcing(false);
    }
  }, [fullAsset, projectId]);

  // Calculate supplier scores when asset changes
  useEffect(() => {
    if (!fullAsset || !allSuppliers.length) {
      setSupplierScores([]);
      return;
    }

    // Find suppliers associated with this asset
    const assetSuppliers = allSuppliers.filter(supplier => {
      // Check if supplier has any asset_suppliers linked to this asset
      return supplier.asset_suppliers?.some(as => as.asset_id === fullAsset.id) ||
        supplier.products?.some(p => 
          fullAsset.name.toLowerCase().includes(p.toLowerCase()) ||
          p.toLowerCase().includes(fullAsset.name.toLowerCase())
        ) ||
        supplier.specializations?.some(s =>
          fullAsset.type?.toLowerCase().includes(s.toLowerCase())
        );
    });

    // If no direct associations, use all suppliers as potential sources
    const relevantSuppliers = assetSuppliers.length > 0 ? assetSuppliers : allSuppliers.slice(0, 5);

    // Calculate scores for each supplier
    const scores: SupplierScore[] = relevantSuppliers.map(supplier => {
      const assetSupplier = supplier.asset_suppliers?.find(as => as.asset_id === fullAsset.id);
      
      // Calculate individual scores (0-100)
      const priceScore = calculatePriceScore(assetSupplier?.quote_price, fullAsset.specifications?.estimated_cost_usd);
      const deliveryScore = calculateDeliveryScore(assetSupplier?.lead_time_days);
      const qualityScore = calculateQualityScore(supplier);
      const reliabilityScore = calculateReliabilityScore(supplier);
      const locationScore = calculateLocationScore(supplier);

      // Weight the scores
      const totalScore = Math.round(
        priceScore * 0.30 +
        deliveryScore * 0.20 +
        qualityScore * 0.25 +
        reliabilityScore * 0.15 +
        locationScore * 0.10
      );

      return {
        supplier,
        assetSupplier,
        totalScore,
        scores: {
          price: priceScore,
          delivery: deliveryScore,
          quality: qualityScore,
          reliability: reliabilityScore,
          location: locationScore,
        },
      };
    });

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);
    setSupplierScores(scores);
  }, [fullAsset, allSuppliers]);

  if (!asset) return null;

  // Use fullAsset if available, otherwise fallback to asset
  const displayAsset = fullAsset || asset;
  const specs = displayAsset.specifications || {};
  const estimatedCost = specs.estimated_cost_usd || 0;

  // Check if we have any specs to show
  const hasSpecs = specs.power_kw || specs.dimensions || specs.weight_kg || 
    specs.capacity || specs.voltage || specs.manufacturer || specs.model || specs.warranty;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-2xl">
        <Drawer.Header>
          <Drawer.Title>
            <div className="flex items-start gap-x-4">
              {/* Asset Image */}
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-ui-bg-subtle border border-ui-border-base">
                {isLoadingAsset ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-ui-border-base border-t-ui-fg-interactive rounded-full animate-spin" />
                  </div>
                ) : displayAsset.image_url ? (
                  <img
                    src={displayAsset.image_url}
                    alt={displayAsset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Photo className="w-8 h-8 text-ui-fg-muted" />
                  </div>
                )}
              </div>
              {/* Asset Info */}
              <div className="flex-1 min-w-0">
                <Heading level="h2" className="truncate">{displayAsset.name}</Heading>
                <div className="flex items-center gap-x-2 mt-2 flex-wrap">
                  <Badge color="purple" size="small">{displayAsset.type || "Equipment"}</Badge>
                  {estimatedCost > 0 && (
                    <Badge color="green" size="small">
                      ${estimatedCost.toLocaleString()}
                    </Badge>
                  )}
                  {displayAsset.image_generated && (
                    <Badge color="blue" size="small">Image Generated</Badge>
                  )}
                </div>
              </div>
            </div>
          </Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="p-0">
          {/* Tab Navigation */}
          <div className="border-b border-ui-border-base px-6 bg-ui-bg-subtle">
            <div className="flex gap-x-1">
              <TabButton 
                active={activeTab === "details"} 
                onClick={() => setActiveTab("details")}
                label="Details"
              />
              <TabButton 
                active={activeTab === "image"} 
                onClick={() => setActiveTab("image")}
                label="Image"
                disabled={!displayAsset.image_url && !isLoadingAsset}
              />
              <TabButton 
                active={activeTab === "3d"} 
                onClick={() => setActiveTab("3d")}
                label="3D Model"
                disabled={!displayAsset.model_url}
              />
              <TabButton 
                active={activeTab === "sourcing"} 
                onClick={() => setActiveTab("sourcing")}
                label="🔍 Sourcing"
              />
              <TabButton 
                active={activeTab === "suppliers"} 
                onClick={() => setActiveTab("suppliers")}
                label={`Suppliers (${supplierScores.length})`}
              />
              <TabButton 
                active={activeTab === "comparison"} 
                onClick={() => setActiveTab("comparison")}
                label="Compare"
                disabled={supplierScores.length < 2}
              />
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Details Tab */}
            {activeTab === "details" && (
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <Text weight="plus" size="small" className="text-ui-fg-muted mb-2 uppercase tracking-wider">
                    Description
                  </Text>
                  <Text className="text-ui-fg-base">
                    {displayAsset.description || "No description available"}
                  </Text>
                </div>

                {/* Appearance */}
                {displayAsset.appearance && (
                  <div>
                    <Text weight="plus" size="small" className="text-ui-fg-muted mb-2 uppercase tracking-wider">
                      Appearance
                    </Text>
                    <div className="bg-ui-bg-subtle rounded-lg p-3 border border-ui-border-base">
                      <Text size="small" className="text-ui-fg-subtle italic">
                        "{displayAsset.appearance}"
                      </Text>
                    </div>
                  </div>
                )}

                {/* Specifications */}
                <div>
                  <Text weight="plus" size="small" className="text-ui-fg-muted mb-3 uppercase tracking-wider">
                    Technical Specifications
                  </Text>
                  {hasSpecs ? (
                    <Container className="p-0 divide-y divide-ui-border-base">
                      {specs.manufacturer && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Manufacturer</Text>
                          <Text size="small" weight="plus">{specs.manufacturer}</Text>
                        </div>
                      )}
                      {specs.model && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Model</Text>
                          <Text size="small" weight="plus">{specs.model}</Text>
                        </div>
                      )}
                      {specs.power_kw && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Power</Text>
                          <Text size="small" weight="plus">{specs.power_kw} kW</Text>
                        </div>
                      )}
                      {specs.voltage && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Voltage</Text>
                          <Text size="small" weight="plus">{specs.voltage}</Text>
                        </div>
                      )}
                      {specs.dimensions && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Dimensions</Text>
                          <Text size="small" weight="plus">{specs.dimensions}</Text>
                        </div>
                      )}
                      {specs.weight_kg && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Weight</Text>
                          <Text size="small" weight="plus">{specs.weight_kg} kg</Text>
                        </div>
                      )}
                      {specs.capacity && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Capacity</Text>
                          <Text size="small" weight="plus">{specs.capacity}</Text>
                        </div>
                      )}
                      {specs.warranty && (
                        <div className="px-4 py-3 flex justify-between">
                          <Text size="small" className="text-ui-fg-muted">Warranty</Text>
                          <Text size="small" weight="plus">{specs.warranty}</Text>
                        </div>
                      )}
                    </Container>
                  ) : (
                    <Container className="p-4 text-center">
                      <Swatch className="w-6 h-6 text-ui-fg-muted mx-auto mb-2" />
                      <Text size="small" className="text-ui-fg-muted">
                        No technical specifications available yet
                      </Text>
                    </Container>
                  )}
                </div>

                {/* Cost Breakdown */}
                <div>
                  <Text weight="plus" size="small" className="text-ui-fg-muted mb-3 uppercase tracking-wider">
                    Cost Estimates
                  </Text>
                  {estimatedCost > 0 ? (
                    <Container className="p-0 divide-y divide-ui-border-base">
                      <div className="px-4 py-3 flex justify-between">
                        <Text size="small" className="text-ui-fg-muted">Equipment Cost</Text>
                        <Text size="small" weight="plus">
                          ${estimatedCost.toLocaleString()}
                        </Text>
                      </div>
                      <div className="px-4 py-3 flex justify-between">
                        <Text size="small" className="text-ui-fg-muted">Installation (est. 10%)</Text>
                        <Text size="small">
                          ${Math.round(estimatedCost * 0.1).toLocaleString()}
                        </Text>
                      </div>
                      <div className="px-4 py-3 flex justify-between">
                        <Text size="small" className="text-ui-fg-muted">Annual Maintenance (est. 5%)</Text>
                        <Text size="small">
                          ${Math.round(estimatedCost * 0.05).toLocaleString()}/yr
                        </Text>
                      </div>
                      <div className="px-4 py-3 flex justify-between bg-ui-bg-subtle">
                        <Text size="small" weight="plus">Total First Year</Text>
                        <Text size="small" weight="plus">
                          ${Math.round(estimatedCost * 1.15).toLocaleString()}
                        </Text>
                      </div>
                    </Container>
                  ) : (
                    <Container className="p-4 text-center">
                      <CurrencyDollar className="w-6 h-6 text-ui-fg-muted mx-auto mb-2" />
                      <Text size="small" className="text-ui-fg-muted">
                        Cost estimate not available
                      </Text>
                    </Container>
                  )}
                </div>
              </div>
            )}

            {/* Image Tab */}
            {activeTab === "image" && (
              <div className="space-y-4">
                {isLoadingAsset ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-ui-border-base border-t-ui-fg-interactive rounded-full animate-spin mx-auto mb-4" />
                      <Text className="text-ui-fg-muted">Loading image...</Text>
                    </div>
                  </div>
                ) : displayAsset.image_url ? (
                  <div className="space-y-4">
                    <div className="bg-ui-bg-subtle rounded-lg border border-ui-border-base overflow-hidden">
                      <div className="aspect-video bg-ui-bg-base flex items-center justify-center p-4">
                        <img
                          src={displayAsset.image_url}
                          alt={displayAsset.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                      <div>
                        <Text weight="plus" size="small" className="text-ui-fg-muted mb-1">
                          Asset Image
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {displayAsset.image_generated ? "AI Generated" : "Reference Image"}
                        </Text>
                      </div>
                      <Button variant="secondary" size="small" asChild>
                        <a
                          href={displayAsset.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-x-2"
                        >
                          <Photo className="w-4 h-4" />
                          Open Full Size
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Photo className="w-16 h-16 text-ui-fg-muted mx-auto mb-4" />
                    <Text weight="plus" className="text-ui-fg-muted mb-2">No Image Available</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      This asset doesn't have an image yet
                    </Text>
                  </div>
                )}
              </div>
            )}

            {/* 3D Model Tab */}
            {activeTab === "3d" && (
              <div className="space-y-4">
                {displayAsset.model_url ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Text weight="plus" size="small" className="text-ui-fg-muted mb-1">
                          3D Model
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          Interactive 3D visualization
                        </Text>
                      </div>
                      <Button variant="secondary" size="small" asChild>
                        <a
                          href={displayAsset.model_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-x-2"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Download Model
                        </a>
                      </Button>
                    </div>
                    <div className="flex items-center justify-center bg-ui-bg-subtle rounded-lg border border-ui-border-base p-4">
                      <ModelViewer
                        url={displayAsset.model_url}
                        width="100%"
                        height={500}
                        className="min-h-[500px]"
                      />
                    </div>
                    <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                      <Text size="xsmall" className="text-ui-fg-muted">
                        <strong>Controls:</strong> Click and drag to rotate • Scroll to zoom • Right-click and drag to pan
                      </Text>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Swatch className="w-16 h-16 text-ui-fg-muted mx-auto mb-4" />
                    <Text weight="plus" className="text-ui-fg-muted mb-2">No 3D Model Available</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      This asset doesn't have a 3D model yet. Generate one from the assets table.
                    </Text>
                  </div>
                )}
              </div>
            )}

            {/* Sourcing Tab */}
            {activeTab === "sourcing" && (
              <div className="space-y-4">
                {/* Sourcing Header */}
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-ui-border-base">
                  <div className="flex items-center gap-x-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-ui-bg-interactive flex items-center justify-center">
                      <MagnifyingGlass className="w-5 h-5 text-ui-fg-on-interactive" />
                    </div>
                    <div>
                      <Text weight="plus" className="text-ui-fg-base">
                        Firecrawl Supplier Search
                      </Text>
                      <Text size="small" className="text-ui-fg-muted">
                        Find real suppliers for {displayAsset.name}
                      </Text>
                    </div>
                  </div>
                  
                  <Button
                    variant={isSourcing ? "secondary" : "primary"}
                    onClick={startSourcingForAsset}
                    disabled={isSourcing}
                    className="w-full mt-3"
                  >
                    {isSourcing ? (
                      <>
                        <ArrowPath className="w-4 h-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <GlobeEurope className="w-4 h-4 mr-2" />
                        Search for Suppliers
                      </>
                    )}
                  </Button>
                </div>

                {/* Search Info */}
                <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                  <Text weight="plus" size="small" className="text-ui-fg-muted mb-2">
                    Search Strategy
                  </Text>
                  <div className="space-y-2 text-sm text-ui-fg-subtle">
                    <div className="flex items-center gap-x-2">
                      <CheckCircleSolid className="w-4 h-4 text-ui-fg-interactive" />
                      <span>Searches multiple industrial directories</span>
                    </div>
                    <div className="flex items-center gap-x-2">
                      <CheckCircleSolid className="w-4 h-4 text-ui-fg-interactive" />
                      <span>Filters by Algeria & North Africa region</span>
                    </div>
                    <div className="flex items-center gap-x-2">
                      <CheckCircleSolid className="w-4 h-4 text-ui-fg-interactive" />
                      <span>Scrapes supplier websites for details</span>
                    </div>
                    <div className="flex items-center gap-x-2">
                      <CheckCircleSolid className="w-4 h-4 text-ui-fg-interactive" />
                      <span>Validates against compliance rules</span>
                    </div>
                  </div>
                </div>

                {/* Progress Log */}
                {sourcingProgress.length > 0 && (
                  <div className="bg-ui-bg-base rounded-lg border border-ui-border-base overflow-hidden">
                    <div className="px-4 py-2 bg-ui-bg-subtle border-b border-ui-border-base">
                      <Text weight="plus" size="small" className="text-ui-fg-muted">
                        Sourcing Progress
                      </Text>
                    </div>
                    <div className="p-4 max-h-60 overflow-y-auto font-mono text-xs space-y-1">
                      {sourcingProgress.map((msg, i) => (
                        <div 
                          key={i} 
                          className={clx(
                            "py-1",
                            msg.includes("✅") && "text-green-600",
                            msg.includes("❌") && "text-red-600",
                            msg.includes("⚠️") && "text-yellow-600",
                            msg.includes("🔎") && "text-blue-600",
                            msg.includes("🌐") && "text-purple-600"
                          )}
                        >
                          {msg}
                        </div>
                      ))}
                      {isSourcing && (
                        <div className="flex items-center gap-x-2 text-ui-fg-muted animate-pulse">
                          <ArrowPath className="w-3 h-3 animate-spin" />
                          <span>Processing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {sourcingError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-x-2 text-red-600">
                      <ExclamationCircle className="w-5 h-5" />
                      <Text weight="plus">{sourcingError}</Text>
                    </div>
                  </div>
                )}

                {/* Found Suppliers Preview */}
                {foundSuppliersFromSourcing.length > 0 && (
                  <div className="space-y-3">
                    <Text weight="plus" size="small" className="text-ui-fg-muted">
                      Found Suppliers ({foundSuppliersFromSourcing.length})
                    </Text>
                    {foundSuppliersFromSourcing.map((supplier, i) => (
                      <div 
                        key={i}
                        className="p-3 bg-ui-bg-subtle rounded-lg border border-ui-border-base"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <Text weight="plus" className="text-ui-fg-base">
                              {supplier.name}
                            </Text>
                            <Text size="small" className="text-ui-fg-muted">
                              {supplier.location || supplier.country || "Location unknown"}
                            </Text>
                          </div>
                          {supplier.website && (
                            <Button variant="secondary" size="small" asChild>
                              <a
                                href={supplier.website}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkIcon className="w-3 h-3 mr-1" />
                                Visit
                              </a>
                            </Button>
                          )}
                        </div>
                        {supplier.description && (
                          <Text size="xsmall" className="text-ui-fg-subtle mt-2 line-clamp-2">
                            {supplier.description}
                          </Text>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {supplier.certifications?.slice(0, 3).map((cert: string, j: number) => (
                            <Badge key={j} color="grey" size="2xsmall">{cert}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!isSourcing && sourcingProgress.length === 0 && foundSuppliersFromSourcing.length === 0 && (
                  <div className="text-center py-8">
                    <GlobeEurope className="w-12 h-12 text-ui-fg-muted mx-auto mb-3" />
                    <Text weight="plus" className="text-ui-fg-muted mb-1">
                      Ready to Search
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      Click the button above to search for suppliers using Firecrawl
                    </Text>
                  </div>
                )}
              </div>
            )}

            {/* Suppliers Tab */}
            {activeTab === "suppliers" && (
              <div className="space-y-4">
                {supplierScores.length === 0 ? (
                  <div className="text-center py-12">
                    <Buildings className="w-12 h-12 text-ui-fg-muted mx-auto mb-3" />
                    <Text weight="plus" className="text-ui-fg-muted mb-1">No suppliers found</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      Suppliers will appear here after the sourcing step
                    </Text>
                  </div>
                ) : (
                  <>
                    {/* Top supplier highlight */}
                    {supplierScores.length > 0 && (
                      <div className="bg-ui-bg-field rounded-lg p-4 border border-ui-border-strong mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">
                              Recommended Supplier
                            </Text>
                            <Text weight="plus" className="text-ui-fg-base text-lg">
                              {supplierScores[0].supplier.name}
                            </Text>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-ui-fg-base">{supplierScores[0].totalScore}</div>
                            <Text size="xsmall" className="text-ui-fg-muted">Score</Text>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {supplierScores.map((item, index) => (
                      <SupplierCard
                        key={item.supplier.id}
                        supplierScore={item}
                        rank={index + 1}
                        isTop={index === 0}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Comparison Tab */}
            {activeTab === "comparison" && (
              <div className="space-y-4">
                {supplierScores.length < 2 ? (
                  <div className="text-center py-12">
                    <ExclamationCircle className="w-12 h-12 text-ui-fg-muted mx-auto mb-3" />
                    <Text weight="plus" className="text-ui-fg-muted mb-1">
                      Not enough suppliers
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      Need at least 2 suppliers for comparison
                    </Text>
                  </div>
                ) : (
                  <>
                    {/* Comparison Table */}
                    <div className="overflow-x-auto rounded-lg border border-ui-border-base">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-ui-bg-subtle border-b border-ui-border-base">
                            <th className="text-left py-3 px-4 text-ui-fg-muted font-medium">
                              Criteria
                            </th>
                            {supplierScores.slice(0, 4).map((item, i) => (
                              <th
                                key={item.supplier.id}
                                className={clx(
                                  "text-center py-3 px-3 font-medium min-w-[120px]",
                                  i === 0 && "bg-ui-bg-field"
                                )}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span className="truncate max-w-[100px] text-ui-fg-base">
                                    {item.supplier.name}
                                  </span>
                                  {i === 0 && (
                                    <Badge color="green" size="2xsmall">
                                      Best Match
                                    </Badge>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ui-border-base">
                          <ComparisonRow
                            label="Overall Score"
                            scores={supplierScores.slice(0, 4).map(s => s.totalScore)}
                            format={(v) => `${v}%`}
                            isTotal
                          />
                          <ComparisonRow
                            label="💰 Price"
                            scores={supplierScores.slice(0, 4).map(s => s.scores.price)}
                          />
                          <ComparisonRow
                            label="🚚 Delivery"
                            scores={supplierScores.slice(0, 4).map(s => s.scores.delivery)}
                          />
                          <ComparisonRow
                            label="⭐ Quality"
                            scores={supplierScores.slice(0, 4).map(s => s.scores.quality)}
                          />
                          <ComparisonRow
                            label="🏢 Reliability"
                            scores={supplierScores.slice(0, 4).map(s => s.scores.reliability)}
                          />
                          <ComparisonRow
                            label="📍 Location"
                            scores={supplierScores.slice(0, 4).map(s => s.scores.location)}
                          />
                          <tr className="bg-ui-bg-subtle">
                            <td className="py-3 px-4 text-ui-fg-muted font-medium">Quote Price</td>
                            {supplierScores.slice(0, 4).map((item, i) => (
                              <td key={item.supplier.id} className={clx("text-center py-3 px-3", i === 0 && "bg-ui-bg-field")}>
                                <span className="font-mono">
                                  {item.assetSupplier?.quote_price
                                    ? `$${item.assetSupplier.quote_price.toLocaleString()}`
                                    : "-"}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-3 px-4 text-ui-fg-muted font-medium">Lead Time</td>
                            {supplierScores.slice(0, 4).map((item, i) => (
                              <td key={item.supplier.id} className={clx("text-center py-3 px-3", i === 0 && "bg-ui-bg-field")}>
                                {item.assetSupplier?.lead_time_days
                                  ? `${item.assetSupplier.lead_time_days} days`
                                  : "-"}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-ui-bg-subtle">
                            <td className="py-3 px-4 text-ui-fg-muted font-medium">Verified</td>
                            {supplierScores.slice(0, 4).map((item, i) => (
                              <td key={item.supplier.id} className={clx("text-center py-3 px-3", i === 0 && "bg-ui-bg-field")}>
                                {item.supplier.verified ? (
                                  <CheckCircleSolid className="w-5 h-5 text-ui-fg-interactive mx-auto" />
                                ) : (
                                  <XMark className="w-5 h-5 text-ui-fg-muted mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Score Legend */}
                    <div className="p-4 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
                      <Text weight="plus" size="small" className="text-ui-fg-muted mb-2">
                        Score Calculation
                      </Text>
                      <div className="flex flex-wrap gap-3 text-xs text-ui-fg-subtle">
                        <span className="bg-ui-bg-base px-2 py-1 rounded border border-ui-border-base">💰 Price: 30%</span>
                        <span className="bg-ui-bg-base px-2 py-1 rounded border border-ui-border-base">⭐ Quality: 25%</span>
                        <span className="bg-ui-bg-base px-2 py-1 rounded border border-ui-border-base">🚚 Delivery: 20%</span>
                        <span className="bg-ui-bg-base px-2 py-1 rounded border border-ui-border-base">🏢 Reliability: 15%</span>
                        <span className="bg-ui-bg-base px-2 py-1 rounded border border-ui-border-base">📍 Location: 10%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Drawer.Body>

        <Drawer.Footer>
            <div className="flex items-center justify-between w-full">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex gap-x-2">
              {displayAsset.image_url && (
                <Button variant="secondary" asChild>
                  <a href={displayAsset.image_url} target="_blank" rel="noopener noreferrer">
                    <Photo className="mr-2 w-4 h-4" />
                    View Image
                  </a>
                </Button>
              )}
              {supplierScores.length > 0 && supplierScores[0].supplier.website && (
                <Button variant="primary" asChild>
                  <a
                    href={supplierScores[0].supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contact Top Supplier
                  </a>
                </Button>
              )}
            </div>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

// Helper Components

function TabButton({ 
  active, 
  onClick, 
  label, 
  disabled = false 
}: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clx(
        "py-3 px-4 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-ui-fg-interactive text-ui-fg-base"
          : "border-transparent text-ui-fg-muted hover:text-ui-fg-subtle",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
}


function SupplierCard({
  supplierScore,
  rank,
  isTop,
}: {
  supplierScore: SupplierScore;
  rank: number;
  isTop: boolean;
}) {
  const { supplier, assetSupplier, totalScore, scores } = supplierScore;

  return (
    <div
      className={clx(
        "rounded-lg border p-4 transition-all",
        isTop
          ? "border-ui-border-strong bg-ui-bg-field shadow-sm"
          : "border-ui-border-base bg-ui-bg-base hover:border-ui-border-strong hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-x-3">
          <div
            className={clx(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
              isTop
                ? "bg-ui-fg-interactive text-ui-fg-on-interactive"
                : rank === 2
                  ? "bg-ui-bg-subtle-hover text-ui-fg-base"
                  : "bg-ui-bg-subtle text-ui-fg-muted"
            )}
          >
            #{rank}
          </div>
          <div>
            <div className="flex items-center gap-x-2">
              <Text weight="plus" className="text-base">{supplier.name}</Text>
              {supplier.verified && (
                <ShieldCheck className="w-4 h-4 text-ui-fg-interactive" />
              )}
            </div>
            <Text size="small" className="text-ui-fg-muted">
              {supplier.location || supplier.country || "Location not specified"}
            </Text>
          </div>
        </div>
        <div className="text-right">
          <div
            className={clx(
              "text-3xl font-bold",
              totalScore >= 80
                ? "text-ui-fg-interactive"
                : totalScore >= 60
                  ? "text-ui-fg-subtle"
                  : "text-ui-fg-muted"
            )}
          >
            {totalScore}
          </div>
          <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">
            Score
          </Text>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-2 mb-4">
        <ScoreBar label="Price" value={scores.price} />
        <ScoreBar label="Delivery" value={scores.delivery} />
        <ScoreBar label="Quality" value={scores.quality} />
        <ScoreBar label="Reliable" value={scores.reliability} />
      </div>

      {/* Certifications */}
      {supplier.certifications && supplier.certifications.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {supplier.certifications.slice(0, 3).map((cert, i) => (
              <Badge key={i} color="grey" size="2xsmall">{cert}</Badge>
            ))}
            {supplier.certifications.length > 3 && (
              <Badge color="grey" size="2xsmall">+{supplier.certifications.length - 3}</Badge>
            )}
          </div>
        </div>
      )}

      {/* Rating */}
      {supplier.rating && (
        <div className="flex items-center gap-x-1 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={clx(
                "w-4 h-4",
                star <= supplier.rating! ? "text-ui-fg-interactive fill-ui-fg-interactive" : "text-ui-fg-muted"
              )}
            />
          ))}
          <Text size="xsmall" className="text-ui-fg-muted ml-1">
            ({supplier.rating.toFixed(1)})
          </Text>
        </div>
      )}

      {/* Quote info */}
      {assetSupplier && (assetSupplier.quote_price || assetSupplier.lead_time_days) && (
        <div className="flex gap-x-4 py-3 border-t border-ui-border-base">
          {assetSupplier.quote_price && (
            <div className="flex items-center gap-x-2">
              <CurrencyDollar className="w-4 h-4 text-ui-fg-interactive" />
              <span className="font-medium text-ui-fg-base">
                ${assetSupplier.quote_price.toLocaleString()}
              </span>
            </div>
          )}
          {assetSupplier.lead_time_days && (
            <div className="flex items-center gap-x-2">
              <Clock className="w-4 h-4 text-ui-fg-subtle" />
              <span className="text-ui-fg-base">{assetSupplier.lead_time_days} days</span>
            </div>
          )}
        </div>
      )}

      {/* Contact info */}
      <div className="flex flex-wrap gap-3 pt-3 border-t border-ui-border-base">
        {supplier.website && (
          <a
            href={supplier.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ui-fg-interactive hover:underline text-sm flex items-center gap-x-1"
          >
            <LinkIcon className="w-3 h-3" />
            Website
          </a>
        )}
        {supplier.email && (
          <a
            href={`mailto:${supplier.email}`}
            className="text-ui-fg-interactive hover:underline text-sm flex items-center gap-x-1"
          >
            <EnvelopeSolid className="w-3 h-3" />
            Email
          </a>
        )}
        {supplier.phone && (
          <a
            href={`tel:${supplier.phone}`}
            className="text-ui-fg-interactive hover:underline text-sm flex items-center gap-x-1"
          >
            <Phone className="w-3 h-3" />
            Call
          </a>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-x-2">
      <Text size="xsmall" className="text-ui-fg-muted w-14">{label}</Text>
      <div className="flex-1 h-2 bg-ui-bg-subtle rounded-full overflow-hidden border border-ui-border-base">
        <div
          className={clx(
            "h-full rounded-full transition-all",
            value >= 80
              ? "bg-ui-fg-interactive"
              : value >= 60
                ? "bg-ui-fg-subtle"
                : "bg-ui-fg-muted"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <Text size="xsmall" className="text-ui-fg-muted w-8 text-right font-mono">
        {value}
      </Text>
    </div>
  );
}

function ComparisonRow({
  label,
  scores,
  format = (v) => `${v}`,
  isTotal = false,
}: {
  label: string;
  scores: number[];
  format?: (v: number) => string;
  isTotal?: boolean;
}) {
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  return (
    <tr className={isTotal ? "bg-ui-bg-field font-medium" : ""}>
      <td className={clx("py-3 px-4", isTotal ? "text-ui-fg-base" : "text-ui-fg-muted")}>
        {label}
      </td>
      {scores.map((score, i) => {
        const isMax = score === maxScore && scores.filter(s => s === maxScore).length === 1;
        const isMin = score === minScore && scores.filter(s => s === minScore).length === 1;
        
        return (
          <td
            key={i}
            className={clx(
              "text-center py-3 px-3",
              i === 0 && "bg-ui-bg-field",
              isMax && !isTotal && "text-ui-fg-interactive font-bold",
              isMin && !isTotal && "text-ui-fg-muted"
            )}
          >
            {format(score)}
          </td>
        );
      })}
    </tr>
  );
}

// Score calculation functions

function calculatePriceScore(quotePrice?: number, estimatedCost?: number): number {
  if (!quotePrice || !estimatedCost) return 70; // Default moderate score
  
  const ratio = quotePrice / estimatedCost;
  if (ratio <= 0.8) return 95; // Much cheaper
  if (ratio <= 0.9) return 85; // Cheaper
  if (ratio <= 1.0) return 75; // At or below estimate
  if (ratio <= 1.1) return 65; // Slightly above
  if (ratio <= 1.2) return 50; // Above estimate
  return 30; // Much more expensive
}

function calculateDeliveryScore(leadTimeDays?: number): number {
  if (!leadTimeDays) return 60; // Default moderate score
  
  if (leadTimeDays <= 7) return 95; // Very fast
  if (leadTimeDays <= 14) return 85; // Fast
  if (leadTimeDays <= 30) return 75; // Standard
  if (leadTimeDays <= 60) return 60; // Slow
  if (leadTimeDays <= 90) return 45; // Very slow
  return 30; // Extremely slow
}

function calculateQualityScore(supplier: Supplier): number {
  let score = 60; // Base score
  
  // Certifications boost
  if (supplier.certifications?.length) {
    score += Math.min(supplier.certifications.length * 8, 25);
  }
  
  // Rating boost
  if (supplier.rating) {
    score += (supplier.rating / 5) * 15;
  }
  
  // Verified boost
  if (supplier.verified) {
    score += 10;
  }
  
  return Math.min(Math.round(score), 100);
}

function calculateReliabilityScore(supplier: Supplier): number {
  let score = 50; // Base score
  
  // Years in business
  if (supplier.years_in_business) {
    if (supplier.years_in_business >= 20) score += 25;
    else if (supplier.years_in_business >= 10) score += 20;
    else if (supplier.years_in_business >= 5) score += 15;
    else score += 5;
  }
  
  // Company size
  if (supplier.company_size) {
    const size = supplier.company_size.toLowerCase();
    if (size.includes("large") || size.includes("enterprise")) score += 15;
    else if (size.includes("medium")) score += 10;
    else if (size.includes("small")) score += 5;
  }
  
  // Verified
  if (supplier.verified) score += 10;
  
  return Math.min(Math.round(score), 100);
}

function calculateLocationScore(supplier: Supplier): number {
  // This is a simplified location score
  // In a real app, you'd calculate based on actual distance
  if (!supplier.location && !supplier.country) return 50;
  
  // Prefer local/regional suppliers
  const location = (supplier.location || supplier.country || "").toLowerCase();
  
  if (location.includes("local") || location.includes("domestic")) return 90;
  if (location.includes("usa") || location.includes("united states") || location.includes("europe")) return 75;
  if (location.includes("china") || location.includes("asia")) return 60;
  
  return 65; // Default for other locations
}
