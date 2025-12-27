export type ProjectStep =
  | "chat"
  | "planning"
  | "planed"
  | "layoutGenerating"
  | "layoutGenerated"
  | "assetsImagesGenerating"
  | "assetsImagesGenerated"
  | "sourcing"
  | "sourced"
  | "negotiating"
  | "negotiated"
  | "cost_analysing"
  | "cost_analysed"
  | "completed";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  current_step: ProjectStep;
  cost_analysis_pdf?: string;
  planning_data?: PlanningData;
  created_at: string;
  updated_at: string;
}

export interface PlanningData {
  production_process?: string;
  machinery?: string[];
  factory_dimensions?: {
    width?: number;
    length?: number;
    height?: number;
    floors?: number;
  };
  assets?: Asset[];
  [key: string]: any;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  created_at: string;
}

export interface Attachment {
  id: string;
  filename: string;
  file_type: string;
  storage_url?: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;
  file_type?: string;
  file_path?: string;
  storage_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  name: string;
  type?: string;
  appearance?: string;
  description?: string;
  supplier_id?: string;
  image_url?: string;
  image_generated: boolean;
  specifications?: Record<string, any>;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  website?: string;
  email?: string;
  phone?: string;
  location?: string;
  rating?: number;
  products?: any;
  asset_suppliers?: Array<{
    asset_id: string;
    assets?: {
      id: string;
      name: string;
    };
  }>;
  created_at: string;
  updated_at: string;
}

export interface GeneratedFile {
  id: string;
  project_id: string;
  filename: string;
  file_type?: string;
  file_path?: string;
  storage_url?: string;
  metadata?: {
    type?: string;
    layout_type?: string;
  };
  created_at: string;
}

export interface TCOCalculation {
  id: string;
  project_id: string;
  total_cost?: number;
  breakdown?: any;
  roi?: number;
  payback_period?: number;
  created_at: string;
}

export interface StepStatus {
  step: ProjectStep;
  status: "pending" | "active" | "completed" | "error";
  progress?: number;
  message?: string;
}

