import dotenv from 'dotenv';
// ladysbug is a local package installed from ./ladysbug folder
import { Parser, TransactionStreamer } from 'ladysbug';
import { Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import pumpIdl from '../IdlFiles/pump_0.1.0.json' assert { type: 'json' };
import pumpAmmIdl from '../IdlFiles/pump_amm_0.1.0.json' assert { type: 'json' };
import { pool } from '../db.js';
import { getCreatedTokens } from '../utils/solscan.js';

dotenv.config();

const ADDRESSES_TO_STREAM_FROM = [
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // PumpFun Program
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // PumpFun AMM Program
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM", // PumpFun Mint Authority
];

// Stream control state
let isStreaming = false;
let txnStreamer: TransactionStreamer | null = null;

// CreateEvent tracking
let createEventCount = 0;
let lastLogTime = Date.now();
let logInterval: NodeJS.Timeout | null = null;

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
 * Log CreateEvent count every second
 */
function logCreateEventCount(): void {
  const now = Date.now();
  const elapsed = (now - lastLogTime) / 1000; // Convert to seconds
  
  if (elapsed >= 1) {
    console.log(`[CreateEvent Rate] ${createEventCount} CreateEvents in the last ${elapsed.toFixed(2)} seconds (${(createEventCount / elapsed).toFixed(2)} per second)`);
    createEventCount = 0;
    lastLogTime = now;
  }
}

/**
 * Fetch all registered creator wallets from the database
 */
async function getAllCreatorWallets(): Promise<string[]> {
  try {
    const result = await pool.query(
      'SELECT DISTINCT wallet_address FROM creator_wallets ORDER BY wallet_address'
    );
    return result.rows.map(row => row.wallet_address);
  } catch (error) {
    console.error('Error fetching creator wallets:', error);
    return [];
  }
}

/**
 * Process wallets in parallel with a concurrency limit
 */
async function processWalletsInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 10
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Fetch all created tokens for registered creator wallets
 */
async function fetchAllCreatedTokens(): Promise<void> {
  const startTime = Date.now();
  console.log('[Token Fetch] Starting to fetch all created tokens for registered creator wallets...');
  
  try {
    // Get all registered creator wallets
    const wallets = await getAllCreatorWallets();
    
    if (wallets.length === 0) {
      console.log('[Token Fetch] No creator wallets registered. Skipping token fetch.');
      return;
    }
    
    console.log(`[Token Fetch] Found ${wallets.length} registered creator wallet(s)`);
    
    // Process wallets in parallel with concurrency limit of 10
    const results = await processWalletsInBatches(
      wallets,
      async (walletAddress) => {
        try {
          console.log(`[Token Fetch] Fetching tokens for wallet: ${walletAddress}`);
          const tokens = await getCreatedTokens(walletAddress) as any;
          const tokenCount = (tokens && typeof tokens === 'object' && 'data' in tokens && Array.isArray(tokens.data)) 
            ? tokens.data.length 
            : 0;
          console.log(`[Token Fetch] Fetched ${tokenCount} tokens for wallet: ${walletAddress}`);
          return { walletAddress, tokens, success: true };
        } catch (error) {
          console.error(`[Token Fetch] Error fetching tokens for wallet ${walletAddress}:`, error);
          return { walletAddress, tokens: null, success: false, error };
        }
      },
      10 // Concurrency limit of 10
    );
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTokens = results.reduce((sum, r) => {
      if (r.tokens && typeof r.tokens === 'object' && 'data' in r.tokens && Array.isArray(r.tokens.data)) {
        return sum + r.tokens.data.length;
      }
      return sum;
    }, 0);
    
    console.log(`[Token Fetch] Completed in ${duration} seconds`);
    console.log(`[Token Fetch] Summary: ${successful} successful, ${failed} failed, ${totalTokens} total tokens fetched`);
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[Token Fetch] Error fetching created tokens (took ${duration} seconds):`, error);
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

    // Log events if available
    if (processed?.transaction?.message?.events.length === 0) {
      return;
    }

    console.log("Got tx:", processed.transaction.signatures[0]);

    // Handle the transaction data from ladysbug
    // Ladysbug provides parsed transaction data in a readable format:
    // - transaction.signatures: string[]
    // - transaction.message: ReadableLegacyMessage | ReadableV0Message
    // - transaction.message.events?: ReadableEvent[]
    // - meta: ReadableTransactionMeta | null
    // - slot: string | number
    // 
    // Add your custom transaction processing logic here
    const startTime = Date.now();
    if (processed?.transaction) {
      // TODO: Add your transaction processing logic here
      // Example: Save to database, emit events, etc.

      const events = processed.transaction.message?.events;
      events.forEach((event: any) => {
        console.log(event?.name)
        if (event?.name === 'CreateEvent') {
          // Token created
          createEventCount++;
          console.log(`Token created: ${event?.data?.name}`)
        }
      });
      processed.transaction.message?.compiledInstructions?.forEach((instruction: any) => {
        if (instruction?.data?.name?.includes('migrate')) {
          console.log(`Token migrated`)
          console.log(JSON.stringify(processed.transaction.message))
        }
      });
    }
    console.log(`Ended with ${Date.now() - startTime}ms`)
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

    // Fetch all created tokens for registered creator wallets before starting the stream
    await fetchAllCreatedTokens();

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

    // Start CreateEvent count logging
    createEventCount = 0;
    lastLogTime = Date.now();
    logInterval = setInterval(() => {
      logCreateEventCount();
    }, 1000); // Log every second

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
function stopStreaming(): void {
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

  // Stop CreateEvent count logging
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
  
  // Log final count before resetting
  if (createEventCount > 0) {
    logCreateEventCount();
  }
  createEventCount = 0;

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
