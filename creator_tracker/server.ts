import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, testConnection } from './db.js';
import walletRoutes from './routes/wallets.js';
import streamRoutes from './routes/stream.js';
import tokenRoutes from './routes/tokens.js';
import settingsRoutes from './routes/settings.js';
import { initializeConsoleSanitizer } from './utils/consoleSanitizer.js';

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

// Request logging middleware - log all API calls
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[Creator Tracker] [${timestamp}] ${req.method} ${req.originalUrl || req.url}`);
  console.error(`[Creator Tracker] Query params:`, req.query);
  console.error(`[Creator Tracker] Body keys:`, req.body ? Object.keys(req.body) : 'none');
  
  // Special logging for creators/analytics route
  if (req.path.includes('/creators/analytics') || req.originalUrl?.includes('/creators/analytics')) {
    console.error(`[Creator Tracker] ===== CREATORS/ANALYTICS REQUEST DETECTED =====`);
    console.error(`[Creator Tracker] Full path: ${req.path}, OriginalUrl: ${req.originalUrl}, Method: ${req.method}`);
  }
  
  next();
});

// Routes (authentication handled by frontend)
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
    // Test ClickHouse connection
    await testConnection();
    
    console.log('✅ Database connection successful');
    console.log('📝 Note: Ensure ClickHouse schema is created using clickhouse_schema.sql');
    
    // Initialize default scoring settings if none exists (ClickHouse version)
    const scoringSettingsCheck = await pool.query(
      'SELECT count() as count FROM tbl_soltrack_scoring_settings WHERE is_default = 1'
    );
    
    if (parseInt(scoringSettingsCheck.rows[0]?.count || '0') === 0) {
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
      
      await pool.query(
        'INSERT INTO tbl_soltrack_scoring_settings (name, settings, is_default) VALUES ($1, $2, $3)',
        ['Default', JSON.stringify(defaultScoringSettings), 1]
      );
    }

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

