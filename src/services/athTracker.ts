/**
 * ATH (All-Time High) Market Cap Tracker Service
 * 
 * Tracks ATH market cap for tokens created by target creator wallets.
 * Handles real-time trade events and periodic Bitquery updates.
 */

import { pool } from '../db.js';
import { redis } from '../redis.js';
import { fetchAthMarketCapBatched, type TokenAthData } from '../utils/bitquery.js';
import type { TradeEventData, AmmBuyEventData, AmmSellEventData } from '../types.js';

// Constants
const SAVE_INTERVAL_MS = 5000; // Save every 5 seconds
const SOL_PRICE_KEY = 'price:timeseries:So11111111111111111111111111111111111111112';
const EVENTS_SORTED_SET = 'pumpfun:events:1min'; // Use same cache as tokenTracker
const TOKEN_SUPPLY = 1_000_000_000; // 1 billion tokens (human readable)

// In-memory token ATH data
interface TokenAthInfo {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  bonded: boolean;
  athMarketCapUsd: number;
  currentMarketCapUsd: number;
  lastUpdated: number;
  createdAt: number;
  dirty: boolean; // Flag to track if needs saving
}

const tokenAthMap: Map<string, TokenAthInfo> = new Map();
let saveInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Initialize the ATH tracker
 */
export async function initializeAthTracker(): Promise<void> {
  if (isInitialized) {
    console.log('[AthTracker] Already initialized');
    return;
  }

  console.log('[AthTracker] Initializing...');

  // Load existing tracked tokens from database
  await loadTrackedTokensFromDb();

  // Fetch tokens from creator wallets via Solscan and load to tracker
  await fetchTokensFromCreatorWallets();

  // Populate pendingTokenData for tokens that need ATH fetching (those with ATH = 0)
  for (const [mint, tokenInfo] of tokenAthMap.entries()) {
    if (tokenInfo.athMarketCapUsd === 0) {
      const blockTime = Math.floor(tokenInfo.createdAt / 1000);
      pendingTokenData.set(mint, {
        mint,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        creator: tokenInfo.creator,
        blockTime,
      });
    }
  }

  // Start periodic save
  startPeriodicSave();

  isInitialized = true;
  console.log(`[AthTracker] Initialized with ${tokenAthMap.size} tokens, ${pendingTokenData.size} pending ATH fetch`);

  // Fetch ATH from Bitquery in background (async - don't block stream start)
  if (pendingTokenData.size > 0) {
    fetchAthFromBitqueryAsync();
  }
}

/**
 * Load tracked tokens from database
 */
async function loadTrackedTokensFromDb(): Promise<void> {
  try {
    // Use a query that works with or without ATH columns (for backward compatibility)
    // Filtering logic: Only load tokens where the creator wallet is NOT in the blacklist.
    // This ensures we don't track ATH data for tokens from blacklisted wallets.
    const result = await pool.query(
      `SELECT mint, name, symbol, creator, created_at,
              COALESCE(bonded, false) as bonded,
              COALESCE(ath_market_cap_usd, 0) as ath_market_cap_usd
       FROM created_tokens
       WHERE creator NOT IN (SELECT wallet_address FROM blacklist_creator)`
    );

    for (const row of result.rows) {
      tokenAthMap.set(row.mint, {
        mint: row.mint,
        name: row.name || '',
        symbol: row.symbol || '',
        creator: row.creator,
        bonded: row.bonded || false,
        athMarketCapUsd: parseFloat(row.ath_market_cap_usd) || 0,
        currentMarketCapUsd: 0,
        lastUpdated: Date.now(),
        createdAt: new Date(row.created_at).getTime(),
        dirty: false,
      });
    }

    console.log(`[AthTracker] Loaded ${tokenAthMap.size} tokens from database`);
  } catch (error: any) {
    // Handle case where columns don't exist yet (migration not run)
    if (error?.code === '42703') {
      console.warn('[AthTracker] ATH columns not found in database. Run migration first.');
      console.warn('[AthTracker] Falling back to basic query...');
      
      try {
        // Filtering logic: Fallback query also filters out blacklisted wallets
        const fallbackResult = await pool.query(
          `SELECT mint, name, symbol, creator, created_at
           FROM created_tokens
           WHERE creator NOT IN (SELECT wallet_address FROM blacklist_creator)`
        );

        for (const row of fallbackResult.rows) {
          tokenAthMap.set(row.mint, {
            mint: row.mint,
            name: row.name || '',
            symbol: row.symbol || '',
            creator: row.creator,
            bonded: false,
            athMarketCapUsd: 0,
            currentMarketCapUsd: 0,
            lastUpdated: Date.now(),
            createdAt: new Date(row.created_at).getTime(),
            dirty: false,
          });
        }
        console.log(`[AthTracker] Loaded ${tokenAthMap.size} tokens (without ATH data)`);
      } catch (fallbackError) {
        console.error('[AthTracker] Fallback query also failed:', fallbackError);
      }
    } else {
      console.error('[AthTracker] Error loading tokens from database:', error);
    }
  }
}

