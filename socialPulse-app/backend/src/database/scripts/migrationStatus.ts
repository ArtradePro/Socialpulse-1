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

export async function checkMigrationStatus(customPool?: any): Promise<MigrationPreflightReport> {
    const activePool = customPool || pool;
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

    const client = await activePool.connect();
    try {
        // Check if schema_migrations table exists (strictly read-only SELECT)
        const ledgerCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'schema_migrations'
            );
        `);
        hasLedgerTable = Boolean(ledgerCheck.rows[0]?.exists);

        // Check for sales_orders / orders Stripe session idempotency preflight
        const ordersTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name IN ('sales_orders', 'orders')
            );
        `);

        if (ordersTableCheck.rows[0]?.exists) {
            const hasSalesOrders = (await client.query(`
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'sales_orders';
            `)).rows.length > 0;
            const targetTable = hasSalesOrders ? 'sales_orders' : 'orders';

            const dupCheck = await client.query(`
                SELECT stripe_session_id, COUNT(*)
                FROM ${targetTable}
                WHERE stripe_session_id IS NOT NULL
                GROUP BY stripe_session_id
                HAVING COUNT(*) > 1;
            `);
            duplicateStripeSessions = dupCheck.rows.length;

            const indexCheck = await client.query(`
                SELECT
                    ix.indisunique AS is_unique,
                    ix.indisvalid AS is_valid,
                    ix.indisready AS is_ready,
                    pg_get_expr(ix.indpred, ix.indrelid) AS predicate
                FROM pg_class t
                JOIN pg_index ix ON t.oid = ix.indrelid
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE n.nspname = 'public' AND t.relname = '${targetTable}'
                  AND (i.relname LIKE '%stripe_session%' OR pg_get_indexdef(ix.indexrelid) LIKE '%stripe_session%');
            `);

            hasStripeUniqueIndex = indexCheck.rows.length > 0 &&
                Boolean(indexCheck.rows[0].is_unique) &&
                Boolean(indexCheck.rows[0].is_valid) &&
                Boolean(indexCheck.rows[0].is_ready) &&
                Boolean(indexCheck.rows[0].predicate?.includes('IS NOT NULL'));
        }

        if (duplicateStripeSessions > 0) {
            blockers.push(`DUPLICATE_STRIPE_SESSIONS_FOUND: ${duplicateStripeSessions} duplicate session(s) found in sales_orders table`);
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

export function verifyMigrationCurrent(report: MigrationPreflightReport): { isCurrent: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (report.ledgerStatus !== 'active') {
        reasons.push('Migration ledger is absent (schema_migrations table missing)');
    }

    if (report.blockers && report.blockers.length > 0) {
        reasons.push(...report.blockers);
    }

    const pending = report.migrations.filter((m) => m.status === 'pending');
    if (pending.length > 0) {
        reasons.push(`Database has ${pending.length} pending migration(s): ${pending.map((p) => p.filename).join(', ')}`);
    }

    const drift = report.migrations.filter((m) => m.status === 'drift_detected');
    if (drift.length > 0) {
        reasons.push(`Database has ${drift.length} drift detected migration(s): ${drift.map((d) => d.filename).join(', ')}`);
    }

    const unknown = report.migrations.filter((m) => m.status === 'unknown_in_db');
    if (unknown.length > 0) {
        reasons.push(`Database ledger has ${unknown.length} unknown migration(s): ${unknown.map((u) => u.filename).join(', ')}`);
    }

    if (report.totalDiscovered === 0) {
        reasons.push('No migration files discovered in migrations directory');
    }

    const applied = report.migrations.filter((m) => m.status === 'applied');
    if (applied.length !== report.totalDiscovered) {
        reasons.push(`Applied migrations count (${applied.length}) does not match total discovered (${report.totalDiscovered})`);
    }

    return {
        isCurrent: reasons.length === 0,
        reasons
    };
}

if (require.main === module) {
    const requireCurrent = process.argv.includes('--require-current');
    checkMigrationStatus()
        .then((report) => {
            console.log('\n--- READ-ONLY MIGRATION PREFLIGHT REPORT ---');
            console.log(JSON.stringify(report, null, 2));

            if (requireCurrent) {
                const verification = verifyMigrationCurrent(report);
                if (!verification.isCurrent) {
                    console.error('\nERROR: Migration status is NOT current (failed --require-current check):');
                    verification.reasons.forEach((r) => console.error(`  - ${r}`));
                    pool.end();
                    process.exit(1);
                }
                console.log('\nSUCCESS: Database migration state is fully current and verified.');
            }

            pool.end();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Preflight check failed:', err);
            pool.end();
            process.exit(1);
        });
}
