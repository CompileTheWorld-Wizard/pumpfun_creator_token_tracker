import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import axios, { AxiosRequestConfig } from 'axios';

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

// Helper function to make HTTP requests to backend services
const forwardRequest = async (req: express.Request, res: express.Response, target: string, path: string): Promise<void> => {
  try {
    console.error(`[HTTP Forward] ${req.method} ${path} -> ${target}${path}`);
    
    // Build the full URL with query parameters
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const url = `${target}${path}${queryString}`;
    
    // Prepare headers to forward
    const headers: Record<string, string> = {};
    
    // Forward session cookie
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }
    
    // Forward other important headers
    if (req.headers['x-forwarded-for']) {
      headers['X-Forwarded-For'] = req.headers['x-forwarded-for'] as string;
    }
    if (req.headers['x-real-ip']) {
      headers['X-Real-IP'] = req.headers['x-real-ip'] as string;
    }
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'] as string;
    }
    
    // Prepare axios config
    const axiosConfig: AxiosRequestConfig = {
      method: req.method as any,
      url,
      headers,
      timeout: 300000, // 5 minute timeout
      validateStatus: () => true, // Don't throw on any status code
      responseType: 'arraybuffer', // Get raw response to forward headers properly
    };
    
    // Add request body if present
    if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      axiosConfig.data = req.body;
    }
    
    // Make the request
    const response = await axios(axiosConfig);
    
    console.error(`[HTTP Forward] Response from ${target}${path}: ${response.status}`);
    
    // Forward response headers (set-cookie needs special handling)
    if (response.headers['set-cookie']) {
      const setCookie = response.headers['set-cookie'];
      if (Array.isArray(setCookie)) {
        setCookie.forEach(cookie => res.append('Set-Cookie', cookie));
      } else {
        res.setHeader('Set-Cookie', setCookie);
      }
    }
    
    // Forward all other headers (except ones that shouldn't be forwarded)
    const headersToSkip = ['content-encoding', 'transfer-encoding', 'connection', 'content-length', 'set-cookie'];
    Object.keys(response.headers).forEach(key => {
      if (!headersToSkip.includes(key.toLowerCase())) {
        const value = response.headers[key];
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => res.append(key, v));
          } else {
            res.setHeader(key, value);
          }
        }
      }
    });
    
    // Set status and send response
    res.status(response.status);
    
    // Send response data
    if (response.data) {
      const buffer = Buffer.from(response.data);
      res.send(buffer);
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error(`[HTTP Forward] Error for ${req.method} ${path} to ${target}:`, err.message);
    console.error(`[HTTP Forward] Error stack:`, err.stack);
    
    if (!res.headersSent) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        res.status(502).json({ 
          error: 'Backend service unavailable',
          message: err.message 
        });
      } else {
        res.status(500).json({ 
          error: 'Request failed',
          message: err.message 
        });
      }
    }
  }
};

// Helper function to determine which backend service handles a route
// Note: req.path inside app.use('/api', ...) has the '/api' prefix stripped
const getBackendTarget = (req: express.Request): string | null => {
  const path = req.path; // This will be like '/settings/applied/get', not '/api/settings/applied/get'
  const method = req.method.toUpperCase();
  
  // Log routing decision for debugging
  console.error(`[Frontend Proxy] Routing: ${method} ${path} (originalUrl: ${req.originalUrl})`);
  
  // Fund Tracker routes (must come first to avoid conflicts)
  if (path.startsWith('/sol-transfers') || path.startsWith('/tracking')) {
    const target = `http://127.0.0.1:${FUND_TRACKER_PORT}`;
    console.error(`[Frontend Proxy] -> Fund Tracker: ${target}`);
    return target;
  }
  
  // Creator Tracker specific routes
  if (path.startsWith('/stream') || path.startsWith('/settings')) {
    const target = `http://127.0.0.1:${CREATOR_TRACKER_PORT}`;
    console.error(`[Frontend Proxy] -> Creator Tracker: ${target}`);
    return target;
  }
  
  // Trade Tracker specific token routes (must come before generic /tokens)
  if (path.startsWith('/tokens/fetch-info') || 
      path.startsWith('/tokens/ath-mcap')) {
    const target = `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
    console.error(`[Frontend Proxy] -> Trade Tracker: ${target}`);
    return target;
  }
  
  // Creator Tracker token routes (generic /tokens)
  // This includes: /tokens, /tokens/creators/analytics, /tokens/creators/list, etc.
  if (path.startsWith('/tokens')) {
    const target = `http://127.0.0.1:${CREATOR_TRACKER_PORT}`;
    console.error(`[Frontend Proxy] -> Creator Tracker (tokens): ${target} for path: ${path}`);
    return target;
  }
  
  // Trade Tracker specific routes
  const tradeTrackerRoutes = [
    '/status',
    '/addresses',
    '/start',
    '/stop',
    '/transactions',
    '/export-token',
    '/export-token-excel',
    '/export-all-tokens-excel',
    '/analyze',
    '/skip-tokens',
    '/dashboard-statistics',
    '/dashboard-data',
    '/what-if',
    '/creator-tokens',
    '/wallet-activity',
    '/dashboard-filter-presets',
    '/sol-price'
  ];
  
  if (tradeTrackerRoutes.some(route => path.startsWith(route))) {
    return `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
  }
  
  // Handle /wallets conflict: 
  // - GET /wallets -> Trade Tracker (list tracked wallets)
  // - DELETE /wallets/:address -> Trade Tracker (remove tracked wallet)
  // - POST/PUT /wallets -> Creator Tracker (manage creator wallets)
  if (path.startsWith('/wallets')) {
    if (method === 'GET' || (method === 'DELETE' && path.match(/^\/wallets\/[^/]+$/))) {
      return `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
    }
    // POST, PUT, etc. go to Creator Tracker
    return `http://127.0.0.1:${CREATOR_TRACKER_PORT}`;
  }
  
  // Default: route to trade tracker for any other routes
  // Since we're already inside /api middleware, any path here is an API route
  const target = `http://127.0.0.1:${TRADE_TRACKER_PORT}`;
  console.error(`[Frontend Proxy] -> Trade Tracker (default): ${target}`);
  return target;
};

