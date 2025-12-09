import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallets.js';
import streamRoutes from './routes/stream.js';
import tokenRoutes from './routes/tokens.js';
import { initializeConsoleSanitizer } from './utils/consoleSanitizer.js';

dotenv.config();

// Initialize console sanitizer early to prevent binary data corruption in terminal output
initializeConsoleSanitizer();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '5005', 10);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development mode, allow all origins
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      return callback(null, true);
    }
    
    // Allow localhost on any port (both http and https)
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
      return callback(null, true);
    }
    
    // Allow 127.0.0.1 on any port
    if (origin.match(/^https?:\/\/127\.0\.0\.1(:\d+)?$/)) {
      return callback(null, true);
    }
    
    // Allow IP addresses (for server access via IP)
    if (origin.match(/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/)) {
      return callback(null, true);
    }
    
    // Allow specific origins from environment variable (comma-separated)
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(o => o) || [];
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In production, reject unknown origins
    console.warn(`CORS: Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/tokens', tokenRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist-frontend');
  app.use(express.static(distPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Create creator_wallets table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_wallets (
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
          WHERE table_name = 'creator_wallets' AND column_name = 'name'
        ) THEN
          ALTER TABLE creator_wallets ADD COLUMN name VARCHAR(255);
        END IF;
      END $$;
    `);
    
    // Remove user_id column if it exists (migration for old schema)
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'creator_wallets' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE creator_wallets DROP COLUMN user_id;
        END IF;
      END $$;
    `);
    
    // Ensure wallet_address is unique if not already
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'creator_wallets_wallet_address_key'
        ) THEN
          ALTER TABLE creator_wallets ADD CONSTRAINT creator_wallets_wallet_address_key UNIQUE (wallet_address);
        END IF;
      END $$;
    `);
    
    console.log('Database table creator_wallets initialized');
    
    // Create passwords table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS passwords (
        id SERIAL PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Database table passwords initialized');
    
    // Initialize default password if no password exists
    const passwordCheck = await client.query(
      'SELECT COUNT(*) as count FROM passwords'
    );
    
    if (parseInt(passwordCheck.rows[0].count) === 0) {
      const defaultPassword = process.env.DEFAULT_PASSWORD || 'admin123';
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
      
      await client.query(
        'INSERT INTO passwords (password_hash) VALUES ($1)',
        [passwordHash]
      );
      console.log('Default password initialized (use DEFAULT_PASSWORD env var to customize)');
    }
    
    client.release();

    // Bind to 0.0.0.0 to allow external connections (required for remote server access)
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

