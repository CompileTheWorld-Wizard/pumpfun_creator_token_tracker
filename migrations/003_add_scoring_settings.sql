-- Scoring settings table for managing scoring system presets
CREATE TABLE IF NOT EXISTS tbl_soltrack_scoring_settings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  settings JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_scoring_settings_default ON tbl_soltrack_scoring_settings(is_default);

-- Ensure only one default setting exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_soltrack_scoring_settings_single_default 
  ON tbl_soltrack_scoring_settings(is_default) 
  WHERE is_default = TRUE;

