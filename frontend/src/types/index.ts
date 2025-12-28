export type ProjectStep =
  | "chat"
  | "planning"
  | "identityGenerating"
  | "assetSelection"
  | "assetsImagesGenerating"
  | "sourcing"
  | "negotiating"
  | "cost_analysing"
  | "layoutGenerating"
  | "completed";

export interface BrandIdentity {
  logo_svg?: string;
  logo_concept?: string;
  color_palette?: {
    primary: string;
    secondary: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  typography?: {
    heading_font?: string;
    body_font?: string;
  };
  brand_values?: string[];
  tagline?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  current_step: ProjectStep;
  cost_analysis_pdf?: string;
  business_plan_excel?: string;
  full_report_pdf_url?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  brand_identity?: BrandIdentity;
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
  content: string | MessagePart[]; // Can be string or array of parts (text + images)
  attachments?: Attachment[];
  created_at: string;
}

export interface MessagePart {
  type: "text" | "inlineData";
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded
  };
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
  selected_for_processing?: boolean;
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
  country?: string;
  address?: string;
  contact_person?: string;
  rating?: number;
  products?: string[];
  specializations?: string[];
  certifications?: string[];
  years_in_business?: number;
  company_size?: string;
  description?: string;
  source_url?: string;
  verified?: boolean;
  asset_suppliers?: AssetSupplier[];
  created_at: string;
  updated_at: string;
}

export interface AssetSupplier {
  id: string;
  asset_id: string;
  supplier_id: string;
  is_preferred: boolean;
  quote_price?: number;
  lead_time_days?: number;
  notes?: string;
  supplier?: Supplier;
  asset?: Asset;
  created_at: string;
}

export interface GeneratedFile {
  id: string;
  project_id: string;
  filename: string;
  file_type?: string;
  file_path?: string;  // Contains the data URL (data:image/png;base64,...)
  storage_url?: string;
  size_bytes?: number;
  metadata?: {
    type?: string;
    layout_type?: string;
    layoutType?: string;  // Alternative field name
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

export interface VideoProject {
  id: string;
  project_id: string;
  title: string;
  prompt: string | null;
  first_frame_url: string | null;
  last_frame_url: string | null;
  video_url: string | null;
  status: "draft" | "frames_generating" | "frames_ready" | "video_generating" | "completed";
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