// Store token data for Bitquery fetch
let pendingTokenData: Map<string, { mint: string; name: string; symbol: string; creator: string; blockTime: number }> = new Map();
let bitqueryFetchScheduled = false; // Flag to prevent multiple concurrent fetches

/**
 * Fetch tokens from creator wallets via Solscan and load to tracker
 * NOTE: This function is no longer used for blacklisted wallets.
 * It's kept for backward compatibility but should not fetch tokens for blacklisted wallets.
 */
async function fetchTokensFromCreatorWallets(): Promise<void> {
  // This function is deprecated - we don't fetch tokens for blacklisted wallets
  // Tokens are now fetched dynamically when new creators are encountered during streaming
  console.log('[AthTracker] Skipping initial token fetch - tokens will be fetched dynamically during streaming');
}

/**
 * Fetch ATH from Bitquery in background (async, non-blocking)
 */
function fetchAthFromBitqueryAsync(): void {
  // Run in background without blocking
  (async () => {
    try {
      if (pendingTokenData.size === 0) {
        console.log('[AthTracker] No tokens to fetch ATH for');
        return;
      }

      // Find earliest block time for Bitquery query
      let earliestBlockTime = Math.floor(Date.now() / 1000);
      const tokenDetails: Array<{ mint: string; name: string; symbol: string; blockTime: number }> = [];
      for (const data of pendingTokenData.values()) {
        tokenDetails.push(data);
        if (data.blockTime < earliestBlockTime) {
          earliestBlockTime = data.blockTime;
        }
      }

      // Subtract 1 day (86400 seconds) to account for timezone issues
      const ONE_DAY_SECONDS = 86400;
      const adjustedBlockTime = earliestBlockTime - ONE_DAY_SECONDS;

      // Convert to ISO string
      const sinceTime = new Date(adjustedBlockTime * 1000).toISOString();
      console.log(`[AthTracker] Fetching ATH from Bitquery since ${sinceTime} for ${pendingTokenData.size} tokens...`);

      // Fetch ATH from Bitquery
      const tokenAddresses = Array.from(pendingTokenData.keys());
      const athDataList = await fetchAthMarketCapBatched(tokenAddresses, sinceTime);

      console.log(`[AthTracker] Received ATH data for ${athDataList.length} tokens from Bitquery`);

      // Update token map with ATH data (only if higher than current)
      for (const athData of athDataList) {
        const existing = tokenAthMap.get(athData.mintAddress);
        if (existing) {
          // Only update if Bitquery ATH is higher than current
          if (athData.athMarketCapUsd > existing.athMarketCapUsd) {
            existing.athMarketCapUsd = athData.athMarketCapUsd;
            existing.dirty = true;
            console.log(`[AthTracker] Updated ATH from Bitquery for ${existing.symbol}: $${athData.athMarketCapUsd.toFixed(2)}`);
          }
          // Update name/symbol if missing
          if (!existing.name && athData.name) existing.name = athData.name;
          if (!existing.symbol && athData.symbol) existing.symbol = athData.symbol;
        }
      }

      // Clear pending data
      pendingTokenData.clear();
      bitqueryFetchScheduled = false;
      
      console.log('[AthTracker] Bitquery ATH update completed');
    } catch (error) {
      console.error('[AthTracker] Error fetching ATH from Bitquery:', error);
      bitqueryFetchScheduled = false;
    }
  })();
}

