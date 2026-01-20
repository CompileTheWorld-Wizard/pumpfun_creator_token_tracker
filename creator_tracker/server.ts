import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import walletRoutes from './routes/wallets.js';
import streamRoutes from './routes/stream.js';
import tokenRoutes from './routes/tokens.js';
import settingsRoutes from './routes/settings.js';
import { initializeConsoleSanitizer } from './utils/consoleSanitizer.js';
import { sessionStore } from './src/shared/sessionStore.js';
import { getSessionConfig } from './src/shared/auth.js';

dotenv.config();

// Initialize console sanitizer early to prevent binary data corruption in terminal output
initializeConsoleSanitizer();

const app = express();
const PORT = parseInt(process.env.CREATOR_SERVER_PORT || process.env.PORT || '5005', 10);

// Trust proxy - required when behind nginx reverse proxy
// This allows Express to correctly identify the original request
app.set('trust proxy', 1);

// Middleware - Simplified CORS since only accessed via localhost proxy
app.use(cors({
  origin: true, // Allow all origins (only accessible via localhost proxy)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration - using shared Redis store
app.use(session({
  ...getSessionConfig(),
  store: sessionStore,
}));

// Routes (authentication is handled by frontend proxy)
app.use('/wallets', walletRoutes);
app.use('/stream', streamRoutes);
app.use('/tokens', tokenRoutes);
app.use('/settings', settingsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Note: Static files are served by the frontend/auth server

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect();
    
    // Migrate creator_wallets to tbl_soltrack_blacklist_creator if old table exists
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'creator_wallets'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'tbl_soltrack_blacklist_creator'
        ) THEN
          ALTER TABLE creator_wallets RENAME TO tbl_soltrack_blacklist_creator;
        END IF;
      END $$;
    `);
    
    // Migrate blacklist_creator to tbl_soltrack_blacklist_creator if old table exists
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'blacklist_creator'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'tbl_soltrack_blacklist_creator'
        ) THEN
          ALTER TABLE blacklist_creator RENAME TO tbl_soltrack_blacklist_creator;
        END IF;
      END $$;
    `);
    
    // Create tbl_soltrack_blacklist_creator table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tbl_soltrack_blacklist_creator (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add name column if it doesn't exist (migration for existing tables)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tbl_soltrack_blacklist_creator' AND column_name = 'name'
        ) THEN
          ALTER TABLE tbl_soltrack_blacklist_creator ADD COLUMN name VARCHAR(255);
        END IF;
      END $$;
    `);
    
    // Remove user_id column if it exists (migration for old schema)
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tbl_soltrack_blacklist_creator' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE tbl_soltrack_blacklist_creator DROP COLUMN user_id;
        END IF;
      END $$;
    `);
    
    // Ensure wallet_address is unique if not already
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'tbl_soltrack_blacklist_creator_wallet_address_key'
        ) THEN
          ALTER TABLE tbl_soltrack_blacklist_creator ADD CONSTRAINT tbl_soltrack_blacklist_creator_wallet_address_key UNIQUE (wallet_address);
        END IF;
      END $$;
    `);
    
    // Migrate created_tokens to tbl_soltrack_created_tokens if old table exists
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'created_tokens'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'tbl_soltrack_created_tokens'
        ) THEN
          ALTER TABLE created_tokens RENAME TO tbl_soltrack_created_tokens;
        END IF;
      END $$;
    `);
    
    
    // Add is_fetched column to tbl_soltrack_created_tokens if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tbl_soltrack_created_tokens' AND column_name = 'is_fetched'
        ) THEN
          ALTER TABLE tbl_soltrack_created_tokens ADD COLUMN is_fetched BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);
    
    // Create scoring settings table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tbl_soltrack_scoring_settings (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        settings JSONB NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tbl_soltrack_scoring_settings_default 
      ON tbl_soltrack_scoring_settings(is_default)
    `);
    
    // Ensure only one default setting exists (create unique partial index)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = 'idx_tbl_soltrack_scoring_settings_single_default'
        ) THEN
          CREATE UNIQUE INDEX idx_tbl_soltrack_scoring_settings_single_default 
          ON tbl_soltrack_scoring_settings(is_default) 
          WHERE is_default = TRUE;
        END IF;
      END $$;
    `);
    
    // Create table for currently applied settings (only one row allowed)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tbl_soltrack_applied_settings (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        preset_id INTEGER REFERENCES tbl_soltrack_scoring_settings(id) ON DELETE SET NULL,
        settings JSONB NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Initialize default scoring settings if none exists
    const scoringSettingsCheck = await client.query(
      'SELECT COUNT(*) as count FROM tbl_soltrack_scoring_settings WHERE is_default = TRUE'
    );
    
    if (parseInt(scoringSettingsCheck.rows[0].count) === 0) {
      const defaultScoringSettings = {
        trackingTimeSeconds: 15,
        rugThresholdMcap: 6000, // Default 6k market cap threshold
        includeTimeBucketRugRate: false, // Default: exclude from total score
        winRate: {
          ranges: [
            { min: 0, max: 20, score: 1 },
            { min: 21, max: 40, score: 2 },
            { min: 41, max: 60, score: 3 },
            { min: 61, max: 80, score: 4 },
            { min: 81, max: 100, score: 5 }
          ]
        },
        avgAthMcap: {
          ranges: [
            { min: 0, max: 20, score: 1 },
            { min: 21, max: 40, score: 2 },
            { min: 41, max: 60, score: 3 },
            { min: 61, max: 80, score: 4 },
            { min: 81, max: 100, score: 5 }
          ]
        },
        medianAthMcap: {
          ranges: [
            { min: 0, max: 20, score: 1 },
            { min: 21, max: 40, score: 2 },
            { min: 41, max: 60, score: 3 },
            { min: 61, max: 80, score: 4 },
            { min: 81, max: 100, score: 5 }
          ]
        },
        multiplierConfigs: [
          {
            multiplier: 1.5,
            ranges: [
              { min: 0, max: 20, score: 1 },
              { min: 21, max: 40, score: 2 },
              { min: 41, max: 60, score: 3 },
              { min: 61, max: 80, score: 4 },
              { min: 81, max: 100, score: 5 }
            ]
          },
          {
            multiplier: 2,
            ranges: [
              { min: 0, max: 20, score: 1 },
              { min: 21, max: 40, score: 2 },
              { min: 41, max: 60, score: 3 },
              { min: 61, max: 80, score: 4 },
              { min: 81, max: 100, score: 5 }
            ]
          },
          {
            multiplier: 3,
            ranges: [
              { min: 0, max: 20, score: 1 },
              { min: 21, max: 40, score: 2 },
              { min: 41, max: 60, score: 3 },
              { min: 61, max: 80, score: 4 },
              { min: 81, max: 100, score: 5 }
            ]
          },
          {
            multiplier: 5,
            ranges: [
              { min: 0, max: 20, score: 1 },
              { min: 21, max: 40, score: 2 },
              { min: 41, max: 60, score: 3 },
              { min: 61, max: 80, score: 4 },
              { min: 81, max: 100, score: 5 }
            ]
          },
          {
            multiplier: 10,
            ranges: [
              { min: 0, max: 20, score: 1 },
              { min: 21, max: 40, score: 2 },
              { min: 41, max: 60, score: 3 },
              { min: 61, max: 80, score: 4 },
              { min: 81, max: 100, score: 5 }
            ]
          }
        ],
        avgRugRate: {
          ranges: [
            { min: 0, max: 20, score: -2 },
            { min: 21, max: 40, score: -4 },
            { min: 41, max: 60, score: -6 },
            { min: 61, max: 80, score: -8 },
            { min: 81, max: 100, score: -10 }
          ]
        },
        avgRugRateByTimeBucket: {
          ranges: [
            { min: 1, max: 3, score: -10 },
            { min: 3, max: 6, score: -8 },
            { min: 6, max: 9, score: -6 },
            { min: 9, max: 12, score: -4 },
            { min: 12, max: 15, score: -2 }
          ]
        }
      };
      
      await client.query(
        'INSERT INTO tbl_soltrack_scoring_settings (name, settings, is_default) VALUES ($1, $2, $3)',
        ['Default', JSON.stringify(defaultScoringSettings), true]
      );
    }
    
    client.release();

    // Bind to localhost only (accessed via frontend server proxy)
    const HOST = process.env.HOST || '127.0.0.1';
    app.listen(PORT, HOST, () => {
      console.log(`✅ Creator tracking server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

