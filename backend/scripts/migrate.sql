-- ===========================================
-- Factory Planning Application - Database Migration
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Projects Table
-- ===========================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    current_step VARCHAR(50) DEFAULT 'chat',
    status VARCHAR(50) DEFAULT 'active',
    planning_data JSONB,
    cost_analysis_pdf TEXT,
    business_plan_excel TEXT,
    full_report_pdf_url TEXT,
    -- Brand Identity fields
    logo_url TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    brand_identity JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- 3D Model fields
    meshy_id TEXT,
    model_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Project Messages Table
-- ===========================================
CREATE TABLE IF NOT EXISTS project_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    attachments JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Project Files Table
-- ===========================================
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_path TEXT,
    size_bytes BIGINT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Suppliers Table
-- ===========================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    country VARCHAR(100),
    address TEXT,
    contact_person VARCHAR(255),
    rating DECIMAL(3, 2),
    products JSONB,
    specializations JSONB,
    certifications JSONB,
    years_in_business INTEGER,
    company_size VARCHAR(50),
    description TEXT,
    source_url TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Assets Table
-- ===========================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    appearance TEXT,
    description TEXT,
    specifications JSONB,
    image_generated BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    selected_for_processing BOOLEAN DEFAULT TRUE,
    -- 3D Model fields
    meshy_id TEXT,
    model_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure updated_at column exists (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assets' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE assets 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- ===========================================
-- Generated Files Table
-- ===========================================
CREATE TABLE IF NOT EXISTS generated_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_path TEXT,
    size_bytes BIGINT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- TCO Calculations Table
-- ===========================================
CREATE TABLE IF NOT EXISTS tco_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_name VARCHAR(255),
    total_cost DECIMAL(15, 2),
    annual_tco DECIMAL(15, 2),
    npv DECIMAL(15, 2),
    roi DECIMAL(10, 2),
    payback_period DECIMAL(10, 2),
    breakdown JSONB,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Asset-Suppliers Junction Table (Many-to-Many)
-- Supports 1-5 suppliers per asset
-- ===========================================
CREATE TABLE IF NOT EXISTS asset_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT FALSE,
    quote_price DECIMAL(15, 2),
    lead_time_days INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, supplier_id)
);

-- ===========================================
-- Indexes for Performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_project_messages_project ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created ON project_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_supplier ON assets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_asset_suppliers_asset ON asset_suppliers(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_suppliers_supplier ON asset_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_generated_files_project ON generated_files(project_id);
CREATE INDEX IF NOT EXISTS idx_tco_calculations_project ON tco_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_current_step ON projects(current_step);

-- ===========================================
-- Functions and Triggers
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Comments for Documentation
-- ===========================================
COMMENT ON TABLE projects IS 'Main projects table storing factory planning projects';
COMMENT ON COLUMN projects.current_step IS 'Current step in the workflow: chat, planning, identityGenerating, assetsImagesGenerating, sourcing, negotiating, cost_analysing, layoutGenerating, 3dGenerating, completed';
COMMENT ON COLUMN projects.meshy_id IS 'Task ID from Meshy3D API for tracking 3D model generation from isometric layout';
COMMENT ON COLUMN projects.model_url IS 'URL to the generated 3D model GLB file from Meshy3D';
COMMENT ON COLUMN assets.meshy_id IS 'Task ID from Meshy3D API for tracking 3D model generation';
COMMENT ON COLUMN assets.model_url IS 'URL to the generated 3D model GLB file from Meshy3D';
COMMENT ON COLUMN projects.planning_data IS 'JSON data containing the AI-generated factory plan';
COMMENT ON COLUMN projects.logo_url IS 'URL or data URL of the generated brand logo';
COMMENT ON COLUMN projects.primary_color IS 'Primary brand color in hex format (e.g., #0F172A)';
COMMENT ON COLUMN projects.secondary_color IS 'Secondary brand color in hex format';
COMMENT ON COLUMN projects.brand_identity IS 'JSON data containing full brand identity (colors, typography, tagline, etc.)';
COMMENT ON COLUMN projects.metadata IS 'Flexible metadata including layout_progress and other project-specific data';

COMMENT ON TABLE project_messages IS 'Chat messages between user and AI assistant';
COMMENT ON TABLE project_files IS 'Files uploaded by users for the project';
COMMENT ON TABLE assets IS 'Production assets/machines identified for the project';
COMMENT ON TABLE suppliers IS 'Suppliers sourced for project assets';
COMMENT ON TABLE generated_files IS 'Files generated by the system (layouts, images, reports)';
COMMENT ON TABLE tco_calculations IS 'Total Cost of Ownership calculations and financial analysis';

-- ===========================================
-- Migration Complete
-- ===========================================
SELECT 'Database migration completed successfully!' as status;

