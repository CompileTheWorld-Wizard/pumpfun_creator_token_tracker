import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5006', 10);

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', server: 'new-server' });
});

// Start server
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`New server running on http://${HOST}:${PORT}`);
});

