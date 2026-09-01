import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pool } from '../../config/database';
import dotenv from 'dotenv';
dotenv.config();

export interface MigrationPreflightReport {
    timestamp: string;
    totalDiscovered: number;
    discoveredFiles: string[];
    preflightChecks: {
        destructiveStatementsFound: string[];
        duplicateStripeSessions: number;
        requiredExtensions: string[];
    };
    safeToApply: boolean;
}

export async function checkMigrationStatus(): Promise<MigrationPreflightReport> {
    const migrationsDir = join(__dirname, '../migrations');
    const files = existsSync(migrationsDir)
        ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
        : [];

    const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i];
    const destructiveStatementsFound: string[] = [];

    for (const file of files) {
        const content = readFileSync(join(migrationsDir, file), 'utf-8');
        for (const pattern of destructivePatterns) {
            if (pattern.test(content)) {
                destructiveStatementsFound.push(`${file} matches destructive pattern ${pattern}`);
            }
        }
    }

    let duplicateStripeSessions = 0;
    const client = await pool.connect();
    try {
        // Preflight check: verify if orders table has duplicate stripe_session_ids
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'orders'
            );
        `);

        if (tableCheck.rows[0]?.exists) {
            const dupCheck = await client.query(`
                SELECT stripe_session_id, COUNT(*) 
                FROM orders 
                WHERE stripe_session_id IS NOT NULL 
                GROUP BY stripe_session_id 
                HAVING COUNT(*) > 1;
            `);
            duplicateStripeSessions = dupCheck.rows.length;
        }
    } catch (err: any) {
        console.warn('[MigrationStatus] Preflight query note:', err.message);
    } finally {
        client.release();
    }

    const safeToApply = duplicateStripeSessions === 0 && destructiveStatementsFound.length === 0;

    return {
        timestamp: new Date().toISOString(),
        totalDiscovered: files.length,
        discoveredFiles: files,
        preflightChecks: {
            destructiveStatementsFound,
            duplicateStripeSessions,
            requiredExtensions: ['uuid-ossp', 'pgcrypto']
        },
        safeToApply
    };
}

if (require.main === module) {
    checkMigrationStatus()
        .then((report) => {
            console.log('\n--- READ-ONLY MIGRATION PREFLIGHT REPORT ---');
            console.log(JSON.stringify(report, null, 2));
            pool.end();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Preflight check failed:', err);
            pool.end();
            process.exit(1);
        });
}
