import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'soltrack',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Redis client for session store
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_SESSION_DB || process.env.REDIS_DB || '1'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
} as any);

const sessionStore = new RedisStore({
  client: redisClient,
  prefix: 'soltrack:sess:',
});

redisClient.on('connect', () => {
  console.log('[AuthServer] Connected to Redis for session storage');
});

redisClient.on('error', (err) => {
  console.error('[AuthServer] Redis connection error:', err);
});

// Session configuration
const getSessionConfig = () => {
  const SESSION_SECRET = process.env.SESSION_SECRET || 'soltrack-shared-secret-change-in-production';
  const useHttps = process.env.USE_HTTPS === 'true';
  let cookieDomain = process.env.SESSION_COOKIE_DOMAIN;
  const sameSiteValue: 'none' | 'lax' | 'strict' = 'lax';
  const secureCookie = useHttps;
  
  return {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: secureCookie,
      httpOnly: true,
      sameSite: sameSiteValue,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
    name: 'soltrack.sid', // Unified session cookie name for all servers
  };
};

const app = express();
const PORT = parseInt(process.env.AUTH_SERVER_PORT || process.env.PORT || '5004', 10);

// Trust proxy - required when behind nginx reverse proxy
app.set('trust proxy', 1);

// Disable ETag globally to prevent 304 responses for API routes in production
// Express enables ETag by default in production, which causes 304 responses
app.disable('etag');

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      return callback(null, true);
    }
    
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
      return callback(null, true);
    }
    
    if (origin.match(/^https?:\/\/127\.0\.0\.1(:\d+)?$/)) {
      return callback(null, true);
    }
    
    if (origin.match(/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/)) {
      return callback(null, true);
    }
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(o => o) || [];
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn(`CORS: Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  ...getSessionConfig(),
  store: sessionStore,
}));

// Set no-cache headers for API routes to prevent 304 responses
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  next();
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM passwords ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ 
        error: 'Password not configured. Please contact administrator.' 
      });
    }

    const passwordHash = result.rows[0].password_hash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (isValid) {
      (req.session as any).authenticated = true;
      (req.session as any).userId = 'admin';
      
      return res.json({ 
        success: true, 
        message: 'Login successful' 
      });
    } else {
      return res.status(401).json({ 
        error: 'Invalid password' 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

app.post('/api/auth/logout', (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.get('/api/auth/check', (req, res) => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  res.json({ authenticated: isAuthenticated });
});

app.post('/api/auth/change-password', async (req, res) => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      error: 'Current password and new password are required' 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      error: 'New password must be at least 6 characters long' 
    });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM passwords ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ 
        error: 'Password not configured' 
      });
    }

    const currentPasswordHash = result.rows[0].password_hash;
    const isValid = await bcrypt.compare(currentPassword, currentPasswordHash);

    if (!isValid) {
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await pool.query(
      'INSERT INTO passwords (password_hash) VALUES ($1)',
      [newPasswordHash]
    );

    return res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

app.post('/api/auth/clear-database', async (req, res) => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ 
      error: 'Password is required' 
    });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM passwords ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ 
        error: 'Password not configured' 
      });
    }

    const passwordHash = result.rows[0].password_hash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!isValid) {
      return res.status(401).json({ 
        error: 'Invalid password' 
      });
    }

    await pool.query('TRUNCATE TABLE tbl_soltrack_created_tokens CASCADE');
    await pool.query('TRUNCATE TABLE tbl_soltrack_blacklist_creator CASCADE');

    console.log('[ClearDatabase] Database cleared successfully');

    return res.json({ 
      success: true, 
      message: 'Database cleared successfully' 
    });
  } catch (error: any) {
    console.error('Clear database error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', server: 'frontend-server' });
});

// Backend server ports (running on localhost via PM2)
const CREATOR_TRACKER_PORT = parseInt(process.env.CREATOR_SERVER_PORT || '5005', 10);
const TRADE_TRACKER_PORT = parseInt(process.env.TRADE_SERVER_PORT || '5007', 10);
const FUND_TRACKER_PORT = parseInt(process.env.FUND_SERVER_PORT || '5006', 10);

// Proxy configuration for backend services
const proxyOptions = {
  changeOrigin: true,
  ws: false,
  onProxyReq: (proxyReq: any, req: express.Request) => {
    // Forward session cookie
    if (req.headers.cookie) {
      proxyReq.setHeader('Cookie', req.headers.cookie);
    }
    // Forward other headers
    if (req.headers['x-forwarded-for']) {
      proxyReq.setHeader('X-Forwarded-For', req.headers['x-forwarded-for']);
    }
    if (req.headers['x-real-ip']) {
      proxyReq.setHeader('X-Real-IP', req.headers['x-real-ip']);
    }
  },
  onProxyRes: (proxyRes: any, req: express.Request, res: express.Response) => {
    // Forward set-cookie headers to maintain session
    if (proxyRes.headers['set-cookie']) {
      res.setHeader('Set-Cookie', proxyRes.headers['set-cookie']);
    }
  },
  onError: (err: Error, req: express.Request, res: express.Response) => {
    console.error(`[Proxy Error] ${req.path}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ 
        error: 'Backend service unavailable',
        message: err.message 
      });
    }
  }
};

