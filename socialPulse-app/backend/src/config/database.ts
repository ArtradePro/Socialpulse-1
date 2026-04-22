import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Prefer DATABASE_URL (Docker / production), fall back to individual vars (local dev)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
