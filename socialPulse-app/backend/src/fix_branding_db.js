
const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

const poolConfig = dbUrl 
  ? { connectionString: dbUrl, ssl: (dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }) }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'socialpulse',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: false // Local connections usually don't use SSL
    };

const pool = new Pool(poolConfig);

async function migrate() {
  try {
    console.log('Checking and adding missing columns to workspaces...');
    
    await pool.query('ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_guidelines TEXT');
    console.log('Checked ai_guidelines');
    
    await pool.query('ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS purchase_url TEXT');
    console.log('Checked purchase_url');
    
    console.log('Database is up to date!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
