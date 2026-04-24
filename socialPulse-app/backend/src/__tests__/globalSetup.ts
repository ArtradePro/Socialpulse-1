import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../../../.env') });

// Tests require TEST_DATABASE_URL (a separate DB from dev).
// If not set, tests will be skipped via the helper below.
export default async function globalSetup(): Promise<void> {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
        console.warn(
            '\n⚠️  TEST_DATABASE_URL not set — integration tests will be skipped.\n' +
            '   Set it to a separate PostgreSQL database, e.g.:\n' +
            '   TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/socialpulse_test\n'
        );
        return;
    }

    // Apply schema to test database
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
        const schema = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf-8');
        await client.query(schema);
        console.log('✓ Test database schema applied');
    } finally {
        client.release();
        await pool.end();
    }
}
