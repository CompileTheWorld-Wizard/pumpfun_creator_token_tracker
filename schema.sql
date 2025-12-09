-- Schema for pumpfun_creator_token_tracker

-- Blacklist creator wallets table (if not exists)
CREATE TABLE IF NOT EXISTS blacklist_creator (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Created tokens table for tracking tokens from target creators
CREATE TABLE IF NOT EXISTS created_tokens (
  id SERIAL PRIMARY KEY,
  mint VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255),
  symbol VARCHAR(32),
  creator VARCHAR(64) NOT NULL,
  bonding_curve VARCHAR(64),
  created_at TIMESTAMP NOT NULL,
  create_tx_signature VARCHAR(128),
  
  -- Bonding status (true = migrated to AMM/Raydium)
  bonded BOOLEAN DEFAULT FALSE,
  
  -- ATH (All-Time High) market cap tracking
  ath_market_cap_usd DECIMAL(20, 2),
  ath_updated_at TIMESTAMP,
  
  -- Market cap time series data (first 15 seconds)
  market_cap_time_series JSONB,
  
  -- Summary statistics (first 15 seconds)
  initial_market_cap_usd DECIMAL(20, 2),
  peak_market_cap_usd DECIMAL(20, 2),
  final_market_cap_usd DECIMAL(20, 2),
  trade_count_15s INTEGER DEFAULT 0,
  
  -- Timestamps
  tracked_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_created_tokens_creator ON created_tokens(creator);
CREATE INDEX IF NOT EXISTS idx_created_tokens_created_at ON created_tokens(created_at);
CREATE INDEX IF NOT EXISTS idx_created_tokens_mint ON created_tokens(mint);
CREATE INDEX IF NOT EXISTS idx_created_tokens_bonded ON created_tokens(bonded);
CREATE INDEX IF NOT EXISTS idx_created_tokens_ath ON created_tokens(ath_market_cap_usd);

-- Migration: Add new columns to existing table (run if table already exists)
-- ALTER TABLE created_tokens ADD COLUMN IF NOT EXISTS bonded BOOLEAN DEFAULT FALSE;
-- ALTER TABLE created_tokens ADD COLUMN IF NOT EXISTS ath_market_cap_usd DECIMAL(20, 2);
-- ALTER TABLE created_tokens ADD COLUMN IF NOT EXISTS ath_updated_at TIMESTAMP;

-- Foreign key to link created tokens to registered creator wallets
-- (optional, uncomment if you want strict referential integrity)
-- ALTER TABLE created_tokens 
-- ADD CONSTRAINT fk_creator_wallet 
-- FOREIGN KEY (creator) REFERENCES blacklist_creator(wallet_address);

-- Password table for authentication
CREATE TABLE IF NOT EXISTS passwords (
  id SERIAL PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

