/**
 * ATH (All-Time High) Market Cap Tracker Service
 * 
 * Tracks ATH market cap for tokens created by target creator wallets.
 * Handles real-time trade events and periodic Bitquery updates.
 */

import { pool } from '../db.js';
import { redis } from '../redis.js';
import { fetchAthMarketCap, type TokenAthData } from '../utils/bitquery.js';
import type { TradeEventData, AmmBuyEventData, AmmSellEventData } from '../types.js';

// Constants
const SAVE_INTERVAL_MS = 5000; // Save every 5 seconds
const SOL_PRICE_KEY = 'price:timeseries:So11111111111111111111111111111111111111112';
const EVENTS_SORTED_SET = 'pumpfun:events'; // Use same cache as tokenTracker
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
    return;
  }

  // Load existing tracked tokens from database
  await loadTrackedTokensFromDb();

  // Start periodic save
  startPeriodicSave();

  isInitialized = true;
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
              coalesce(bonded, 0) as bonded,
              coalesce(ath_market_cap_usd, 0) as ath_market_cap_usd
       FROM tbl_soltrack_tokens
       WHERE creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)`
    );

    for (const row of result.rows) {
      tokenAthMap.set(row.mint, {
        mint: row.mint,
        name: row.name || '',
        symbol: row.symbol || '',
        creator: row.creator,
        bonded: row.bonded === 1 || row.bonded === true,
        athMarketCapUsd: parseFloat(row.ath_market_cap_usd) || 0,
        currentMarketCapUsd: 0,
        lastUpdated: Date.now(),
        createdAt: new Date(row.created_at).getTime(),
        dirty: false,
      });
    }

  } catch (error: any) {
    // Handle case where columns don't exist yet (migration not run)
    // ClickHouse error codes differ from PostgreSQL
    if (error?.message && error.message.includes('Missing columns')) {
      console.warn('[AthTracker] ATH columns not found in database. Run migration first.');
      console.warn('[AthTracker] Falling back to basic query...');
      
      try {
        // Filtering logic: Fallback query also filters out blacklisted wallets
        const fallbackResult = await pool.query(
          `SELECT mint, name, symbol, creator, created_at
           FROM tbl_soltrack_tokens
           WHERE creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)`
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
      } catch (fallbackError) {
        console.error('[AthTracker] Fallback query also failed:', fallbackError);
      }
    } else {
      console.error('[AthTracker] Error loading tokens from database:', error);
    }
  }
}

/**
 * Fetch ATH for a list of tokens immediately
 * Used when tokens are fetched from Solscan for a new creator wallet
 */
export async function fetchAthForTokens(
  tokens: Array<{ mint: string; name: string; symbol: string; creator: string; blockTime: number }>
): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  try {
    // Find earliest block time for Bitquery query
    let earliestBlockTime = Math.floor(Date.now() / 1000);
    for (const token of tokens) {
      if (token.blockTime < earliestBlockTime) {
        earliestBlockTime = token.blockTime;
      }
    }

    // Subtract 1 day (86400 seconds) to account for timezone issues
    const ONE_DAY_SECONDS = 86400;
    const adjustedBlockTime = earliestBlockTime - ONE_DAY_SECONDS;
    const sinceTime = new Date(adjustedBlockTime * 1000).toISOString();

    // Process tokens in batches of 100
    const tokenAddresses = tokens.map(t => t.mint);
    console.log(`[AthTracker] Fetching ATH for ${tokenAddresses.length} tokens from Solscan since ${sinceTime}`);

    // Process in batches of 100
    for (let i = 0; i < tokenAddresses.length; i += 100) {
      const batch = tokenAddresses.slice(i, i + 100);
      console.log(`[AthTracker] Processing batch ${Math.floor(i / 100) + 1}: ${batch.length} tokens`);
      
      let athDataList: TokenAthData[] = [];
      try {
        athDataList = await fetchAthMarketCap(batch, sinceTime);
        console.log(`[AthTracker] Received ${athDataList.length} ATH results from Bitquery for this batch`);
      } catch (error) {
        console.error(`[AthTracker] Error fetching ATH from Bitquery for batch ${Math.floor(i / 100) + 1}:`, error);
        // Continue processing with empty results - will use peak_market_cap_usd as fallback
        athDataList = [];
      }

      // Create a map of results for quick lookup
      const resultMap = new Map<string, TokenAthData>();
      for (const athData of athDataList) {
        resultMap.set(athData.mintAddress, athData);
      }

      // Get peak_market_cap_usd for tokens in this batch to ensure ATH >= peak
      const peakMcapMap = new Map<string, number>();
      try {
        const peakResult = await pool.query(
          `SELECT mint, peak_market_cap_usd 
           FROM tbl_soltrack_tokens 
           WHERE mint = ANY($1) AND peak_market_cap_usd IS NOT NULL`,
          [batch]
        );
        for (const row of peakResult.rows) {
          peakMcapMap.set(row.mint, parseFloat(row.peak_market_cap_usd) || 0);
        }
      } catch (error) {
        console.error(`[AthTracker] Error fetching peak market cap for batch:`, error);
      }

      // Update token map and database with ATH data
      let updatedCount = 0;
      for (const mint of batch) {
        const athData = resultMap.get(mint);
        const existing = tokenAthMap.get(mint);
        const tokenInfo = tokens.find(t => t.mint === mint);
        const peakMcap = peakMcapMap.get(mint) || 0;

        if (existing) {
          if (athData) {
            // Ensure ATH is at least as high as peak_market_cap_usd
            const effectiveAth = Math.max(athData.athMarketCapUsd, peakMcap);
            // Only update if effective ATH is higher than current (or if current is 0 and we have data)
            if (effectiveAth >= existing.athMarketCapUsd && effectiveAth > 0) {
              const oldAth = existing.athMarketCapUsd;
              existing.athMarketCapUsd = effectiveAth;
              existing.dirty = true;
              updatedCount++;
              
              // Log ATH update with debugging information
              console.log(`[AthTracker] ATH UPDATE - fetchAthForTokens (Bitquery)`, {
                source: 'Bitquery batch fetch',
                mint,
                symbol: athData.symbol || existing.symbol,
                name: athData.name || existing.name,
                creator: existing.creator,
                oldAth: `$${oldAth.toFixed(2)}`,
                newAth: `$${effectiveAth.toFixed(2)}`,
                increase: `$${(effectiveAth - oldAth).toFixed(2)}`,
                increasePercent: oldAth > 0 ? `${((effectiveAth / oldAth - 1) * 100).toFixed(2)}%` : 'N/A',
                bitqueryAth: `$${athData.athMarketCapUsd.toFixed(2)}`,
                peakMcap: `$${peakMcap.toFixed(2)}`,
                usedPeak: peakMcap > athData.athMarketCapUsd,
                startingMarketCap: athData.startingMarketCapUsd ? `$${athData.startingMarketCapUsd.toFixed(2)}` : 'N/A',
                batchNumber: Math.floor(i / 100) + 1,
              });
            }
            // Update name/symbol if missing
            if (!existing.name && athData.name) existing.name = athData.name;
            if (!existing.symbol && athData.symbol) existing.symbol = athData.symbol;
          } else if (peakMcap > 0) {
            // No Bitquery data, but we have peak - use it as minimum ATH
            if (peakMcap > existing.athMarketCapUsd) {
              const oldAth = existing.athMarketCapUsd;
              existing.athMarketCapUsd = peakMcap;
              existing.dirty = true;
              updatedCount++;
              
              // Log ATH update with debugging information
              console.log(`[AthTracker] ATH UPDATE - fetchAthForTokens (Peak fallback)`, {
                source: 'Peak market cap fallback (no Bitquery data)',
                mint,
                symbol: existing.symbol,
                name: existing.name,
                creator: existing.creator,
                oldAth: `$${oldAth.toFixed(2)}`,
                newAth: `$${peakMcap.toFixed(2)}`,
                increase: `$${(peakMcap - oldAth).toFixed(2)}`,
                increasePercent: oldAth > 0 ? `${((peakMcap / oldAth - 1) * 100).toFixed(2)}%` : 'N/A',
                batchNumber: Math.floor(i / 100) + 1,
              });
            }
          }
        } else if (tokenInfo) {
          // Token not in map yet, add it
          // Use peak_market_cap_usd as minimum if Bitquery data is missing or lower
          const effectiveAth = Math.max(athData?.athMarketCapUsd || 0, peakMcap);
          tokenAthMap.set(mint, {
            mint,
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            creator: tokenInfo.creator,
            bonded: false,
            athMarketCapUsd: effectiveAth,
            currentMarketCapUsd: 0,
            lastUpdated: Date.now(),
            createdAt: tokenInfo.blockTime * 1000,
            dirty: true,
          });
          if (effectiveAth > 0) {
            updatedCount++;
            console.log(`[AthTracker] Added ATH for ${mint} (${tokenInfo.symbol}): $${effectiveAth.toFixed(2)}${peakMcap > (athData?.athMarketCapUsd || 0) ? ` (using peak)` : ''}`);
          }
        }

        // Update database directly - ensure ATH is at least as high as peak_market_cap_usd
        const effectiveAth = Math.max(athData?.athMarketCapUsd || 0, peakMcap);
        const startingMarketCap = athData?.startingMarketCapUsd || 0;
        if (effectiveAth > 0 || startingMarketCap > 0) {
          try {
            if (startingMarketCap > 0) {
              console.log(`[AthTracker] Updating initial_market_cap_usd for ${mint} (${athData?.symbol || 'unknown'}): $${startingMarketCap.toFixed(2)}`);
            }
            // ClickHouse: Use ALTER TABLE UPDATE
            await pool.query(
              `ALTER TABLE tbl_soltrack_tokens 
               UPDATE ath_market_cap_usd = greatest(
                 $1, 
                 coalesce(ath_market_cap_usd, 0),
                 coalesce(peak_market_cap_usd, 0)
               ),
                   initial_market_cap_usd = CASE 
                     WHEN $3 > 0 THEN $3 
                     ELSE initial_market_cap_usd
                   END,
                   updated_at = now()
               WHERE mint = $2`,
              [effectiveAth, mint, startingMarketCap]
            );
          } catch (error) {
            console.error(`[AthTracker] Error updating ATH in database for ${mint}:`, error);
          }
        } else if (peakMcap > 0) {
          // No Bitquery data but we have peak - update ATH with peak
          try {
            // ClickHouse: Use ALTER TABLE UPDATE
            await pool.query(
              `ALTER TABLE tbl_soltrack_tokens 
               UPDATE ath_market_cap_usd = greatest(
                 $1, 
                 coalesce(ath_market_cap_usd, 0)
               ),
                   updated_at = now()
               WHERE mint = $2`,
              [peakMcap, mint]
            );
          } catch (error) {
            console.error(`[AthTracker] Error updating ATH with peak for ${mint}:`, error);
          }
        }
      }

      console.log(`[AthTracker] Updated ${updatedCount} tokens with ATH data in this batch`);

      // Ensure all tokens in batch have ATH >= peak_market_cap_usd (even if Bitquery failed)
      try {
        // ClickHouse: Use ALTER TABLE UPDATE
        await pool.query(
          `ALTER TABLE tbl_soltrack_tokens 
           UPDATE ath_market_cap_usd = greatest(
             coalesce(ath_market_cap_usd, 0),
             coalesce(peak_market_cap_usd, 0)
           ),
               updated_at = now()
           WHERE mint = ANY($1) 
             AND peak_market_cap_usd IS NOT NULL 
             AND (ath_market_cap_usd IS NULL OR ath_market_cap_usd < peak_market_cap_usd)`,
          [batch]
        );
      } catch (error) {
        console.error(`[AthTracker] Error ensuring ATH >= peak for batch:`, error);
      }

      // Small delay between batches to avoid rate limiting
      if (i + 100 < tokenAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[AthTracker] Completed fetching ATH for all ${tokenAddresses.length} tokens`);
  } catch (error) {
    console.error('[AthTracker] Error fetching ATH for tokens:', error);
    throw error;
  }
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
    return;
  }

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

  // Note: Token data is already cached in Redis by storeTransactionEvent (pumpfun:events:5min)
  // ATH fetching for real-time tokens is handled separately via trade events
}


