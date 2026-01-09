import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import dotenv from "dotenv";
dotenv.config();

const parser = new Parser();
parser.useDefaultInstructionParsing(true);
// Initializing parser with Pump.fun IDL

const streamer = new TransactionStreamer(process.env.GRPC_URL, process.env.X_TOKEN);
streamer.addParser(parser);
// setting up streamer to parse using the Pump.fun parser

streamer.addAddresses(["11111111111111111111111111111111"]);
// adds the address to stream data from

async function processData(processed) {
    //handle the incoming transaction
    const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
    
    const { meta, transaction } = processed;
    
    if (!meta || !transaction || !transaction.message) {
        return;
    }

    // Check both compiledInstructions (version 0) and instructions (legacy)
    const instructions = transaction.message.compiledInstructions || transaction.message.instructions || [];
    
    // Find system program transfers
    for (const instruction of instructions) {
      // Check if this instruction is from the system program
      if (instruction.programId !== SYSTEM_PROGRAM_ID) {
        continue;
      }
      
      // Check if this is a transfer instruction (parser already parsed it)
      if (!instruction.data || instruction.data.name !== "transfer") {
        continue;
      }
      
      // Extract transfer data from parsed instruction
      const transferData = instruction.data.data;
      if (!transferData || !transferData.fromPubkey || !transferData.toPubkey || transferData.lamports === undefined) {
        continue;
      }
      
      const sender = transferData.fromPubkey;
      const receiver = transferData.toPubkey;
      const amountLamports = Number(transferData.lamports);
      const amountSOL = amountLamports / 1e9;
      
      // Display the transfer
      console.log(`\n💰 System Program Transfer:`);
      console.log(`  Signature: ${transaction.signatures[0]}`);
      console.log(`  Slot: ${meta.slot}`);
      console.log(`  Sender: ${sender}`);
      console.log(`  Receiver: ${receiver}`);
      console.log(`  Amount: ${amountSOL.toFixed(9)} SOL (${amountLamports} lamports)`);
      if (meta.fee) {
        console.log(`  Fee: ${(Number(meta.fee) / 1e9).toFixed(9)} SOL`);
      }
    }
  }

streamer.onData(processData);
// set the callback function that receives the data

streamer.start();
//starts streaming transactions