/**
 * Register a new token (from CreateEvent)
 * Caches in Redis for edge case where trade comes before registration
 */
export async function registerToken(
  mint: string,
  name: string,
  symbol: string,
  creator: string,
  createdAt: number
): Promise<void> {
  // Filtering logic: Skip tokens created by blacklisted wallets.
  const isBlacklisted = await isBlacklistedCreatorWallet(creator);
  if (isBlacklisted) {
    console.log(`[AthTracker] Skipping token from blacklisted creator: ${creator}`);
    return;
  }

  console.log(`[AthTracker] Registering new token: ${mint} (${symbol})`);

  // Convert createdAt (milliseconds) to blockTime (seconds) for Bitquery
  const blockTime = Math.floor(createdAt / 1000);

  // Add to in-memory map
  tokenAthMap.set(mint, {
    mint,
    name,
    symbol,
    creator,
    bonded: false,
    athMarketCapUsd: 0,
    currentMarketCapUsd: 0,
    lastUpdated: Date.now(),
    createdAt,
    dirty: true,
  });

  // Add to pendingTokenData for Bitquery ATH fetching
  pendingTokenData.set(mint, {
    mint,
    name,
    symbol,
    creator,
    blockTime,
  });

  // Trigger Bitquery fetch in background (non-blocking)
  // Batch tokens: fetch immediately if we have 10+ tokens, otherwise wait 5s to accumulate
  if (!bitqueryFetchScheduled) {
    if (pendingTokenData.size >= 10) {
      // Fetch immediately for batches
      bitqueryFetchScheduled = true;
      fetchAthFromBitqueryAsync();
    } else {
      // Schedule fetch after delay to accumulate more tokens
      bitqueryFetchScheduled = true;
      setTimeout(() => {
        bitqueryFetchScheduled = false;
        if (pendingTokenData.size > 0) {
          fetchAthFromBitqueryAsync();
        }
      }, 5000); // Wait 5s to accumulate more tokens
    }
  }

  // Note: Token data is already cached in Redis by storeTransactionEvent (pumpfun:events:1min)
}

/**
 * Check if a wallet is blacklisted
 * 
 * Filtering logic: Queries the blacklist_creator table to determine if the given wallet
 * address is blacklisted. Returns true if the wallet exists in the blacklist.
 */
async function isBlacklistedCreatorWallet(walletAddress: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM blacklist_creator WHERE wallet_address = $1 LIMIT 1',
      [walletAddress]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[AthTracker] Error checking blacklisted wallet:', error);
    return false;
  }
}

/**
 * Get SOL USD price at a specific timestamp
 */
async function getSolPriceUsd(): Promise<number> {
  try {
    const result = await redis.zrevrange(SOL_PRICE_KEY, 0, 0);
    if (result.length > 0) {
      const priceData = JSON.parse(result[0]);
      return priceData.price_usd || 0;
    }
    return 0;
  } catch (error) {
    console.error('[AthTracker] Error getting SOL price:', error);
    return 0;
  }
}

/**
 * Calculate market cap from trade data
 */
function calculateMarketCapUsd(
  solAmount: number,
  tokenAmount: number,
  solPriceUsd: number
): number {
  // Convert from base units
  const solAmountConverted = solAmount / 1e9;
  const tokenAmountConverted = tokenAmount / 1e6;
  
  if (tokenAmountConverted === 0) return 0;
  
  const executionPriceSol = solAmountConverted / tokenAmountConverted;
  const marketCapSol = executionPriceSol * TOKEN_SUPPLY;
  return marketCapSol * solPriceUsd;
}

/**
 * Handle TradeEvent (pump.fun bonding curve buy/sell)
 */