// Helper function to determine which backend service handles a route
const getBackendTarget = (req: express.Request): string | null => {
  const path = req.path;
  const method = req.method.toUpperCase();
  
  // Fund Tracker routes (must come first to avoid conflicts)
  if (path.startsWith('/api/sol-transfers') || path.startsWith('/api/tracking')) {
    return `http://127.0.0.1:${FUND_TRACKER_PORT}`;
  }
  
  // Creator Tracker specific routes
  if (path.startsWith('/api/stream') || path.startsWith('/api/settings')) {
    return `http://127.0.0.1:${CREATOR_TRACKER_PORT}`;
  }
  
  // Trade Tracker specific token routes (must come before generic /api/tokens)
  if (path.startsWith('/api/tokens/fetch-info') || 
      path.startsWith('/api/tokens/ath-mcap')) {
    return `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
  }
  
  // Creator Tracker token routes (generic /api/tokens)
  if (path.startsWith('/api/tokens')) {
    return `http://127.0.0.1:${CREATOR_TRACKER_PORT}`;
  }
  
  // Trade Tracker specific routes
  const tradeTrackerRoutes = [
    '/api/status',
    '/api/addresses',
    '/api/start',
    '/api/stop',
    '/api/transactions',
    '/api/export-token',
    '/api/export-token-excel',
    '/api/export-all-tokens-excel',
    '/api/analyze',
    '/api/skip-tokens',
    '/api/dashboard-statistics',
    '/api/dashboard-data',
    '/api/what-if',
    '/api/creator-tokens',
    '/api/wallet-activity',
    '/api/dashboard-filter-presets',
    '/api/sol-price'
  ];
  
  if (tradeTrackerRoutes.some(route => path.startsWith(route))) {
    return `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
  }
  
  // Handle /api/wallets conflict: 
  // - GET /api/wallets -> Trade Tracker (list tracked wallets)
  // - DELETE /api/wallets/:address -> Trade Tracker (remove tracked wallet)
  // - POST/PUT /api/wallets -> Creator Tracker (manage creator wallets)
  if (path.startsWith('/api/wallets')) {
    if (method === 'GET' || (method === 'DELETE' && path.match(/^\/api\/wallets\/[^/]+$/))) {
      return `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
    }
    // POST, PUT, etc. go to Creator Tracker
    return `http://127.0.0.1:${CREATOR_TRACKER_PORT}`;
  }
  
  // Default: route to trade tracker for any other /api routes
  if (path.startsWith('/api/')) {
    return `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
  }
  
  return null;
};

// Authentication check middleware for proxied routes
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Proxy middleware for all API routes (except auth which is handled above)
app.use('/api', (req, res, next) => {
  // Skip auth routes and health check (handled directly above)
  if (req.path.startsWith('/api/auth') || req.path === '/api/health') {
    return next();
  }
  
  // Check authentication before proxying to backend services
  requireAuth(req, res, () => {
    const target = getBackendTarget(req);
    
    if (!target) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    // Create proxy for this specific request
    const proxy = createProxyMiddleware({
      ...proxyOptions,
      target,
    });
    
    proxy(req, res, next);
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // __dirname is 'dist' when running from compiled server.js
  // dist-frontend is at the frontend root, so go up one level
  const distPath = path.join(__dirname, '..', 'dist-frontend');
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
    
    // Create passwords table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS passwords (
        id SERIAL PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
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
    }
    
    client.release();

    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`✅ Auth server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
