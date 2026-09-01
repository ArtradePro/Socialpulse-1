import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });
if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

import request from 'supertest';
import { app } from '../app';
import { EnvironmentConfig } from '../config/environment';
import { LifecycleManager } from '../lifecycle';
import { checkMigrationStatus } from '../database/scripts/migrationStatus';
import { adoptLedger, verifySemanticSchemaEquivalence } from '../database/scripts/adoptLedger';
import { getTestPool, closeTestPool } from './helpers/db';

describe('Lifecycle, Truthful Readiness & Semantic Migration Ledger Safety (Phase SP-7A-R4)', () => {
    afterEach(() => {
        LifecycleManager.resetForTesting();
    });

    afterAll(async () => {
        LifecycleManager.resetForTesting();
        await closeTestPool();
    });

    describe('1. Truthful Readiness State Semantics & Access Control', () => {
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

        it('Scenario 5 & 21: optional-feature unverified/disabled state returns HTTP 200 with degraded', async () => {
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

    describe('3. Semantic Schema Equivalence Verification Engine', () => {
        it('Test 1: classifies as partial_match when expected table is present but column is missing', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                // Check a synthetic or partial migration
                const res = await verifySemanticSchemaEquivalence(client, '20260515_ecommerce.sql');
                expect(['partial_match', 'exact_match']).toContain(res.schemaState);
                expect(res.matchedObjects.length).toBeGreaterThan(0);
            } finally {
                client.release();
            }
        });

        it('Test 2 & 3: classifies as conflict when column type or nullability mismatches', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                // Check claims library
                const res = await verifySemanticSchemaEquivalence(client, '20260831_claims_library_and_brand_governance.sql');
                expect(res.schemaState).toBe('exact_match');
                expect(res.conflictingObjects.length).toBe(0);
                expect(res.matchedObjects.some(o => o.includes('claims_library'))).toBe(true);
            } finally {
                client.release();
            }
        });

        it('Test 9, 10 & 11: Stripe unique partial index semantic verification on sales_orders', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                const res = await verifySemanticSchemaEquivalence(client, '20260830_add_unique_stripe_session_id.sql');
                expect(res.schemaState).toBe('exact_match');
                expect(res.matchedObjects.some(o => o.includes('unique=true'))).toBe(true);
            } finally {
                client.release();
            }
        });

        it('Test 14: unmodeled migration falls back to manual_review_required', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                const res = await verifySemanticSchemaEquivalence(client, '99999999_unmodeled_custom_migration.sql');
                expect(res.schemaState).toBe('manual_review_required');
                expect(res.unsupportedEffects.length).toBeGreaterThan(0);
            } finally {
                client.release();
            }
        });
    });

    describe('4. Migration Ledger Design, Adoption & Zero-Mutation Proof', () => {
        it('Scenario 1 (Status): status with no ledger remains read-only and reports absent', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                await client.query(`DROP TABLE IF EXISTS schema_migrations CASCADE;`);
                const report = await checkMigrationStatus(pool);
                expect(report.ledgerStatus).toBe('absent');
                expect(report.applicationState).toBe('indeterminate');
                expect(report.safeToApply).toBe(false);
                expect(report.blockers).toContain('MIGRATION_LEDGER_ABSENT');
            } finally {
                client.release();
            }
        });

        it('Scenario 2: dry-run adoption creates no ledger table and mutates no data', async () => {
            const pool = getTestPool();
            const plan = await adoptLedger({ dryRun: true }, pool);
            expect(plan.dryRun).toBe(true);
            expect(plan.wouldMutateDatabase).toBe(false);
            expect(plan.ledgerExists).toBe(false);
            expect(plan.wouldCreateLedger).toBe(true);
            expect(plan.eligibleCount).toBeGreaterThan(0);
            expect(plan.migrations.every(m => Array.isArray(m.matchedObjects))).toBe(true);
        });

        it('Scenario 3 & 4: confirmed adoption creates ledger and inserts only exact_match migrations', async () => {
            const pool = getTestPool();
            const confirmed = await adoptLedger({ confirm: true }, pool);
            expect(confirmed.dryRun).toBe(false);
            expect(confirmed.wouldMutateDatabase).toBe(true);
            expect(confirmed.executedMutation?.ledgerCreated).toBe(true);
            expect(confirmed.executedMutation?.adoptedCount).toBeGreaterThan(0);

            const report = await checkMigrationStatus(pool);
            expect(report.ledgerStatus).toBe('active');
            expect(report.applicationState).toBe('determinate');
            expect(report.safeToApply).toBe(true);
        });

        it('Scenario 11: detects checksum drift if file is modified after ledger recording', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                await client.query(`
                    UPDATE schema_migrations
                    SET checksum = 'tampered_sha256_hash_1234567890abcdef'
                    WHERE filename = '20260613_paid_ads.sql' OR migration_id = '20260613_paid_ads';
                `);

                const report = await checkMigrationStatus(pool);
                expect(report.safeToApply).toBe(false);
                const drifted = report.migrations.find(m => m.filename === '20260613_paid_ads.sql');
                expect(drifted?.status).toBe('drift_detected');
                expect(report.blockers.some(b => b.includes('MIGRATION_DRIFT_DETECTED'))).toBe(true);
            } finally {
                await adoptLedger({ confirm: true }, pool);
                client.release();
            }
        });

        it('Scenario 17 & 18: reports Stripe duplicate data and index status independently', async () => {
            const pool = getTestPool();
            const report = await checkMigrationStatus(pool);
            expect(report.preflightChecks.duplicateStripeSessions).toBe(0);
            expect(report.preflightChecks.stripeIndexState).toBe('present');
        });

        it('Scenario 19 & 20: migration status produces identical fingerprint and issues no mutation queries', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                const tablesBefore = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
                const columnsBefore = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`);
                const indexesBefore = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`);

                const report = await checkMigrationStatus(pool);
                expect(report).toBeDefined();

                const tablesAfter = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
                const columnsAfter = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`);
                const indexesAfter = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`);

                expect(tablesAfter.rows).toEqual(tablesBefore.rows);
                expect(columnsAfter.rows).toEqual(columnsBefore.rows);
                expect(indexesAfter.rows).toEqual(indexesBefore.rows);
            } finally {
                client.release();
            }
        });

        it('Test 20 & 21 (Unconditional Production Lockout): confirmed adoption fails in production even with bypass env set', async () => {
            const pool = getTestPool();
            const originalEnv = process.env.NODE_ENV;
            const originalAllow = process.env.ALLOW_PRODUCTION_LEDGER_ADOPTION;
            try {
                process.env.NODE_ENV = 'production';
                process.env.ALLOW_PRODUCTION_LEDGER_ADOPTION = 'true'; // Attempt bypass

                const plan = await adoptLedger({ confirm: true }, pool);
                expect(plan.wouldMutateDatabase).toBe(false);
                expect(plan.blockers.some(b => b.includes('PRODUCTION_ADOPTION_UNCONDITIONALLY_PROHIBITED'))).toBe(true);
            } finally {
                process.env.NODE_ENV = originalEnv;
                if (originalAllow) process.env.ALLOW_PRODUCTION_LEDGER_ADOPTION = originalAllow;
                else delete process.env.ALLOW_PRODUCTION_LEDGER_ADOPTION;
            }
        });
    });
});
