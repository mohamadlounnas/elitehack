-- Add meshy_id and model_url columns to projects table for 3D model generation
-- meshy_id: Stores the task ID from Meshy3D API
-- model_url: Stores the URL to the generated GLB file

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS meshy_id TEXT;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS model_url TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN projects.meshy_id IS 'Task ID from Meshy3D API for tracking 3D model generation from isometric layout';
COMMENT ON COLUMN projects.model_url IS 'URL to the generated 3D model GLB file from Meshy3D';

