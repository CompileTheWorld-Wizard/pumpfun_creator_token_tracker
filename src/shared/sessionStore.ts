import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Create Redis client for session store
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_SESSION_DB || process.env.REDIS_DB || '1'), // Use DB 1 for sessions
  maxRetriesPerRequest: 3,
  // @ts-ignore - retryDelayOnFailover is valid but not in types
  retryDelayOnFailover: 100,
} as any);

// Create Redis store for sessions
export const sessionStore = new RedisStore({
  client: redisClient,
  prefix: 'soltrack:sess:', // Prefix for session keys
});

// Handle Redis connection events
redisClient.on('connect', () => {
  console.log('[SessionStore] Connected to Redis for session storage');
});

redisClient.on('error', (err) => {
  console.error('[SessionStore] Redis connection error:', err);
});

redisClient.on('close', () => {
  console.log('[SessionStore] Redis connection closed');
});

export default sessionStore;
