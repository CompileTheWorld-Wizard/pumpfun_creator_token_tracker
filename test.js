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
    const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
    const TRANSFER_INSTRUCTION_DISCRIMINATOR = [2, 0, 0, 0, 0, 0, 0, 0]; // System Program Transfer instruction
    
    const { meta, transaction } = processed;
    
    if (!meta || !transaction || !transaction.message) {
        return;
    }

    const accountKeys = transaction.message.accountKeys || transaction.message.staticAccountKeys || [];
    const instructions = transaction.message.compiledInstructions || [];
    
    // Find system program transfers
    for (const instruction of instructions) {
      // Check if this instruction is from the system program
      const programIdIndex = instruction.programIdIndex;
      const programId = accountKeys[programIdIndex];
      const programIdString = typeof programId === 'string' ? programId : (programId?.pubkey || programId);
      
      if (programIdString !== SYSTEM_PROGRAM_ID) {
        continue;
      }
      
      // Check if this is a transfer instruction (discriminator [2, 0, 0, 0, 0, 0, 0, 0])
      const instructionData = instruction.data || [];
      if (instructionData.length < 8) {
        continue;
      }
      
      // Check discriminator (first 8 bytes)
      const discriminator = instructionData.slice(0, 8);
      const isTransfer = discriminator.every((byte, idx) => byte === TRANSFER_INSTRUCTION_DISCRIMINATOR[idx]);
      
      if (!isTransfer) {
        continue;
      }
      
      // Extract amount (next 8 bytes as u64 little-endian)
      if (instructionData.length < 16) {
        continue;
      }
      
      const amountBytes = instructionData.slice(8, 16);
      let amount = 0n;
      for (let i = 0; i < 8; i++) {
        amount |= BigInt(amountBytes[i]) << BigInt(i * 8);
      }
      const amountLamports = Number(amount);
      const amountSOL = amountLamports / 1e9;
      
      // Extract sender and receiver from account indices
      const accountIndices = instruction.accountKeyIndexes || [];
      if (accountIndices.length < 2) {
        continue;
      }
      
      const senderIndex = accountIndices[0];
      const receiverIndex = accountIndices[1];
      
      const sender = accountKeys[senderIndex];
      const receiver = accountKeys[receiverIndex];
      
      const senderString = typeof sender === 'string' ? sender : (sender?.pubkey || sender);
      const receiverString = typeof receiver === 'string' ? receiver : (receiver?.pubkey || receiver);
      
      // Display the transfer
      console.log(`\n💰 System Program Transfer:`);
      console.log(`  Signature: ${transaction.signatures[0]}`);
      console.log(`  Slot: ${meta.slot}`);
      console.log(`  Sender: ${senderString}`);
      console.log(`  Receiver: ${receiverString}`);
      console.log(`  Amount: ${amountSOL.toFixed(9)} SOL (${amountLamports} lamports)`);
      if (meta.fee) {
        console.log(`  Fee: ${(meta.fee / 1e9).toFixed(9)} SOL`);
      }
    }
  }

streamer.onData(processData);
// set the callback function that receives the data

streamer.start();
//starts streaming transactions