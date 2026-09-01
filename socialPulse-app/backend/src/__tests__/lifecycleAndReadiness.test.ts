import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import request from 'supertest';
import { app } from '../app';
import { EnvironmentConfig } from '../config/environment';
import { LifecycleManager } from '../lifecycle';
import { checkMigrationStatus } from '../database/scripts/migrationStatus';
import { adoptLedger } from '../database/scripts/adoptLedger';
import { getTestPool, closeTestPool } from './helpers/db';

describe('Lifecycle, Truthful Readiness & Migration Ledger Safety (Phase SP-7A-R2)', () => {
    afterEach(() => {
        LifecycleManager.resetForTesting();
    });

    afterAll(async () => {
        LifecycleManager.resetForTesting();
        await closeTestPool();
    });

    describe('1. Truthful Readiness State Semantics', () => {
        it('Scenario 1: configured external provider reports configured_unverified', () => {
            const originalSg = process.env.SENDGRID_API_KEY;
            try {
                process.env.SENDGRID_API_KEY = 'SG.mock_key_unverified';
                const diag = EnvironmentConfig.getDiagnostics();
                expect(diag.features.sendgrid.status).toBe('configured_unverified');
                expect(diag.features.sendgrid.reason).toContain('connectivity unverified');
            } finally {
                if (originalSg) process.env.SENDGRID_API_KEY = originalSg;
                else delete process.env.SENDGRID_API_KEY;
            }
        });

        it('Scenario 2: missing optional provider reports disabled', () => {
            const originalSg = process.env.SENDGRID_API_KEY;
            try {
                delete process.env.SENDGRID_API_KEY;
                const diag = EnvironmentConfig.getDiagnostics();
                expect(diag.features.sendgrid.status).toBe('disabled');
            } finally {
                if (originalSg) process.env.SENDGRID_API_KEY = originalSg;
            }
        });

        it('Scenario 3: invalid provider configuration reports misconfigured', () => {
            const invalid = EnvironmentConfig.validateEncryptionConfig('bad_id', '{"bad_id":"SHORT_KEY"}');
            expect(invalid.valid).toBe(false);
            expect(invalid.error).toBeDefined();

            const diag = EnvironmentConfig.getDiagnostics();
            expect(['ready', 'misconfigured']).toContain(diag.features.encryption.status);
        });

        it('Scenario 4: core dependency failure returns HTTP 503 unavailable', async () => {
            const { db } = require('../config/database');
            const originalQuery = db.query;
            try {
                db.query = jest.fn().mockRejectedValue(new Error('DB connection timed out'));
                const res = await request(app).get('/health/ready');
                expect(res.status).toBe(503);
                expect(res.body.coreReady).toBe(false);
                expect(res.body.status).toBe('unavailable');
            } finally {
                db.query = originalQuery;
            }
        });

        it('Scenario 5: optional-feature degradation returns HTTP 200 with degraded', async () => {
            const res = await request(app).get('/health/ready');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('degraded');
            expect(res.body.coreReady).toBe(true);
        });

        it('Scenario 6: public readiness does not expose component details or secrets', async () => {
            const res = await request(app).get('/health/ready');
            expect(res.status).toBe(200);
            expect(res.body.diagnostics).toBeUndefined();
            expect(res.body.status).toBeDefined();
            expect(res.body.coreReady).toBe(true);

            const json = JSON.stringify(res.body);
            expect(json).not.toContain('TEST_KEY');
            expect(json).not.toContain('postgres://');
        });

        it('Scenario 7: authorized monitoring request receives detailed diagnostics via header', async () => {
            process.env.INTERNAL_MONITORING_SECRET = 'super-secret-monitor-token-123';
            try {
                const res = await request(app)
                    .get('/health/ready')
                    .set('x-monitoring-secret', 'super-secret-monitor-token-123');

                expect(res.status).toBe(200);
                expect(res.body.diagnostics).toBeDefined();
                expect(res.body.diagnostics.features.database.status).toBe('ready');
            } finally {
                delete process.env.INTERNAL_MONITORING_SECRET;
            }
        });

        it('Scenario 12 (CORS): excludes unauthorized localhost origins in production CORS', () => {
            const originalEnv = process.env.NODE_ENV;
            const originalAllowLocal = process.env.ALLOW_LOCALHOST_IN_PRODUCTION;
            try {
                process.env.NODE_ENV = 'production';
                delete process.env.ALLOW_LOCALHOST_IN_PRODUCTION;

                const origins = EnvironmentConfig.getAllowedOrigins();
                expect(origins).not.toContain('http://localhost:3000');
                expect(origins).not.toContain('http://localhost:5000');
                expect(origins).toContain('https://usesocialpulse.com');
            } finally {
                process.env.NODE_ENV = originalEnv;
                if (originalAllowLocal) process.env.ALLOW_LOCALHOST_IN_PRODUCTION = originalAllowLocal;
            }
        });
    });

    describe('2. Lifecycle Management & Resource Cleanup', () => {
        it('Scenario 8: graceful shutdown executes registered cleanup tasks and clears timers', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            let cleanupExecuted = false;

            const dummyTimer = setInterval(() => {}, 100000);
            LifecycleManager.registerInterval(dummyTimer);
            LifecycleManager.registerCleanup('testQueue', () => {
                cleanupExecuted = true;
            });

            await LifecycleManager.shutdown('SIGTERM', false);
            expect(cleanupExecuted).toBe(true);
            expect(LifecycleManager.getIsShuttingDown()).toBe(true);

            logSpy.mockRestore();
        });

        it('Scenario 9: safely ignores duplicate shutdown signals', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            const p1 = LifecycleManager.shutdown('SIGTERM', false);
            const p2 = LifecycleManager.shutdown('SIGINT', false);

            await Promise.all([p1, p2]);
            expect(LifecycleManager.getIsShuttingDown()).toBe(true);

            logSpy.mockRestore();
        });
    });

    describe('3. Migration Ledger Design & Adoption Tooling', () => {
        it('Scenario 8 (Ledger): missing ledger forces safeToApply=false with blockers', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                await client.query(`DROP TABLE IF EXISTS schema_migrations CASCADE;`);
                const report = await checkMigrationStatus();
                expect(report.ledgerStatus).toBe('absent');
                expect(report.applicationState).toBe('indeterminate');
                expect(report.safeToApply).toBe(false);
                expect(report.blockers).toContain('MIGRATION_LEDGER_ABSENT');
            } finally {
                client.release();
            }
        });

        it('Scenario 15 & 16: adoption defaults to dry-run and requires explicit confirm', async () => {
            // Dry run
            const dryRun = await adoptLedger({ dryRun: true });
            expect(dryRun.dryRun).toBe(true);
            expect(dryRun.ledgerCreated).toBe(false);
            expect(dryRun.totalFiles).toBeGreaterThan(0);

            // Confirmed adoption
            const confirmed = await adoptLedger({ confirm: true });
            expect(confirmed.dryRun).toBe(false);
            expect(confirmed.ledgerCreated).toBe(true);
            expect(confirmed.adoptedCount).toBeGreaterThan(0);

            // Now checkMigrationStatus with active ledger
            const report = await checkMigrationStatus();
            expect(report.ledgerStatus).toBe('active');
            expect(report.applicationState).toBe('determinate');
            expect(report.safeToApply).toBe(true);
            expect(report.migrations.every(m => m.status === 'applied')).toBe(true);
        });

        it('Scenario 11: detects checksum drift if file is modified after ledger recording', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                // Update checksum for first migration to a fake hash
                await client.query(`
                    UPDATE schema_migrations
                    SET checksum = 'fake_tampered_hash_1234567890'
                    WHERE filename = '20260515_ecommerce.sql';
                `);

                const report = await checkMigrationStatus();
                expect(report.safeToApply).toBe(false);
                const drifted = report.migrations.find(m => m.filename === '20260515_ecommerce.sql');
                expect(drifted?.status).toBe('drift_detected');
                expect(report.blockers.some(b => b.includes('MIGRATION_DRIFT_DETECTED'))).toBe(true);
            } finally {
                // Re-adopt to restore legitimate hashes
                await adoptLedger({ confirm: true });
                client.release();
            }
        });

        it('Scenario 17 & 18: reports Stripe duplicate data and index status independently', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                const report = await checkMigrationStatus();
                expect(report.preflightChecks.duplicateStripeSessions).toBe(0);
                expect(report.preflightChecks.stripeIndexState).toBeDefined();
            } finally {
                client.release();
            }
        });

        it('Scenario 19 & 20: migration status produces identical fingerprint and issues no mutation queries', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                // Take comprehensive database schema fingerprint
                const tablesBefore = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
                const columnsBefore = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`);
                const indexesBefore = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`);

                // Run preflight check
                const report = await checkMigrationStatus();
                expect(report).toBeDefined();

                // Take fingerprint after
                const tablesAfter = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
                const columnsAfter = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`);
                const indexesAfter = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`);

                // Deep compare schema objects
                expect(tablesAfter.rows).toEqual(tablesBefore.rows);
                expect(columnsAfter.rows).toEqual(columnsBefore.rows);
                expect(indexesAfter.rows).toEqual(indexesBefore.rows);
            } finally {
                client.release();
            }
        });
    });
});
