/**
 * GLB Preview Dialog
 * Displays 3D GLB models in a dialog using model-viewer
 */

import React, { useEffect, useState } from "react";
import { 
  Button, 
  Text, 
  IconButton,
  clx,
} from "@medusajs/ui";
import { 
  XMark,
  ArrowDownTray,
} from "@medusajs/icons";

interface GLBPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  glbUrl: string;
  title?: string;
}

// Declare model-viewer as a web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'ar'?: boolean;
        'shadow-intensity'?: string;
        'exposure'?: string;
        'environment-image'?: string;
        'interaction-policy'?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

export function GLBPreviewDialog({
  isOpen,
  onClose,
  glbUrl,
  title = "3D Model Preview",
}: GLBPreviewDialogProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Load model-viewer script and create the element
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    let checkInterval: NodeJS.Timeout | null = null;
    let maxAttempts = 30; // 15 seconds max (30 * 500ms)
    let attempts = 0;

    console.log('GLB Preview Dialog opened, loading model-viewer...');

    const createModelViewer = () => {
      const container = containerRef.current;
      if (!container) return;
      
      container.innerHTML = '';
      
      const modelViewer = document.createElement('model-viewer');
      modelViewer.setAttribute('src', glbUrl);
      modelViewer.setAttribute('camera-controls', '');
      modelViewer.setAttribute('auto-rotate', '');
      modelViewer.setAttribute('shadow-intensity', '1');
      modelViewer.setAttribute('exposure', '1');
      modelViewer.setAttribute('interaction-policy', 'allow-when-focused');
      modelViewer.setAttribute('ar', '');
      modelViewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
      modelViewer.style.width = '100%';
      modelViewer.style.height = '100%';
      modelViewer.style.backgroundColor = '#f8f9fa';
      
      // Add error handler
      modelViewer.addEventListener('error', (e: any) => {
        console.error('Model viewer error:', e);
        setError('Failed to load 3D model. The file may be corrupted or inaccessible.');
      });
      
      // Add loading placeholder
      const poster = document.createElement('div');
      poster.setAttribute('slot', 'poster');
      poster.className = 'absolute inset-0 flex items-center justify-center bg-ui-bg-subtle';
      poster.innerHTML = `
        <div class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 border-4 border-ui-border-base border-t-purple-500 rounded-full animate-spin"></div>
          <p class="text-ui-fg-muted">Loading 3D model...</p>
        </div>
      `;
      modelViewer.appendChild(poster);
      
      container.appendChild(modelViewer);
    };

    const checkModelViewer = () => {
      attempts++;
      
      // Check if custom element is defined
      const isDefined = customElements.get('model-viewer');
      if (isDefined) {
        console.log('Model viewer custom element found!');
        setScriptLoaded(true);
        setError(null);
        
        if (checkInterval) {
          clearInterval(checkInterval);
        }
        
        createModelViewer();
        return true;
      }
      return false;
    };

    // First check if already loaded
    if (checkModelViewer()) {
      return;
    }

    // Check if script is already in the page
    const existingScript = document.querySelector('script[src*="model-viewer"]');
    
    if (existingScript) {
      console.log('Model viewer script found in page, waiting for it to load...');
      // Script exists, just wait for it
      checkInterval = setInterval(() => {
        if (checkModelViewer() || attempts >= maxAttempts) {
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          if (attempts >= maxAttempts && !customElements.get('model-viewer')) {
            setError('3D viewer failed to load. Please refresh the page.');
          }
        }
      }, 500);
    } else {
      console.log('Loading model viewer script...');
      // Load the script
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
      script.async = true;
      
      script.onload = () => {
        console.log('Model viewer script loaded, waiting for custom element...');
        // Wait for custom element to register
        checkInterval = setInterval(() => {
          if (checkModelViewer() || attempts >= maxAttempts) {
            if (checkInterval) {
              clearInterval(checkInterval);
            }
            if (attempts >= maxAttempts && !customElements.get('model-viewer')) {
              setError('3D viewer custom element failed to register. Please refresh the page.');
            }
          }
        }, 200);
      };
      
      script.onerror = () => {
        console.error('Failed to load model viewer script');
        setError('Failed to load 3D viewer script. Please check your internet connection.');
      };
      
      document.head.appendChild(script);
    }
    
    // Cleanup on unmount
    return () => {
      if (loadHandler) {
        window.removeEventListener('load', loadHandler);
      }
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [isOpen, glbUrl]);

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
          ) : !scriptLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-ui-border-base border-t-purple-500 rounded-full animate-spin" />
                <Text className="text-ui-fg-muted">Loading 3D viewer...</Text>
              </div>
            </div>
          ) : (
            <div ref={containerRef} className="w-full h-full" />
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

