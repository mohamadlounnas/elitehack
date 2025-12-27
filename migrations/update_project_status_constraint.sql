-- Migration: Update projects table status check constraint
-- This updates the check constraint to include all new status values:
-- ASSETS_RESEARCH, GENERATING_2D_LAYOUT, GENERATING_3D_MODEL, PROJECT_COMPLETED

-- Drop the existing constraint
ALTER TABLE projects 
DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add the new constraint with all valid status values
ALTER TABLE projects 
ADD CONSTRAINT projects_status_check 
CHECK (status IN (
  'DATA_COLLECTING',
  'CREATING_PROCCES',
  'ASSETS_RESEARCH',
  'GENERATING_2D_LAYOUT',
  'GENERATING_3D_MODEL',
  'PROJECT_COMPLETED'
));

