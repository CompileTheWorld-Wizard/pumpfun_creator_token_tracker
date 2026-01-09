import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import dotenv from "dotenv";
dotenv.config();

const parser = new Parser();
// Initializing parser with Pump.fun IDL

const streamer = new TransactionStreamer(process.env.GRPC_URL, process.env.X_TOKEN);
streamer.addParser(parser);
// setting up streamer to parse using the Pump.fun parser

streamer.addAddresses(["11111111111111111111111111111111"]);
// adds the address to stream data from

async function processData(processed) {
    //handle the incoming transaction
    const MIN_SOL_AMOUNT = 2; // Minimum SOL amount to display (in SOL)
    const MIN_LAMPORTS = MIN_SOL_AMOUNT * 1e9; // Convert to lamports
    
    const { meta, transaction } = processed;
    
    if (!meta || !transaction || !meta.preBalances || !meta.postBalances) {
        return;
    }

    // Calculate largest balance change
    let maxChange = 0;
    meta.preBalances.forEach((preBalance: number, index: number) => {
      const postBalance = meta.postBalances[index] || 0;
      const change = Math.abs(postBalance - preBalance);
      maxChange = Math.max(maxChange, change);
    });
    
    // Only log transactions with > 10 SOL moved
    const changeInSOL = maxChange / 1e9;
    if (changeInSOL > 10) {
      console.log(`\n💰 High-Value Transaction:`);
      console.log(`  Signature: ${transaction.signatures[0]}`);
      console.log(`  Slot: ${transaction.slot}`);
      console.log(`  Max SOL Transfer: ${changeInSOL.toFixed(2)} SOL`);
      console.log(`  Fee: ${meta.fee / 1e9} SOL`);
      console.log(`  Accounts: ${transaction.message?.staticAccountKeys?.length || 0}`);
    }
  }

streamer.onData(processData);
// set the callback function that receives the data

streamer.start();
//starts streaming transactions