/**
 * Check if a wallet is blacklisted
 * 
 * Filtering logic: Queries the tbl_soltrack_blacklist_creator table to determine if the given wallet
 * address is blacklisted. Returns true if the wallet exists in the blacklist.
 */
async function isBlacklistedCreatorWallet(walletAddress: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM tbl_soltrack_blacklist_creator WHERE wallet_address = $1 LIMIT 1',
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
  txSignature: string
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
    const oldAth = tokenInfo.athMarketCapUsd;
    tokenInfo.athMarketCapUsd = currentMarketCapUsd;
    tokenInfo.dirty = true;
    
    // Log ATH update with transaction ID and debugging information
    console.log(`[AthTracker] ATH UPDATE - TradeEvent`, {
      transactionId: txSignature,
      mint,
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      creator: tokenInfo.creator,
      oldAth: `$${oldAth.toFixed(2)}`,
      newAth: `$${currentMarketCapUsd.toFixed(2)}`,
      increase: `$${(currentMarketCapUsd - oldAth).toFixed(2)}`,
      increasePercent: `${((currentMarketCapUsd / oldAth - 1) * 100).toFixed(2)}%`,
      solAmount: tradeData.sol_amount / 1e9,
      tokenAmount: tradeData.token_amount / 1e6,
      isBuy: tradeData.is_buy,
      solPriceUsd: `$${solPriceUsd.toFixed(2)}`,
      timestamp: new Date(tradeData.timestamp * 1000).toISOString(),
    });
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
  txSignature: string
): Promise<void> {
  let tokenInfo: TokenAthInfo | undefined = tokenAthMap.get(mint);
  
  if (!tokenInfo) {
    tokenInfo = await checkPendingToken(mint);
    if (!tokenInfo) return;
  }

  const solPriceUsd = await getSolPriceUsd();
  if (solPriceUsd === 0) return;

  // Calculate execution price from the actual trade amounts
  const quoteAmountIn = buyData.quote_amount_in / 1e9; // SOL paid
  const baseAmountOut = buyData.base_amount_out / 1e6; // Tokens received
  
  if (baseAmountOut === 0) return;
  
  // Execution price = SOL paid / tokens received
  const priceSol = quoteAmountIn / baseAmountOut;
  const currentMarketCapUsd = priceSol * TOKEN_SUPPLY * solPriceUsd;

  if (currentMarketCapUsd > tokenInfo.athMarketCapUsd) {
    const oldAth = tokenInfo.athMarketCapUsd;
    tokenInfo.athMarketCapUsd = currentMarketCapUsd;
    tokenInfo.dirty = true;
    
    // Log ATH update with transaction ID and debugging information
    console.log(`[AthTracker] ATH UPDATE - AMM BuyEvent`, {
      transactionId: txSignature,
      mint,
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      creator: tokenInfo.creator,
      oldAth: `$${oldAth.toFixed(2)}`,
      newAth: `$${currentMarketCapUsd.toFixed(2)}`,
      increase: `$${(currentMarketCapUsd - oldAth).toFixed(2)}`,
      increasePercent: `${((currentMarketCapUsd / oldAth - 1) * 100).toFixed(2)}%`,
      executionPrice: `${priceSol.toFixed(8)} SOL/token`,
      quoteAmountIn: `${quoteAmountIn.toFixed(4)} SOL`,
      baseAmountOut: `${baseAmountOut.toFixed(2)} tokens`,
      poolQuoteReserves: `${(buyData.pool_quote_token_reserves / 1e9).toFixed(4)} SOL`,
      poolBaseReserves: `${(buyData.pool_base_token_reserves / 1e6).toFixed(2)} tokens`,
      solPriceUsd: `$${solPriceUsd.toFixed(2)}`,
      timestamp: new Date(buyData.timestamp * 1000).toISOString(),
    });
  }

  // Note: Bonding status should be managed by bonding tracker, not ATH tracker
  // AMM events indicate bonding, but we let bonding tracker handle that via migrate events

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
  txSignature: string
): Promise<void> {
  let tokenInfo: TokenAthInfo | undefined = tokenAthMap.get(mint);
  
  if (!tokenInfo) {
    tokenInfo = await checkPendingToken(mint);
    if (!tokenInfo) return;
  }

  const solPriceUsd = await getSolPriceUsd();
  if (solPriceUsd === 0) return;

  // Calculate execution price from the actual trade amounts
  const baseAmountIn = sellData.base_amount_in / 1e6; // Tokens paid
  const quoteAmountOut = sellData.quote_amount_out / 1e9; // SOL received
  
  if (baseAmountIn === 0) return;
  
  // Execution price = SOL received / tokens paid
  const priceSol = quoteAmountOut / baseAmountIn;
  const currentMarketCapUsd = priceSol * TOKEN_SUPPLY * solPriceUsd;

  if (currentMarketCapUsd > tokenInfo.athMarketCapUsd) {
    const oldAth = tokenInfo.athMarketCapUsd;
    tokenInfo.athMarketCapUsd = currentMarketCapUsd;
    tokenInfo.dirty = true;
    
    // Log ATH update with transaction ID and debugging information
    console.log(`[AthTracker] ATH UPDATE - AMM SellEvent`, {
      transactionId: txSignature,
      mint,
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      creator: tokenInfo.creator,
      oldAth: `$${oldAth.toFixed(2)}`,
      newAth: `$${currentMarketCapUsd.toFixed(2)}`,
      increase: `$${(currentMarketCapUsd - oldAth).toFixed(2)}`,
      increasePercent: `${((currentMarketCapUsd / oldAth - 1) * 100).toFixed(2)}%`,
      executionPrice: `${priceSol.toFixed(8)} SOL/token`,
      baseAmountIn: `${baseAmountIn.toFixed(2)} tokens`,
      quoteAmountOut: `${quoteAmountOut.toFixed(4)} SOL`,
      poolQuoteReserves: `${(sellData.pool_quote_token_reserves / 1e9).toFixed(4)} SOL`,
      poolBaseReserves: `${(sellData.pool_base_token_reserves / 1e6).toFixed(2)} tokens`,
      solPriceUsd: `$${solPriceUsd.toFixed(2)}`,
      timestamp: new Date(sellData.timestamp * 1000).toISOString(),
    });
  }

  // Note: Bonding status should be managed by bonding tracker, not ATH tracker
  // AMM events indicate bonding, but we let bonding tracker handle that via migrate events

  tokenInfo.currentMarketCapUsd = currentMarketCapUsd;
  tokenInfo.lastUpdated = Date.now();
  tokenAthMap.set(mint, tokenInfo);
}

