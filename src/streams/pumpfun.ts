import dotenv from 'dotenv';
import { Parser, TransactionStreamer } from '@shyft-to/ladybug-sdk';
import { Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import pumpIdl from '../IdlFiles/pump_0.1.0.json' with { type: 'json' };
import pumpAmmIdl from '../IdlFiles/pump_amm_0.1.0.json' with { type: 'json' };
import { storeTransactionEvent, type EventType } from '../redis.js';
import { handleCreateEvent, initializeTokenTracker, cleanup as cleanupTokenTracker, isBlacklistedCreator } from '../services/tokenTracker.js';
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
import { getCreatedTokens } from '../utils/solscan.js';
import { pool } from '../db.js';
import { fetchBondingStatusBatch } from '../services/bondingTracker.js';
import type { CreateEventData, TradeEventData, AmmBuyEventData, AmmSellEventData } from '../types.js';

dotenv.config();

const ADDRESSES_TO_STREAM_FROM = [
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // PumpFun Program
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // PumpFun AMM Program
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM", // PumpFun Mint Authority
];

// Stream control state
let isStreaming = false;
let txnStreamer: TransactionStreamer | null = null;

// Track creator wallets that have been fetched during this streaming cycle
const fetchedCreatorWallets: Set<string> = new Set();

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
 * Fetch all tokens created by a creator wallet and get their bonding status
 */
async function fetchCreatorTokensAndBondingStatus(creatorAddress: string): Promise<void> {
  try {
    console.log(`[PumpFun] Fetching tokens for creator: ${creatorAddress}`);
    
    // Fetch all tokens created by this wallet from Solscan
    const response = await getCreatedTokens(creatorAddress) as any;
    
    if (!response?.data || !Array.isArray(response.data)) {
      console.log(`[PumpFun] No tokens found for creator: ${creatorAddress}`);
      return;
    }
    
    const tokenMints: string[] = [];
    const tokenDataMap = new Map<string, { name: string; symbol: string; blockTime: number }>();
    
    // Extract token mints from the response
    for (const activity of response.data) {
      const token1 = activity.routers?.token1;
      if (token1 && token1 !== 'So11111111111111111111111111111111111111111') {
        const tokenMeta = response.metadata?.tokens?.[token1];
        const blockTime = activity.block_time || Math.floor(Date.now() / 1000);
        
        if (!tokenMints.includes(token1)) {
          tokenMints.push(token1);
          tokenDataMap.set(token1, {
            name: tokenMeta?.token_name || '',
            symbol: tokenMeta?.token_symbol || '',
            blockTime,
          });
        }
      }
    }
    
    if (tokenMints.length === 0) {
      console.log(`[PumpFun] No valid tokens found for creator: ${creatorAddress}`);
      return;
    }
    
    console.log(`[PumpFun] Found ${tokenMints.length} tokens for creator ${creatorAddress}`);
    
    // Fetch bonding status for all tokens
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
          console.error(`[PumpFun] Error saving token ${mint} to database:`, error);
        }
      }
    }
    
    console.log(`[PumpFun] Completed fetching tokens for creator ${creatorAddress}: ${tokenMints.length} tokens, ${Array.from(bondingStatusMap.values()).filter(b => b).length} bonded`);
  } catch (error) {
    console.error(`[PumpFun] Error fetching creator tokens and bonding status:`, error);
    throw error;
  }
}

/**
 * Process incoming transaction data from ladysbug
 */
