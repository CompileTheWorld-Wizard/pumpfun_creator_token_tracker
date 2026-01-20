import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { sessionStore } from './src/shared/sessionStore.js';
import { getSessionConfig } from './src/shared/auth.js';
import { dbService } from './database.js';
import { SolTransferTracker } from './services/solTransferTracker.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.FUND_SERVER_PORT || process.env.PORT || '5006', 10);

// Trust proxy - required when behind nginx reverse proxy
app.set('trust proxy', 1);

// Disable ETag globally to prevent 304 responses for API routes in production
// Express enables ETag by default in production, which causes 304 responses
app.disable('etag');

// Initialize SOL transfer tracker
const solTransferTracker = new SolTransferTracker();

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

// Set no-cache headers for API routes to prevent 304 responses
app.use((req, res, next) => {
  if (req.path.startsWith('/')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  next();
});

// Health check (public)
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'fund_tracking_server',
    tracking: solTransferTracker.getIsStreaming() ? 'active' : 'inactive'
  });
});

// API route to get SOL transfers (authentication handled by frontend proxy)
app.get('/sol-transfers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const transfers = await dbService.getSolTransfers(limit, offset);
    res.json({ transfers });
  } catch (error: any) {
    console.error('Error fetching SOL transfers:', error);
    res.status(500).json({ error: 'Failed to fetch SOL transfers' });
  }
});

// API route to get SOL transfers by sender (authentication handled by frontend proxy)
app.get('/sol-transfers/sender/:sender', async (req, res) => {
  try {
    const { sender } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const transfers = await dbService.getSolTransfersBySender(sender, limit);
    res.json({ transfers });
  } catch (error: any) {
    console.error('Error fetching SOL transfers by sender:', error);
    res.status(500).json({ error: 'Failed to fetch SOL transfers' });
  }
});

// API route to get SOL transfers by receiver (authentication handled by frontend proxy)
app.get('/sol-transfers/receiver/:receiver', async (req, res) => {
  try {
    const { receiver } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const transfers = await dbService.getSolTransfersByReceiver(receiver, limit);
    res.json({ transfers });
  } catch (error: any) {
    console.error('Error fetching SOL transfers by receiver:', error);
    res.status(500).json({ error: 'Failed to fetch SOL transfers' });
  }
});

// API route to get tracking status (authentication handled by frontend proxy)
app.get('/tracking/status', async (_req, res) => {
  try {
    res.json({
      isTracking: solTransferTracker.getIsStreaming(),
      minSolAmount: solTransferTracker.getMinSolAmount()
    });
  } catch (error: any) {
    console.error('Error fetching tracking status:', error);
    res.status(500).json({ error: 'Failed to fetch tracking status' });
  }
});

// API route to start tracking (authentication handled by frontend proxy)
app.post('/tracking/start', async (_req, res) => {
  try {
    const grpcUrl = process.env.GRPC_URL;
    const xToken = process.env.X_TOKEN;

    if (!grpcUrl || !xToken) {
      return res.status(400).json({ error: 'GRPC_URL or X_TOKEN not configured' });
    }

    // Initialize if not already initialized
    if (!solTransferTracker.getIsInitialized()) {
      solTransferTracker.initialize(grpcUrl, xToken);
    }

    solTransferTracker.start();
    return res.json({ success: true, message: 'Tracking started' });
  } catch (error: any) {
    console.error('Error starting tracking:', error);
    return res.status(500).json({ error: error.message || 'Failed to start tracking' });
  }
});

// API route to stop tracking (authentication handled by frontend proxy)
app.post('/tracking/stop', async (_req, res) => {
  try {
    solTransferTracker.stop();
    res.json({ success: true, message: 'Tracking stopped' });
  } catch (error: any) {
    console.error('Error stopping tracking:', error);
    res.status(500).json({ error: error.message || 'Failed to stop tracking' });
  }
});

// API route to update minimum SOL amount (authentication handled by frontend proxy)
app.put('/tracking/min-sol', async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const minAmount = parseFloat(amount);
    if (isNaN(minAmount) || minAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a valid number >= 0' });
    }

    solTransferTracker.setMinSolAmount(minAmount);
    return res.json({ success: true, minSolAmount: minAmount });
  } catch (error: any) {
    console.error('Error updating minimum SOL amount:', error);
    return res.status(500).json({ error: error.message || 'Failed to update minimum SOL amount' });
  }
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    console.log('📊 Initializing database...');
    await dbService.initialize();

    // Note: SOL transfer tracker will be initialized and started only when user clicks start button
    const grpcUrl = process.env.GRPC_URL;
    const xToken = process.env.X_TOKEN;

    if (!grpcUrl || !xToken) {
      console.warn('⚠️  GRPC_URL or X_TOKEN not set. SOL transfer tracking will not be available.');
    } else {
      console.log('✅ SOL transfer tracker ready (will start when user clicks start button)');
    }

    // Start server - Bind to localhost only (accessed via frontend server proxy)
    const HOST = process.env.HOST || '127.0.0.1';
    app.listen(PORT, HOST, () => {
      console.log(`✅ Fund tracking server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  solTransferTracker.stop();
  await dbService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  solTransferTracker.stop();
  await dbService.close();
  process.exit(0);
});

// Start the server
startServer();

