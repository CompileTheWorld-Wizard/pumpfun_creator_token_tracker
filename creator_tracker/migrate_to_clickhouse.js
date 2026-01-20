/**
 * Migration Script: PostgreSQL to ClickHouse
 * 
 * This script migrates data from PostgreSQL to ClickHouse for creator_tracker.
 * It handles:
 * - Token metadata migration
 * - Time series data normalization (JSONB → separate table)
 * - Blacklist, passwords, and settings migration
 * 
 * Usage: node migrate_to_clickhouse.js
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@clickhouse/client';

dotenv.config();

const { Client: PgClient } = pg;

// Configuration
const BATCH_SIZE = 1000; // Process tokens in batches
const TIME_SERIES_BATCH_SIZE = 5000; // Insert time series in batches

// PostgreSQL connection
const pgClient = new PgClient({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'postgres',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
});

// ClickHouse connection
const clickhouseClient = createClient({
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
});

/**
 * Convert PostgreSQL boolean to ClickHouse UInt8
 */
function boolToUInt8(value) {
  if (value === null || value === undefined) return 0;
  return value === true || value === 1 ? 1 : 0;
}

/**
 * Convert Date to ClickHouse DateTime string format
 */
function formatDateForClickHouse(date) {
  if (!date) return null;
  if (date instanceof Date) {
    return date.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);
  }
  if (typeof date === 'string') {
    // Try to parse and format
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);
    }
    return date;
  }
  return date;
}

/**
 * Parse and normalize time series data from JSONB
 */
function normalizeTimeSeries(timeSeriesData, tokenCreatedAt, mint, creator) {
  if (!timeSeriesData) return [];
  
  let timeSeries = timeSeriesData;
  if (typeof timeSeriesData === 'string') {
    try {
      timeSeries = JSON.parse(timeSeriesData);
    } catch (e) {
      console.warn(`Failed to parse time series JSON for ${mint}:`, e.message);
      return [];
    }
  }
  
  if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
    return [];
  }
  
  // Convert token created_at to milliseconds
  const tokenCreatedAtMs = tokenCreatedAt instanceof Date 
    ? tokenCreatedAt.getTime() 
    : new Date(tokenCreatedAt).getTime();
  
  // Sort by timestamp to ensure correct trade_index
  const sorted = [...timeSeries].sort((a, b) => {
    const tsA = a.timestamp || a.timestamp_ms || 0;
    const tsB = b.timestamp || b.timestamp_ms || 0;
    return tsA - tsB;
  });
  
  return sorted.map((point, index) => {
    const timestampMs = point.timestamp || point.timestamp_ms || 0;
    const timeSeconds = Math.floor((timestampMs - tokenCreatedAtMs) / 1000);
    
    // Convert trade type
    const tradeType = point.tradeType || point.trade_type || 'buy';
    const isBuy = tradeType.toLowerCase() === 'buy' ? 1 : 0;
    
    const timestampDate = new Date(timestampMs);
    
    return {
      mint,
      creator,
      signature: point.signature || '',
      timestamp_ms: timestampMs,
      timestamp: formatDateForClickHouse(timestampDate),
      time_seconds: Math.max(0, timeSeconds), // Ensure non-negative
      trade_type: tradeType,
      is_buy: isBuy,
      sol_amount: parseFloat(point.solAmount || point.sol_amount || 0),
      token_amount: parseFloat(point.tokenAmount || point.token_amount || 0),
      market_cap_sol: parseFloat(point.marketCapSol || point.market_cap_sol || 0),
      market_cap_usd: parseFloat(point.marketCapUsd || point.market_cap_usd || 0),
      sol_price_usd: parseFloat(point.solPriceUsd || point.sol_price_usd || 0),
      execution_price_sol: parseFloat(point.executionPriceSol || point.execution_price_sol || 0),
      trade_index: index + 1, // 1-based index
    };
  });
}

/**
 * Migrate tokens table
 */
