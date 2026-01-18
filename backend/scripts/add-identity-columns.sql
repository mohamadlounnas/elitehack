-- ===========================================
-- Add Brand Identity Columns to Projects Table
-- ===========================================

-- Add logo_url column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add primary_color column (hex color)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7);

-- Add secondary_color column (hex color)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);

-- Add brand identity data (for storing additional brand assets)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brand_identity JSONB DEFAULT '{}'::jsonb;

-- ===========================================
-- Migration Complete
-- ===========================================
SELECT 'Brand identity columns added successfully!' as status;


