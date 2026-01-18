-- SQL script to drop all data from the database
-- WARNING: This will delete ALL data from all tables!
-- Run this in Supabase SQL Editor

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Delete all data from tables (in order to respect foreign key constraints)
TRUNCATE TABLE tco_calculations CASCADE;
TRUNCATE TABLE generated_files CASCADE;
TRUNCATE TABLE asset_suppliers CASCADE;
TRUNCATE TABLE suppliers CASCADE;
TRUNCATE TABLE assets CASCADE;
TRUNCATE TABLE project_files CASCADE;
TRUNCATE TABLE project_messages CASCADE;
TRUNCATE TABLE projects CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Verify tables are empty
SELECT 
  'projects' as table_name, COUNT(*) as row_count FROM projects
UNION ALL
SELECT 'project_messages', COUNT(*) FROM project_messages
UNION ALL
SELECT 'project_files', COUNT(*) FROM project_files
UNION ALL
SELECT 'assets', COUNT(*) FROM assets
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'generated_files', COUNT(*) FROM generated_files
UNION ALL
SELECT 'tco_calculations', COUNT(*) FROM tco_calculations;