export async function handleTradeEvent(
  tradeData: TradeEventData,
  _txSignature: string
): Promise<void> {
  const mint = tradeData.mint;
  
  // Check if token is tracked or pending
  let tokenInfo: TokenAthInfo | undefined = tokenAthMap.get(mint);
  
  if (!tokenInfo) {
    // Check Redis cache for pending token
    tokenInfo = await checkPendingToken(mint);
    if (!tokenInfo) {
      return; // Not a tracked token
    }
  }

  // Calculate current market cap
  const solPriceUsd = await getSolPriceUsd();
  if (solPriceUsd === 0) return;

  const currentMarketCapUsd = calculateMarketCapUsd(
    tradeData.sol_amount,
    tradeData.token_amount,
    solPriceUsd
  );

  // Update ATH if new high
  if (currentMarketCapUsd > tokenInfo.athMarketCapUsd) {
    tokenInfo.athMarketCapUsd = currentMarketCapUsd;
    tokenInfo.dirty = true;
    console.log(`[AthTracker] New ATH for ${tokenInfo.symbol}: $${currentMarketCapUsd.toFixed(2)}`);
  }

  tokenInfo.currentMarketCapUsd = currentMarketCapUsd;
  tokenInfo.lastUpdated = Date.now();
  tokenAthMap.set(mint, tokenInfo);
}

/**
 * Handle AMM BuyEvent (pump.fun AMM)
 */
export async function handleAmmBuyEvent(
  buyData: AmmBuyEventData,
  mint: string,
  _txSignature: string
): Promise<void> {
  let tokenInfo: TokenAthInfo | undefined = tokenAthMap.get(mint);
  
  if (!tokenInfo) {
    tokenInfo = await checkPendingToken(mint);
    if (!tokenInfo) return;
  }

  const solPriceUsd = await getSolPriceUsd();
  if (solPriceUsd === 0) return;

  // For AMM events, use pool reserves to calculate price
  const poolQuoteReserves = buyData.pool_quote_token_reserves / 1e9; // SOL
  const poolBaseReserves = buyData.pool_base_token_reserves / 1e6; // Token
  
  if (poolBaseReserves === 0) return;
  
  const priceSol = poolQuoteReserves / poolBaseReserves;
  const currentMarketCapUsd = priceSol * TOKEN_SUPPLY * solPriceUsd;

  if (currentMarketCapUsd > tokenInfo.athMarketCapUsd) {
    tokenInfo.athMarketCapUsd = currentMarketCapUsd;
    tokenInfo.dirty = true;
    console.log(`[AthTracker] New ATH (AMM Buy) for ${tokenInfo.symbol}: $${currentMarketCapUsd.toFixed(2)}`);
  }

  // Mark as bonded (on AMM means bonded)
  if (!tokenInfo.bonded) {
    tokenInfo.bonded = true;
    tokenInfo.dirty = true;
  }

  tokenInfo.currentMarketCapUsd = currentMarketCapUsd;
  tokenInfo.lastUpdated = Date.now();
  tokenAthMap.set(mint, tokenInfo);
}

/**
 * Handle AMM SellEvent (pump.fun AMM)
 */
export async function handleAmmSellEvent(
  sellData: AmmSellEventData,
  mint: string,
  _txSignature: string
): Promise<void> {
  let tokenInfo: TokenAthInfo | undefined = tokenAthMap.get(mint);
  
  if (!tokenInfo) {
    tokenInfo = await checkPendingToken(mint);
    if (!tokenInfo) return;
  }

  const solPriceUsd = await getSolPriceUsd();
  if (solPriceUsd === 0) return;

  // For AMM events, use pool reserves to calculate price
  const poolQuoteReserves = sellData.pool_quote_token_reserves / 1e9; // SOL
  const poolBaseReserves = sellData.pool_base_token_reserves / 1e6; // Token
  
  if (poolBaseReserves === 0) return;
  
  const priceSol = poolQuoteReserves / poolBaseReserves;
  const currentMarketCapUsd = priceSol * TOKEN_SUPPLY * solPriceUsd;

  if (currentMarketCapUsd > tokenInfo.athMarketCapUsd) {
    tokenInfo.athMarketCapUsd = currentMarketCapUsd;
    tokenInfo.dirty = true;
    console.log(`[AthTracker] New ATH (AMM Sell) for ${tokenInfo.symbol}: $${currentMarketCapUsd.toFixed(2)}`);
  }

  // Mark as bonded
  if (!tokenInfo.bonded) {
    tokenInfo.bonded = true;
    tokenInfo.dirty = true;
  }

  tokenInfo.currentMarketCapUsd = currentMarketCapUsd;
  tokenInfo.lastUpdated = Date.now();
  tokenAthMap.set(mint, tokenInfo);
}

