-- ============================================================================
-- ClickHouse Schema Design for Creator Tracker
-- ============================================================================
-- This schema is optimized for time series data and analytical queries
-- Migration from PostgreSQL to ClickHouse for better performance
-- ============================================================================

-- ============================================================================
-- 1. Main Tokens Table (Replacing tbl_soltrack_created_tokens)
-- ============================================================================
-- Stores token metadata and summary statistics
-- Uses ReplacingMergeTree for deduplication and efficient updates
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_soltrack_tokens
(
    -- Primary identifiers
    mint String,
    name Nullable(String),
    symbol Nullable(String),
    creator String,
    bonding_curve Nullable(String),
    
    -- Timestamps
    created_at DateTime,
    create_tx_signature Nullable(String),
    tracked_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now(),
    
    -- Bonding status
    bonded UInt8 DEFAULT 0, -- 0 = false, 1 = true
    
    -- ATH (All-Time High) market cap tracking
    ath_market_cap_usd Nullable(Decimal64(2)),
    ath_updated_at Nullable(DateTime),
    
    -- Summary statistics (first 15 seconds)
    initial_market_cap_usd Nullable(Decimal64(2)),
    peak_market_cap_usd Nullable(Decimal64(2)),
    final_market_cap_usd Nullable(Decimal64(2)),
    trade_count UInt32 DEFAULT 0,
    
    -- Buy/sell statistics (materialized columns for fast queries)
    buy_count UInt32 DEFAULT 0,
    sell_count UInt32 DEFAULT 0,
    buy_sol_amount Decimal64(9) DEFAULT 0,
    sell_sol_amount Decimal64(9) DEFAULT 0,
    first_5_buy_sol Decimal64(9) DEFAULT 0,
    dev_buy_sol_amount Decimal64(9) DEFAULT 0,
    
    -- Source tracking
    is_fetched UInt8 DEFAULT 0, -- 0 = from streaming, 1 = from Solscan API
    
    -- Version for ReplacingMergeTree (auto-increment on updates)
    version UInt64 DEFAULT now64()
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(created_at)
ORDER BY (creator, created_at, mint)
SETTINGS 
    index_granularity = 8192,
    deduplicate_merge_projection_mode = 'drop';

-- ============================================================================
-- 2. Time Series Data Table (Normalized from JSONB market_cap_time_series)
-- ============================================================================
-- Stores individual time series data points for efficient querying
-- This replaces the JSONB column and enables fast time-based queries
--
-- Source data format (JSONB array):
-- [{
--   "signature": "B2ALLKho9xdGr3b9LFWCaxkt9gEwArpJtKBQFaysityqkU1pm3Lu7bL6ZJHyQiufqAcNa39zfxZ62hYNchgpwBV",
--   "solAmount": 0.009876542,
--   "timestamp": 1768181644877,  // milliseconds since epoch
--   "tradeType": "buy",           // "buy" or "sell"
--   "solPriceUsd": 140.5202191844025,
--   "tokenAmount": 353134.727201,
--   "marketCapSol": 27.968198082026618,
--   "marketCapUsd": 3930.097324679166,
--   "executionPriceSol": 0.000000027968198082026617
-- }]
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_soltrack_token_time_series
(
    -- Foreign key to tokens table
    mint String,
    creator String,
    
    -- Transaction signature (unique identifier for this trade)
    signature String,
    
    -- Time point (absolute timestamp and relative time)
    timestamp_ms UInt64, -- Absolute timestamp in milliseconds (from data)
    timestamp DateTime, -- Absolute timestamp converted to DateTime
    time_seconds UInt32, -- Seconds since token creation (calculated during migration: 
                         -- (timestamp_ms - token_created_at_ms) / 1000)
    
    -- Trade data
    trade_type String, -- "buy" or "sell"
    is_buy UInt8, -- 0 = sell, 1 = buy (derived from trade_type)
    sol_amount Decimal64(9), -- Amount of SOL in the trade
    token_amount Decimal64(9), -- Amount of tokens in the trade
    
    -- Market cap data at this time point
    market_cap_sol Decimal64(9), -- Market cap in SOL
    market_cap_usd Decimal64(2), -- Market cap in USD
    
    -- Price data
    sol_price_usd Decimal64(9), -- SOL price in USD at this time
    execution_price_sol Decimal64(18), -- Execution price per token in SOL
    
    -- Sequential trade number for this token (1st, 2nd, 3rd, etc.)
    -- This will be calculated during migration based on order
    trade_index UInt32,
    
    -- Timestamp for data insertion
    inserted_at DateTime DEFAULT now()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (creator, mint, timestamp_ms, trade_index)
SETTINGS index_granularity = 8192;

-- ============================================================================
-- 3. Blacklist Creator Wallets Table
-- ============================================================================
-- Simple lookup table for blacklisted creator wallets
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_soltrack_blacklist_creator
(
    wallet_address String,
    name Nullable(String),
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now(),
    version UInt64 DEFAULT now64()
)
ENGINE = ReplacingMergeTree(version)
ORDER BY wallet_address
SETTINGS 
    index_granularity = 8192,
    deduplicate_merge_projection_mode = 'drop';

-- ============================================================================
-- 4. Passwords Table (for authentication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_soltrack_passwords
(
    id UInt64,
    password_hash String,
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now(),
    version UInt64 DEFAULT now64()
)
ENGINE = ReplacingMergeTree(version)
ORDER BY id
SETTINGS 
    index_granularity = 8192,
    deduplicate_merge_projection_mode = 'drop';

-- ============================================================================
-- 5. Scoring Settings Table
-- ============================================================================
-- Stores scoring configuration presets
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_soltrack_scoring_settings
(
    id UInt64,
    name String,
    settings String, -- JSON string (ClickHouse doesn't have native JSON, use String)
    is_default UInt8 DEFAULT 0, -- 0 = false, 1 = true
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now(),
    version UInt64 DEFAULT now64()
)
ENGINE = ReplacingMergeTree(version)
ORDER BY (is_default, id)
SETTINGS 
    index_granularity = 8192,
    deduplicate_merge_projection_mode = 'drop';

-- ============================================================================
-- 6. Applied Settings Table
-- ============================================================================
-- Stores currently applied scoring settings (only one row)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_soltrack_applied_settings
(
    id UInt8 DEFAULT 1, -- Always 1 (only one row allowed)
    preset_id Nullable(UInt64),
    settings String, -- JSON string
    applied_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now(),
    version UInt64 DEFAULT now64()
)
ENGINE = ReplacingMergeTree(version)
ORDER BY id
SETTINGS 
    index_granularity = 8192,
    deduplicate_merge_projection_mode = 'drop';

-- ============================================================================
-- 7. Materialized Views for Fast Aggregations
-- ============================================================================
-- Pre-aggregated views for common queries (optional optimization)
-- ============================================================================

-- Materialized view for creator wallet statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_wallet_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(updated_at)
ORDER BY (creator, toStartOfDay(updated_at))
AS SELECT
    creator,
    toStartOfDay(updated_at) as stat_date,
    count() as total_tokens,
    sum(bonded) as bonded_tokens,
    avg(ath_market_cap_usd) as avg_ath_mcap,
    quantile(0.5)(ath_market_cap_usd) as median_ath_mcap,
    sum(buy_count) as total_buy_count,
    sum(sell_count) as total_sell_count,
    sum(buy_sol_amount) as total_buy_sol,
    sum(sell_sol_amount) as total_sell_sol,
    avg(buy_count) as avg_buy_count,
    avg(sell_count) as avg_sell_count,
    avg(buy_sol_amount) as avg_buy_sol,
    avg(sell_sol_amount) as avg_sell_sol,
    avg(first_5_buy_sol) as avg_first_5_buy_sol,
    quantile(0.5)(first_5_buy_sol) as median_first_5_buy_sol,
    avg(dev_buy_sol_amount) as avg_dev_buy_amount,
    quantile(0.5)(dev_buy_sol_amount) as median_dev_buy_amount,
    updated_at
FROM tbl_soltrack_tokens
GROUP BY creator, toStartOfDay(updated_at), updated_at;

-- ============================================================================
-- 8. Indexes and Projections (ClickHouse-specific optimizations)
-- ============================================================================
-- NOTE: Projections require deduplicate_merge_projection_mode = 'drop' 
-- for ReplacingMergeTree tables. This is set in the table definition above.
-- If tables already exist, you may need to alter them first:
-- ALTER TABLE tbl_soltrack_tokens MODIFY SETTING deduplicate_merge_projection_mode = 'drop';

-- Projection for filtering by creator and date range
ALTER TABLE tbl_soltrack_tokens ADD PROJECTION IF NOT EXISTS creator_date_projection
(
    SELECT 
        creator,
        toYYYYMM(created_at) as year_month,
        mint,
        created_at,
        bonded,
        ath_market_cap_usd,
        initial_market_cap_usd,
        peak_market_cap_usd,
        final_market_cap_usd
    ORDER BY (creator, toYYYYMM(created_at), created_at)
);

-- Projection for buy/sell statistics queries
ALTER TABLE tbl_soltrack_tokens ADD PROJECTION IF NOT EXISTS buy_sell_stats_projection
(
    SELECT 
        creator,
        buy_count,
        sell_count,
        buy_sol_amount,
        sell_sol_amount,
        first_5_buy_sol,
        dev_buy_sol_amount
    ORDER BY (creator, buy_count, sell_count)
);

-- ============================================================================
-- 9. Dictionary for Blacklist Lookup (Optional Performance Optimization)
-- ============================================================================
-- Fast in-memory lookup for blacklisted creators
-- ============================================================================

CREATE DICTIONARY IF NOT EXISTS tbl_soltrack_blacklist_creator_dict
(
    wallet_address String,
    name Nullable(String)
)
PRIMARY KEY wallet_address
SOURCE(CLICKHOUSE(
    HOST 'localhost'
    PORT 9000
    USER 'default'
    PASSWORD ''
    DB 'default'
    TABLE 'tbl_soltrack_blacklist_creator'
))
LAYOUT(HASHED())
LIFETIME(MIN 300 MAX 600);

-- ============================================================================
-- NOTES ON DESIGN DECISIONS:
-- ============================================================================
--
-- 1. **Normalized Time Series**: 
--    - Separated time series data into its own table for efficient queries
--    - Stores actual data fields: signature, solAmount, timestamp, tradeType, 
--      solPriceUsd, tokenAmount, marketCapSol, marketCapUsd, executionPriceSol
--    - Allows filtering, aggregation, and time-based calculations without parsing JSON
--    - Indexed by (creator, mint, timestamp_ms, trade_index) for fast lookups
--    - time_seconds is calculated during migration: (timestamp_ms - token_created_at_ms) / 1000
--
-- 2. **ReplacingMergeTree for Tokens**:
--    - Handles updates efficiently (ClickHouse is append-only)
--    - Uses version column for deduplication
--    - Partitioned by month for better query performance
--
-- 3. **Materialized Views**:
--    - Pre-aggregates common statistics for faster queries
--    - Can be refreshed incrementally
--
-- 4. **Projections**:
--    - ClickHouse-specific feature for query optimization
--    - Automatically used by query planner when beneficial
--    - Reduces data scanning for common query patterns
--
-- 5. **Data Types**:
--    - Used Decimal64 for financial data (precision)
--    - Used UInt8 for booleans (0/1)
--    - Used UInt32/UInt64 for counters and IDs
--    - Used DateTime for timestamps
--
-- 6. **Partitioning**:
--    - Partitioned by month for time-based queries
--    - Improves query performance and data management
--
-- 7. **Ordering Keys**:
--    - Optimized for common query patterns (filter by creator, sort by date)
--    - Enables efficient range scans
--
-- ============================================================================
-- QUERY PATTERNS SUPPORTED:
-- ============================================================================
--
-- 1. **Get tokens by creator with time series**:
--    SELECT * FROM tbl_soltrack_tokens WHERE creator = '...'
--    SELECT * FROM tbl_soltrack_token_time_series WHERE mint = '...' ORDER BY time_seconds
--
-- 2. **Filter by buy/sell stats** (fast, uses materialized columns):
--    SELECT * FROM tbl_soltrack_tokens WHERE buy_count > 5 AND buy_sol_amount > 100
--
-- 3. **Calculate rug rate** (uses time series):
--    SELECT mint, countIf(market_cap_usd < 6000) / count() as rug_rate
--    FROM tbl_soltrack_token_time_series 
--    WHERE time_seconds <= 15 
--    GROUP BY mint
--
-- 4. **What-if calculations** (uses time series):
--    SELECT mint, trade_index, time_seconds, market_cap_usd, sol_amount, is_buy
--    FROM tbl_soltrack_token_time_series 
--    WHERE mint = '...' AND trade_index <= 3
--    ORDER BY timestamp_ms
--
-- 5. **Aggregations by creator** (uses materialized view):
--    SELECT * FROM creator_wallet_stats_mv WHERE creator = '...'
--
-- ============================================================================
