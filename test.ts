import pkg from "@coral-xyz/anchor";
const { Idl } = pkg;
type Idl = typeof Idl;
import { PublicKey, Connection } from "@solana/web3.js";
import { Parser } from "@shyft-to/ladybug-sdk";
import pumpIdl from "./src/IdlFiles/pump_0.1.0.json" with { type: 'json' };
import pumpAmmIdl from "./src/IdlFiles/pump_amm_0.1.0.json" with { type: 'json' };
import pumpFeeIdl from "./src/IdlFiles/pumpfees_0.1.0.json" with { type: 'json' };

async function getAndParseTxn() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  const parser = new Parser();
  parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);
  parser.addIDL(new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"), pumpAmmIdl as Idl);
  parser.addIDL(new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"), pumpFeeIdl as Idl);
  parser.useDefaultInstructionParsing(true);

  const txnSignature = "5PyvRNqckTRhtDRF5iQm6EnW2JUExSXxQC7wMGX8LbQoKijQS3zUCpidFCsWiWNzdvf1gyh1bvfYoy7pDydSsgRy";

  const transaction = await connection.getTransaction(txnSignature, {
      maxSupportedTransactionVersion: 0
    });
  
  if(!transaction) throw new Error("Transaction not found");
  const parsed = parser.parseTransaction(transaction);

  console.log(JSON.stringify(parsed));
}

getAndParseTxn();