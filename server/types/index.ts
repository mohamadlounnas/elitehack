/**
 * Type definitions for the Production Line Planning System
 * Updated workflow: 6 steps including assets research, 2D layout, 3D model, and PDF report
 */

export type ProjectStatus = 
  | 'DATA_COLLECTING'
  | 'CREATING_PROCCES'
  | 'ASSETS_RESEARCH'
  | 'GENERATING_2D_LAYOUT'
  | 'GENERATING_3D_MODEL'
  | 'PROJECT_COMPLETED';

export type AssetStatus =
  | 'pending'
  | 'researching'
  | 'completed'
  | 'error';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  data_collecting_result: Record<string, unknown> | null;
  creating_procces_result: Record<string, unknown> | null;
  layout_2d_url: string | null;
  model_3d_url: string | null;
  report_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  manufacturer: string | null;
  country: string | null;
  estimated_price: number | null;
  shipping_estimated_price: number | null;
  dimensions: Record<string, unknown> | null; // {length, width, height, unit}
  weight: number | null;
  weight_unit: string | null; // kg, lbs, etc.
  supplier_name: string | null;
  supplier_contact: string | null;
  supplier_url: string | null;
  supplier_info: Record<string, unknown> | null; // Additional supplier details
  status: AssetStatus;
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

export interface AssetInput {
  name: string;
  description?: string;
  appearance?: string;
  manufacturer?: string;
  country?: string;
  estimated_price?: number;
  shipping_estimated_price?: number;
  dimensions?: { length?: number; width?: number; height?: number; unit?: string };
  weight?: number;
  weight_unit?: string;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_url?: string;
  supplier_info?: Record<string, unknown>;
}
