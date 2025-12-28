-- Add missing columns to suppliers table
-- Run this in Supabase Dashboard > SQL Editor

-- Add address column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT;

-- Add contact_person column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);

-- Add country column (separate from location)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Add specializations column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS specializations JSONB;

-- Add certifications column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS certifications JSONB;

-- Add years_in_business column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS years_in_business INTEGER;

-- Add company_size column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);

-- Add description column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS description TEXT;

-- Add source_url column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add verified column
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Confirm success
SELECT 'Supplier columns added successfully!' as status;

