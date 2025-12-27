/**
 * Type definitions for the Production Line Planning System
 */

export type ProjectStatus = 
  | 'DATA_COLLECTING'
  | 'CREATING_PROCCES'
  | 'ASSETS_RESEARCH'
  | 'GENERATING_2D_LAYOUT'
  | 'GENERATING_3D_MODEL'
  | 'PROJECT_COMPLETED';

export type MachineStatus =
  | 'pending'
  | 'generating_image'
  | 'generating_3d_model'
  | 'completed'
  | 'previous';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  data_collecting_result: Record<string, unknown> | null;
  creating_procces_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  project_id: string;
  name: string;
  appearance: string | null;
  description: string | null;
  generated_image: string | null;
  generated_3d_model: string | null;
  status: MachineStatus;
  supplier_name: string | null;
  supplier_contact: string | null;
  supplier_url: string | null;
  supplier_info: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: Record<string, unknown> | null;
  created_at: string;
}

export interface MachineInput {
  name: string;
  appearance?: string;
  description?: string;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_url?: string;
  supplier_info?: Record<string, unknown>;
}