/**
 * Check Redis cache for pending token (edge case handling)
 * Uses the same events cache as tokenTracker (pumpfun:events:5min)
 */
async function checkPendingToken(mint: string): Promise<TokenAthInfo | undefined> {
  try {
    // Query the events sorted set for CreateEvent with this mint
    const fiveMinutesAgo = Date.now() - 300000; // 5 minutes
    const events = await redis.zrangebyscore(EVENTS_SORTED_SET, fiveMinutesAgo, '+inf');
    
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
      const oldAth = tokenInfo.athMarketCapUsd;
      tokenInfo.athMarketCapUsd = athData.athMarketCapUsd;
      tokenInfo.lastUpdated = Date.now();
      tokenInfo.dirty = true;
      
      // Log ATH update with debugging information
      console.log(`[AthTracker] ATH UPDATE - External Source (Bitquery)`, {
        source: 'Bitquery',
        mint: athData.mintAddress,
        symbol: tokenInfo.symbol || athData.symbol,
        name: tokenInfo.name || athData.name,
        creator: tokenInfo.creator,
        oldAth: `$${oldAth.toFixed(2)}`,
        newAth: `$${athData.athMarketCapUsd.toFixed(2)}`,
        increase: `$${(athData.athMarketCapUsd - oldAth).toFixed(2)}`,
        increasePercent: `${((athData.athMarketCapUsd / oldAth - 1) * 100).toFixed(2)}%`,
        startingMarketCap: athData.startingMarketCapUsd ? `$${athData.startingMarketCapUsd.toFixed(2)}` : 'N/A',
      });
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
        console.log(`[AthTracker] Saving token ${token.mint} to database (ATH: $${token.athMarketCapUsd.toFixed(2)})`);
        
        // ClickHouse: Use ReplacingMergeTree pattern (insert with version)
        // First, get current values to preserve them
        const currentResult = await pool.query(
          'SELECT name, symbol, is_fetched, ath_market_cap_usd, peak_market_cap_usd FROM tbl_soltrack_tokens WHERE mint = $1 ORDER BY version DESC LIMIT 1',
          [token.mint]
        );
        
        const current = currentResult.rows[0];
        const preservedName = current?.name || token.name;
        const preservedSymbol = current?.symbol || token.symbol;
        const preservedIsFetched = current?.is_fetched !== undefined ? current.is_fetched : 0;
        const currentAth = current?.ath_market_cap_usd ? parseFloat(current.ath_market_cap_usd) : 0;
        const currentPeak = current?.peak_market_cap_usd ? parseFloat(current.peak_market_cap_usd) : 0;
        const newAth = Math.max(token.athMarketCapUsd, currentAth, currentPeak);
        
        await pool.query(
          `INSERT INTO tbl_soltrack_tokens (mint, name, symbol, creator, ath_market_cap_usd, created_at, is_fetched, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now64())`,
          [
            token.mint,
            preservedName,
            preservedSymbol,
            token.creator,
            newAth,
            new Date(token.createdAt),
            preservedIsFetched,
          ]
        );
        
      } else {
        // Fallback: save without ATH columns
        // ClickHouse: Use ReplacingMergeTree pattern
        const currentResult = await pool.query(
          'SELECT name, symbol, is_fetched FROM tbl_soltrack_tokens WHERE mint = $1 ORDER BY version DESC LIMIT 1',
          [token.mint]
        );
        
        const current = currentResult.rows[0];
        const preservedName = current?.name || token.name;
        const preservedSymbol = current?.symbol || token.symbol;
        const preservedIsFetched = current?.is_fetched !== undefined ? current.is_fetched : 0;
        
        await pool.query(
          `INSERT INTO tbl_soltrack_tokens (mint, name, symbol, creator, created_at, is_fetched, version)
           VALUES ($1, $2, $3, $4, $5, $6, now64())`,
          [
            token.mint,
            preservedName,
            preservedSymbol,
            token.creator,
            new Date(token.createdAt),
            preservedIsFetched,
          ]
        );
      }
      
      token.dirty = false;
    } catch (error: any) {
      // Check if error is due to missing columns (ClickHouse error format)
      if (error?.message && error.message.includes('Missing columns') && athColumnsExist) {
        console.warn('[AthTracker] ATH columns not found. Run migration! Falling back to basic save...');
        athColumnsExist = false;
        
        // Retry with fallback query
        try {
          // ClickHouse: Use ReplacingMergeTree pattern
          const currentResult = await pool.query(
            'SELECT name, symbol, is_fetched FROM tbl_soltrack_tokens WHERE mint = $1 ORDER BY version DESC LIMIT 1',
            [token.mint]
          );
          
          const current = currentResult.rows[0];
          const preservedName = current?.name || token.name;
          const preservedSymbol = current?.symbol || token.symbol;
          const preservedIsFetched = current?.is_fetched !== undefined ? current.is_fetched : 0;
          
          await pool.query(
            `INSERT INTO tbl_soltrack_tokens (mint, name, symbol, creator, created_at, is_fetched, version)
             VALUES ($1, $2, $3, $4, $5, $6, now64())`,
            [
              token.mint,
              preservedName,
              preservedSymbol,
              token.creator,
              new Date(token.createdAt),
              preservedIsFetched,
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
       FROM tbl_soltrack_tokens
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

    // Fetch ATH from Bitquery (limit to 100 tokens per call)
    const limitedTokenAddresses = tokenAddresses.slice(0, 100);
    const athDataList = await fetchAthMarketCap(limitedTokenAddresses, sinceTime);

    console.log(`[AthTracker] Received ATH data for ${athDataList.length} tokens from Bitquery`);

      // Update database with ATH data (only if higher than current)
      let updatedCount = 0;
      for (const athData of athDataList) {
        const tokenInfo = tokenDataMap.get(athData.mintAddress);
        const startingMarketCap = athData.startingMarketCapUsd || 0;
        if (tokenInfo && athData.athMarketCapUsd > tokenInfo.currentAth) {
          try {
            const oldAth = tokenInfo.currentAth;
            // ClickHouse: Use ALTER TABLE UPDATE
            await pool.query(
              `ALTER TABLE tbl_soltrack_tokens 
               UPDATE ath_market_cap_usd = greatest(
                 $1, 
                 coalesce(ath_market_cap_usd, 0),
                 coalesce(peak_market_cap_usd, 0)
               ),
                   initial_market_cap_usd = CASE 
                     WHEN $3 > 0 THEN $3 
                     ELSE initial_market_cap_usd
                   END,
                   updated_at = now()
               WHERE mint = $2`,
              [athData.athMarketCapUsd, athData.mintAddress, startingMarketCap]
            );
            updatedCount++;
            
            // Log ATH update with debugging information
            console.log(`[AthTracker] ATH UPDATE - updateAthMcapForCreator (Bitquery)`, {
              source: 'Bitquery creator update',
              mint: athData.mintAddress,
              symbol: athData.symbol || tokenInfo.symbol,
              name: tokenInfo.name,
              creator: creatorAddress,
              oldAth: `$${oldAth.toFixed(2)}`,
              newAth: `$${athData.athMarketCapUsd.toFixed(2)}`,
              increase: `$${(athData.athMarketCapUsd - oldAth).toFixed(2)}`,
              increasePercent: oldAth > 0 ? `${((athData.athMarketCapUsd / oldAth - 1) * 100).toFixed(2)}%` : 'N/A',
              startingMarketCap: startingMarketCap > 0 ? `$${startingMarketCap.toFixed(2)}` : 'N/A',
            });
          } catch (error) {
            console.error(`[AthTracker] Error updating ATH for ${athData.mintAddress}:`, error);
          }
        } else if (tokenInfo && startingMarketCap > 0) {
        // ATH didn't change, but we might have starting market cap to update
        try {
          console.log(`[AthTracker] Updating initial_market_cap_usd for ${athData.mintAddress} (${athData.symbol || 'unknown'}): $${startingMarketCap.toFixed(2)}`);
          // ClickHouse: Use ALTER TABLE UPDATE
          await pool.query(
            `ALTER TABLE tbl_soltrack_tokens 
             UPDATE initial_market_cap_usd = $1,
                 updated_at = now()
             WHERE mint = $2`,
            [startingMarketCap, athData.mintAddress]
          );
        } catch (error) {
          console.error(`[AthTracker] Error updating initial market cap for ${athData.mintAddress}:`, error);
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

  // No pending queue to process - tokens are fetched immediately when fetched from Solscan

  // Final save
  await saveAthDataToDb();
  
  isInitialized = false;
  console.log('[AthTracker] Cleanup complete');
}

