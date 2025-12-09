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

// Constants
const COLLECTION_DELAY_MS = 20000; // Wait 20 seconds before collecting data
const DATA_WINDOW_MS = 15000; // Collect 15 seconds of data
const SOL_PRICE_KEY = 'price:timeseries:So11111111111111111111111111111111111111112';
const EVENTS_SORTED_SET = 'pumpfun:events:1min';

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
  console.log(`[TokenTracker] Initialized with ${blacklistedCreatorWallets.size} blacklisted wallets`);
}

/**
 * Refresh blacklisted creator wallets from the database
 * 
 * This function loads all blacklisted creator wallet addresses from the creator_wallets table
 * and stores them in memory for fast filtering. Tokens created by these wallets will NOT
 * be tracked for market cap data collection.
 */
export async function refreshBlacklistedWallets(): Promise<void> {
  try {
    // Load all blacklisted creator wallet addresses from database
    const result = await pool.query(
      'SELECT DISTINCT wallet_address FROM creator_wallets'
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
    console.log(`[TokenTracker] Fetching tokens for creator: ${creatorAddress}`);
    
    // Fetch latest 100 tokens created by this wallet from Solscan
    const response = await getCreatedTokens(creatorAddress) as any;
    
    if (!response?.data || !Array.isArray(response.data)) {
      console.log(`[TokenTracker] No tokens found for creator: ${creatorAddress}`);
      return;
    }
    
    const tokenMintsSet = new Set<string>();
    const tokenDataMap = new Map<string, { name: string; symbol: string; blockTime: number }>();
    const MAX_TOKENS = 100; // Limit to 100 tokens as per requirements
    
    // Extract token mints from the response (limit to 100)
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
    
    const tokenMints = Array.from(tokenMintsSet);
    
    if (tokenMints.length === 0) {
      console.log(`[TokenTracker] No valid tokens found for creator: ${creatorAddress}`);
      return;
    }
    
    console.log(`[TokenTracker] Found ${tokenMints.length} tokens for creator ${creatorAddress} (limited to ${MAX_TOKENS})`);
    
    // Fetch bonding status for all tokens using Shyft GraphQL API
    const bondingStatusMap = await fetchBondingStatusBatch(tokenMints);
    
    // Save tokens to database
    for (const mint of tokenMints) {
      const tokenData = tokenDataMap.get(mint);
      const isBonded = bondingStatusMap.get(mint) || false;
      
      if (tokenData) {
        try {
          await pool.query(
            `INSERT INTO created_tokens (mint, name, symbol, creator, bonded, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (mint) DO UPDATE SET
               name = COALESCE(EXCLUDED.name, created_tokens.name),
               symbol = COALESCE(EXCLUDED.symbol, created_tokens.symbol),
               bonded = EXCLUDED.bonded,
               updated_at = NOW()`,
            [
              mint,
              tokenData.name,
              tokenData.symbol,
              creatorAddress,
              isBonded,
              new Date(tokenData.blockTime * 1000),
            ]
          );
        } catch (error) {
          console.error(`[TokenTracker] Error saving token ${mint} to database:`, error);
        }
      }
    }
    
    console.log(`[TokenTracker] Completed fetching tokens for creator ${creatorAddress}: ${tokenMints.length} tokens, ${Array.from(bondingStatusMap.values()).filter(b => b).length} bonded`);
  } catch (error) {
    console.error(`[TokenTracker] Error fetching creator tokens and bonding status:`, error);
    throw error;
  }
}

/**
 * Handle a CreateEvent - schedule tracking if NOT from a blacklisted wallet
 * Also fetches latest 100 tokens by the same creator if not already fetched
 */
export async function handleCreateEvent(
  createEventData: CreateEventData,
  txSignature: string
): Promise<void> {
  const creator = createEventData.creator || createEventData.user;
  
  // Filtering logic: Skip tokens created by blacklisted wallets.
  // If the creator wallet is in the blacklist, skip tracking this token.
  if (isBlacklistedCreator(creator)) {
    console.log(`[TokenTracker] Skipping token from blacklisted creator: ${creator}`);
    return;
  }

  // Check if this creator wallet has been fetched in this streaming cycle
  // If not, fetch latest 100 tokens created by this creator
  if (!fetchedCreatorWallets.has(creator)) {
    console.log(`[TokenTracker] New creator wallet detected: ${creator}, fetching latest 100 tokens...`);
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
  console.log(`[TokenTracker] Creator ${creator} created token: ${mint}`);
  console.log(`[TokenTracker] Token: ${createEventData.name} (${createEventData.symbol})`);
  console.log(`[TokenTracker] Scheduling data collection in ${COLLECTION_DELAY_MS / 1000} seconds...`);

  // Cancel existing tracking job if any
  if (pendingTrackingJobs.has(mint)) {
    clearTimeout(pendingTrackingJobs.get(mint)!);
  }

  // Schedule data collection after delay
  const timeoutId = setTimeout(async () => {
    try {
      await collectAndSaveTokenData(createEventData, txSignature);
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

    if (results.length === 0) {
      // Try to get any available price
      const anyPrice = await redis.zrevrange(SOL_PRICE_KEY, 0, 0);
      if (anyPrice.length > 0) {
        const priceData = JSON.parse(anyPrice[0]);
        return priceData.price_usd;
      }
      return null;
    }

    const priceData = JSON.parse(results[0]);
    return priceData.price_usd;
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
 */
function calculateMarketCap(
  tradeData: TradeEventData,
  solPriceUsd: number,
  tokenSupply: number = DEFAULT_TOKEN_SUPPLY
): { executionPriceSol: number; marketCapSol: number; marketCapUsd: number } {
  // Calculate execution price (SOL per token)
  // sol_amount and token_amount are in their base units
  const solAmount = tradeData.sol_amount / 1e9; // Convert lamports to SOL
  const tokenAmount = tradeData.token_amount / 1e6; // Convert to token units (assuming 6 decimals)
  
  const executionPriceSol = solAmount / tokenAmount;
  const marketCapSol = executionPriceSol * tokenSupply;
  const marketCapUsd = marketCapSol * solPriceUsd;
  
  return { executionPriceSol, marketCapSol, marketCapUsd };
}

/**
 * Collect and save token data after the delay period
 */
async function collectAndSaveTokenData(
  createEventData: CreateEventData,
  createTxSignature: string
): Promise<void> {
  const mint = createEventData.mint;
  const createdAt = createEventData.timestamp * 1000; // Convert to milliseconds
  
  console.log(`[TokenTracker] Collecting market cap data for ${mint}...`);
  
  // Define time window: first 15 seconds after creation
  const startTime = createdAt;
  const endTime = createdAt + DATA_WINDOW_MS;
  
  // Get trade events for this mint
  const tradeEvents = await getTradeEventsForMint(mint, startTime, endTime);
  
  console.log(`[TokenTracker] Found ${tradeEvents.length} trades in the first 15 seconds`);
  
  // Build market cap time series
  const marketCapTimeSeries: MarketCapDataPoint[] = [];
  
  for (const trade of tradeEvents) {
    const solPriceUsd = await getSolPriceAtTime(trade.timestamp);
    
    if (solPriceUsd === null) {
      console.warn(`[TokenTracker] Could not get SOL price for timestamp ${trade.timestamp}`);
      continue;
    }
    
    // Convert token_total_supply from base units to human-readable (divide by 1e6 for 6 decimals)
    const tokenSupply = createEventData.token_total_supply 
      ? createEventData.token_total_supply / 1e6 
      : DEFAULT_TOKEN_SUPPLY;
    
    const { executionPriceSol, marketCapSol, marketCapUsd } = calculateMarketCap(
      trade.data,
      solPriceUsd,
      tokenSupply
    );
    
    marketCapTimeSeries.push({
      timestamp: trade.timestamp,
      executionPriceSol,
      marketCapSol,
      marketCapUsd,
      solPriceUsd,
      tradeType: trade.data.is_buy ? 'buy' : 'sell',
      signature: trade.signature,
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
  
  console.log(`[TokenTracker] Saved tracking data for ${mint}`);
  console.log(`[TokenTracker] Initial: $${initialMarketCapUsd?.toFixed(2) || 'N/A'}, Peak: $${peakMarketCapUsd?.toFixed(2) || 'N/A'}, Final: $${finalMarketCapUsd?.toFixed(2) || 'N/A'}`);
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
      `INSERT INTO created_tokens (
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
        trade_count_15s
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (mint) DO UPDATE SET
        market_cap_time_series = EXCLUDED.market_cap_time_series,
        initial_market_cap_usd = EXCLUDED.initial_market_cap_usd,
        peak_market_cap_usd = EXCLUDED.peak_market_cap_usd,
        final_market_cap_usd = EXCLUDED.final_market_cap_usd,
        trade_count_15s = EXCLUDED.trade_count_15s,
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
 * Cleanup pending tracking jobs (call on shutdown)
 */
export function cleanup(): void {
  for (const [mint, timeoutId] of pendingTrackingJobs) {
    clearTimeout(timeoutId);
    console.log(`[TokenTracker] Cancelled pending tracking for ${mint}`);
  }
  pendingTrackingJobs.clear();
  
  // Clear fetched creator wallets set when stopping
  fetchedCreatorWallets.clear();
}

