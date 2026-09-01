import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Prefer TEST_DATABASE_URL in test mode, or DATABASE_URL (Docker / production), fall back to individual vars (local dev)
const connectionString = (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL)
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.NODE_ENV !== 'production' ? false : true }
        : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'socialpulse',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

export const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err);
});

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);

// Alias for controllers that use db.query() pattern
export const db = { query };

export const connectDB = async (): Promise<void> => {
  const client = await pool.connect();
  client.release();
  console.log('PostgreSQL connected');
};

export const closeDB = async (): Promise<void> => {
  await pool.end();
};
