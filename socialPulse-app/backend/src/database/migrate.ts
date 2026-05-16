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
    console.log('Running base schema...');
    await client.query(sql);
    console.log('✓ Base schema applied.');

    const migrationsDir = join(__dirname, 'migrations');
    const fs = require('fs');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();
      for (const file of files) {
        console.log(`Running migration: ${file}...`);
        const migrationSql = fs.readFileSync(join(migrationsDir, file), 'utf-8').replace(/^﻿/, '');
        await client.query(migrationSql);
        console.log(`✓ ${file} applied.`);
      }
    }

    console.log('✓ All migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