/**
 * Check Redis cache for pending token (edge case handling)
 * Uses the same events cache as tokenTracker (pumpfun:events:1min)
 */
async function checkPendingToken(mint: string): Promise<TokenAthInfo | undefined> {
  try {
    // Query the events sorted set for CreateEvent with this mint
    const oneMinuteAgo = Date.now() - 60000;
    const events = await redis.zrangebyscore(EVENTS_SORTED_SET, oneMinuteAgo, '+inf');
    
    for (const eventJson of events) {
      const event = JSON.parse(eventJson);
      
      // Look for CreateEvent with matching mint
      if (event.eventType === 'CreateEvent' && event.data?.mint === mint) {
        const createData = event.data;
        const creator = createData.creator || createData.user;
        
        // Filtering logic: Skip pending tokens if the creator wallet is blacklisted.
        const isBlacklisted = await isBlacklistedCreatorWallet(creator);
        if (isBlacklisted) return undefined;

        // Create token info and add to map
        const tokenInfo: TokenAthInfo = {
          mint: createData.mint,
          name: createData.name || '',
          symbol: createData.symbol || '',
          creator,
          bonded: false,
          athMarketCapUsd: 0,
          currentMarketCapUsd: 0,
          lastUpdated: Date.now(),
          createdAt: (createData.timestamp || Math.floor(Date.now() / 1000)) * 1000,
          dirty: true,
        };
        
        tokenAthMap.set(mint, tokenInfo);
        console.log(`[AthTracker] Recovered pending token from events cache: ${mint}`);
        return tokenInfo;
      }
    }
  } catch (error) {
    console.error('[AthTracker] Error checking pending token:', error);
  }
  return undefined;
}

/**
 * Update ATH from external source (e.g., Bitquery callback)
 */
export function updateAthFromExternal(athDataList: TokenAthData[]): void {
  for (const athData of athDataList) {
    const tokenInfo = tokenAthMap.get(athData.mintAddress);
    if (tokenInfo && athData.athMarketCapUsd > tokenInfo.athMarketCapUsd) {
      tokenInfo.athMarketCapUsd = athData.athMarketCapUsd;
      tokenInfo.lastUpdated = Date.now();
      tokenInfo.dirty = true;
      console.log(`[AthTracker] Updated ATH from Bitquery for ${tokenInfo.symbol}: $${athData.athMarketCapUsd.toFixed(2)}`);
    }
  }
}

/**
 * Start periodic save to database
 */
function startPeriodicSave(): void {
  if (saveInterval) {
    clearInterval(saveInterval);
  }

  saveInterval = setInterval(async () => {
    await saveAthDataToDb();
  }, SAVE_INTERVAL_MS);

  console.log(`[AthTracker] Started periodic save (every ${SAVE_INTERVAL_MS / 1000}s)`);
}

// Track if ATH columns exist in database
let athColumnsExist = true;

/**
 * Save dirty ATH data to database
 */
