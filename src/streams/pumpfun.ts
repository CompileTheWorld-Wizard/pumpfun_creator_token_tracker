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
  parser.useDefaultInstructionParsing(false);

  return parser;
}

/**
 * Process incoming transaction data from ladysbug
 * Streamer only detects events and signals trackers - no heavy processing here
 */
async function processData(processed: any) {
  try {
    // Log transaction signatures
    if (!processed?.transaction?.signatures)
      return

    const txSignature = Array.isArray(processed.transaction.signatures) 
      ? processed.transaction.signatures[0] 
      : String(processed.transaction.signatures[0] || 'unknown');

    // Check for migrate instruction (non-blocking signal to bonding tracker)
    try {
      const instructions = processed.transaction.message?.compiledInstructions || [];
      for (const instruction of instructions) {
        if (instruction?.data?.name?.includes('migrate')) {
          // Extract mint address from transaction
          const mintAddress = extractMintFromTransaction(processed);
          if (mintAddress) {
            // Signal bonding tracker (non-blocking)
            handleMigrateEvent(mintAddress).catch((error) => {
              console.error(`[PumpFun] Error handling migrate event for ${mintAddress}:`, error);
            });
          } else {
            console.warn(`[PumpFun] Could not extract mint address from migrate transaction`);
          }
        }
      }
    } catch (error) {
      // Don't fail the whole transaction processing if migrate detection fails
      console.error('[PumpFun] Error detecting migrate:', error);
    }

    // Log events if available
    if (processed?.transaction?.message?.events.length === 0) {
      return;
    }

    // Store events in Redis and process them
    const events = processed.transaction.message?.events;
    if (events && Array.isArray(events)) {
      // First pass: Store all events in Redis
      const transactionTimestamp = Date.now();
      
      for (const event of events) {
        const eventName = event?.name ? String(event.name) : 'unknown';
        
        // Determine event type
        let eventType: EventType = 'unknown';
        if (eventName === 'CreateEvent') {
          eventType = 'CreateEvent';
        } else if (eventName === 'BuyEvent') {
          eventType = 'BuyEvent';
        } else if (eventName === 'SellEvent') {
          eventType = 'SellEvent';
        } else if (eventName === 'TradeEvent') {
          eventType = 'TradeEvent';
        }
        
        // Store event in Redis (only relevant event types)
        if (eventType !== 'unknown') {
          await storeTransactionEvent({
            signature: txSignature,
            eventType,
            timestamp: transactionTimestamp,
            data: event?.data || null,
          });
        }
      }
      
      // Second pass: Collect CreateEvent and TradeEvent from same transaction
      let createEventFound: CreateEventData | null = null;
      let devBuyTradeEventFound: TradeEventData | null = null;
      const tradeEventsInTx: TradeEventData[] = [];
      
      // First, find CreateEvent
      for (const event of events) {
        const eventName = event?.name ? String(event.name) : 'unknown';
        if (eventName === 'CreateEvent' && event?.data) {
          createEventFound = event.data as CreateEventData;
          break; // Found CreateEvent, can exit
        }
      }
      
      // Then, find TradeEvents in the same transaction
      if (createEventFound) {
        for (const event of events) {
          const eventName = event?.name ? String(event.name) : 'unknown';
          if (eventName === 'TradeEvent' && event?.data) {
            const tradeData = event.data as TradeEventData;
            tradeEventsInTx.push(tradeData);
            // Check if this TradeEvent is for the same mint as CreateEvent and is a buy (dev buy)
            if (tradeData.mint === createEventFound.mint && tradeData.is_buy) {
              devBuyTradeEventFound = tradeData;
              console.log(`[PumpFun] Found dev buy TradeEvent in same transaction as CreateEvent for ${tradeData.mint}`);
            }
          }
        }
      }
      
      // Process CreateEvent with dev buy if found
      if (createEventFound) {
        // During graceful shutdown, don't accept new tokens
        if (!isStopping) {
          const creator = createEventFound.creator || createEventFound.user;
          
          // Skip if creator is blacklisted (fast check in streamer)
          if (!isBlacklistedCreator(creator)) {
            // Signal token tracker (handles 15-sec tracking + creator token fetching)
            // Pass dev buy TradeEvent if found in same transaction
            handleCreateEvent(createEventFound, txSignature, devBuyTradeEventFound);
            
            // Signal ATH tracker to register token
            registerTokenForAth(
              createEventFound.mint,
              createEventFound.name,
              createEventFound.symbol,
              creator,
              createEventFound.timestamp * 1000
            );
            
            // If dev buy found, also send to ATH tracker immediately
            if (devBuyTradeEventFound) {
              handleTradeEvent(devBuyTradeEventFound, txSignature);
            }
          }
        }
      }
      
      // Process other events (TradeEvent, BuyEvent, SellEvent) that are NOT dev buys
      for (const event of events) {
        const eventName = event?.name ? String(event.name) : 'unknown';
        
        let eventType: EventType = 'unknown';
        if (eventName === 'CreateEvent') {
          eventType = 'CreateEvent';
        } else if (eventName === 'BuyEvent') {
          eventType = 'BuyEvent';
        } else if (eventName === 'SellEvent') {
          eventType = 'SellEvent';
        } else if (eventName === 'TradeEvent') {
          eventType = 'TradeEvent';
        }
        
        // Skip CreateEvent (already processed) and dev buy TradeEvent (already processed)
        if (eventType === 'CreateEvent') {
          continue;
        }
        
        if (eventType === 'TradeEvent' && event?.data) {
          const tradeData = event.data as TradeEventData;
          // Skip if this is the dev buy we already processed (same mint, same transaction, is buy)
          if (createEventFound && 
              devBuyTradeEventFound && 
              tradeData.mint === createEventFound.mint && 
              tradeData.is_buy &&
              tradeData.sol_amount === devBuyTradeEventFound.sol_amount &&
              tradeData.token_amount === devBuyTradeEventFound.token_amount) {
            continue; // Skip dev buy - already processed
          }
          // Process other TradeEvents (not dev buys)
          handleTradeEvent(tradeData, txSignature);
        }
        
        // Send BuyEvent to ATH tracker (pump.fun AMM)
        if (eventType === 'BuyEvent' && event?.data) {
          const buyData = event.data as AmmBuyEventData;
          // Extract mint from pool or other field - AMM events need pool lookup
          const mint = extractMintFromAmmEvent(processed, event);
          if (mint) {
            handleAmmBuyEvent(buyData, mint, txSignature);
          }
        }
        
        // Send SellEvent to ATH tracker (pump.fun AMM)
        if (eventType === 'SellEvent' && event?.data) {
          const sellData = event.data as AmmSellEventData;
          const mint = extractMintFromAmmEvent(processed, event);
          if (mint) {
            handleAmmSellEvent(sellData, mint, txSignature);
          }
        }
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
