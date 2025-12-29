/**
 * Sourcing Progress Dialog
 * Shows real-time progress when re-sourcing suppliers for all equipment
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Button, 
  Text, 
  Badge,
  IconButton,
} from "@medusajs/ui";
import { 
  XMark,
  Check,
  ArrowPath,
  Buildings,
} from "@medusajs/icons";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

interface Asset {
  id: string;
  name: string;
  type?: string;
}

interface SupplierFound {
  name: string;
  country?: string;
  website?: string;
}

interface AssetProgress {
  asset: Asset;
  status: "pending" | "searching" | "complete" | "error";
  suppliers: SupplierFound[];
  message?: string;
}

interface SourcingProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  assets: Asset[];
  onComplete?: () => void;
}

export function SourcingProgressDialog({
  isOpen,
  onClose,
  projectId,
  assets,
  onComplete,
}: SourcingProgressDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [assetProgress, setAssetProgress] = useState<Map<string, AssetProgress>>(new Map());
  const [currentMessage, setCurrentMessage] = useState<string>("Ready to start sourcing...");
  const [completedCount, setCompletedCount] = useState(0);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initialize asset progress
  useEffect(() => {
    if (isOpen && assets.length > 0) {
      const initialProgress = new Map<string, AssetProgress>();
      assets.forEach(asset => {
        initialProgress.set(asset.id, {
          asset,
          status: "pending",
          suppliers: [],
        });
      });
      setAssetProgress(initialProgress);
      setCompletedCount(0);
      setTotalSuppliers(0);
      setError(null);
      setCurrentMessage("Ready to start sourcing...");
    }
  }, [isOpen, assets]);

  // Auto-scroll log container
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [currentMessage, assetProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startSourcing = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setError(null);
    setCurrentMessage("🚀 Starting parallel supplier sourcing...");
    setCompletedCount(0);
    setTotalSuppliers(0);

    // Reset all assets to pending
    setAssetProgress(prev => {
      const newMap = new Map(prev);
      newMap.forEach((value, key) => {
        newMap.set(key, { ...value, status: "pending", suppliers: [], message: undefined });
      });
      return newMap;
    });

    try {
      // First, mark all assets as selected for processing
      const assetIds = assets.map(a => a.id);
      await fetch(`${API_BASE}/projects/${projectId}/select-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds }),
      });

      // Connect to SSE stream for sourcing
      const eventSource = new EventSource(`${API_BASE}/projects/${projectId}/stream?step=sourcing`);
      eventSourceRef.current = eventSource;

      const handleEvent = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[SourcingDialog] SSE event:", data);

          if (data.message) {
            setCurrentMessage(data.message);
          }

          if (data.asset) {
            setAssetProgress(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(data.asset.id);
              
              if (existing) {
                // Update status based on event type
                let newStatus = existing.status;
                let newSuppliers = [...existing.suppliers];
                
                if (data.type === "searching") {
                  newStatus = "searching";
                } else if (data.type === "found" && data.supplier) {
                  // Add supplier to list
                  if (!newSuppliers.find(s => s.name === data.supplier.name)) {
                    newSuppliers.push(data.supplier);
                  }
                } else if (data.type === "asset_complete") {
                  newStatus = "complete";
                  if (data.suppliers) {
                    newSuppliers = data.suppliers;
                  }
                }
                
                newMap.set(data.asset.id, {
                  ...existing,
                  status: newStatus,
                  suppliers: newSuppliers,
                  message: data.message,
                });
              }
              
              return newMap;
            });

            // Update counts
            if (data.type === "asset_complete") {
              setCompletedCount(prev => prev + 1);
              if (data.suppliers) {
                setTotalSuppliers(prev => prev + data.suppliers.length);
              }
            }
          }
        } catch (e) {
          console.error("Error parsing SSE event:", e);
        }
      };

      eventSource.addEventListener("status", handleEvent);
      eventSource.addEventListener("update", handleEvent);
      eventSource.addEventListener("progress", handleEvent);
      
      eventSource.addEventListener("complete", (event) => {
        handleEvent(event);
        setCurrentMessage("✅ Sourcing complete!");
        setIsRunning(false);
        eventSource.close();
        eventSourceRef.current = null;
        onComplete?.();
      });

      eventSource.addEventListener("error", (event: any) => {
        try {
          const data = JSON.parse(event.data);
          setError(data.message || "An error occurred");
          setCurrentMessage(`❌ Error: ${data.message}`);
        } catch {
          setError("Connection error occurred");
          setCurrentMessage("❌ Connection error");
        }
        setIsRunning(false);
        eventSource.close();
        eventSourceRef.current = null;
      });

      eventSource.onerror = () => {
        // Only treat as error if we haven't received complete event
        if (isRunning) {
          console.error("EventSource connection error");
          setError("Connection lost. Please try again.");
          setIsRunning(false);
          eventSource.close();
          eventSourceRef.current = null;
        }
      };

    } catch (err: any) {
      console.error("Sourcing error:", err);
      setError(err.message || "Failed to start sourcing");
      setCurrentMessage(`❌ Error: ${err.message}`);
      setIsRunning(false);
    }
  }, [isRunning, assets, projectId, onComplete]);

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRunning(false);
    onClose();
  };

  if (!isOpen) return null;

  const progressPercent = assets.length > 0 ? (completedCount / assets.length) * 100 : 0;
  const assetList = Array.from(assetProgress.values());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-ui-bg-base w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-ui-border-base">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ui-border-base bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Buildings className="w-5 h-5 text-white" />
            </div>
            <div>
              <Text weight="plus" className="text-lg text-white">Re-source Suppliers</Text>
              <Text size="small" className="text-white/80">
                Finding suppliers for {assets.length} equipment items
              </Text>
            </div>
          </div>
          <IconButton
            variant="transparent"
            onClick={handleClose}
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <XMark className="w-6 h-6" />
          </IconButton>
        </div>

        {/* Progress Section */}
        <div className="p-4 border-b border-ui-border-base bg-ui-bg-subtle">
          {/* Stats Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge color={isRunning ? "purple" : completedCount === assets.length ? "green" : "grey"}>
                  {completedCount} / {assets.length}
                </Badge>
                <Text size="small" className="text-ui-fg-muted">Equipment Processed</Text>
              </div>
              <div className="flex items-center gap-2">
                <Badge color="blue">{totalSuppliers}</Badge>
                <Text size="small" className="text-ui-fg-muted">Suppliers Found</Text>
              </div>
            </div>
            {isRunning && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <Text size="small" className="text-purple-600">Processing...</Text>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-ui-bg-base rounded-full h-3 border border-ui-border-base overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Current Status */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-ui-bg-base rounded-lg border border-ui-border-base">
            {isRunning ? (
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            ) : completedCount === assets.length && completedCount > 0 ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <div className="w-2 h-2 bg-ui-fg-muted rounded-full" />
            )}
            <Text size="small" className="text-ui-fg-subtle">{currentMessage}</Text>
          </div>
        </div>

        {/* Asset Progress List */}
        <div 
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px] max-h-[400px]"
        >
          {assetList.map(({ asset, status, suppliers, message }) => (
            <div 
              key={asset.id}
              className={`p-3 rounded-lg border transition-all duration-300 ${
                status === "searching" 
                  ? "bg-purple-50 border-purple-200" 
                  : status === "complete" 
                    ? "bg-green-50 border-green-200" 
                    : status === "error"
                      ? "bg-red-50 border-red-200"
                      : "bg-ui-bg-subtle border-ui-border-base"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  {status === "searching" ? (
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  ) : status === "complete" ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : status === "error" ? (
                    <XMark className="w-5 h-5 text-red-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-ui-border-base" />
                  )}
                  
                  {/* Asset Info */}
                  <div>
                    <Text weight="plus" size="small">{asset.name}</Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {asset.type || "Equipment"}
                    </Text>
                  </div>
                </div>

                {/* Suppliers Count */}
                <Badge 
                  color={suppliers.length > 0 ? "green" : "grey"} 
                  size="small"
                >
                  {suppliers.length} suppliers
                </Badge>
              </div>

              {/* Status Message */}
              {message && status === "searching" && (
                <Text size="xsmall" className="text-purple-600 mt-2 pl-8">
                  {message}
                </Text>
              )}

              {/* Supplier Names */}
              {suppliers.length > 0 && status === "complete" && (
                <div className="mt-2 pl-8 flex flex-wrap gap-1">
                  {suppliers.slice(0, 5).map((s, i) => (
                    <Badge key={i} color="grey" size="2xsmall">
                      {s.name} {s.country && `(${s.country})`}
                    </Badge>
                  ))}
                  {suppliers.length > 5 && (
                    <Badge color="grey" size="2xsmall">
                      +{suppliers.length - 5} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-4 pb-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <Text size="small" className="text-red-600">
                ❌ {error}
              </Text>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-ui-border-base bg-ui-bg-subtle">
          <div className="flex items-center justify-between">
            <Text size="small" className="text-ui-fg-muted">
              💡 Searching Algeria, North Africa, MENA, Europe & Asia for best suppliers
            </Text>
            <div className="flex items-center gap-2">
              {!isRunning && completedCount === assets.length && completedCount > 0 ? (
                <Button variant="primary" onClick={handleClose}>
                  Done
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={handleClose} disabled={isRunning}>
                    {isRunning ? "Running..." : "Cancel"}
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={startSourcing}
                    disabled={isRunning}
                    className="gap-2"
                  >
                    {isRunning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sourcing...
                      </>
                    ) : (
                      <>
                        <ArrowPath className="w-4 h-4" />
                        Start Sourcing
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

