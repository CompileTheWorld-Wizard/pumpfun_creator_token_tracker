import dotenv from 'dotenv';
// ladysbug is a local package installed from ./ladysbug folder
import { Parser, TransactionStreamer } from 'ladysbug';
import { Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import pumpIdl from '../IdlFiles/pump_0.1.0.json';
import pumpAmmIdl from '../IdlFiles/pump_amm_0.1.0.json';

dotenv.config();

const ADDRESSES_TO_STREAM_FROM = [
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // PumpFun Program
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // PumpFun AMM Program
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM", // PumpFun Mint Authority
];

// Stream control state
let isStreaming = false;
let txnStreamer: TransactionStreamer | null = null;

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
 */
async function processData(processed: any) {
  try {
    // Log transaction signatures
    if (processed?.transaction?.signatures) {
      console.log("Got tx:", processed.transaction.signatures[0]);
    }

    // Log events if available
    if (processed?.transaction?.message?.events.length === 0) {
        console.log("No events found");
        return;
    }
    console.log(processed.transaction.message.events)
    // Handle the transaction data from ladysbug
    // Ladysbug provides parsed transaction data in a readable format:
    // - transaction.signatures: string[]
    // - transaction.message: ReadableLegacyMessage | ReadableV0Message
    // - transaction.message.events?: ReadableEvent[]
    // - meta: ReadableTransactionMeta | null
    // - slot: string | number
    // 
    // Add your custom transaction processing logic here
    if (processed?.transaction) {
      // TODO: Add your transaction processing logic here
      // Example: Save to database, emit events, etc.
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
