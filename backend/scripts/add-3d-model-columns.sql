-- Add meshy_id and model_url columns to assets table for 3D model generation
-- meshy_id: Stores the task ID from Meshy3D API
-- model_url: Stores the URL to the generated GLB file

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS meshy_id TEXT;

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS model_url TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN assets.meshy_id IS 'Task ID from Meshy3D API for tracking 3D model generation';
COMMENT ON COLUMN assets.model_url IS 'URL to the generated 3D model GLB file from Meshy3D';


