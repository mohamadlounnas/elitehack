-- Migration: Add full_report_pdf_url column to projects table
-- This column stores the path to the comprehensive industrial report PDF

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS full_report_pdf_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN projects.full_report_pdf_url IS 'Path to the comprehensive industrial investment report PDF';

