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
  res.json({ status: 'ok', server: 'auth-server' });
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