async function migrateTokens() {
  console.log('\n📦 Migrating tokens...');
  
  // Get total count
  const countResult = await pgClient.query('SELECT COUNT(*) as count FROM tbl_soltrack_created_tokens');
  const totalCount = parseInt(countResult.rows[0].count, 10);
  console.log(`   Found ${totalCount} tokens to migrate`);
  
  let migrated = 0;
  let offset = 0;
  
  while (offset < totalCount) {
    // Fetch batch from PostgreSQL
    const result = await pgClient.query(`
      SELECT 
        mint,
        name,
        symbol,
        creator,
        bonding_curve,
        created_at,
        create_tx_signature,
        market_cap_time_series,
        initial_market_cap_usd,
        peak_market_cap_usd,
        final_market_cap_usd,
        trade_count,
        bonded,
        ath_market_cap_usd,
        ath_updated_at,
        tracked_at,
        updated_at,
        is_fetched
      FROM tbl_soltrack_created_tokens
      ORDER BY created_at
      LIMIT $1 OFFSET $2
    `, [BATCH_SIZE, offset]);
    
    if (result.rows.length === 0) break;
    
    // Prepare data for ClickHouse
    const tokens = result.rows.map(row => ({
      mint: row.mint,
      name: row.name || null,
      symbol: row.symbol || null,
      creator: row.creator,
      bonding_curve: row.bonding_curve || null,
      created_at: formatDateForClickHouse(row.created_at),
      create_tx_signature: row.create_tx_signature || null,
      tracked_at: formatDateForClickHouse(row.tracked_at || row.created_at),
      updated_at: formatDateForClickHouse(row.updated_at || row.created_at),
      bonded: boolToUInt8(row.bonded),
      ath_market_cap_usd: row.ath_market_cap_usd ? parseFloat(row.ath_market_cap_usd) : null,
      ath_updated_at: formatDateForClickHouse(row.ath_updated_at),
      initial_market_cap_usd: row.initial_market_cap_usd ? parseFloat(row.initial_market_cap_usd) : null,
      peak_market_cap_usd: row.peak_market_cap_usd ? parseFloat(row.peak_market_cap_usd) : null,
      final_market_cap_usd: row.final_market_cap_usd ? parseFloat(row.final_market_cap_usd) : null,
      trade_count: parseInt(row.trade_count || 0, 10),
      buy_count: parseInt(row.buy_count || 0, 10),
      sell_count: parseInt(row.sell_count || 0, 10),
      buy_sol_amount: parseFloat(row.buy_sol_amount || 0),
      sell_sol_amount: parseFloat(row.sell_sol_amount || 0),
      first_5_buy_sol: parseFloat(row.first_5_buy_sol || 0),
      dev_buy_sol_amount: parseFloat(row.dev_buy_sol_amount || 0),
      is_fetched: boolToUInt8(row.is_fetched),
      version: Date.now(), // Use current timestamp as version
    }));
    
    // Insert into ClickHouse
    await clickhouseClient.insert({
      table: 'tbl_soltrack_tokens',
      values: tokens,
      format: 'JSONEachRow',
    });
    
    migrated += tokens.length;
    offset += BATCH_SIZE;
    
    console.log(`   Migrated ${migrated}/${totalCount} tokens (${Math.round(migrated/totalCount*100)}%)`);
  }
  
  console.log(`✅ Migrated ${migrated} tokens`);
  return migrated;
}

/**
 * Migrate time series data
 */
async function migrateTimeSeries() {
  console.log('\n📊 Migrating time series data...');
  
  // Get all tokens with time series data
  const result = await pgClient.query(`
    SELECT 
      mint,
      creator,
      created_at,
      market_cap_time_series
    FROM tbl_soltrack_created_tokens
    WHERE market_cap_time_series IS NOT NULL
      AND market_cap_time_series != '[]'::jsonb
      AND market_cap_time_series != 'null'::jsonb
    ORDER BY created_at
  `);
  
  console.log(`   Found ${result.rows.length} tokens with time series data`);
  
  let totalTimeSeriesRows = 0;
  let processed = 0;
  const timeSeriesBatch = [];
  
  for (const row of result.rows) {
    const normalized = normalizeTimeSeries(
      row.market_cap_time_series,
      row.created_at,
      row.mint,
      row.creator
    );
    
    if (normalized.length > 0) {
      timeSeriesBatch.push(...normalized);
      totalTimeSeriesRows += normalized.length;
    }
    
    processed++;
    
    // Insert in batches
    if (timeSeriesBatch.length >= TIME_SERIES_BATCH_SIZE) {
      await clickhouseClient.insert({
        table: 'tbl_soltrack_token_time_series',
        values: timeSeriesBatch,
        format: 'JSONEachRow',
      });
      
      console.log(`   Processed ${processed}/${result.rows.length} tokens, inserted ${totalTimeSeriesRows} time series rows`);
      timeSeriesBatch.length = 0; // Clear array
    }
  }
  
  // Insert remaining
  if (timeSeriesBatch.length > 0) {
    await clickhouseClient.insert({
      table: 'tbl_soltrack_token_time_series',
      values: timeSeriesBatch,
      format: 'JSONEachRow',
    });
  }
  
  console.log(`✅ Migrated ${totalTimeSeriesRows} time series rows from ${processed} tokens`);
  return totalTimeSeriesRows;
}

/**
 * Migrate blacklist_creator table
 */
