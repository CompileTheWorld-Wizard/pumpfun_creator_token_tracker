-- Migration: Add ATH tracking columns to tbl_soltrack_created_tokens table
-- Run this if your database already has the tbl_soltrack_created_tokens table

-- Add bonded column
ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS bonded BOOLEAN DEFAULT FALSE;

-- Add ATH market cap column
ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS ath_market_cap_usd DECIMAL(20, 2);

-- Add ATH updated timestamp
ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS ath_updated_at TIMESTAMP;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_bonded ON tbl_soltrack_created_tokens(bonded);
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_ath ON tbl_soltrack_created_tokens(ath_market_cap_usd);

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added columns: bonded, ath_market_cap_usd, ath_updated_at';
END $$;