// Authentication check middleware for forwarded routes
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction | (() => Promise<void>)): void => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  
  if (!isAuthenticated) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  const result = next();
  // If next returns a promise, handle it
  if (result && typeof result === 'object' && 'then' in result) {
    (result as Promise<void>).catch((err: Error) => {
      console.error(`[Auth] Error in next callback:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
};

// Proxy middleware for all API routes (except auth which is handled above)
app.use('/api', (req, res, next) => {
  // Log all incoming API requests
  console.error(`[Frontend API Middleware] ${req.method} ${req.originalUrl || req.url}`);
  console.error(`[Frontend API Middleware] req.path: ${req.path}, req.url: ${req.url}`);
  
  // Skip auth routes and health check (handled directly above)
  // Note: req.path inside app.use('/api', ...) has '/api' stripped, so check for '/auth' not '/api/auth'
  if (req.path.startsWith('/auth') || req.path === '/health') {
    console.error(`[Frontend API Middleware] Skipping auth/health route: ${req.path}`);
    return next();
  }
  
  // Check authentication before forwarding to backend services
  requireAuth(req, res, async (): Promise<void> => {
    const target = getBackendTarget(req);
    
    console.error(`[Frontend API Middleware] ${req.method} ${req.path} -> target: ${target || 'NOT FOUND'}`);
    
    if (!target) {
      console.error(`[Frontend API Middleware] Route not found: ${req.method} ${req.path}`);
      res.status(404).json({ error: 'Route not found' });
      return;
    }
    
    // Forward request to backend service
    // Note: req.path has '/api' stripped by Express
    // Backend services expect paths WITHOUT /api prefix, so pass as-is
    await forwardRequest(req, res, target, req.path);
  });
});

// Handle /trade-api routes - forward directly to trade tracker
app.use('/trade-api', (req, res, next) => {
  console.error(`[Trade-API] Request received: ${req.method} ${req.originalUrl}, req.path: ${req.path}`);
  requireAuth(req, res, async () => {
    // req.path is stripped of /trade-api prefix by Express
    // So /trade-api/skip-tokens becomes /skip-tokens in req.path
    // Pass path as-is to backend (no /api prefix needed)
    await forwardRequest(req, res, `http://127.0.0.1:${TRADE_TRACKER_PORT}`, req.path);
  });
});

// Handle /fund-api routes - forward directly to fund tracker
app.use('/fund-api', (req, res, next) => {
  console.error(`[Fund-API] Request received: ${req.method} ${req.originalUrl}, req.path: ${req.path}`);
  requireAuth(req, res, async () => {
    // req.path is stripped of /fund-api prefix by Express
    // So /fund-api/tracking/status becomes /tracking/status in req.path
    // Pass path as-is to backend (no /api prefix needed)
    await forwardRequest(req, res, `http://127.0.0.1:${FUND_TRACKER_PORT}`, req.path);
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // __dirname is 'dist' when running from compiled server.js
  // dist-frontend is at the frontend root, so go up one level
  const distPath = path.resolve(__dirname, '..', 'dist-frontend');
  
  // Log the path for debugging
  console.log(`[Static] Serving static files from: ${distPath}`);
  console.log(`[Static] __dirname is: ${__dirname}`);
  
  // Check if directory exists
  if (!fs.existsSync(distPath)) {
    console.error(`[Static] ERROR: dist-frontend directory not found at: ${distPath}`);
    console.error(`[Static] Please ensure the frontend has been built with 'npm run build:frontend'`);
  } else {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      console.error(`[Static] ERROR: index.html not found at: ${indexPath}`);
    } else {
      console.log(`[Static] Static files directory found and index.html exists`);
    }
    
    // Check if assets directory exists
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      const assetsFiles = fs.readdirSync(assetsPath);
      console.log(`[Static] Assets directory found with ${assetsFiles.length} files`);
      if (assetsFiles.length > 0) {
        console.log(`[Static] Sample assets: ${assetsFiles.slice(0, 3).join(', ')}`);
      }
    } else {
      console.warn(`[Static] WARNING: assets directory not found at: ${assetsPath}`);
    }
  }
  
  // Add logging middleware BEFORE static to see all asset requests
  app.use((req, _res, next) => {
    if (req.path.startsWith('/assets/')) {
      const filePath = path.join(distPath, req.path);
      const exists = fs.existsSync(filePath);
      console.log(`[Static] Asset request: ${req.path} -> ${exists ? 'EXISTS' : 'NOT FOUND'} (${filePath})`);
    }
    next();
  });
  
  // Serve static files (CSS, JS, images, etc.)
  // This middleware will serve files if they exist, or call next() if they don't
  app.use(express.static(distPath, {
    maxAge: '1y',
    etag: false,
    index: false, // Don't serve index.html for directories
    fallthrough: true // Continue to next middleware if file not found
  }));
  
  // Serve index.html for all non-API routes (SPA routing)
  // This should only fire if the static file doesn't exist and it's not an asset
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    // If it's a static asset request that wasn't found, return 404
    if (req.path.startsWith('/assets/') || 
        req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      return res.status(404).send('File not found');
    }
    
    // For all other routes, serve index.html (SPA routing)
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[Static] Error serving index.html for ${req.path}:`, err);
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error');
        }
      }
    });
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
