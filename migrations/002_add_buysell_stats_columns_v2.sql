-- Migration: Add buy/sell statistics columns and rename trade_count_15s to trade_count
-- This migration adds materialized buy/sell stats columns for faster sorting
-- Run this migration to upgrade existing databases
-- 
-- IMPORTANT: Run this with psql using -f flag, or ensure autocommit is ON
-- Example: psql -d your_database -f migrations/002_add_buysell_stats_columns_v2.sql

-- Step 1: Add new columns (if they don't exist)
ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS buy_count INTEGER DEFAULT 0;

ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS sell_count INTEGER DEFAULT 0;

ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS buy_sol_amount DECIMAL(20, 9) DEFAULT 0;

ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS sell_sol_amount DECIMAL(20, 9) DEFAULT 0;

ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS first_5_buy_sol DECIMAL(20, 9) DEFAULT 0;

-- Step 2: Rename trade_count_15s to trade_count (if it exists and trade_count doesn't)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tbl_soltrack_created_tokens' 
    AND column_name = 'trade_count_15s'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tbl_soltrack_created_tokens' 
    AND column_name = 'trade_count'
  ) THEN
    ALTER TABLE tbl_soltrack_created_tokens 
    RENAME COLUMN trade_count_15s TO trade_count;
    RAISE NOTICE 'Renamed trade_count_15s to trade_count';
  END IF;
END $$;

-- Step 3: Calculate and populate buy/sell stats from existing market_cap_time_series data
-- Process in batches to avoid memory issues with large datasets
DO $$
DECLARE
  updated_count INTEGER;
  batch_size INTEGER := 1000;
  processed_count INTEGER := 0;
BEGIN
  -- Process tokens in batches
  LOOP
    WITH token_calculations AS (
      SELECT 
        id,
        market_cap_time_series,
        -- Calculate buy_count
        COALESCE((
          SELECT COUNT(*)::INTEGER
          FROM jsonb_array_elements(market_cap_time_series) AS point
          WHERE (point->>'tradeType' = 'buy' OR point->>'trade_type' = 'buy')
            AND (point->>'solAmount') IS NOT NULL
        ), 0) AS calc_buy_count,
        
        -- Calculate sell_count
        COALESCE((
          SELECT COUNT(*)::INTEGER
          FROM jsonb_array_elements(market_cap_time_series) AS point
          WHERE (point->>'tradeType' = 'sell' OR point->>'trade_type' = 'sell')
            AND (point->>'solAmount') IS NOT NULL
        ), 0) AS calc_sell_count,
        
        -- Calculate buy_sol_amount
        COALESCE((
          SELECT COALESCE(SUM((point->>'solAmount')::DECIMAL), 0)
          FROM jsonb_array_elements(market_cap_time_series) AS point
          WHERE (point->>'tradeType' = 'buy' OR point->>'trade_type' = 'buy')
            AND (point->>'solAmount') IS NOT NULL
        ), 0) AS calc_buy_sol_amount,
        
        -- Calculate sell_sol_amount
        COALESCE((
          SELECT COALESCE(SUM((point->>'solAmount')::DECIMAL), 0)
          FROM jsonb_array_elements(market_cap_time_series) AS point
          WHERE (point->>'tradeType' = 'sell' OR point->>'trade_type' = 'sell')
            AND (point->>'solAmount') IS NOT NULL
        ), 0) AS calc_sell_sol_amount,
        
        -- Calculate first_5_buy_sol
        COALESCE((
          SELECT COALESCE(SUM((buy_point->>'solAmount')::DECIMAL), 0)
          FROM (
            SELECT buy_point
            FROM jsonb_array_elements(market_cap_time_series) AS buy_point
            WHERE (buy_point->>'tradeType' = 'buy' OR buy_point->>'trade_type' = 'buy')
              AND (buy_point->>'solAmount') IS NOT NULL
            ORDER BY (buy_point->>'timestamp')::BIGINT ASC NULLS LAST
            LIMIT 5
          ) AS first_5_buys
        ), 0) AS calc_first_5_buy_sol,
        
        -- Calculate trade_count
        COALESCE((
          SELECT COUNT(*)::INTEGER
          FROM jsonb_array_elements(market_cap_time_series) AS point
        ), 0) AS calc_trade_count
      FROM tbl_soltrack_created_tokens
      WHERE market_cap_time_series IS NOT NULL
        AND jsonb_typeof(market_cap_time_series) = 'array'
        AND (buy_count = 0 AND sell_count = 0) -- Only process tokens that haven't been updated yet
      LIMIT batch_size
    )
    UPDATE tbl_soltrack_created_tokens AS ct
    SET 
      buy_count = tc.calc_buy_count,
      sell_count = tc.calc_sell_count,
      buy_sol_amount = tc.calc_buy_sol_amount,
      sell_sol_amount = tc.calc_sell_sol_amount,
      first_5_buy_sol = tc.calc_first_5_buy_sol,
      trade_count = CASE 
        WHEN ct.trade_count = 0 OR ct.trade_count IS NULL THEN tc.calc_trade_count
        ELSE ct.trade_count
      END
    FROM token_calculations tc
    WHERE ct.id = tc.id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    processed_count := processed_count + updated_count;
    
    EXIT WHEN updated_count = 0;
    
    RAISE NOTICE 'Processed % tokens (total: %)', updated_count, processed_count;
  END LOOP;
  
  RAISE NOTICE 'Completed updating % total tokens with buy/sell statistics', processed_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error calculating buy/sell stats: %', SQLERRM;
    RAISE NOTICE 'Processed % tokens before error', processed_count;
END $$;

-- Step 4: Add indexes for better query performance on new columns
CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_buy_count 
ON tbl_soltrack_created_tokens(buy_count);

CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_sell_count 
ON tbl_soltrack_created_tokens(sell_count);

CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_buy_sol_amount 
ON tbl_soltrack_created_tokens(buy_sol_amount);

CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_sell_sol_amount 
ON tbl_soltrack_created_tokens(sell_sol_amount);

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added columns: buy_count, sell_count, buy_sol_amount, sell_sol_amount, first_5_buy_sol';
  RAISE NOTICE 'Renamed trade_count_15s to trade_count (if applicable)';
  RAISE NOTICE 'Calculated and populated buy/sell stats from existing market_cap_time_series data';
  RAISE NOTICE 'Added indexes for performance optimization';
END $$;
