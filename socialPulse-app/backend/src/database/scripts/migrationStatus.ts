import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { pool } from '../../config/database';
import dotenv from 'dotenv';
dotenv.config();

export interface MigrationFileEntry {
    filename: string;
    migrationId: string;
    checksum: string;
    status: 'applied' | 'pending' | 'drift_detected' | 'unknown_in_db';
    appliedAt?: string;
    checksumInDb?: string;
}

export interface MigrationPreflightReport {
    timestamp: string;
    ledgerStatus: 'active' | 'absent';
    applicationState: 'determinate' | 'indeterminate';
    totalDiscovered: number;
    discoveredFiles: string[];
    migrations: MigrationFileEntry[];
    preflightChecks: {
        duplicateMigrationIds: string[];
        destructiveStatementsFound: string[];
        duplicateStripeSessions: number;
        hasStripeUniqueIndex: boolean;
        stripeIndexState: 'present' | 'pending_migration' | 'blocked_by_duplicates';
        requiredExtensions: string[];
    };
    blockers: string[];
    safeToApply: boolean;
}

export function computeFileChecksum(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function checkMigrationStatus(): Promise<MigrationPreflightReport> {
    const migrationsDir = join(__dirname, '../migrations');
    const files = existsSync(migrationsDir)
        ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
        : [];

    const blockers: string[] = [];

    // 1. Check duplicate prefixes
    const prefixes = files.map((f) => f.split('.')[0]);
    const duplicateMigrationIds = prefixes.filter((item, index) => prefixes.indexOf(item) !== index);
    if (duplicateMigrationIds.length > 0) {
        blockers.push(`DUPLICATE_MIGRATION_IDS: ${duplicateMigrationIds.join(', ')}`);
    }

    // 2. Scan for destructive statements
    const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i];
    const destructiveStatementsFound: string[] = [];
    const fileChecksums: Map<string, { checksum: string; migrationId: string }> = new Map();

    for (const file of files) {
        const content = readFileSync(join(migrationsDir, file), 'utf-8');
        const checksum = computeFileChecksum(content);
        const migrationId = file.replace(/\.sql$/, '');
        fileChecksums.set(file, { checksum, migrationId });

        for (const pattern of destructivePatterns) {
            if (pattern.test(content)) {
                destructiveStatementsFound.push(`${file} matches destructive pattern ${pattern}`);
            }
        }
    }
    if (destructiveStatementsFound.length > 0) {
        blockers.push(`DESTRUCTIVE_STATEMENTS_DETECTED: ${destructiveStatementsFound.join(', ')}`);
    }

    let hasLedgerTable = false;
    let duplicateStripeSessions = 0;
    let hasStripeUniqueIndex = false;
    const migrations: MigrationFileEntry[] = [];

    const client = await pool.connect();
    try {
        // Check if schema_migrations table exists (strictly read-only SELECT)
        const ledgerCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'schema_migrations'
            );
        `);
        hasLedgerTable = Boolean(ledgerCheck.rows[0]?.exists);

        // Preflight Stripe uniqueness check (strictly read-only SELECT)
        const ordersTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'orders'
            );
        `);

        if (ordersTableCheck.rows[0]?.exists) {
            const dupCheck = await client.query(`
                SELECT stripe_session_id, COUNT(*)
                FROM orders
                WHERE stripe_session_id IS NOT NULL
                GROUP BY stripe_session_id
                HAVING COUNT(*) > 1;
            `);
            duplicateStripeSessions = dupCheck.rows.length;

            const indexCheck = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE tablename = 'orders' AND indexname LIKE '%stripe_session%'
                );
            `);
            hasStripeUniqueIndex = Boolean(indexCheck.rows[0]?.exists);
        }

        if (duplicateStripeSessions > 0) {
            blockers.push(`DUPLICATE_STRIPE_SESSIONS_FOUND: ${duplicateStripeSessions} duplicate session(s) in orders table`);
        }

        if (hasLedgerTable) {
            const ledgerRows = await client.query(`
                SELECT migration_id, filename, checksum, applied_at
                FROM schema_migrations
                ORDER BY migration_id ASC;
            `);
            const ledgerMap = new Map<string, { checksum: string; applied_at: string; filename: string }>();
            ledgerRows.rows.forEach((r: any) => {
                ledgerMap.set(r.filename || r.migration_id, {
                    checksum: r.checksum,
                    applied_at: r.applied_at,
                    filename: r.filename
                });
            });

            // Map filesystem files against ledger
            for (const file of files) {
                const meta = fileChecksums.get(file)!;
                const dbEntry = ledgerMap.get(file) || ledgerMap.get(meta.migrationId);

                if (!dbEntry) {
                    migrations.push({
                        filename: file,
                        migrationId: meta.migrationId,
                        checksum: meta.checksum,
                        status: 'pending'
                    });
                } else if (dbEntry.checksum === meta.checksum) {
                    migrations.push({
                        filename: file,
                        migrationId: meta.migrationId,
                        checksum: meta.checksum,
                        status: 'applied',
                        appliedAt: dbEntry.applied_at
                    });
                    ledgerMap.delete(file);
                    ledgerMap.delete(meta.migrationId);
                } else {
                    migrations.push({
                        filename: file,
                        migrationId: meta.migrationId,
                        checksum: meta.checksum,
                        status: 'drift_detected',
                        checksumInDb: dbEntry.checksum,
                        appliedAt: dbEntry.applied_at
                    });
                    blockers.push(`MIGRATION_DRIFT_DETECTED in ${file}: File checksum ${meta.checksum.slice(0, 8)} != DB checksum ${dbEntry.checksum.slice(0, 8)}`);
                }
            }

            // Check if DB ledger contains migrations not in filesystem
            for (const [unknownKey, unknownVal] of ledgerMap.entries()) {
                migrations.push({
                    filename: unknownVal.filename || unknownKey,
                    migrationId: unknownKey,
                    checksum: unknownVal.checksum,
                    status: 'unknown_in_db',
                    appliedAt: unknownVal.applied_at
                });
                blockers.push(`UNKNOWN_MIGRATION_IN_LEDGER: ${unknownKey}`);
            }
        } else {
            blockers.push('MIGRATION_LEDGER_ABSENT');
            blockers.push('APPLIED_MIGRATIONS_UNKNOWN');

            for (const file of files) {
                const meta = fileChecksums.get(file)!;
                migrations.push({
                    filename: file,
                    migrationId: meta.migrationId,
                    checksum: meta.checksum,
                    status: 'pending'
                });
            }
        }
    } catch (err: any) {
        console.warn('[MigrationStatus] Preflight query note:', err.message);
        blockers.push(`QUERY_ERROR: ${err.message}`);
    } finally {
        client.release();
    }

    const stripeIndexState = duplicateStripeSessions > 0
        ? 'blocked_by_duplicates'
        : hasStripeUniqueIndex ? 'present' : 'pending_migration';

    const safeToApply = hasLedgerTable && blockers.length === 0;

    return {
        timestamp: new Date().toISOString(),
        ledgerStatus: hasLedgerTable ? 'active' : 'absent',
        applicationState: hasLedgerTable ? 'determinate' : 'indeterminate',
        totalDiscovered: files.length,
        discoveredFiles: files,
        migrations,
        preflightChecks: {
            duplicateMigrationIds,
            destructiveStatementsFound,
            duplicateStripeSessions,
            hasStripeUniqueIndex,
            stripeIndexState,
            requiredExtensions: ['uuid-ossp', 'pgcrypto']
        },
        blockers,
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
