-- Add business_plan_excel column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS business_plan_excel TEXT;

COMMENT ON COLUMN projects.business_plan_excel IS 'Path to the generated business plan Excel file';


