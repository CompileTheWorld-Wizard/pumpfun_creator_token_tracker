-- Migration: Rename tables to use tbl_soltrack_ prefix
-- This migration renames blacklist_creator and created_tokens tables

-- Rename blacklist_creator to tbl_soltrack_blacklist_creator
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'blacklist_creator'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'tbl_soltrack_blacklist_creator'
  ) THEN
    ALTER TABLE blacklist_creator RENAME TO tbl_soltrack_blacklist_creator;
    RAISE NOTICE 'Renamed blacklist_creator to tbl_soltrack_blacklist_creator';
  END IF;
END $$;

-- Rename created_tokens to tbl_soltrack_created_tokens
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'created_tokens'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'tbl_soltrack_created_tokens'
  ) THEN
    ALTER TABLE created_tokens RENAME TO tbl_soltrack_created_tokens;
    RAISE NOTICE 'Renamed created_tokens to tbl_soltrack_created_tokens';
  END IF;
END $$;

-- Rename indexes for created_tokens
DO $$
BEGIN
  -- Rename index idx_created_tokens_creator
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_created_tokens_creator'
  ) THEN
    ALTER INDEX idx_created_tokens_creator RENAME TO idx_tbl_soltrack_created_tokens_creator;
  END IF;
  
  -- Rename index idx_created_tokens_created_at
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_created_tokens_created_at'
  ) THEN
    ALTER INDEX idx_created_tokens_created_at RENAME TO idx_tbl_soltrack_created_tokens_created_at;
  END IF;
  
  -- Rename index idx_created_tokens_mint
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_created_tokens_mint'
  ) THEN
    ALTER INDEX idx_created_tokens_mint RENAME TO idx_tbl_soltrack_created_tokens_mint;
  END IF;
  
  -- Rename index idx_created_tokens_bonded
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_created_tokens_bonded'
  ) THEN
    ALTER INDEX idx_created_tokens_bonded RENAME TO idx_tbl_soltrack_created_tokens_bonded;
  END IF;
  
  -- Rename index idx_created_tokens_ath
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_created_tokens_ath'
  ) THEN
    ALTER INDEX idx_created_tokens_ath RENAME TO idx_tbl_soltrack_created_tokens_ath;
  END IF;
END $$;

-- Rename constraint for blacklist_creator
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'blacklist_creator_wallet_address_key'
  ) THEN
    ALTER TABLE tbl_soltrack_blacklist_creator 
    RENAME CONSTRAINT blacklist_creator_wallet_address_key 
    TO tbl_soltrack_blacklist_creator_wallet_address_key;
  END IF;
END $$;

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Renamed tables: blacklist_creator -> tbl_soltrack_blacklist_creator, created_tokens -> tbl_soltrack_created_tokens';
END $$;