async function migrateBlacklist() {
  console.log('\n🚫 Migrating blacklist...');
  
  // First check what columns exist
  let hasUpdatedAt = false;
  try {
    const checkResult = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_soltrack_blacklist_creator' 
        AND column_name = 'updated_at'
    `);
    hasUpdatedAt = checkResult.rows.length > 0;
  } catch (e) {
    // If we can't check, assume it doesn't exist
    hasUpdatedAt = false;
  }
  
  const selectColumns = hasUpdatedAt 
    ? 'wallet_address, name, created_at, updated_at'
    : 'wallet_address, name, created_at';
  
  const result = await pgClient.query(`
    SELECT 
      ${selectColumns}
    FROM tbl_soltrack_blacklist_creator
    ORDER BY created_at
  `);
  
  if (result.rows.length === 0) {
    console.log('   No blacklist entries to migrate');
    return 0;
  }
  
  const blacklist = result.rows.map(row => ({
    wallet_address: row.wallet_address,
    name: row.name || null,
    created_at: formatDateForClickHouse(row.created_at),
    updated_at: formatDateForClickHouse(row.updated_at || row.created_at),
    version: Date.now(),
  }));
  
  await clickhouseClient.insert({
    table: 'tbl_soltrack_blacklist_creator',
    values: blacklist,
    format: 'JSONEachRow',
  });
  
  console.log(`✅ Migrated ${blacklist.length} blacklist entries`);
  return blacklist.length;
}

/**
 * Migrate passwords table
 */
async function migratePasswords() {
  console.log('\n🔐 Migrating passwords...');
  
  // Check what columns exist
  let hasUpdatedAt = false;
  let hasCreatedAt = false;
  try {
    const checkResult = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'passwords'
    `);
    hasUpdatedAt = checkResult.rows.some(r => r.column_name === 'updated_at');
    hasCreatedAt = checkResult.rows.some(r => r.column_name === 'created_at');
  } catch (e) {
    // If we can't check, assume standard columns
    hasUpdatedAt = true;
    hasCreatedAt = true;
  }
  
  const selectColumns = [];
  if (hasCreatedAt) selectColumns.push('created_at');
  if (hasUpdatedAt) selectColumns.push('updated_at');
  const columnsStr = ['id', 'password_hash', ...selectColumns].join(', ');
  
  const result = await pgClient.query(`
    SELECT 
      ${columnsStr}
    FROM passwords
    ORDER BY id
  `);
  
  if (result.rows.length === 0) {
    console.log('   No passwords to migrate');
    return 0;
  }
  
  const passwords = result.rows.map(row => {
    const createdAt = hasCreatedAt ? row.created_at : new Date();
    const updatedAt = hasUpdatedAt ? (row.updated_at || createdAt) : createdAt;
    
    return {
      id: parseInt(row.id, 10),
      password_hash: row.password_hash,
      created_at: formatDateForClickHouse(createdAt),
      updated_at: formatDateForClickHouse(updatedAt),
      version: Date.now(),
    };
  });
  
  await clickhouseClient.insert({
    table: 'tbl_soltrack_passwords',
    values: passwords,
    format: 'JSONEachRow',
  });
  
  console.log(`✅ Migrated ${passwords.length} password entries`);
  return passwords.length;
}

/**
 * Migrate scoring_settings table
 */
