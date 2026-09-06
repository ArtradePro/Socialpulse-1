"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = require("fs");
const path_1 = require("path");
const database_1 = require("../config/database");
const migrationStatus_1 = require("./scripts/migrationStatus");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function runMigrations() {
    console.log('Connecting to PostgreSQL for migration runner...');
    const client = await database_1.pool.connect();
    try {
        // 1. Ensure ledger table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                migration_id VARCHAR(255) UNIQUE NOT NULL,
                filename VARCHAR(255) NOT NULL,
                checksum VARCHAR(64) NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW(),
                execution_time_ms INTEGER,
                application_mode VARCHAR(32) NOT NULL DEFAULT 'executed'
            );
        `);
        // 2. Discover filesystem migrations
        const migrationsDir = (0, path_1.join)(__dirname, 'migrations');
        const files = (0, fs_1.existsSync)(migrationsDir)
            ? (0, fs_1.readdirSync)(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
            : [];
        // 3. Fetch applied ledger records
        const ledgerRes = await client.query(`SELECT migration_id, filename, checksum FROM schema_migrations;`);
        const appliedMap = new Map();
        ledgerRes.rows.forEach((r) => {
            appliedMap.set(r.migration_id, r.checksum);
            if (r.filename)
                appliedMap.set(r.filename, r.checksum);
        });
        // 4. Verify checksum drift for previously applied migrations
        for (const file of files) {
            const content = (0, fs_1.readFileSync)((0, path_1.join)(migrationsDir, file), 'utf-8').replace(/^﻿/, '');
            const currentChecksum = (0, migrationStatus_1.computeFileChecksum)(content);
            const migrationId = file.replace(/\.sql$/, '');
            const recordedChecksum = appliedMap.get(migrationId) || appliedMap.get(file);
            if (recordedChecksum && recordedChecksum !== currentChecksum) {
                throw new Error(`MIGRATION_DRIFT_DETECTED: ${file} checksum ${currentChecksum.slice(0, 8)} does not match recorded ${recordedChecksum.slice(0, 8)}`);
            }
        }
        // 5. Apply pending migrations transactionally
        let appliedCount = 0;
        for (const file of files) {
            const content = (0, fs_1.readFileSync)((0, path_1.join)(migrationsDir, file), 'utf-8').replace(/^﻿/, '');
            const checksum = (0, migrationStatus_1.computeFileChecksum)(content);
            const migrationId = file.replace(/\.sql$/, '');
            if (appliedMap.has(migrationId) || appliedMap.has(file)) {
                continue; // Already applied
            }
            console.log(`Applying migration: ${file}...`);
            const start = Date.now();
            await client.query('BEGIN');
            try {
                await client.query(content);
                const duration = Date.now() - start;
                await client.query(`
                    INSERT INTO schema_migrations (migration_id, filename, checksum, execution_time_ms, application_mode)
                    VALUES ($1, $2, $3, $4, 'executed');
                `, [migrationId, file, checksum, duration]);
                await client.query('COMMIT');
                console.log(`✓ ${file} applied in ${duration}ms.`);
                appliedCount++;
            }
            catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Migration failed in ${file}. Transaction rolled back.`);
                throw err;
            }
        }
        console.log(`✓ Migration run complete. ${appliedCount} pending migration(s) applied.`);
    }
    finally {
        client.release();
    }
}
if (require.main === module) {
    runMigrations()
        .then(() => {
        database_1.pool.end();
        process.exit(0);
    })
        .catch((err) => {
        console.error('Migration process fatal error:', err);
        database_1.pool.end();
        process.exit(1);
    });
}
//# sourceMappingURL=migrate.js.map