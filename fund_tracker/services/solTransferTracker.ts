import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import { dbService, SolTransferRecord } from "../database.js";

const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const DEFAULT_MIN_SOL_AMOUNT = 10; // Default minimum SOL amount to track

export class SolTransferTracker {
  private parser: Parser;
  private streamer: TransactionStreamer | null = null;
  private isStreaming: boolean = false;
  private minSolAmount: number = DEFAULT_MIN_SOL_AMOUNT;
  private isInitialized: boolean = false;

  constructor() {
    this.parser = new Parser();
    this.parser.useDefaultInstructionParsing(true);
    this.parser.enableLogging(false);
  }

  /**
   * Initialize the streamer with grpc url and token
   */
  public initialize(grpcUrl: string, xToken: string): void {
    if (!grpcUrl || !xToken) {
      throw new Error("GRPC_URL and X_TOKEN are required");
    }

    // Stop existing streamer if running
    if (this.isStreaming && this.streamer) {
      this.stop();
    }

    this.streamer = new TransactionStreamer(grpcUrl, xToken);
    this.streamer.addParser(this.parser);
    
    // Add system program address to track
    this.streamer.addAddresses([SYSTEM_PROGRAM_ID]);
    
    // Set up data processing callback
    this.streamer.onData(this.processTransaction.bind(this));
    
    // Set up error callback
    this.streamer.onError((error: any) => {
      console.error('❌ Streamer error:', error);
    });

    this.isInitialized = true;
    console.log("✅ SolTransferTracker initialized");
  }

  /**
   * Check if tracker is initialized
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Process incoming transaction data
   */
  private async processTransaction(processed: any): Promise<void> {
    try {
      const { slot, meta, transaction } = processed;
      
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

        // Only track transfers >= minimum SOL amount
        if (amountSOL < this.minSolAmount) {
          continue;
        }
        
        // Get signature and slot
        const signature = transaction.signatures?.[0];

        if (!signature || slot === null) {
          console.warn('⚠️ Missing signature or slot for transfer');
          continue;
        }

        // Create transfer record
        const transferRecord: SolTransferRecord = {
          signature,
          sender,
          receiver,
          block_number: slot,
          amount: amountSOL
        };

        // Save to database
        try {
          await dbService.saveSolTransfer(transferRecord);
          console.log(`💰 SOL Transfer recorded: ${amountSOL.toFixed(9)} SOL from ${sender.substring(0, 8)}... to ${receiver.substring(0, 8)}... (Signature: ${signature.substring(0, 16)}...)`);
        } catch (error) {
          console.error('❌ Failed to save SOL transfer:', error);
        }
      }
    } catch (error: any) {
      console.error('❌ Error processing transaction:', error?.message || error);
    }
  }

  /**
   * Start streaming
   */
  public start(): void {
    if (!this.streamer) {
      throw new Error("Tracker not initialized. Call initialize() first.");
    }

    if (this.isStreaming) {
      console.warn("⚠️  Tracker is already running");
      return;
    }

    this.streamer.start();
    this.isStreaming = true;
    console.log("🚀 Started SOL transfer tracking...");
  }

  /**
   * Stop streaming
   */
  public stop(): void {
    if (!this.streamer) {
      return;
    }

    if (!this.isStreaming) {
      console.warn("⚠️  Tracker is not running");
      return;
    }

    this.isStreaming = false;
    if (this.streamer.stop) {
      this.streamer.stop();
    }
    console.log("🛑 Stopped SOL transfer tracking");
  }

  /**
   * Check if tracker is currently streaming
   */
  public getIsStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Get minimum SOL amount
   */
  public getMinSolAmount(): number {
    return this.minSolAmount;
  }

  /**
   * Set minimum SOL amount
   */
  public setMinSolAmount(amount: number): void {
    if (amount < 0) {
      throw new Error("Minimum SOL amount must be >= 0");
    }
    this.minSolAmount = amount;
    console.log(`✅ Minimum SOL amount updated to ${amount} SOL`);
  }
}
