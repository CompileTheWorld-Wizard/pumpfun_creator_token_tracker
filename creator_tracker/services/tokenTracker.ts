/**
 * Token Tracker Service
 * 
 * Tracks created tokens from target creator wallets and collects
 * their first 15-seconds market cap data after creation.
 */

import { pool } from '../db.js';
import { redis } from '../redis.js';
import type { CreateEventData, TradeEventData } from '../types.js';
import { getCreatedTokens } from '../utils/solscan.js';
import { fetchBondingStatusBatch } from './bondingTracker.js';
import { registerToken as registerTokenForAth, fetchAthForTokens } from './athTracker.js';

// Constants
const COLLECTION_DELAY_MS = 20000; // Wait 20 seconds before collecting data
const DATA_WINDOW_MS = 15000; // Collect 15 seconds of data
const SOL_PRICE_KEY = 'price:timeseries:So11111111111111111111111111111111111111112';
const EVENTS_SORTED_SET = 'pumpfun:events:5min';

// Token total supply (standard for pump.fun tokens)
const DEFAULT_TOKEN_SUPPLY = 1_000_000_000;

// In-memory set of blacklisted creator wallets
let blacklistedCreatorWallets: Set<string> = new Set();

// Pending token tracking jobs
const pendingTrackingJobs: Map<string, NodeJS.Timeout> = new Map();

// Track creator wallets that have been fetched during this streaming cycle
// Prevents re-fetching the same creator's tokens multiple times
const fetchedCreatorWallets: Set<string> = new Set();

/**
 * Market cap data point
 */
export interface MarketCapDataPoint {
  timestamp: number;
  executionPriceSol: number;
  marketCapSol: number;
  marketCapUsd: number;
  solPriceUsd: number;
  tradeType: 'buy' | 'sell';
  signature: string;
  solAmount: number; // Actual SOL amount for this trade
  tokenAmount: number; // Actual token amount for this trade
}

/**
 * Token tracking result
 */
export interface TokenTrackingResult {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  bondingCurve: string;
  createdAt: number;
  marketCapTimeSeries: MarketCapDataPoint[];
  initialMarketCapUsd: number | null;
  peakMarketCapUsd: number | null;
  finalMarketCapUsd: number | null;
  tradeCount: number;
}

/**
 * Initialize the token tracker by loading blacklisted creator wallets
 */
export async function initializeTokenTracker(): Promise<void> {
  await refreshBlacklistedWallets();
}

/**
 * Refresh blacklisted creator wallets from the database
 * 
 * This function loads all blacklisted creator wallet addresses from the tbl_soltrack_blacklist_creator table
 * and stores them in memory for fast filtering. Tokens created by these wallets will NOT
 * be tracked for market cap data collection.
 */
export async function refreshBlacklistedWallets(): Promise<void> {
  try {
    // Load all blacklisted creator wallet addresses from database
    const result = await pool.query(
      'SELECT DISTINCT wallet_address FROM tbl_soltrack_blacklist_creator'
    );
    blacklistedCreatorWallets = new Set(result.rows.map(row => row.wallet_address));
  } catch (error) {
    console.error('[TokenTracker] Error refreshing blacklisted wallets:', error);
  }
}

/**
 * Check if a wallet is blacklisted
 * 
 * Filtering logic: Returns true if the wallet address is in the blacklist.
 * Tokens created by blacklisted wallets should NOT be tracked.
 */
export function isBlacklistedCreator(walletAddress: string): boolean {
  return blacklistedCreatorWallets.has(walletAddress);
}

/**
 * Fetch latest 100 tokens created by a creator wallet and get their bonding status
 * Limits to latest 100 tokens as per API request
 */
