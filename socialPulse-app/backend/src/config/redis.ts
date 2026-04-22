import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

export const redis = new Redis(redisConfig);

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
