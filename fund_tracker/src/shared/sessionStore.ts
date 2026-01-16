import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Create Redis client for session store (shared with auth server)
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_SESSION_DB || process.env.REDIS_DB || '1'), // Use DB 1 for sessions
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
} as any);

// Create Redis store for sessions
export const sessionStore = new RedisStore({
  client: redisClient,
  prefix: 'soltrack:sess:', // Same prefix as auth server
});

// Handle Redis connection events
redisClient.on('connect', () => {
  console.log('[FundTracker] Connected to Redis for session storage');
});

redisClient.on('error', (err) => {
  console.error('[FundTracker] Redis connection error:', err);
});

redisClient.on('close', () => {
  console.log('[FundTracker] Redis connection closed');
});

export default sessionStore;
