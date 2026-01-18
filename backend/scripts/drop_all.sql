-- ===========================================
-- Drop All Tables (for clean migration)
-- Run this before migrate.sql to reset the database
-- ===========================================

-- Drop triggers first
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS asset_suppliers CASCADE;
DROP TABLE IF EXISTS tco_calculations CASCADE;
DROP TABLE IF EXISTS generated_files CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS project_files CASCADE;
DROP TABLE IF EXISTS project_messages CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Confirm drop
SELECT 'All tables dropped successfully!' as status;


