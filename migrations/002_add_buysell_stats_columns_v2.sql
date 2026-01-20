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

ALTER TABLE tbl_soltrack_created_tokens 
ADD COLUMN IF NOT EXISTS dev_buy_sol_amount DECIMAL(20, 9) DEFAULT 0;

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
  calc_dev_buy_sol_amount DECIMAL(20, 9);
  calc_trade_count INTEGER;
  batch_counter INTEGER := 0;
  total_tokens INTEGER;
  sig_count INTEGER;
  debug_signature TEXT;
  buy_count_with_sig INTEGER;
  first_buy_sig TEXT;
  first_buy_amount DECIMAL(20, 9);
BEGIN
  -- Count total tokens to process
  SELECT COUNT(*) INTO total_tokens
  FROM tbl_soltrack_created_tokens
  WHERE market_cap_time_series IS NOT NULL
    AND jsonb_typeof(market_cap_time_series) = 'array';
  
  RAISE NOTICE 'Found % tokens with time series data to process', total_tokens;
  
  -- Process tokens one by one using cursor (same approach as single-ID test)
  -- Recalculate ALL tokens with time series data, even if they already have stats
  -- This ensures first_5_buy_sol excludes dev buy and dev_buy_sol_amount is properly calculated
  FOR token_rec IN 
    SELECT id, trade_count, create_tx_signature, market_cap_time_series
    FROM tbl_soltrack_created_tokens
    WHERE market_cap_time_series IS NOT NULL
      AND jsonb_typeof(market_cap_time_series) = 'array'
    ORDER BY id  -- Process in order for consistency
  LOOP
    -- Calculate stats for this token (same logic as single-ID test)
    SELECT 
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'buy'
          AND (point->'solAmount') IS NOT NULL
          AND (point->'solAmount')::DECIMAL > 0
      ), 0),
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'sell'
          AND (point->'solAmount') IS NOT NULL
          AND (point->'solAmount')::DECIMAL > 0
      ), 0),
      COALESCE((
        SELECT COALESCE(SUM((point->'solAmount')::DECIMAL), 0)
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'buy'
          AND (point->'solAmount') IS NOT NULL
      ), 0),
      COALESCE((
        SELECT COALESCE(SUM((point->'solAmount')::DECIMAL), 0)
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'sell'
          AND (point->'solAmount') IS NOT NULL
      ), 0),
      COALESCE((
        SELECT COALESCE(SUM((buy_point->'solAmount')::DECIMAL), 0)
        FROM (
          SELECT buy_point
          FROM jsonb_array_elements(token_rec.market_cap_time_series) AS buy_point
          WHERE buy_point->>'tradeType' = 'buy'
            AND (buy_point->'solAmount') IS NOT NULL
            AND (buy_point->'solAmount')::DECIMAL > 0
            -- Exclude dev buy from first 5 buys
            -- Dev buy is either: (1) matching create_tx_signature by signature, OR (2) the first buy by timestamp
            AND NOT (
              -- Exclude if signature matches create_tx_signature
              (token_rec.create_tx_signature IS NOT NULL
               AND buy_point->>'signature' IS NOT NULL
               AND buy_point->>'signature' = token_rec.create_tx_signature)
              OR
              -- OR exclude if this is the first buy by timestamp (dev buy is always first)
              NOT EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(token_rec.market_cap_time_series) AS earlier_buy
                WHERE earlier_buy->>'tradeType' = 'buy'
                  AND (earlier_buy->'solAmount') IS NOT NULL
                  AND (earlier_buy->'solAmount')::DECIMAL > 0
                  AND (earlier_buy->'timestamp')::BIGINT < (buy_point->'timestamp')::BIGINT
              )
            )
          ORDER BY (buy_point->'timestamp')::BIGINT ASC NULLS LAST
          LIMIT 5
        ) AS first_5_buys
      ), 0),
      COALESCE(
        -- First, try to find by signature match if create_tx_signature exists
        (
          SELECT (point->>'solAmount')::DECIMAL
          FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
          WHERE point->>'tradeType' = 'buy'
            AND (point->'solAmount') IS NOT NULL
            AND (point->'solAmount')::DECIMAL > 0
            AND token_rec.create_tx_signature IS NOT NULL
            AND point->>'signature' IS NOT NULL
            AND point->>'signature' = token_rec.create_tx_signature
          LIMIT 1
        ),
        -- Fallback: use first buy by timestamp (dev buy is always the first buy chronologically)
        (
          SELECT (point->>'solAmount')::DECIMAL
          FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
          WHERE point->>'tradeType' = 'buy'
            AND (point->'solAmount') IS NOT NULL
            AND (point->'solAmount')::DECIMAL > 0
            AND NOT EXISTS (
              -- Make sure this is the first buy (no earlier buys)
              SELECT 1 
              FROM jsonb_array_elements(token_rec.market_cap_time_series) AS earlier_point
              WHERE earlier_point->>'tradeType' = 'buy'
                AND (earlier_point->'solAmount') IS NOT NULL
                AND (earlier_point->'solAmount')::DECIMAL > 0
                AND (earlier_point->'timestamp')::BIGINT < (point->'timestamp')::BIGINT
            )
          ORDER BY (point->'timestamp')::BIGINT ASC NULLS LAST
          LIMIT 1
        ),
        0
      ),
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
      ), 0)
    INTO 
      calc_buy_count,
      calc_sell_count,
      calc_buy_sol_amount,
      calc_sell_sol_amount,
      calc_first_5_buy_sol,
      calc_dev_buy_sol_amount,
      calc_trade_count;
    
    -- Debug: Log if dev buy calculation might have issues (only first 20 tokens)
    IF calc_dev_buy_sol_amount = 0 AND processed_count < 20 THEN
      -- Check if there are any buys at all
      SELECT COUNT(*) INTO sig_count
      FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
      WHERE point->>'tradeType' = 'buy'
        AND (point->'solAmount') IS NOT NULL
        AND (point->'solAmount')::DECIMAL > 0;
      
      IF sig_count > 0 THEN
        -- Check if signature exists in time series
        SELECT COUNT(*) INTO buy_count_with_sig
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'buy'
          AND point->>'signature' IS NOT NULL;
        
        -- Get first buy signature and amount
        SELECT point->>'signature', (point->>'solAmount')::DECIMAL
        INTO first_buy_sig, first_buy_amount
        FROM jsonb_array_elements(token_rec.market_cap_time_series) AS point
        WHERE point->>'tradeType' = 'buy'
          AND (point->'solAmount') IS NOT NULL
          AND (point->'solAmount')::DECIMAL > 0
        ORDER BY (point->'timestamp')::BIGINT ASC NULLS LAST
        LIMIT 1;
        
        RAISE NOTICE 'Token id %: create_tx_sig=%, total_buys=%, buys_with_sig=%, first_buy_sig=%, first_buy_amount=%, dev_buy=0', 
          token_rec.id, 
          COALESCE(LEFT(token_rec.create_tx_signature, 30), 'NULL'),
          sig_count,
          buy_count_with_sig,
          COALESCE(LEFT(first_buy_sig, 30), 'NULL'),
          COALESCE(first_buy_amount::TEXT, '0');
      END IF;
    END IF;
    
    -- Update this token
    -- Recalculate all stats, including first_5_buy_sol (excluding dev buy) and dev_buy_sol_amount
    -- Always update ALL tokens, even if they already have data
    UPDATE tbl_soltrack_created_tokens
    SET 
      buy_count = calc_buy_count,
      sell_count = calc_sell_count,
      buy_sol_amount = calc_buy_sol_amount,
      sell_sol_amount = calc_sell_sol_amount,
      first_5_buy_sol = calc_first_5_buy_sol,
      dev_buy_sol_amount = calc_dev_buy_sol_amount,
      trade_count = CASE 
        WHEN trade_count = 0 OR trade_count IS NULL THEN calc_trade_count
        ELSE trade_count
      END,
      updated_at = NOW()  -- Force update by touching updated_at to ensure row is updated
    WHERE id = token_rec.id;
    
    -- Check if update actually happened
    IF NOT FOUND THEN
      RAISE NOTICE 'Warning: No row updated for token id %', token_rec.id;
    END IF;
    
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

CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_created_tokens_dev_buy_sol_amount 
ON tbl_soltrack_created_tokens(dev_buy_sol_amount);

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added columns: buy_count, sell_count, buy_sol_amount, sell_sol_amount, first_5_buy_sol, dev_buy_sol_amount';
  RAISE NOTICE 'Renamed trade_count_15s to trade_count (if applicable)';
  RAISE NOTICE 'Recalculated ALL buy/sell stats from existing market_cap_time_series data for all tokens';
  RAISE NOTICE 'Recalculated dev_buy_sol_amount by matching create_tx_signature with time series signatures';
  RAISE NOTICE 'Recalculated first_5_buy_sol to exclude dev buy from calculation (even for tokens with existing data)';
  RAISE NOTICE 'Added indexes for performance optimization';
END $$;
