import dotenv from 'dotenv';
import { Parser, TransactionStreamer } from '@shyft-to/ladybug-sdk';
import { Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import pumpIdl from '../IdlFiles/pump_0.1.0.json' with { type: 'json' };
import pumpAmmIdl from '../IdlFiles/pump_amm_0.1.0.json' with { type: 'json' };
import { storeTransactionEvent, type EventType } from '../redis.js';
import { handleCreateEvent, initializeTokenTracker, cleanup as cleanupTokenTracker, waitForPendingTrackingJobs, isBlacklistedCreator } from '../services/tokenTracker.js';
import { 
  initializeAthTracker, 
  cleanupAthTracker, 
  registerToken as registerTokenForAth,
  handleTradeEvent,
  handleAmmBuyEvent,
  handleAmmSellEvent
} from '../services/athTracker.js';
import {
  initializeBondingTracker,
  cleanupBondingTracker,
  handleMigrateEvent
} from '../services/bondingTracker.js';
import type { CreateEventData, TradeEventData, AmmBuyEventData, AmmSellEventData } from '../types.js';

dotenv.config();

const ADDRESSES_TO_STREAM_FROM = [
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // PumpFun Program
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // PumpFun AMM Program
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM", // PumpFun Mint Authority
];

// Stream control state
let isStreaming = false;
let isStopping = false; // Flag to indicate graceful shutdown in progress
let txnStreamer: TransactionStreamer | null = null;

// In-memory pool -> mint mapping (for buy/sell events)
// This maps pool addresses to base_mint addresses
const poolToMintMap: Map<string, string> = new Map();

/**
 * Get mint address from pool address
 */
export function getMintFromPool(poolAddress: string): string | null {
  return poolToMintMap.get(poolAddress) || null;
}

/**
 * Store pool -> mint mapping
 */
export function setPoolToMintMapping(poolAddress: string, mintAddress: string): void {
  poolToMintMap.set(poolAddress, mintAddress);
}

/**
 * Extract mint address from AMM event
 * AMM events don't have mint directly, need to extract from transaction accounts
 */
function extractMintFromAmmEvent(processed: any, event: any): string | null {
  try {
    // Try to get from pool field and look up in accounts
    const pool = event?.data?.pool;
    if (!pool) return null;
    
    // The mint is typically in the transaction accounts
    // Look for a token mint that's not SOL
    const accounts = processed?.transaction?.message?.accountKeys || [];
    for (const account of accounts) {
      const pubkey = account?.pubkey || account;
      if (typeof pubkey === 'string' && 
          pubkey.endsWith('pump') && 
          pubkey !== 'So11111111111111111111111111111111111111112') {
        return pubkey;
      }
    }
    
    // Fallback: check static accounts
    const staticAccounts = processed?.transaction?.message?.staticAccountKeys || [];
    for (const pubkey of staticAccounts) {
      if (typeof pubkey === 'string' && 
          pubkey.endsWith('pump') && 
          pubkey !== 'So11111111111111111111111111111111111111112') {
        return pubkey;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract mint address from transaction (for migrate detection)
 * Looks for token mint addresses in transaction accounts
 */
function extractMintFromTransaction(processed: any): string | null {
  try {
    // Check accountKeys
    const accounts = processed?.transaction?.message?.accountKeys || [];
    for (const account of accounts) {
      const pubkey = account?.pubkey || account;
      if (typeof pubkey === 'string' && 
          pubkey.endsWith('pump') && 
          pubkey !== 'So11111111111111111111111111111111111111112') {
        return pubkey;
      }
    }
    
    // Check staticAccountKeys
    const staticAccounts = processed?.transaction?.message?.staticAccountKeys || [];
    for (const pubkey of staticAccounts) {
      if (typeof pubkey === 'string' && 
          pubkey.endsWith('pump') && 
          pubkey !== 'So11111111111111111111111111111111111111112') {
        return pubkey;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Initialize the parser with PumpFun IDL
 */
function initializeParser(): Parser {
  const parser = new Parser();

  // Add PumpFun program IDL
  parser.addIDL(
    new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
    pumpIdl as Idl
  );

  parser.addIDL(
    new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
    pumpAmmIdl as Idl
  )

  // Disable default instruction parsing to use custom parsers
  parser.useDefaultInstructionParsing(true);
  parser.enableLogging(false);

  return parser;
}

// Event type lookup map for fast conversion (optimization)
const EVENT_TYPE_MAP: Record<string, EventType> = {
  'CreateEvent': 'CreateEvent',
  'BuyEvent': 'BuyEvent',
  'SellEvent': 'SellEvent',
  'TradeEvent': 'TradeEvent',
};

/**
 * Process incoming transaction data from ladysbug
 * Optimized for high-frequency transactions (10-50ms intervals)
 * Streamer only detects events and signals trackers - no heavy processing here
 */
async function processData(processed: any) {
  try {
    // Early return if no signatures
    if (!processed?.transaction?.signatures) {
      return;
    }

    // Early return if no events (before any processing)
    const events = processed.transaction.message?.events;
    if (!events || !Array.isArray(events) || events.length === 0) {
      return;
    }

    // Extract signature once
    const txSignature = Array.isArray(processed.transaction.signatures) 
      ? processed.transaction.signatures[0] 
      : String(processed.transaction.signatures[0] || 'unknown');

    // Single-pass optimization: process all events in one loop
    const transactionTimestamp = Date.now();
    let createEventFound: CreateEventData | null = null;
    let devBuyTradeEventFound: TradeEventData | null = null;
    const redisEvents: Array<{ signature: string; eventType: EventType; timestamp: number; data: any }> = [];
    const tradeEventsToProcess: TradeEventData[] = [];
    const ammBuyEventsToProcess: Array<{ data: AmmBuyEventData; mint: string | null }> = [];
    const ammSellEventsToProcess: Array<{ data: AmmSellEventData; mint: string | null }> = [];
    let createPoolEvent: any = null;
    let hasMigrateInstruction = false;

    // Check for migrate instruction first (lightweight check)
    try {
      const instructions = processed.transaction.message?.compiledInstructions || [];
      for (const instruction of instructions) {
        if (instruction?.data?.name?.includes('migrate')) {
          hasMigrateInstruction = true;
          break;
        }
      }
    } catch (error) {
      // Ignore migrate detection errors
    }

    // Single pass through events - collect all information
    for (const event of events) {
      if (!event) continue;
      
      const eventName = event.name;
      if (!eventName) continue;

      // Fast event type lookup
      const eventType = EVENT_TYPE_MAP[eventName] || 'unknown';

      // Handle CreatePoolEvent for migrate (only if migrate instruction detected)
      if (hasMigrateInstruction && eventName === 'CreatePoolEvent' && event.data && !createPoolEvent) {
        createPoolEvent = event.data;
      }

      // Collect events for Redis (batch write later)
      if (eventType !== 'unknown' && event.data) {
        redisEvents.push({
          signature: txSignature,
          eventType,
          timestamp: transactionTimestamp,
          data: event.data,
        });
      }

      // Collect CreateEvent
      if (eventName === 'CreateEvent' && event.data && !createEventFound) {
        createEventFound = event.data as CreateEventData;
      }

      // Collect TradeEvents
      if (eventName === 'TradeEvent' && event.data) {
        const tradeData = event.data as TradeEventData;
        if (createEventFound && tradeData.mint === createEventFound.mint && tradeData.is_buy) {
          // Dev buy found
          if (!devBuyTradeEventFound) {
            devBuyTradeEventFound = tradeData;
          }
        } else {
          // Regular trade event (not dev buy)
          tradeEventsToProcess.push(tradeData);
        }
      }

      // Collect AMM events (defer mint resolution)
      if (eventName === 'BuyEvent' && event.data) {
        const buyData = event.data as AmmBuyEventData;
        const poolAddress = buyData.pool;
        const mint = poolAddress ? (poolToMintMap.get(poolAddress) || null) : null;
        ammBuyEventsToProcess.push({ data: buyData, mint });
      }

      if (eventName === 'SellEvent' && event.data) {
        const sellData = event.data as AmmSellEventData;
        const poolAddress = sellData.pool;
        const mint = poolAddress ? (poolToMintMap.get(poolAddress) || null) : null;
        ammSellEventsToProcess.push({ data: sellData, mint });
      }
    }

    // Handle migrate event (non-blocking)
    if (hasMigrateInstruction) {
      try {
        if (createPoolEvent) {
          const poolAddress = createPoolEvent.pool;
          const baseMint = createPoolEvent.base_mint;
          const quoteMint = createPoolEvent.quote_mint;
          const mintAddress = baseMint || extractMintFromTransaction(processed);
          
          if (mintAddress && poolAddress && baseMint && quoteMint) {
            // Store pool->mint mapping immediately
            poolToMintMap.set(poolAddress, baseMint);
            // Signal bonding tracker (non-blocking)
            handleMigrateEvent(mintAddress, {
              pool: poolAddress,
              base_mint: baseMint,
              quote_mint: quoteMint
            }).catch((error) => {
              console.error(`[PumpFun] Error handling migrate event for ${mintAddress}:`, error);
            });
          }
        } else {
          // Fallback: extract mint from transaction
          const mintAddress = extractMintFromTransaction(processed);
          if (mintAddress) {
            handleMigrateEvent(mintAddress).catch((error) => {
              console.error(`[PumpFun] Error handling migrate event for ${mintAddress}:`, error);
            });
          }
        }
      } catch (error) {
        // Ignore migrate errors
      }
    }

    // Batch write all events to Redis (non-blocking)
    if (redisEvents.length > 0) {
      // Fire and forget - don't await Redis writes
      Promise.all(redisEvents.map(event => storeTransactionEvent(event))).catch((error) => {
        console.error('[PumpFun] Error storing events to Redis:', error);
      });
    }

    // Process CreateEvent (if found)
    if (createEventFound && !isStopping) {
      const creator = createEventFound.creator || createEventFound.user;
      
      if (!isBlacklistedCreator(creator)) {
        // Signal token tracker (non-blocking)
        handleCreateEvent(createEventFound, txSignature, devBuyTradeEventFound);
        
        // Signal ATH tracker (non-blocking)
        registerTokenForAth(
          createEventFound.mint,
          createEventFound.name,
          createEventFound.symbol,
          creator,
          createEventFound.timestamp * 1000
        );
        
        // Process dev buy if found (non-blocking)
        if (devBuyTradeEventFound) {
          handleTradeEvent(devBuyTradeEventFound, txSignature);
        }
      }
    }

    // Process regular TradeEvents (non-blocking)
    for (const tradeData of tradeEventsToProcess) {
      handleTradeEvent(tradeData, txSignature);
    }

    // Process AMM BuyEvents (resolve mints if needed)
    for (const { data: buyData, mint } of ammBuyEventsToProcess) {
      let resolvedMint = mint;
      const poolAddress = buyData.pool;
      
      if (!resolvedMint && poolAddress) {
        // Fallback: try to extract from transaction
        resolvedMint = extractMintFromAmmEvent(processed, { data: buyData });
        if (resolvedMint) {
          poolToMintMap.set(poolAddress, resolvedMint);
        }
      }
      
      if (resolvedMint) {
        handleAmmBuyEvent(buyData, resolvedMint, txSignature);
      }
    }

    // Process AMM SellEvents (resolve mints if needed)
    for (const { data: sellData, mint } of ammSellEventsToProcess) {
      let resolvedMint = mint;
      const poolAddress = sellData.pool;
      
      if (!resolvedMint && poolAddress) {
        // Fallback: try to extract from transaction
        resolvedMint = extractMintFromAmmEvent(processed, { data: sellData });
        if (resolvedMint) {
          poolToMintMap.set(poolAddress, resolvedMint);
        }
      }
      
      if (resolvedMint) {
        handleAmmSellEvent(sellData, resolvedMint, txSignature);
      }
    }
  } catch (error) {
    console.error("Error processing transaction data:", error);
  }
}

/**
 * Start the transaction stream
 */
async function startStreaming(): Promise<void> {
  if (isStreaming) {
    return;
  }

  try {
    const endpoint = process.env.GRPC_URL;
    const xToken = process.env.X_TOKEN;

    if (!endpoint || !xToken) {
      throw new Error('ENDPOINT and X_TOKEN environment variables are required');
    }

    // Reset stopping flag when starting
    isStopping = false;

    // Initialize token tracker (15-second tracking)
    await initializeTokenTracker();

    // Initialize ATH tracker (also fetches tokens from creator wallets via Solscan)
    await initializeAthTracker();

    // Initialize bonding tracker (fetches bonding status from Shyft API)
    await initializeBondingTracker();

    // Load pool -> mint mappings from database
    await loadPoolToMintMappings();

    // Initialize parser
    const parser = initializeParser();

    // Create transaction streamer
    txnStreamer = new TransactionStreamer(endpoint, xToken);

    // Add parser to streamer
    txnStreamer.addParser(parser);

    // Add addresses to monitor
    txnStreamer.addAddresses(ADDRESSES_TO_STREAM_FROM);

    // Set up data handler
    txnStreamer.onData(processData);

    // Start streaming
    txnStreamer.start();

    isStreaming = true;
  } catch (error) {
    console.error('Error starting stream:', error);
    isStreaming = false;
    isStopping = false;
    txnStreamer = null;
    throw error;
  }
}

/**
 * Stop the currently running stream gracefully
 * - Stops accepting new tokens immediately
 * - Continues processing buy/sell trading events (TradeEvent, BuyEvent, SellEvent)
 * - Keeps ATH tracker and bonding tracker running
 * - Waits for all pending 15-second monitoring jobs to complete
 * - Then stops the streamer and cleans up
 */
async function stopStreaming(): Promise<void> {
  if (!isStreaming || !txnStreamer) {
    return;
  }

  console.log('[PumpFun] Initiating graceful shutdown...');
  
  // Set stopping flag to prevent new token acceptance
  // The streamer will continue running to process buy/sell events
  isStopping = true;
  console.log('[PumpFun] Stopped accepting new tokens. Continuing to process buy/sell trading events...');

  // Wait for all pending 15-second monitoring jobs to complete
  // This allows current tokens to finish their monitoring period
  // During this time, the streamer continues running to process TradeEvent, BuyEvent, SellEvent
  console.log('[PumpFun] Waiting for pending token tracking jobs to complete...');
  await waitForPendingTrackingJobs();

  // Now stop the transaction streamer (all monitoring is complete)
  try {
    txnStreamer.stop();
    console.log('[PumpFun] Transaction streamer stopped');
  } catch (error) {
    console.error("Error stopping stream:", error);
  }

  // Now cleanup token tracker (all jobs should be done)
  console.log('[PumpFun] Cleaning up token tracker...');
  cleanupTokenTracker();

  // Cleanup ATH tracker (final save)
  console.log('[PumpFun] Cleaning up ATH tracker...');
  await cleanupAthTracker();

  // Cleanup bonding tracker
  console.log('[PumpFun] Cleaning up bonding tracker...');
  await cleanupBondingTracker();

  isStreaming = false;
  isStopping = false;
  txnStreamer = null;
  console.log('[PumpFun] Graceful shutdown complete');
}

/**
 * Load pool -> mint mappings from database
 */
async function loadPoolToMintMappings(): Promise<void> {
  try {
    const { pool } = await import('../db.js');
    const result = await pool.query(
      `SELECT pool_address, base_mint 
       FROM tbl_soltrack_created_tokens 
       WHERE pool_address IS NOT NULL AND base_mint IS NOT NULL`
    );
    
    for (const row of result.rows) {
      if (row.pool_address && row.base_mint) {
        poolToMintMap.set(row.pool_address, row.base_mint);
      }
    }
    
    console.log(`[PumpFun] Loaded ${result.rows.length} pool->mint mappings from database`);
  } catch (error) {
    // Ignore errors if columns don't exist yet (migration not run)
    if ((error as any)?.code !== '42703') {
      console.error('[PumpFun] Error loading pool->mint mappings from database:', error);
    }
  }
}

/**
 * Gets the current streaming status
 */
function getStreamingStatus(): boolean {
  return isStreaming;
}

// Export functions for use in other modules
export {
  startStreaming,
  stopStreaming,
  getStreamingStatus
};