async function processData(processed: any) {
  try {
    // Log transaction signatures
    if (!processed?.transaction?.signatures)
      return

    const txSignature = Array.isArray(processed.transaction.signatures) 
      ? processed.transaction.signatures[0] 
      : String(processed.transaction.signatures[0] || 'unknown');

    // Check for migrate instruction
    try {
      const instructions = processed.transaction.message?.compiledInstructions || [];
      for (const instruction of instructions) {
        if (instruction?.data?.name?.includes('migrate')) {
          console.log(`[BondingTracker] Token migrate detected in transaction ${txSignature}`);
          // Extract mint address from transaction
          const mintAddress = extractMintFromTransaction(processed);
          if (mintAddress) {
            await handleMigrateEvent(mintAddress);
          } else {
            console.warn(`[BondingTracker] Could not extract mint address from migrate transaction`);
          }
        }
      }
    } catch (error) {
      // Don't fail the whole transaction processing if migrate detection fails
      console.error('[BondingTracker] Error detecting migrate:', error);
    }

    // Log events if available
    if (processed?.transaction?.message?.events.length === 0) {
      return;
    }

    // Store events in Redis
    const events = processed.transaction.message?.events;
    if (events && Array.isArray(events)) {
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
            timestamp: Date.now(),
            data: event?.data || null,
          });
        }
        
        // Send CreateEvent to token tracker (15-second tracking)
        if (eventType === 'CreateEvent' && event?.data) {
          const createData = event.data as CreateEventData;
          const creator = createData.creator || createData.user;
          
          // Skip if creator is blacklisted
          if (isBlacklistedCreator(creator)) {
            console.log(`[PumpFun] Skipping token from blacklisted creator: ${creator}`);
            continue;
          }
          
          // Check if this creator wallet has been fetched in this streaming cycle
          if (!fetchedCreatorWallets.has(creator)) {
            console.log(`[PumpFun] New creator wallet detected: ${creator}, fetching all tokens...`);
            fetchedCreatorWallets.add(creator);
            
            // Fetch all tokens created by this wallet and get bonding status
            // Run in background to avoid blocking event processing
            fetchCreatorTokensAndBondingStatus(creator).catch((error) => {
              console.error(`[PumpFun] Error fetching tokens for creator ${creator}:`, error);
            });
          }
          
          handleCreateEvent(createData, txSignature);
          
          // Also register for ATH tracking
          registerTokenForAth(
            createData.mint,
            createData.name,
            createData.symbol,
            creator,
            createData.timestamp * 1000
          );
        }
        
        // Send TradeEvent to ATH tracker (pump.fun bonding curve)
        if (eventType === 'TradeEvent' && event?.data) {
          handleTradeEvent(event.data as TradeEventData, txSignature);
        }
        
        // Send BuyEvent to ATH tracker (pump.fun AMM)
        if (eventType === 'BuyEvent' && event?.data) {
          const buyData = event.data as AmmBuyEventData;
          // Extract mint from pool or other field - AMM events need pool lookup
          // For now, we'll need to get mint from the transaction accounts
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
    console.log("Stream is already running");
    return;
  }

  try {
    const endpoint = process.env.GRPC_URL;
    const xToken = process.env.X_TOKEN;

    if (!endpoint || !xToken) {
      throw new Error('ENDPOINT and X_TOKEN environment variables are required');
    }

    console.log('Starting pump.fun stream with ladysbug...');

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

    // Clear fetched creator wallets set when starting a new stream
    fetchedCreatorWallets.clear();

    isStreaming = true;
    console.log('Stream started successfully');
  } catch (error) {
    console.error('Error starting stream:', error);
    isStreaming = false;
    txnStreamer = null;
    throw error;
  }
}

/**
 * Stop the currently running stream
 */
async function stopStreaming(): Promise<void> {
  if (!isStreaming || !txnStreamer) {
    console.log("No stream is currently running");
    return;
  }

  console.log("Stopping stream...");

  try {
    // Ladysbug TransactionStreamer has a stop() method
    txnStreamer.stop();
  } catch (error) {
    console.error("Error stopping stream:", error);
  }

  // Cleanup token tracker
  cleanupTokenTracker();

  // Cleanup ATH tracker
  await cleanupAthTracker();

  // Cleanup bonding tracker
  await cleanupBondingTracker();

  // Clear fetched creator wallets set when stopping stream
  fetchedCreatorWallets.clear();

  isStreaming = false;
  txnStreamer = null;
  console.log("Stream stopped");
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
