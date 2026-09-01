import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pool } from '../../config/database';
import { computeFileChecksum } from './migrationStatus';
import dotenv from 'dotenv';
dotenv.config();

export interface AdoptionResult {
    dryRun: boolean;
    totalFiles: number;
    proposedAdoptions: { migrationId: string; filename: string; checksum: string }[];
    ledgerCreated: boolean;
    adoptedCount: number;
    message: string;
}

export async function adoptLedger(options: { dryRun?: boolean; confirm?: boolean } = { dryRun: true }): Promise<AdoptionResult> {
    const isDryRun = options.confirm !== true;
    const migrationsDir = join(__dirname, '../migrations');
    const files = existsSync(migrationsDir)
        ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
        : [];

    const proposedAdoptions = files.map((file) => {
        const content = readFileSync(join(migrationsDir, file), 'utf-8');
        return {
            migrationId: file.replace(/\.sql$/, ''),
            filename: file,
            checksum: computeFileChecksum(content)
        };
    });

    let ledgerCreated = false;
    let adoptedCount = 0;

    if (!isDryRun) {
        const client = await pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id SERIAL PRIMARY KEY,
                    migration_id VARCHAR(255) UNIQUE NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    checksum VARCHAR(64) NOT NULL,
                    applied_at TIMESTAMPTZ DEFAULT NOW(),
                    execution_time_ms INTEGER,
                    status VARCHAR(32) DEFAULT 'applied'
                );
            `);
            ledgerCreated = true;

            for (const item of proposedAdoptions) {
                await client.query(`
                    INSERT INTO schema_migrations (migration_id, filename, checksum, status)
                    VALUES ($1, $2, $3, 'applied')
                    ON CONFLICT (migration_id) DO NOTHING;
                `, [item.migrationId, item.filename, item.checksum]);
                adoptedCount++;
            }
        } finally {
            client.release();
        }
    }

    return {
        dryRun: isDryRun,
        totalFiles: files.length,
        proposedAdoptions,
        ledgerCreated,
        adoptedCount,
        message: isDryRun
            ? 'Dry run completed. Pass --confirm to record existing baseline into schema_migrations.'
            : `Successfully adopted ${adoptedCount} migrations into schema_migrations.`
    };
}

if (require.main === module) {
    const confirm = process.argv.includes('--confirm');
    adoptLedger({ confirm })
        .then((res) => {
            console.log('\n--- MIGRATION LEDGER ADOPTION REPORT ---');
            console.log(JSON.stringify(res, null, 2));
            pool.end();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Adoption failed:', err);
            pool.end();
            process.exit(1);
        });
}
