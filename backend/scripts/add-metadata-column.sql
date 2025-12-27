-- Add metadata column to projects table for storing layout progress and other metadata
-- This column will be a JSONB type to store flexible structured data

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN projects.metadata IS 'Stores flexible metadata including layout_progress, user preferences, and other project-specific data';


