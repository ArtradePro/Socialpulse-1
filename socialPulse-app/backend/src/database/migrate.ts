import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const schemaPath = join(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8').replace(/^﻿/, '');

  console.log('Connecting to PostgreSQL...');
  const client = await pool.connect();

  try {
    console.log('Running migrations...');
    await client.query(sql);
    console.log('✓ Database schema applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