async function fetchCreatorTokensAndBondingStatus(creatorAddress: string): Promise<void> {
  try {
    // Fetch latest 100 tokens created by this wallet from Solscan
    const response = await getCreatedTokens(creatorAddress) as any;
    
    const tokenMintsSet = new Set<string>();
    const tokenDataMap = new Map<string, { name: string; symbol: string; blockTime: number }>();
    const MAX_TOKENS = 100; // Limit to 100 tokens as per requirements
    
    // Extract token mints from the response (limit to 100) if Solscan returned data
    if (response?.data && Array.isArray(response.data)) {
      for (const activity of response.data) {
        // Try multiple possible fields for token mint address in INIT_MINT activities
        const tokenMint = activity.token || 
                         activity.mint || 
                         activity.token_address ||
                         activity.routers?.token1 ||
                         activity.routers?.token0;
        
        if (tokenMint && 
            typeof tokenMint === 'string' &&
            tokenMint !== 'So11111111111111111111111111111111111111111' &&
            tokenMint !== 'So11111111111111111111111111111111111111112') {
          
          // Limit to 100 tokens
          if (tokenMintsSet.size >= MAX_TOKENS) {
            break;
          }
          
          if (!tokenMintsSet.has(tokenMint)) {
            tokenMintsSet.add(tokenMint);
            
            // Get token metadata from response
            const tokenMeta = response.metadata?.tokens?.[tokenMint] || {};
            const blockTime = activity.block_time || Math.floor(Date.now() / 1000);
            
            tokenDataMap.set(tokenMint, {
              name: tokenMeta?.token_name || tokenMeta?.name || '',
              symbol: tokenMeta?.token_symbol || tokenMeta?.symbol || '',
              blockTime,
            });
          }
        }
      }
    }
    
    const tokenMints = Array.from(tokenMintsSet);
    
    // If Solscan didn't return valid tokens, check database for tokens from this creator
    if (tokenMints.length === 0) {
      try {
        // Get tokens from database for this creator
        const dbResult = await pool.query(
          `SELECT mint, name, symbol, created_at, bonded
           FROM tbl_soltrack_created_tokens
           WHERE creator = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [creatorAddress, MAX_TOKENS]
        );
        
        if (dbResult.rows.length === 0) {
          return;
        }
        
        // Extract token mints from database
        const dbTokenMints = dbResult.rows.map(row => row.mint);
        
        // Fetch bonding status for database tokens
        const { bondingStatusMap, poolInfoMap } = await fetchBondingStatusBatch(dbTokenMints);
        
        // Update bonding status in database based on Shyft API response
        const bondedTokens: string[] = [];
        const unbondedTokens: string[] = [];
        
        for (const mint of dbTokenMints) {
          const isBonded = bondingStatusMap.get(mint) || false;
          if (isBonded) {
            bondedTokens.push(mint);
          } else {
            unbondedTokens.push(mint);
          }
        }
        
        // Update database with latest bonding status from Shyft API (with pool info)
        if (bondedTokens.length > 0) {
          for (const mint of bondedTokens) {
            const poolInfo = poolInfoMap.get(mint);
            if (poolInfo) {
              await pool.query(
                `UPDATE tbl_soltrack_created_tokens 
                 SET bonded = true,
                     pool_address = $2,
                     base_mint = $3,
                     quote_mint = $4,
                     updated_at = NOW()
                 WHERE mint = $1`,
                [mint, poolInfo.pool, poolInfo.base_mint, poolInfo.quote_mint]
              );
            } else {
              await pool.query(
                `UPDATE tbl_soltrack_created_tokens 
                 SET bonded = true, updated_at = NOW()
                 WHERE mint = $1`,
                [mint]
              );
            }
          }
        }
        
        if (unbondedTokens.length > 0) {
          const unbondedPlaceholders = unbondedTokens.map((_, i) => `$${i + 1}`).join(', ');
          await pool.query(
            `UPDATE tbl_soltrack_created_tokens 
             SET bonded = false, updated_at = NOW()
             WHERE mint IN (${unbondedPlaceholders})`,
            unbondedTokens
          );
        }
        
        return;
      } catch (dbError) {
        console.error(`[TokenTracker] Error checking database for creator ${creatorAddress}:`, dbError);
        return;
      }
    }
    
    // Fetch bonding status for all tokens using Shyft GraphQL API
    const { bondingStatusMap, poolInfoMap } = await fetchBondingStatusBatch(tokenMints);
    
    // Save tokens to database and prepare for ATH fetching
    const tokensForAth: Array<{ mint: string; name: string; symbol: string; creator: string; blockTime: number }> = [];
    
    for (const mint of tokenMints) {
      const tokenData = tokenDataMap.get(mint);
      const isBonded = bondingStatusMap.get(mint) || false;
      const poolInfo = poolInfoMap.get(mint);
      
      if (tokenData) {
        try {
          if (isBonded && poolInfo) {
            // Insert with pool information if bonded
            await pool.query(
              `INSERT INTO tbl_soltrack_created_tokens (mint, name, symbol, creator, bonded, pool_address, base_mint, quote_mint, created_at, is_fetched)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (mint) DO UPDATE SET
                 name = COALESCE(EXCLUDED.name, tbl_soltrack_created_tokens.name),
                 symbol = COALESCE(EXCLUDED.symbol, tbl_soltrack_created_tokens.symbol),
                 -- Don't update bonded status - it should only be set by migrate events
                 -- Preserve existing bonded status to avoid overwriting migrate event updates
                 bonded = tbl_soltrack_created_tokens.bonded,
                 -- Update pool info only if not already set (preserve migrate event data)
                 pool_address = COALESCE(tbl_soltrack_created_tokens.pool_address, EXCLUDED.pool_address),
                 base_mint = COALESCE(tbl_soltrack_created_tokens.base_mint, EXCLUDED.base_mint),
                 quote_mint = COALESCE(tbl_soltrack_created_tokens.quote_mint, EXCLUDED.quote_mint),
                 is_fetched = COALESCE(EXCLUDED.is_fetched, tbl_soltrack_created_tokens.is_fetched),
                 updated_at = NOW()`,
              [
                mint,
                tokenData.name,
                tokenData.symbol,
                creatorAddress,
                isBonded,
                poolInfo.pool,
                poolInfo.base_mint,
                poolInfo.quote_mint,
                new Date(tokenData.blockTime * 1000),
                true, // is_fetched = true (from Solscan API)
              ]
            );
          } else {
            // Insert without pool information
            await pool.query(
              `INSERT INTO tbl_soltrack_created_tokens (mint, name, symbol, creator, bonded, created_at, is_fetched)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (mint) DO UPDATE SET
                 name = COALESCE(EXCLUDED.name, tbl_soltrack_created_tokens.name),
                 symbol = COALESCE(EXCLUDED.symbol, tbl_soltrack_created_tokens.symbol),
                 -- Don't update bonded status - it should only be set by migrate events
                 -- Preserve existing bonded status to avoid overwriting migrate event updates
                 bonded = tbl_soltrack_created_tokens.bonded,
                 is_fetched = COALESCE(EXCLUDED.is_fetched, tbl_soltrack_created_tokens.is_fetched),
                 updated_at = NOW()`,
              [
                mint,
                tokenData.name,
                tokenData.symbol,
                creatorAddress,
                isBonded, // Only used for new inserts, not for updates
                new Date(tokenData.blockTime * 1000),
                true, // is_fetched = true (from Solscan API)
              ]
            );
          }

          // Register token in ATH tracker (for real-time tracking)
          // Only register if creator is not blacklisted (registerToken checks this internally)
          try {
            await registerTokenForAth(
              mint,
              tokenData.name,
              tokenData.symbol,
              creatorAddress,
              tokenData.blockTime * 1000 // Convert to milliseconds
            );
            
            // Add to list for ATH fetching
            tokensForAth.push({
              mint,
              name: tokenData.name,
              symbol: tokenData.symbol,
              creator: creatorAddress,
              blockTime: tokenData.blockTime,
            });
          } catch (athError) {
            // ATH registration might fail if creator is blacklisted - silently continue
          }
        } catch (error) {
          console.error(`[TokenTracker] Error saving token ${mint} to database:`, error);
        }
      }
    }
    
    // Fetch ATH for all tokens immediately
    if (tokensForAth.length > 0) {
      try {
        await fetchAthForTokens(tokensForAth);
      } catch (error) {
        console.error(`[TokenTracker] Error fetching ATH for tokens:`, error);
      }
    }
  } catch (error) {
    console.error(`[TokenTracker] Error fetching creator tokens and bonding status:`, error);
    throw error;
  }
}

/**
 * Handle a CreateEvent - schedule tracking if NOT from a blacklisted wallet
 * Also fetches latest 100 tokens by the same creator if not already fetched
 * @param devBuyTradeEvent Optional TradeEvent from the same transaction (dev buy)
 */
export async function handleCreateEvent(
  createEventData: CreateEventData,
  txSignature: string,
  devBuyTradeEvent?: TradeEventData | null
): Promise<void> {
  const creator = createEventData.creator || createEventData.user;
  
  // Filtering logic: Skip tokens created by blacklisted wallets.
  // If the creator wallet is in the blacklist, skip tracking this token.
  if (isBlacklistedCreator(creator)) {
    return;
  }

  // Check if this creator wallet has been fetched in this streaming cycle
  // If not, fetch latest 100 tokens created by this creator
  if (!fetchedCreatorWallets.has(creator)) {
    fetchedCreatorWallets.add(creator);
    
    // Fetch latest 100 tokens created by this wallet and get bonding status
    // Run in background to avoid blocking event processing
    // If fetch fails, remove from Set to allow retry on next CreateEvent
    fetchCreatorTokensAndBondingStatus(creator).catch((error) => {
      console.error(`[TokenTracker] Error fetching tokens for creator ${creator}:`, error);
      // Remove from Set on error to allow retry
      fetchedCreatorWallets.delete(creator);
    });
  }

  const mint = createEventData.mint;

  // Cancel existing tracking job if any
  if (pendingTrackingJobs.has(mint)) {
    clearTimeout(pendingTrackingJobs.get(mint)!);
  }

  // Schedule data collection after delay
  const timeoutId = setTimeout(async () => {
    try {
      await collectAndSaveTokenData(createEventData, txSignature, devBuyTradeEvent);
    } catch (error) {
      console.error(`[TokenTracker] Error collecting data for ${mint}:`, error);
    } finally {
      pendingTrackingJobs.delete(mint);
    }
  }, COLLECTION_DELAY_MS);

  pendingTrackingJobs.set(mint, timeoutId);
}

/**
 * Get SOL USD price at a specific timestamp
 * Returns a fallback price if exact timestamp price is not available
 */
async function getSolPriceAtTime(timestamp: number): Promise<number | null> {
  try {
    // Get the closest price entry before or at the timestamp
    const results = await redis.zrevrangebyscore(
      SOL_PRICE_KEY,
      timestamp,
      '-inf',
      'LIMIT',
      0,
      1
    );

    if (results.length > 0) {
      const priceData = JSON.parse(results[0]);
      const price = priceData.price_usd;
      if (price != null && !isNaN(price) && isFinite(price) && price > 0) {
        return price;
      }
    }

    // Try to get any available price (fallback)
    const anyPrice = await redis.zrevrange(SOL_PRICE_KEY, 0, 0);
    if (anyPrice.length > 0) {
      const priceData = JSON.parse(anyPrice[0]);
      const price = priceData.price_usd;
      if (price != null && !isNaN(price) && isFinite(price) && price > 0) {
        return price;
      }
    }

    // Try to get a price from a wider range (within 1 minute)
    const oneMinuteAgo = timestamp - 60000;
    const oneMinuteLater = timestamp + 60000;
    const nearbyResults = await redis.zrangebyscore(
      SOL_PRICE_KEY,
      oneMinuteAgo,
      oneMinuteLater,
      'LIMIT',
      0,
      1
    );
    if (nearbyResults.length > 0) {
      const priceData = JSON.parse(nearbyResults[0]);
      const price = priceData.price_usd;
      if (price != null && !isNaN(price) && isFinite(price) && price > 0) {
        return price;
      }
    }

    return null;
  } catch (error) {
    console.error('[TokenTracker] Error getting SOL price:', error);
    return null;
  }
}

/**
 * Get trade events for a specific mint within a time window
 */
async function getTradeEventsForMint(
  mint: string,
  startTime: number,
  endTime: number
): Promise<Array<{ timestamp: number; data: TradeEventData; signature: string }>> {
  try {
    const events = await redis.zrangebyscore(EVENTS_SORTED_SET, startTime, endTime);
    
    const tradeEvents: Array<{ timestamp: number; data: TradeEventData; signature: string }> = [];
    
    for (const eventJson of events) {
      const event = JSON.parse(eventJson);
      
      // Check if it's a TradeEvent for our mint
      if (event.eventType === 'TradeEvent' && event.data?.mint === mint) {
        tradeEvents.push({
          timestamp: event.timestamp,
          data: event.data as TradeEventData,
          signature: event.signature,
        });
      }
    }
    
    // Sort by timestamp
    tradeEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    return tradeEvents;
  } catch (error) {
    console.error('[TokenTracker] Error getting trade events:', error);
    return [];
  }
}

/**
 * Calculate market cap from trade data
 * Returns null values if calculation is invalid (division by zero, etc.)
 */
function calculateMarketCap(
  tradeData: TradeEventData,
  solPriceUsd: number | null,
  tokenSupply: number = DEFAULT_TOKEN_SUPPLY
): { executionPriceSol: number; marketCapSol: number; marketCapUsd: number; solAmount: number; tokenAmount: number } | null {
  // Calculate execution price (SOL per token)
  // sol_amount and token_amount are in their base units
  const solAmount = tradeData.sol_amount / 1e9; // Convert lamports to SOL
  const tokenAmount = tradeData.token_amount / 1e6; // Convert to token units (assuming 6 decimals)
  
  // Validate inputs to prevent division by zero and invalid calculations
  if (tokenAmount === 0 || !isFinite(tokenAmount) || isNaN(tokenAmount)) {
    return null;
  }
  
  if (solAmount < 0 || !isFinite(solAmount) || isNaN(solAmount)) {
    return null;
  }
  
  const executionPriceSol = solAmount / tokenAmount;
  
  // Validate calculated price
  if (!isFinite(executionPriceSol) || isNaN(executionPriceSol) || executionPriceSol <= 0) {
    return null;
  }
  
  const marketCapSol = executionPriceSol * tokenSupply;
  
  // If SOL price is null, we can still calculate marketCapSol but not marketCapUsd
  let marketCapUsd = 0;
  if (solPriceUsd != null && solPriceUsd > 0 && isFinite(solPriceUsd)) {
    marketCapUsd = marketCapSol * solPriceUsd;
  }
  
  // Final validation
  if (!isFinite(marketCapSol) || isNaN(marketCapSol) || marketCapSol < 0) {
    return null;
  }
  
  if (solPriceUsd != null && (!isFinite(marketCapUsd) || isNaN(marketCapUsd) || marketCapUsd < 0)) {
    return null;
  }
  
  return { executionPriceSol, marketCapSol, marketCapUsd, solAmount, tokenAmount };
}

/**
 * Collect and save token data after the delay period
 * @param devBuyTradeEvent Optional TradeEvent from the same transaction (dev buy) - should be included as initial mcap
 */
async function collectAndSaveTokenData(
  createEventData: CreateEventData,
  createTxSignature: string,
  devBuyTradeEvent?: TradeEventData | null
): Promise<void> {
  const mint = createEventData.mint;
  const createdAt = createEventData.timestamp * 1000; // Convert to milliseconds
  
  // Define time window: first 15 seconds after creation
  const startTime = createdAt;
  const endTime = createdAt + DATA_WINDOW_MS;
  
  // Get trade events for this mint from Redis
  const tradeEvents = await getTradeEventsForMint(mint, startTime, endTime);
  
  // If dev buy exists, ensure it's included (it should be in Redis, but add it if missing)
  let devBuyIncluded = false;
  if (devBuyTradeEvent) {
    // Check if dev buy is already in the list (same signature)
    devBuyIncluded = tradeEvents.some(te => te.signature === createTxSignature);
    
    if (!devBuyIncluded) {
      // Add dev buy at the beginning (it's the first trade)
      const devBuyTimestamp = createdAt; // Dev buy happens at creation time
      tradeEvents.unshift({
        timestamp: devBuyTimestamp,
        data: devBuyTradeEvent,
        signature: createTxSignature,
      });
    }
  }
  
  // Build market cap time series
  const marketCapTimeSeries: MarketCapDataPoint[] = [];
  
  for (const trade of tradeEvents) {
    const solPriceUsd = await getSolPriceAtTime(trade.timestamp);
    
    // Convert token_total_supply from base units to human-readable (divide by 1e6 for 6 decimals)
    const tokenSupply = createEventData.token_total_supply 
      ? createEventData.token_total_supply / 1e6 
      : DEFAULT_TOKEN_SUPPLY;
    
    const marketCapResult = calculateMarketCap(
      trade.data,
      solPriceUsd,
      tokenSupply
    );
    
    // Skip invalid calculations
    if (marketCapResult === null) {
      continue;
    }
    
    const { executionPriceSol, marketCapSol, marketCapUsd, solAmount, tokenAmount } = marketCapResult;
    
    // Include trade even if SOL price is missing (marketCapUsd will be 0)
    // This prevents gaps in the timeseries
    marketCapTimeSeries.push({
      timestamp: trade.timestamp,
      executionPriceSol,
      marketCapSol,
      marketCapUsd: marketCapUsd || 0, // Use 0 if SOL price was missing
      solPriceUsd: solPriceUsd || 0, // Use 0 if SOL price was missing
      tradeType: trade.data.is_buy ? 'buy' : 'sell',
      signature: trade.signature,
      solAmount,
      tokenAmount,
    });
  }
  
  // Calculate summary stats
  const initialMarketCapUsd = marketCapTimeSeries.length > 0 
    ? marketCapTimeSeries[0].marketCapUsd 
    : null;
  
  const peakMarketCapUsd = marketCapTimeSeries.length > 0
    ? Math.max(...marketCapTimeSeries.map(d => d.marketCapUsd))
    : null;
  
  const finalMarketCapUsd = marketCapTimeSeries.length > 0
    ? marketCapTimeSeries[marketCapTimeSeries.length - 1].marketCapUsd
    : null;
  
  const result: TokenTrackingResult = {
    mint,
    name: createEventData.name,
    symbol: createEventData.symbol,
    creator: createEventData.creator || createEventData.user,
    bondingCurve: createEventData.bonding_curve,
    createdAt,
    marketCapTimeSeries,
    initialMarketCapUsd,
    peakMarketCapUsd,
    finalMarketCapUsd,
    tradeCount: marketCapTimeSeries.length,
  };
  
  // Save to database
  await saveTokenTrackingResult(result, createTxSignature);
}

/**
 * Save token tracking result to PostgreSQL
 */
async function saveTokenTrackingResult(
  result: TokenTrackingResult,
  createTxSignature: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO tbl_soltrack_created_tokens (
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
        trade_count_15s,
        is_fetched,
        bonded
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (mint) DO UPDATE SET
        market_cap_time_series = EXCLUDED.market_cap_time_series,
        initial_market_cap_usd = EXCLUDED.initial_market_cap_usd,
        peak_market_cap_usd = EXCLUDED.peak_market_cap_usd,
        final_market_cap_usd = EXCLUDED.final_market_cap_usd,
        trade_count_15s = EXCLUDED.trade_count_15s,
        is_fetched = COALESCE(EXCLUDED.is_fetched, tbl_soltrack_created_tokens.is_fetched),
        -- Don't update bonded field - it should only be set by migrate events or bonding tracker
        -- This preserves bonding status set by handleMigrateEvent or bonding tracker
        bonded = tbl_soltrack_created_tokens.bonded,
        -- Ensure ATH is at least as high as peak_market_cap_usd
        ath_market_cap_usd = GREATEST(
          COALESCE(tbl_soltrack_created_tokens.ath_market_cap_usd, 0),
          COALESCE(EXCLUDED.peak_market_cap_usd, 0)
        ),
        updated_at = NOW()`,
      [
        result.mint,
        result.name,
        result.symbol,
        result.creator,
        result.bondingCurve,
        new Date(result.createdAt),
        createTxSignature,
        JSON.stringify(result.marketCapTimeSeries),
        result.initialMarketCapUsd,
        result.peakMarketCapUsd,
        result.finalMarketCapUsd,
        result.tradeCount,
        false, // is_fetched = false (from streaming)
        false, // bonded = false (newly created tokens are not bonded)
      ]
    );
  } catch (error) {
    console.error('[TokenTracker] Error saving to database:', error);
    throw error;
  }
}

/**
 * Get tracking statistics
 */
export function getTrackingStats(): { pendingJobs: number; blacklistedWallets: number } {
  return {
    pendingJobs: pendingTrackingJobs.size,
    blacklistedWallets: blacklistedCreatorWallets.size,
  };
}

/**
 * Wait for all pending tracking jobs to complete
 * Used during graceful shutdown to ensure all 15-second monitoring completes
 */
export async function waitForPendingTrackingJobs(): Promise<void> {
  const MAX_WAIT_TIME_MS = 60000; // Maximum 60 seconds wait time
  const CHECK_INTERVAL_MS = 500; // Check every 500ms
  const startTime = Date.now();

  while (pendingTrackingJobs.size > 0) {
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= MAX_WAIT_TIME_MS) {
      console.warn(`[TokenTracker] Timeout waiting for ${pendingTrackingJobs.size} pending jobs. Proceeding with cleanup.`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
  }
}

/**
 * Cleanup pending tracking jobs (call on shutdown)
 */
export function cleanup(): void {
  for (const [, timeoutId] of pendingTrackingJobs) {
    clearTimeout(timeoutId);
  }
  pendingTrackingJobs.clear();
  
  // Clear fetched creator wallets set when stopping
  fetchedCreatorWallets.clear();
}