async function saveAthDataToDb(): Promise<void> {
  const dirtyTokens = Array.from(tokenAthMap.values()).filter(t => t.dirty);
  
  if (dirtyTokens.length === 0) {
    return;
  }

  console.log(`[AthTracker] Saving ${dirtyTokens.length} tokens to database...`);

  for (const token of dirtyTokens) {
    try {
      if (athColumnsExist) {
        // Try with ATH columns
        await pool.query(
          `INSERT INTO created_tokens (mint, name, symbol, creator, bonded, ath_market_cap_usd, created_at, is_fetched)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (mint) DO UPDATE SET
             name = COALESCE(EXCLUDED.name, created_tokens.name),
             symbol = COALESCE(EXCLUDED.symbol, created_tokens.symbol),
             bonded = EXCLUDED.bonded,
             ath_market_cap_usd = GREATEST(EXCLUDED.ath_market_cap_usd, COALESCE(created_tokens.ath_market_cap_usd, 0)),
             is_fetched = created_tokens.is_fetched,
             updated_at = NOW()`,
          [
            token.mint,
            token.name,
            token.symbol,
            token.creator,
            token.bonded,
            token.athMarketCapUsd,
            new Date(token.createdAt),
            false, // is_fetched = false (ATH tracker doesn't create new tokens, just updates existing ones)
          ]
        );
      } else {
        // Fallback: save without ATH columns
        await pool.query(
          `INSERT INTO created_tokens (mint, name, symbol, creator, created_at, is_fetched)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (mint) DO UPDATE SET
             name = COALESCE(EXCLUDED.name, created_tokens.name),
             symbol = COALESCE(EXCLUDED.symbol, created_tokens.symbol),
             is_fetched = created_tokens.is_fetched,
             updated_at = NOW()`,
          [
            token.mint,
            token.name,
            token.symbol,
            token.creator,
            new Date(token.createdAt),
            false, // is_fetched = false (ATH tracker doesn't create new tokens, just updates existing ones)
          ]
        );
      }
      
      token.dirty = false;
    } catch (error: any) {
      // Check if error is due to missing columns
      if (error?.code === '42703' && athColumnsExist) {
        console.warn('[AthTracker] ATH columns not found. Run migration! Falling back to basic save...');
        athColumnsExist = false;
        
        // Retry with fallback query
        try {
          await pool.query(
            `INSERT INTO created_tokens (mint, name, symbol, creator, created_at, is_fetched)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (mint) DO UPDATE SET
               name = COALESCE(EXCLUDED.name, created_tokens.name),
               symbol = COALESCE(EXCLUDED.symbol, created_tokens.symbol),
               is_fetched = created_tokens.is_fetched,
               updated_at = NOW()`,
            [
              token.mint,
              token.name,
              token.symbol,
              token.creator,
              new Date(token.createdAt),
              false, // is_fetched = false (ATH tracker doesn't create new tokens, just updates existing ones)
            ]
          );
          token.dirty = false;
        } catch (fallbackError) {
          console.error(`[AthTracker] Fallback save failed for ${token.mint}:`, fallbackError);
        }
      } else {
        console.error(`[AthTracker] Error saving token ${token.mint}:`, error);
      }
    }
  }
}

/**
 * Get tracking statistics
 */
export function getAthTrackerStats(): { 
  trackedTokens: number; 
  dirtyTokens: number;
  isInitialized: boolean;
} {
  return {
    trackedTokens: tokenAthMap.size,
    dirtyTokens: Array.from(tokenAthMap.values()).filter(t => t.dirty).length,
    isInitialized,
  };
}

/**
 * Get token ATH info
 */
export function getTokenAthInfo(mint: string): TokenAthInfo | undefined {
  return tokenAthMap.get(mint);
}

/**
 * Update ATH mcap for all tokens from a specific creator wallet
 * This is useful when stats are requested for a blacklisted wallet
 */
