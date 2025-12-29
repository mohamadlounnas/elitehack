/**
 * ModelViewer Component
 * Displays 3D GLB models using React Three Fiber
 */

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Html } from "@react-three/drei";
import { Text } from "@medusajs/ui";

interface ModelViewerProps {
  url: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 p-4 bg-ui-bg-base rounded-lg border border-ui-border-base">
        <div className="w-8 h-8 border-2 border-ui-border-base border-t-ui-fg-interactive rounded-full animate-spin" />
        <Text size="small" className="text-ui-fg-muted">Loading 3D model...</Text>
      </div>
    </Html>
  );
}

export default function ModelViewer({ 
  url, 
  width = 400, 
  height = 400,
  className = ""
}: ModelViewerProps) {
  // Use proxy URL if the URL is external to avoid CORS issues
  // Check if we have a project ID in the URL path to construct proxy URL
  const modelUrl = url.startsWith('http') && !url.includes(window.location.hostname)
    ? url // For now, use direct URL. If CORS issues occur, implement proxy
    : url;

  return (
    <div 
      className={`bg-ui-bg-subtle rounded-lg border border-ui-border-base overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          <Environment preset="city" />
          <Model url={modelUrl} />
          <OrbitControls 
            enableZoom={true}
            enablePan={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={10}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

