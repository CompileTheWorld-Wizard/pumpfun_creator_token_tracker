-- Add pool address, base_mint, and quote_mint columns to track AMM pool information
ALTER TABLE tbl_soltrack_created_tokens 
  ADD COLUMN IF NOT EXISTS pool_address VARCHAR(64),
  ADD COLUMN IF NOT EXISTS base_mint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS quote_mint VARCHAR(64);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_pool_address ON tbl_soltrack_created_tokens(pool_address);
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_base_mint ON tbl_soltrack_created_tokens(base_mint);
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_quote_mint ON tbl_soltrack_created_tokens(quote_mint);

