-- ===========================================
-- Add Asset-Suppliers Junction Table & Enhance Suppliers
-- ===========================================

-- Add new columns to suppliers table (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'country') THEN
        ALTER TABLE suppliers ADD COLUMN country VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'address') THEN
        ALTER TABLE suppliers ADD COLUMN address TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact_person') THEN
        ALTER TABLE suppliers ADD COLUMN contact_person VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'specializations') THEN
        ALTER TABLE suppliers ADD COLUMN specializations JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'certifications') THEN
        ALTER TABLE suppliers ADD COLUMN certifications JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'years_in_business') THEN
        ALTER TABLE suppliers ADD COLUMN years_in_business INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'company_size') THEN
        ALTER TABLE suppliers ADD COLUMN company_size VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'description') THEN
        ALTER TABLE suppliers ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'source_url') THEN
        ALTER TABLE suppliers ADD COLUMN source_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'verified') THEN
        ALTER TABLE suppliers ADD COLUMN verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create asset_suppliers junction table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS asset_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT FALSE,
    quote_price DECIMAL(15, 2),
    lead_time_days INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, supplier_id)
);

-- Create indexes for asset_suppliers
CREATE INDEX IF NOT EXISTS idx_asset_suppliers_asset ON asset_suppliers(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_suppliers_supplier ON asset_suppliers(supplier_id);

-- Comment for documentation
COMMENT ON TABLE asset_suppliers IS 'Junction table linking assets to multiple suppliers (1-5 suppliers per asset)';

SELECT 'Asset-Suppliers migration completed!' as status;


