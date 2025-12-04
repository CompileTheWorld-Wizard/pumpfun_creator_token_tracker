import { Connection, type GetVersionedTransactionConfig } from "@solana/web3.js";
import { parsePumpFunTransaction } from "./src/parsers/pumpFun/index";
import * as bs58 from "bs58";

const connection = new Connection(
  "https://rpc.shyft.to?api_key=C5WUfQxUvSmrEBES",
  "confirmed"
);

// Test transaction signatures - you can add more here
const TEST_SIGNATURES = [
  "45fW1fMG6TVB6r6J5EVj5FofMawR1Cg6pFnWPS87bV63xeE5veYCQohaYTRjdJGcgXY5CJDUFSkRGrxsVG14QYhT",
  // Add more test signatures here
];

const config: GetVersionedTransactionConfig = {
  commitment: "finalized",
  maxSupportedTransactionVersion: 0,
};

async function testPumpFunParser(signature: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`Testing signature: ${signature}`);
  console.log("=".repeat(80));

  try {
    // Fetch transaction from Solana
    const transaction = await connection.getTransaction(signature, config);
    // Replace the signatures array with base58-decoded Buffers
    transaction.transaction.signatures = transaction.transaction.signatures.map((sig: string) => bs58.default.decode(sig));
    transaction.transaction.message.insturctions = transaction.transaction.message.compiledInstructions

    console.log(transaction)

    if (!transaction) {
      console.error(`❌ Transaction not found for signature: ${signature}`);
      return;
    }

    if (!transaction.meta) {
      console.error(`❌ Transaction metadata not available for signature: ${signature}`);
      return;
    }

    console.log(`✓ Transaction fetched successfully`);
    console.log(`  Slot: ${transaction.slot}`);
    console.log(`  Block Time: ${transaction.blockTime ? new Date(transaction.blockTime * 1000).toISOString() : 'N/A'}`);
    console.log(`  Fee: ${transaction.meta.fee} lamports`);

    // Format transaction for parser
    // The parser expects the transaction in a specific format:
    // { transaction: { transaction: {...}, meta: {...} }, slot: ... }
    const txData = {
      transaction: {
        transaction: transaction.transaction,
        meta: transaction.meta,
      },
      slot: transaction.slot,
    };

    console.log(`\n📊 Parsing transaction with PumpFun parser...`);
    console.log("-".repeat(80));

    // Test the parser
    parsePumpFunTransaction(txData);

    console.log("-".repeat(80));
    console.log(`✓ Parsing completed for signature: ${signature}`);

  } catch (error) {
    console.error(`❌ Error processing signature ${signature}:`, error);
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
  }
}

async function main() {
  console.log("🚀 Starting PumpFun Parser Test");
  console.log(`Testing ${TEST_SIGNATURES.length} transaction(s)\n`);

  // Test each signature
  for (const signature of TEST_SIGNATURES) {
    await testPumpFunParser(signature);
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Test completed");
  console.log("=".repeat(80));
}

// Run the test
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
