import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import dotenv from "dotenv";
dotenv.config();

const parser = new Parser();
// Initializing parser with Pump.fun IDL

const streamer = new TransactionStreamer(process.env.GRPC_URL, process.env.X_TOKEN);
streamer.addParser(parser);
// setting up streamer to parse using the Pump.fun parser

streamer.addAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]);
// adds the address to stream data from

async function processData(processed) {
    //handle the incoming transaction
    console.log("Received Data: ");
    console.log(processed);
  }

streamer.onData(processData);
// set the callback function that receives the data

streamer.start();
//starts streaming transactions