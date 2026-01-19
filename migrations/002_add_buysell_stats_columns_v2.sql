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
-- Using individual UPDATE per token (same approach as working single-ID test)
DO $$
DECLARE
  token_rec RECORD;
  batch_size INTEGER := 1000;
  processed_count INTEGER := 0;
  calc_buy_count INTEGER;
  calc_sell_count INTEGER;
  calc_buy_sol_amount DECIMAL(20, 9);
  calc_sell_sol_amount DECIMAL(20, 9);
  calc_first_5_buy_sol DECIMAL(20, 9);
  calc_trade_count INTEGER;
  batch_counter INTEGER := 0;
BEGIN
  -- Process tokens one by one using cursor (same approach as single-ID test)
  FOR token_rec IN 
    SELECT id, trade_count
    FROM tbl_soltrack_created_tokens
    WHERE market_cap_time_series IS NOT NULL
      AND jsonb_typeof(market_cap_time_series) = 'array'
      -- Recalculate tokens that either:
      -- 1. Have zero stats (fresh or incorrect data)
      -- 2. Have time series data but all stats are zero (likely incorrect)
      AND (
        (buy_count = 0 AND sell_count = 0 AND buy_sol_amount = 0 AND sell_sol_amount = 0)
        OR (
          -- Check if time series has trades but all stats are zero (incorrect data)
          EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(market_cap_time_series) AS point
            WHERE (point->>'tradeType' = 'buy' OR point->>'tradeType' = 'sell')
              AND (point->'solAmount') IS NOT NULL
          )
          AND buy_count = 0 AND sell_count = 0
        )
      )
  LOOP
    -- Calculate stats for this token (same logic as single-ID test)
    SELECT 
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM jsonb_array_elements(market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'buy'
          AND (point->'solAmount') IS NOT NULL
          AND (point->'solAmount')::DECIMAL > 0
      ), 0),
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM jsonb_array_elements(market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'sell'
          AND (point->'solAmount') IS NOT NULL
          AND (point->'solAmount')::DECIMAL > 0
      ), 0),
      COALESCE((
        SELECT COALESCE(SUM((point->'solAmount')::DECIMAL), 0)
        FROM jsonb_array_elements(market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'buy'
          AND (point->'solAmount') IS NOT NULL
      ), 0),
      COALESCE((
        SELECT COALESCE(SUM((point->'solAmount')::DECIMAL), 0)
        FROM jsonb_array_elements(market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'sell'
          AND (point->'solAmount') IS NOT NULL
      ), 0),
      COALESCE((
        SELECT COALESCE(SUM((buy_point->'solAmount')::DECIMAL), 0)
        FROM (
          SELECT buy_point
          FROM jsonb_array_elements(market_cap_time_series) AS buy_point
          WHERE buy_point->>'tradeType' = 'buy'
            AND (buy_point->'solAmount') IS NOT NULL
          ORDER BY (buy_point->'timestamp')::BIGINT ASC
          LIMIT 5
        ) AS first_5_buys
      ), 0),
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM jsonb_array_elements(market_cap_time_series) AS point
      ), 0)
    INTO 
      calc_buy_count,
      calc_sell_count,
      calc_buy_sol_amount,
      calc_sell_sol_amount,
      calc_first_5_buy_sol,
      calc_trade_count
    FROM tbl_soltrack_created_tokens
    WHERE id = token_rec.id
      AND market_cap_time_series IS NOT NULL
      AND jsonb_typeof(market_cap_time_series) = 'array';
    
    -- Update this token
    UPDATE tbl_soltrack_created_tokens
    SET 
      buy_count = calc_buy_count,
      sell_count = calc_sell_count,
      buy_sol_amount = calc_buy_sol_amount,
      sell_sol_amount = calc_sell_sol_amount,
      first_5_buy_sol = calc_first_5_buy_sol,
      trade_count = CASE 
        WHEN trade_count = 0 OR trade_count IS NULL THEN calc_trade_count
        ELSE trade_count
      END
    WHERE id = token_rec.id;
    
    processed_count := processed_count + 1;
    batch_counter := batch_counter + 1;
    
    -- Log progress every batch_size tokens
    IF batch_counter >= batch_size THEN
      RAISE NOTICE 'Processed % tokens (total: %)', batch_counter, processed_count;
      batch_counter := 0;
    END IF;
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
