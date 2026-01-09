import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import dotenv from "dotenv";
dotenv.config();

const parser = new Parser();
// Initializing parser with Pump.fun IDL

const streamer = new TransactionStreamer(process.env.GRPC_URL, process.env.X_TOKEN);
streamer.addParser(parser);
// setting up streamer to parse using the Pump.fun parser

streamer.addAddresses([]);
// adds the address to stream data from

async function processData(processed) {
    //handle the incoming transaction
    const MIN_SOL_AMOUNT = 2; // Minimum SOL amount to display (in SOL)
    const MIN_LAMPORTS = MIN_SOL_AMOUNT * 1e9; // Convert to lamports
    
    const { meta, transaction } = processed;
    
    if (!meta || !transaction || !meta.preBalances || !meta.postBalances) {
        return;
    }
    
    const accountKeys = transaction.message.accountKeys || transaction.message.staticAccountKeys;
    const preBalances = meta.preBalances;
    const postBalances = meta.postBalances;
    
    // Helper to get address string from account key (handles both PublicKey objects and strings)
    const getAddress = (account) => {
        if (typeof account === 'string') return account;
        if (account && account.toString) return account.toString();
        if (account && account.pubkey) return account.pubkey.toString();
        return String(account);
    };
    
    // Calculate balance changes for each account
    const balanceChanges = accountKeys.map((account, index) => {
        const preBalance = BigInt(preBalances[index] || 0);
        const postBalance = BigInt(postBalances[index] || 0);
        const change = Number(postBalance - preBalance);
        
        return {
            address: getAddress(account),
            change: change,
            isSender: change < 0,
            isReceiver: change > 0
        };
    });
    
    // Filter for significant transfers (absolute value >= MIN_LAMPORTS)
    const significantTransfers = balanceChanges.filter(
        bc => Math.abs(bc.change) >= MIN_LAMPORTS
    );
    
    // Separate senders and receivers
    const senders = significantTransfers.filter(bc => bc.isSender);
    const receivers = significantTransfers.filter(bc => bc.isReceiver);
    
    // Display matched transfers
    if (senders.length > 0 && receivers.length > 0) {
        console.log(`\n=== SOL Transfers (>= ${MIN_SOL_AMOUNT} SOL) ===`);
        
        // Match senders with receivers by amount
        const usedReceivers = new Set();
        
        senders.forEach(sender => {
            const senderAmount = Math.abs(sender.change);
            const amountSOL = senderAmount / 1e9;
            
            // Find best matching receiver (exact match or closest, accounting for fees)
            let bestMatch = null;
            let bestDiff = Infinity;
            
            receivers.forEach((receiver, idx) => {
                if (usedReceivers.has(idx)) return;
                
                const diff = Math.abs(receiver.change - senderAmount);
                // Allow up to 0.001 SOL difference for fees (1000000 lamports)
                if (diff < 1000000 && diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = { receiver, idx };
                }
            });
            
            if (bestMatch) {
                usedReceivers.add(bestMatch.idx);
                console.log(`FROM: ${sender.address}`);
                console.log(`TO:   ${bestMatch.receiver.address}`);
                console.log(`AMOUNT: ${amountSOL.toFixed(9)} SOL\n`);
            } else {
                // No matching receiver found, show sender only
                console.log(`FROM: ${sender.address}`);
                console.log(`TO:   [Unknown/Multiple]`);
                console.log(`AMOUNT: ${amountSOL.toFixed(9)} SOL\n`);
            }
        });
        
        // Show any unmatched receivers
        receivers.forEach((receiver, idx) => {
            if (!usedReceivers.has(idx)) {
                const amountSOL = receiver.change / 1e9;
                console.log(`FROM: [Unknown]`);
                console.log(`TO:   ${receiver.address}`);
                console.log(`AMOUNT: ${amountSOL.toFixed(9)} SOL\n`);
            }
        });
        
        console.log("===========================\n");
    }
  }

streamer.onData(processData);
// set the callback function that receives the data

streamer.start();
//starts streaming transactions