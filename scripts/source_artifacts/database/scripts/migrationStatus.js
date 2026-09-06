"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFileChecksum = computeFileChecksum;
exports.parseMigrationCliArgs = parseMigrationCliArgs;
exports.checkMigrationStatus = checkMigrationStatus;
exports.verifyMigrationModeState = verifyMigrationModeState;
exports.verifyMigrationCurrent = verifyMigrationCurrent;
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../../config/database");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function computeFileChecksum(content) {
    return crypto_1.default.createHash('sha256').update(content, 'utf8').digest('hex');
}
function parseMigrationCliArgs(argv) {
    const isStrict = argv.includes('--strict');
    const requireCurrent = argv.includes('--require-current');
    const errors = [];
    const modeValues = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--mode=')) {
            const val = arg.slice(7).trim();
            modeValues.push(val);
        }
        else if (arg === '--mode') {
            if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
                modeValues.push(argv[i + 1].trim());
                i++;
            }
            else {
                modeValues.push(''); // Missing argument value after --mode flag
            }
        }
    }
    if (modeValues.length > 1) {
        errors.push(`Duplicate --mode arguments supplied: ${modeValues.join(', ')}`);
    }
    let parsedMode = null;
    if (modeValues.length === 1) {
        const raw = modeValues[0].toLowerCase();
        if (raw === 'bootstrap' || raw === 'incremental') {
            parsedMode = raw;
        }
        else {
            errors.push(`Invalid or malformed --mode value: "${modeValues[0]}". Must be "bootstrap" or "incremental".`);
        }
    }
    else if (modeValues.length === 0) {
        if (isStrict) {
            errors.push('Strict migration preflight (--strict) requires an explicit valid mode (--mode=bootstrap or --mode=incremental).');
        }
        else {
            // Intentional default for non-strict local/read-only inspection
            parsedMode = 'incremental';
        }
    }
    return {
        mode: parsedMode,
        isStrict,
        requireCurrent,
        errors
    };
}
async function checkMigrationStatus(customPool) {
    const activePool = customPool || database_1.pool;
    const migrationsDir = (0, path_1.join)(__dirname, '../migrations');
    const files = (0, fs_1.existsSync)(migrationsDir)
        ? (0, fs_1.readdirSync)(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
        : [];
    const blockers = [];
    // 1. Check duplicate prefixes
    const prefixes = files.map((f) => f.split('.')[0]);
    const duplicateMigrationIds = prefixes.filter((item, index) => prefixes.indexOf(item) !== index);
    if (duplicateMigrationIds.length > 0) {
        blockers.push(`DUPLICATE_MIGRATION_IDS: ${duplicateMigrationIds.join(', ')}`);
    }
    // 2. Scan for destructive statements
    const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i];
    const destructiveStatementsFound = [];
    const fileChecksums = new Map();
    for (const file of files) {
        const content = (0, fs_1.readFileSync)((0, path_1.join)(migrationsDir, file), 'utf-8');
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
    const migrations = [];
    let userTables = [];
    const client = await activePool.connect();
    try {
        // Query PostgreSQL catalog for all user base tables in public schema
        const userTablesCheck = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name ASC;
        `);
        userTables = userTablesCheck.rows.map((r) => r.table_name);
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
            const ledgerMap = new Map();
            ledgerRows.rows.forEach((r) => {
                ledgerMap.set(r.filename || r.migration_id, {
                    checksum: r.checksum,
                    applied_at: r.applied_at,
                    filename: r.filename
                });
            });
            // Map filesystem files against ledger
            for (const file of files) {
                const meta = fileChecksums.get(file);
                const dbEntry = ledgerMap.get(file) || ledgerMap.get(meta.migrationId);
                if (!dbEntry) {
                    migrations.push({
                        filename: file,
                        migrationId: meta.migrationId,
                        checksum: meta.checksum,
                        status: 'pending'
                    });
                }
                else if (dbEntry.checksum === meta.checksum) {
                    migrations.push({
                        filename: file,
                        migrationId: meta.migrationId,
                        checksum: meta.checksum,
                        status: 'applied',
                        appliedAt: dbEntry.applied_at
                    });
                    ledgerMap.delete(file);
                    ledgerMap.delete(meta.migrationId);
                }
                else {
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
        }
        else {
            blockers.push('MIGRATION_LEDGER_ABSENT');
            blockers.push('APPLIED_MIGRATIONS_UNKNOWN');
            for (const file of files) {
                const meta = fileChecksums.get(file);
                migrations.push({
                    filename: file,
                    migrationId: meta.migrationId,
                    checksum: meta.checksum,
                    status: 'pending'
                });
            }
        }
    }
    catch (err) {
        console.warn('[MigrationStatus] Preflight query note:', err.message);
        blockers.push(`QUERY_ERROR: ${err.message}`);
    }
    finally {
        client.release();
    }
    const stripeIndexState = duplicateStripeSessions > 0
        ? 'blocked_by_duplicates'
        : hasStripeUniqueIndex ? 'present' : 'pending_migration';
    const isCleanEmpty = userTables.length === 0;
    const safeToApply = hasLedgerTable && blockers.length === 0;
    return {
        timestamp: new Date().toISOString(),
        ledgerStatus: hasLedgerTable ? 'active' : 'absent',
        applicationState: hasLedgerTable ? 'determinate' : 'indeterminate',
        totalDiscovered: files.length,
        discoveredFiles: files,
        migrations,
        databaseEmptiness: {
            isCleanEmpty,
            userTableCount: userTables.length,
            userTables
        },
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
function verifyMigrationModeState(report, mode = 'incremental', requireCurrent = false) {
    const reasons = [];
    // Structural anomalies always fail validation in any mode
    if (report.preflightChecks.duplicateMigrationIds.length > 0) {
        reasons.push(`Duplicate migration prefixes detected: ${report.preflightChecks.duplicateMigrationIds.join(', ')}`);
    }
    if (report.preflightChecks.destructiveStatementsFound.length > 0) {
        reasons.push(`Destructive SQL statements detected in migrations: ${report.preflightChecks.destructiveStatementsFound.join(', ')}`);
    }
    if (report.preflightChecks.duplicateStripeSessions > 0) {
        reasons.push(`Duplicate Stripe sessions detected: ${report.preflightChecks.duplicateStripeSessions} duplicate(s)`);
    }
    const queryErrorBlockers = report.blockers.filter((b) => b.startsWith('QUERY_ERROR:'));
    if (queryErrorBlockers.length > 0) {
        reasons.push(...queryErrorBlockers);
    }
    if (mode === 'bootstrap') {
        // Bootstrap requires completely empty database: 0 user tables and ledger absent
        if (!report.databaseEmptiness.isCleanEmpty) {
            reasons.push(`Bootstrap mode rejected: Database is not empty. Found ${report.databaseEmptiness.userTableCount} existing table(s): ${report.databaseEmptiness.userTables.join(', ')}`);
        }
        if (report.ledgerStatus === 'active') {
            reasons.push('Bootstrap mode rejected: Migration ledger (schema_migrations) already exists. Use incremental mode instead.');
        }
        if (report.totalDiscovered === 0) {
            reasons.push('No migration files discovered in migrations directory.');
        }
    }
    else if (mode === 'incremental') {
        // Incremental requires active ledger, zero drift, zero unknown migrations, safeToApply
        if (report.ledgerStatus !== 'active') {
            reasons.push('Incremental mode rejected: Migration ledger is absent (schema_migrations missing). Initial bootstrap required.');
        }
        const drift = report.migrations.filter((m) => m.status === 'drift_detected');
        if (drift.length > 0) {
            reasons.push(`Database has ${drift.length} drift detected migration(s): ${drift.map((d) => d.filename).join(', ')}`);
        }
        const unknown = report.migrations.filter((m) => m.status === 'unknown_in_db');
        if (unknown.length > 0) {
            reasons.push(`Database ledger has ${unknown.length} unknown migration(s): ${unknown.map((u) => u.filename).join(', ')}`);
        }
        if (requireCurrent) {
            const pending = report.migrations.filter((m) => m.status === 'pending');
            if (pending.length > 0) {
                reasons.push(`Database has ${pending.length} pending migration(s): ${pending.map((p) => p.filename).join(', ')}`);
            }
            const applied = report.migrations.filter((m) => m.status === 'applied');
            if (applied.length !== report.totalDiscovered) {
                reasons.push(`Applied migrations count (${applied.length}) does not match total discovered (${report.totalDiscovered})`);
            }
        }
    }
    else {
        reasons.push(`Unknown migration mode: ${mode}`);
    }
    return {
        isValid: reasons.length === 0,
        reasons
    };
}
function verifyMigrationCurrent(report) {
    const res = verifyMigrationModeState(report, 'incremental', true);
    return {
        isCurrent: res.isValid,
        reasons: res.reasons
    };
}
if (require.main === module) {
    const parsedArgs = parseMigrationCliArgs(process.argv.slice(2));
    let exitCode = 0;
    (async () => {
        try {
            if (parsedArgs.errors.length > 0) {
                console.error('\nERROR: Invalid migration CLI argument(s):');
                parsedArgs.errors.forEach((e) => console.error(`  - ${e}`));
                exitCode = 1;
                return;
            }
            const report = await checkMigrationStatus();
            console.log('\n--- READ-ONLY MIGRATION PREFLIGHT REPORT ---');
            console.log(JSON.stringify(report, null, 2));
            const verification = verifyMigrationModeState(report, parsedArgs.mode, parsedArgs.requireCurrent);
            if (!verification.isValid) {
                console.error(`\nERROR: Migration preflight failed validation (mode: ${parsedArgs.mode}, requireCurrent: ${parsedArgs.requireCurrent}):`);
                verification.reasons.forEach((r) => console.error(`  - ${r}`));
                if (parsedArgs.isStrict || parsedArgs.requireCurrent) {
                    exitCode = 1;
                }
            }
            else {
                console.log(`\nSUCCESS: Database migration state validated successfully for mode '${parsedArgs.mode}'.`);
            }
        }
        catch (err) {
            console.error('Preflight check failed with error:', err);
            exitCode = 1;
        }
        finally {
            try {
                await database_1.pool.end();
            }
            catch (poolErr) {
                console.error('Error closing database pool:', poolErr);
                exitCode = 1;
            }
            process.exitCode = exitCode;
        }
    })();
}
//# sourceMappingURL=migrationStatus.js.map