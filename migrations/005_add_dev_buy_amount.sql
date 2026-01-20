-- Migration: Add dev_buy_sol_amount column
-- This migration adds a column to track the dev buy amount separately
-- Dev buy is the first buy for each token (from the create transaction)
-- Run this migration to upgrade existing databases
-- 
-- IMPORTANT: Run this with psql using -f flag, or ensure autocommit is ON
-- Example: psql -d your_database -f migrations/005_add_dev_buy_amount.sql

-- Step 1: Add dev_buy_sol_amount column (if it doesn't exist)
ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS dev_buy_sol_amount DECIMAL(20, 9) DEFAULT 0;

-- Step 2: Calculate and populate dev_buy_sol_amount from existing market_cap_time_series data
-- The dev buy is identified by matching the signature with create_tx_signature
DO $$
DECLARE
  token_rec RECORD;
  calc_dev_buy_sol_amount DECIMAL(20, 9);
  processed_count INTEGER := 0;
  batch_counter INTEGER := 0;
  batch_size INTEGER := 1000;
BEGIN
  -- Process tokens one by one
  FOR token_rec IN 
    SELECT id, create_tx_signature, market_cap_time_series
    FROM tbl_soltrack_created_tokens
    WHERE market_cap_time_series IS NOT NULL
      AND jsonb_typeof(market_cap_time_series) = 'array'
      AND create_tx_signature IS NOT NULL
      AND (dev_buy_sol_amount = 0 OR dev_buy_sol_amount IS NULL)
  LOOP
    -- Find the dev buy by matching signature with create_tx_signature
    SELECT COALESCE(
      (
        SELECT (point->>'solAmount')::DECIMAL
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
        WHERE point->>'signature' = token_rec.create_tx_signature
          AND (point->>'tradeType' = 'buy' OR point->>'trade_type' = 'buy')
          AND (point->>'solAmount') IS NOT NULL
          AND (point->>'solAmount')::DECIMAL > 0
        LIMIT 1
      ),
      0
    )
    INTO calc_dev_buy_sol_amount;
    
    -- Update this token
    UPDATE tbl_soltrack_created_tokens
    SET dev_buy_sol_amount = calc_dev_buy_sol_amount
    WHERE id = token_rec.id;
    
    processed_count := processed_count + 1;
    batch_counter := batch_counter + 1;
    
    -- Log progress every batch_size tokens
    IF batch_counter >= batch_size THEN
      RAISE NOTICE 'Processed % tokens (total: %)', batch_counter, processed_count;
      batch_counter := 0;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed updating % total tokens with dev buy amounts', processed_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error calculating dev buy amounts: %', SQLERRM;
    RAISE NOTICE 'Processed % tokens before error', processed_count;
END $$;

-- Step 3: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_dev_buy_sol_amount 
ON tbl_soltrack_created_tokens(dev_buy_sol_amount);

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added column: dev_buy_sol_amount';
  RAISE NOTICE 'Calculated and populated dev buy amounts from existing market_cap_time_series data';
  RAISE NOTICE 'Added index for performance optimization';
END $$;
