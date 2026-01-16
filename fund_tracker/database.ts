import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export interface SolTransferRecord {
  id?: number;
  signature: string;
  sender: string;
  receiver: string;
  block_number: number; // Slot number
  amount: number; // Amount in SOL
  created_at?: Date;
}

class DatabaseService {
  private pool: Pool;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize connection pool with environment variables
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'soltrack',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20, // Maximum number of clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  /**
   * Initialize the database (create table if not exists)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test database connection first
      console.log('🔌 Testing database connection...');
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connection successful');
      
      // Check if database exists and is accessible
      const dbName = process.env.DB_NAME || 'soltrack';
      console.log(`📊 Using database: ${dbName}`);
      
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS tbl_fund_sol_transfers (
          id SERIAL PRIMARY KEY,
          signature VARCHAR(128) UNIQUE NOT NULL,
          sender VARCHAR(64) NOT NULL,
          receiver VARCHAR(64) NOT NULL,
          block_number BIGINT NOT NULL,
          amount NUMERIC(20, 9) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_fund_transfer_signature ON tbl_fund_sol_transfers(signature);
        CREATE INDEX IF NOT EXISTS idx_fund_transfer_sender ON tbl_fund_sol_transfers(sender);
        CREATE INDEX IF NOT EXISTS idx_fund_transfer_receiver ON tbl_fund_sol_transfers(receiver);
        CREATE INDEX IF NOT EXISTS idx_fund_transfer_block_number ON tbl_fund_sol_transfers(block_number);
        CREATE INDEX IF NOT EXISTS idx_fund_transfer_created_at ON tbl_fund_sol_transfers(created_at);
      `;

      await this.pool.query(createTableQuery);
      console.log('✅ Database table initialized: tbl_fund_sol_transfers');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Save SOL transfer record to database
   */
  async saveSolTransfer(transfer: SolTransferRecord): Promise<void> {
    try {
      const query = `
        INSERT INTO tbl_fund_sol_transfers (signature, sender, receiver, block_number, amount)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (signature) DO NOTHING
      `;

      await this.pool.query(query, [
        transfer.signature,
        transfer.sender,
        transfer.receiver,
        transfer.block_number,
        transfer.amount
      ]);
    } catch (error) {
      console.error('❌ Failed to save SOL transfer:', error);
      throw error;
    }
  }

  /**
   * Get all SOL transfers (with optional filters)
   */
  async getSolTransfers(limit: number = 100, offset: number = 0): Promise<SolTransferRecord[]> {
    try {
      const query = `
        SELECT 
          id,
          signature,
          sender,
          receiver,
          block_number,
          amount,
          created_at
        FROM tbl_fund_sol_transfers
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await this.pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get SOL transfers:', error);
      throw error;
    }
  }

  /**
   * Get SOL transfers by sender
   */
  async getSolTransfersBySender(sender: string, limit: number = 100): Promise<SolTransferRecord[]> {
    try {
      const query = `
        SELECT 
          id,
          signature,
          sender,
          receiver,
          block_number,
          amount,
          created_at
        FROM tbl_fund_sol_transfers
        WHERE sender = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [sender, limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get SOL transfers by sender:', error);
      throw error;
    }
  }

  /**
   * Get SOL transfers by receiver
   */
  async getSolTransfersByReceiver(receiver: string, limit: number = 100): Promise<SolTransferRecord[]> {
    try {
      const query = `
        SELECT 
          id,
          signature,
          sender,
          receiver,
          block_number,
          amount,
          created_at
        FROM tbl_fund_sol_transfers
        WHERE receiver = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [receiver, limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get SOL transfers by receiver:', error);
      throw error;
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const dbService = new DatabaseService();
