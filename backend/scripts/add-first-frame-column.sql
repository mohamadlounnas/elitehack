-- Add first_frame_url column to video_projects table for Veo 3.1 two-frame video generation

ALTER TABLE video_projects 
ADD COLUMN IF NOT EXISTS first_frame_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN video_projects.first_frame_url IS 'URL to the first frame image for Veo 3.1 FIRST_AND_LAST_FRAMES_2_VIDEO generation';


