/**
 * Machine List Component - Shows machine research and generation progress
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, Image, Box, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Machine, MachineStatus } from '@/types';

interface MachineListProps {
  projectId: string;
}

const STATUS_LABELS: Record<MachineStatus, string> = {
  pending: 'Pending',
  generating_image: 'Generating Image',
  generating_3d_model: 'Generating 3D Model',
  completed: 'Completed',
  previous: 'Retrying',
};

const STATUS_ICONS: Record<MachineStatus, React.ReactNode> = {
  pending: <AlertCircle className="w-4 h-4" />,
  generating_image: <Image className="w-4 h-4 animate-pulse" />,
  generating_3d_model: <Box className="w-4 h-4 animate-pulse" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  previous: <Loader2 className="w-4 h-4 animate-spin" />,
};

const STATUS_COLORS: Record<MachineStatus, string> = {
  pending: 'bg-gray-500',
  generating_image: 'bg-blue-500',
  generating_3d_model: 'bg-purple-500',
  completed: 'bg-green-500',
  previous: 'bg-yellow-500',
};

export default function MachineList({ projectId }: MachineListProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMachines();
    // Poll for updates every 2 seconds
    const interval = setInterval(loadMachines, 2000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadMachines = async () => {
    try {
      const data = await api.getMachines(projectId);
      setMachines(data);
    } catch (error) {
      console.error('Failed to load machines:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = (machine: Machine): number => {
    if (machine.status === 'completed') return 100;
    if (machine.status === 'generating_3d_model') return 66;
    if (machine.status === 'generating_image') return 33;
    if (machine.status === 'previous') return 50;
    return 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No machines yet. The AI will research machines as the project progresses.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {machines.map((machine) => (
        <Card key={machine.id} className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{machine.name}</h3>
                {machine.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {machine.description}
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn(STATUS_COLORS[machine.status], "text-white border-0 text-xs flex items-center gap-1")}
              >
                {STATUS_ICONS[machine.status]}
                {STATUS_LABELS[machine.status]}
              </Badge>
            </div>

            {/* Progress Bar */}
            <Progress value={getProgress(machine)} className="h-2" />

            {/* Supplier Info */}
            {machine.supplier_name && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">Supplier:</span> {machine.supplier_name}
                </div>
                {machine.supplier_contact && (
                  <div>
                    <span className="font-medium">Contact:</span> {machine.supplier_contact}
                  </div>
                )}
              </div>
            )}

            {/* Generated Assets */}
            {(machine.generated_image || machine.generated_3d_model) && (
              <div className="flex gap-2 text-xs">
                {machine.generated_image && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Image className="w-3 h-3" />
                    <span>Image</span>
                  </div>
                )}
                {machine.generated_3d_model && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Box className="w-3 h-3" />
                    <span>3D Model</span>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {machine.error_message && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {machine.error_message}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
