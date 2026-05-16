const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'socialpulse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
});

async function test() {
  console.log('Testing DB connection...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Success:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('DB Connection Failed:', err.message);
    process.exit(1);
  }
}

test();
