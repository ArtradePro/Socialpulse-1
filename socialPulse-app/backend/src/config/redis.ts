import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Support REDIS_URL (Render/Upstash) or individual host/port/password vars
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('Redis connected'));

export const connectRedis = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (redis.status === 'ready') { resolve(); return; }
    redis.once('ready', resolve);
    redis.once('error', reject);
  });

export const CACHE_TTL = {
  SHORT: 60,          // 1 minute
  MEDIUM: 60 * 15,    // 15 minutes
  LONG: 60 * 60,      // 1 hour
  DAY: 60 * 60 * 24,  // 24 hours
};
