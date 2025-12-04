import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db';
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallets';
import streamRoutes from './routes/stream';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;

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
        user_id VARCHAR(255) NOT NULL,
        wallet_address VARCHAR(44) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, wallet_address)
      )
    `);
    console.log('Database table creator_wallets initialized');
    
    client.release();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

