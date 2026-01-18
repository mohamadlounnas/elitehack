-- ===========================================
-- Fix: Add updated_at column to assets table if missing
-- ===========================================

-- Add updated_at column to assets table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'assets' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE assets 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        RAISE NOTICE 'Added updated_at column to assets table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in assets table';
    END IF;
END $$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Migration Complete
-- ===========================================
SELECT 'Assets table updated_at column fix completed successfully!' as status;



