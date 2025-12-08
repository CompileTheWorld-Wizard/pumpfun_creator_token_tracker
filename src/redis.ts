import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

// Create Redis client
export const redis = new Redis(redisConfig);

// Redis keys
const EVENTS_SORTED_SET = 'pumpfun:events:1min';
const EVENT_TTL_SECONDS = 60;

// Event types
export type EventType = 'CreateEvent' | 'BuyEvent' | 'SellEvent' | 'TradeEvent' | 'unknown';

export interface TransactionEvent {
  signature: string;
  eventType: EventType;
  timestamp: number;
  data?: any;
}

/**
 * Store a transaction event in Redis (kept for 1 minute)
 */
export async function storeTransactionEvent(event: TransactionEvent): Promise<void> {
  try {
    const eventJson = JSON.stringify(event);
    const score = event.timestamp;
    
    // Add event to sorted set with timestamp as score
    await redis.zadd(EVENTS_SORTED_SET, score, eventJson);
    
    // Clean up events older than 1 minute
    const oneMinuteAgo = Date.now() - (EVENT_TTL_SECONDS * 1000);
    await redis.zremrangebyscore(EVENTS_SORTED_SET, '-inf', oneMinuteAgo);
  } catch (error) {
    console.error('[Redis] Error storing transaction event:', error);
  }
}

/**
 * Get all events from the last 1 minute
 */
export async function getRecentEvents(): Promise<TransactionEvent[]> {
  try {
    const oneMinuteAgo = Date.now() - (EVENT_TTL_SECONDS * 1000);
    const events = await redis.zrangebyscore(EVENTS_SORTED_SET, oneMinuteAgo, '+inf');
    
    return events.map(eventJson => JSON.parse(eventJson) as TransactionEvent);
  } catch (error) {
    console.error('[Redis] Error getting recent events:', error);
    return [];
  }
}

/**
 * Get event counts by type for the last 1 minute
 */
export async function getEventCounts(): Promise<Record<EventType, number>> {
  const events = await getRecentEvents();
  
  const counts: Record<EventType, number> = {
    CreateEvent: 0,
    BuyEvent: 0,
    SellEvent: 0,
    TradeEvent: 0,
    unknown: 0,
  };
  
  events.forEach(event => {
    counts[event.eventType] = (counts[event.eventType] || 0) + 1;
  });
  
  return counts;
}

/**
 * Get total event count for the last 1 minute
 */
export async function getTotalEventCount(): Promise<number> {
  try {
    const oneMinuteAgo = Date.now() - (EVENT_TTL_SECONDS * 1000);
    return await redis.zcount(EVENTS_SORTED_SET, oneMinuteAgo, '+inf');
  } catch (error) {
    console.error('[Redis] Error getting total event count:', error);
    return 0;
  }
}

/**
 * Clean up old events (called periodically)
 */
export async function cleanupOldEvents(): Promise<number> {
  try {
    const oneMinuteAgo = Date.now() - (EVENT_TTL_SECONDS * 1000);
    return await redis.zremrangebyscore(EVENTS_SORTED_SET, '-inf', oneMinuteAgo);
  } catch (error) {
    console.error('[Redis] Error cleaning up old events:', error);
    return 0;
  }
}

// Handle Redis connection events
redis.on('connect', () => {
  console.log('[Redis] Connected to Redis server');
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

redis.on('close', () => {
  console.log('[Redis] Connection closed');
});

export default redis;