async function migrateScoringSettings() {
  console.log('\n⚙️  Migrating scoring settings...');
  
  // Check what columns exist
  let hasUpdatedAt = false;
  let hasCreatedAt = false;
  try {
    const checkResult = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_soltrack_scoring_settings'
    `);
    hasUpdatedAt = checkResult.rows.some(r => r.column_name === 'updated_at');
    hasCreatedAt = checkResult.rows.some(r => r.column_name === 'created_at');
  } catch (e) {
    hasUpdatedAt = true;
    hasCreatedAt = true;
  }
  
  const selectColumns = ['id', 'name', 'settings', 'is_default'];
  if (hasCreatedAt) selectColumns.push('created_at');
  if (hasUpdatedAt) selectColumns.push('updated_at');
  
  const result = await pgClient.query(`
    SELECT 
      ${selectColumns.join(', ')}
    FROM tbl_soltrack_scoring_settings
    ORDER BY id
  `);
  
  if (result.rows.length === 0) {
    console.log('   No scoring settings to migrate');
    return 0;
  }
  
  const settings = result.rows.map(row => {
    let settingsStr = row.settings;
    if (typeof settingsStr !== 'string') {
      settingsStr = JSON.stringify(settingsStr);
    }
    
    const createdAt = hasCreatedAt ? row.created_at : new Date();
    const updatedAt = hasUpdatedAt ? (row.updated_at || createdAt) : createdAt;
    
    return {
      id: parseInt(row.id, 10),
      name: row.name,
      settings: settingsStr,
      is_default: boolToUInt8(row.is_default),
      created_at: formatDateForClickHouse(createdAt),
      updated_at: formatDateForClickHouse(updatedAt),
      version: Date.now(),
    };
  });
  
  await clickhouseClient.insert({
    table: 'tbl_soltrack_scoring_settings',
    values: settings,
    format: 'JSONEachRow',
  });
  
  console.log(`✅ Migrated ${settings.length} scoring settings`);
  return settings.length;
}

/**
 * Migrate applied_settings table
 */
async function migrateAppliedSettings() {
  console.log('\n📋 Migrating applied settings...');
  
  // Check what columns exist
  let hasUpdatedAt = false;
  let hasAppliedAt = false;
  try {
    const checkResult = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_soltrack_applied_settings'
    `);
    hasUpdatedAt = checkResult.rows.some(r => r.column_name === 'updated_at');
    hasAppliedAt = checkResult.rows.some(r => r.column_name === 'applied_at');
  } catch (e) {
    hasUpdatedAt = true;
    hasAppliedAt = true;
  }
  
  const selectColumns = ['id', 'preset_id', 'settings'];
  if (hasAppliedAt) selectColumns.push('applied_at');
  if (hasUpdatedAt) selectColumns.push('updated_at');
  
  const result = await pgClient.query(`
    SELECT 
      ${selectColumns.join(', ')}
    FROM tbl_soltrack_applied_settings
    ORDER BY id
  `);
  
  if (result.rows.length === 0) {
    console.log('   No applied settings to migrate');
    return 0;
  }
  
  const applied = result.rows.map(row => {
    let settingsStr = row.settings;
    if (typeof settingsStr !== 'string') {
      settingsStr = JSON.stringify(settingsStr);
    }
    
    const appliedAt = hasAppliedAt ? (row.applied_at || new Date()) : new Date();
    const updatedAt = hasUpdatedAt ? (row.updated_at || appliedAt) : appliedAt;
    
    return {
      id: parseInt(row.id, 10) || 1,
      preset_id: row.preset_id ? parseInt(row.preset_id, 10) : null,
      settings: settingsStr,
      applied_at: formatDateForClickHouse(appliedAt),
      updated_at: formatDateForClickHouse(updatedAt),
      version: Date.now(),
    };
  });
  
  await clickhouseClient.insert({
    table: 'tbl_soltrack_applied_settings',
    values: applied,
    format: 'JSONEachRow',
  });
  
  console.log(`✅ Migrated ${applied.length} applied settings`);
  return applied.length;
}

/**
 * Verify migration
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  // Check token counts
  const pgTokenCount = await pgClient.query('SELECT COUNT(*) as count FROM tbl_soltrack_created_tokens');
  const chTokenCount = await clickhouseClient.query({
    query: 'SELECT count() as count FROM tbl_soltrack_tokens',
    format: 'JSONEachRow',
  });
  const chTokenData = await chTokenCount.json();
  const chTokenCountValue = chTokenData.data?.[0]?.count || 0;
  
  console.log(`   PostgreSQL tokens: ${pgTokenCount.rows[0].count}`);
  console.log(`   ClickHouse tokens: ${chTokenCountValue}`);
  
  // Check time series (approximate)
  const pgTimeSeriesCount = await pgClient.query(`
    SELECT COUNT(*) as count
    FROM tbl_soltrack_created_tokens
    WHERE market_cap_time_series IS NOT NULL
      AND market_cap_time_series != '[]'::jsonb
  `);
  
  const chTimeSeriesCount = await clickhouseClient.query({
    query: 'SELECT count() as count FROM tbl_soltrack_token_time_series',
    format: 'JSONEachRow',
  });
  const chTimeSeriesData = await chTimeSeriesCount.json();
  const chTimeSeriesCountValue = chTimeSeriesData.data?.[0]?.count || 0;
  
  console.log(`   PostgreSQL tokens with time series: ${pgTimeSeriesCount.rows[0].count}`);
  console.log(`   ClickHouse time series rows: ${chTimeSeriesCountValue}`);
  
  console.log('\n✅ Verification complete');
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting PostgreSQL to ClickHouse migration...\n');
  
  const startTime = Date.now();
  
  try {
    // Connect to databases
    console.log('📡 Connecting to databases...');
    await pgClient.connect();
    console.log('   ✅ Connected to PostgreSQL');
    
    // Test ClickHouse connection
    await clickhouseClient.ping();
    console.log('   ✅ Connected to ClickHouse\n');
    
    // Run migrations
    await migrateTokens();
    await migrateTimeSeries();
    await migrateBlacklist();
    await migratePasswords();
    await migrateScoringSettings();
    await migrateAppliedSettings();
    
    // Verify
    await verifyMigration();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Migration completed successfully in ${duration} seconds!`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pgClient.end();
    await clickhouseClient.close();
  }
}

// Run migration when executed directly
main().catch(console.error);

export { main };