export async function updateAthMcapForCreator(creatorAddress: string): Promise<void> {
  try {
    console.log(`[AthTracker] Updating ATH mcap for tokens from creator: ${creatorAddress}`);
    
    // Get all tokens from this creator
    const result = await pool.query(
      `SELECT mint, name, symbol, created_at, COALESCE(ath_market_cap_usd, 0) as current_ath
       FROM created_tokens
       WHERE creator = $1`,
      [creatorAddress]
    );

    if (result.rows.length === 0) {
      console.log(`[AthTracker] No tokens found for creator: ${creatorAddress}`);
      return;
    }

    console.log(`[AthTracker] Found ${result.rows.length} tokens for creator ${creatorAddress}`);

    // Find earliest block time for Bitquery query
    let earliestBlockTime = Math.floor(Date.now() / 1000);
    const tokenAddresses: string[] = [];
    const tokenDataMap = new Map<string, { name: string; symbol: string; blockTime: number; currentAth: number }>();

    for (const row of result.rows) {
      const blockTime = Math.floor(new Date(row.created_at).getTime() / 1000);
      if (blockTime < earliestBlockTime) {
        earliestBlockTime = blockTime;
      }
      tokenAddresses.push(row.mint);
      tokenDataMap.set(row.mint, {
        name: row.name || '',
        symbol: row.symbol || '',
        blockTime,
        currentAth: parseFloat(row.current_ath) || 0,
      });
    }

    // Subtract 1 day (86400 seconds) to account for timezone issues
    const ONE_DAY_SECONDS = 86400;
    const adjustedBlockTime = earliestBlockTime - ONE_DAY_SECONDS;

    // Convert to ISO string
    const sinceTime = new Date(adjustedBlockTime * 1000).toISOString();
    console.log(`[AthTracker] Fetching ATH from Bitquery since ${sinceTime} for ${tokenAddresses.length} tokens...`);

    // Fetch ATH from Bitquery
    const athDataList = await fetchAthMarketCapBatched(tokenAddresses, sinceTime);

    console.log(`[AthTracker] Received ATH data for ${athDataList.length} tokens from Bitquery`);

    // Update database with ATH data (only if higher than current)
    let updatedCount = 0;
    for (const athData of athDataList) {
      const tokenInfo = tokenDataMap.get(athData.mintAddress);
      if (tokenInfo && athData.athMarketCapUsd > tokenInfo.currentAth) {
        try {
          await pool.query(
            `UPDATE created_tokens 
             SET ath_market_cap_usd = GREATEST($1, COALESCE(ath_market_cap_usd, 0)),
                 updated_at = NOW()
             WHERE mint = $2`,
            [athData.athMarketCapUsd, athData.mintAddress]
          );
          updatedCount++;
          console.log(`[AthTracker] Updated ATH for ${athData.symbol || athData.mintAddress}: $${athData.athMarketCapUsd.toFixed(2)}`);
        } catch (error) {
          console.error(`[AthTracker] Error updating ATH for ${athData.mintAddress}:`, error);
        }
      }
    }

    console.log(`[AthTracker] Completed updating ATH mcap for creator ${creatorAddress}: ${updatedCount} tokens updated`);
  } catch (error) {
    console.error(`[AthTracker] Error updating ATH mcap for creator ${creatorAddress}:`, error);
    throw error;
  }
}

/**
 * Cleanup (call on shutdown)
 * Finalizes all pending ATH fetches before saving
 */
export async function cleanupAthTracker(): Promise<void> {
  console.log('[AthTracker] Cleaning up...');
  
  // Stop periodic save
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }

  // Finalize pending ATH fetches before cleanup
  if (pendingTokenData.size > 0) {
    console.log(`[AthTracker] Finalizing ${pendingTokenData.size} pending ATH fetches...`);
    
    // Find earliest block time for Bitquery query
    let earliestBlockTime = Math.floor(Date.now() / 1000);
    for (const data of pendingTokenData.values()) {
      if (data.blockTime < earliestBlockTime) {
        earliestBlockTime = data.blockTime;
      }
    }

    // Subtract 1 day (86400 seconds) to account for timezone issues
    const ONE_DAY_SECONDS = 86400;
    const adjustedBlockTime = earliestBlockTime - ONE_DAY_SECONDS;
    const sinceTime = new Date(adjustedBlockTime * 1000).toISOString();

    // Fetch ATH from Bitquery synchronously (blocking, but this is cleanup)
    const tokenAddresses = Array.from(pendingTokenData.keys());
    const athDataList = await fetchAthMarketCapBatched(tokenAddresses, sinceTime);

    console.log(`[AthTracker] Received ATH data for ${athDataList.length} tokens from Bitquery during cleanup`);

    // Update token map with ATH data (only if higher than current)
    for (const athData of athDataList) {
      const existing = tokenAthMap.get(athData.mintAddress);
      if (existing) {
        // Only update if Bitquery ATH is higher than current
        if (athData.athMarketCapUsd > existing.athMarketCapUsd) {
          existing.athMarketCapUsd = athData.athMarketCapUsd;
          existing.dirty = true;
          console.log(`[AthTracker] Updated ATH from Bitquery for ${existing.symbol}: $${athData.athMarketCapUsd.toFixed(2)}`);
        }
        // Update name/symbol if missing
        if (!existing.name && athData.name) existing.name = athData.name;
        if (!existing.symbol && athData.symbol) existing.symbol = athData.symbol;
      }
    }

    // Clear pending data
    pendingTokenData.clear();
    console.log('[AthTracker] Pending ATH fetches finalized');
  }

  // Final save
  await saveAthDataToDb();
  
  isInitialized = false;
  console.log('[AthTracker] Cleanup complete');
}

