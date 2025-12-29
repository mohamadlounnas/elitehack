/**
 * GLB Preview Dialog
 * Displays 3D GLB models in a dialog using @google/model-viewer
 */

import React, { useState } from "react";
import { 
  Button, 
  Text, 
  IconButton,
} from "@medusajs/ui";
import { 
  XMark,
  ArrowDownTray,
} from "@medusajs/icons";
import '@google/model-viewer';

interface GLBPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  glbUrl: string;
  title?: string;
}

export function GLBPreviewDialog({
  isOpen,
  onClose,
  glbUrl,
  title = "3D Model Preview",
}: GLBPreviewDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  if (!isOpen) return null;

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = glbUrl;
    link.download = title.replace(/\s+/g, "_") + ".glb";
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-ui-bg-base w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-ui-border-base">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ui-border-base bg-ui-bg-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <Text weight="plus" className="text-lg">{title}</Text>
              <Text size="small" className="text-ui-fg-subtle">Interactive 3D Model</Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={handleDownload}
              className="gap-2"
            >
              <ArrowDownTray className="w-4 h-4" />
              Download
            </Button>
            <IconButton
              variant="transparent"
              onClick={onClose}
              className="text-ui-fg-subtle hover:text-ui-fg-base"
            >
              <XMark className="w-6 h-6" />
            </IconButton>
          </div>
        </div>

        {/* 3D Model Viewer */}
        <div className="flex-1 relative bg-ui-bg-subtle min-h-[500px]">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-6">
                <Text className="text-ui-tag-red-text mb-2">{error}</Text>
                <Button variant="secondary" size="small" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <model-viewer
              src={glbUrl}
              camera-controls
              auto-rotate
              shadow-intensity="1"
              exposure="1"
              interaction-policy="allow-when-focused"
              ar
              ar-modes="webxr scene-viewer quick-look"
              loading="eager"
              reveal="auto"
              alt="3D Model"
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#f8f9fa',
              }}
              onLoad={() => {
                console.log('Model loaded successfully');
                setIsLoading(false);
                setError(null);
              }}
              onError={(e: any) => {
                console.error('Model viewer error:', e);
                const errorDetail = e.detail?.message || e.message || 'Unknown error';
                setError(`Failed to load 3D model: ${errorDetail}`);
                setIsLoading(false);
              }}
              onModelError={(e: any) => {
                console.error('Model error:', e);
                setError('Failed to load 3D model. The file may be corrupted or inaccessible.');
                setIsLoading(false);
              }}
              onProgress={(e: any) => {
                const progress = e.detail?.totalProgress || 0;
                console.log('Model loading progress:', progress);
                if (progress >= 1) {
                  setIsLoading(false);
                }
              }}
            >
              {/* Loading placeholder */}
              {isLoading && (
                <div slot="poster" className="absolute inset-0 flex items-center justify-center bg-ui-bg-subtle">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-ui-border-base border-t-purple-500 rounded-full animate-spin" />
                    <Text className="text-ui-fg-muted">Loading 3D model...</Text>
                  </div>
                </div>
              )}
            </model-viewer>
          )}
        </div>

        {/* Footer with controls info */}
        <div className="p-4 border-t border-ui-border-base bg-ui-bg-subtle">
          <div className="flex items-center justify-between">
            <Text size="small" className="text-ui-fg-muted">
              💡 Drag to rotate • Scroll to zoom • Right-click to pan
            </Text>
            <Button variant="secondary" size="small" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

