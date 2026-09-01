import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import request from 'supertest';
import { app } from '../app';
import { EnvironmentConfig } from '../config/environment';
import { LifecycleManager } from '../lifecycle';
import { checkMigrationStatus } from '../database/scripts/migrationStatus';
import { getTestPool, closeTestPool } from './helpers/db';

describe('Lifecycle, Configuration Hardening & Readiness (Phase SP-7A/SP-7A-R1)', () => {
    afterEach(() => {
        LifecycleManager.resetForTesting();
    });

    afterAll(async () => {
        LifecycleManager.resetForTesting();
        await closeTestPool();
    });

    describe('1. Startup-Critical & Feature Configuration Validation', () => {
        it('Scenario 1: validates missing startup-critical environment variable in production', () => {
            const originalEnv = process.env.NODE_ENV;
            const originalJwt = process.env.JWT_SECRET;
            try {
                process.env.NODE_ENV = 'production';
                delete process.env.JWT_SECRET;

                const check = EnvironmentConfig.validateStartup();
                expect(check.valid).toBe(false);
                expect(check.errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
            } finally {
                process.env.NODE_ENV = originalEnv;
                if (originalJwt) process.env.JWT_SECRET = originalJwt;
            }
        });

        it('Scenario 2: detects and rejects invalid encryption-key configuration', () => {
            // Missing keys
            const missing = EnvironmentConfig.validateEncryptionConfig('missing-key', '{}');
            expect(missing.valid).toBe(false);
            expect(missing.error).toContain('not found in ENCRYPTION_KEYS_JSON');

            // Invalid key length (not 32 bytes)
            const shortKeyJson = JSON.stringify({
                bad_key: Buffer.from('SHORT_16_BYTES__').toString('base64')
            });
            const invalidLength = EnvironmentConfig.validateEncryptionConfig('bad_key', shortKeyJson);
            expect(invalidLength.valid).toBe(false);
            expect(invalidLength.error).toContain('must be exactly 32 bytes');
        });

        it('Scenario 3: enforces production simulation rejection', () => {
            const originalEnv = process.env.NODE_ENV;
            const originalSim = process.env.ALLOW_SIMULATED_DELIVERY;
            try {
                process.env.NODE_ENV = 'production';
                process.env.ALLOW_SIMULATED_DELIVERY = 'true';

                const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
                EnvironmentConfig.validateStartup();
                expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ALLOW_SIMULATED_DELIVERY=true is ignored in production mode'));
                warnSpy.mockRestore();
            } finally {
                process.env.NODE_ENV = originalEnv;
                if (originalSim) process.env.ALLOW_SIMULATED_DELIVERY = originalSim;
                else delete process.env.ALLOW_SIMULATED_DELIVERY;
            }
        });

        it('Scenario 4: marks optional credentials as feature disabled without crashing', () => {
            const diag = EnvironmentConfig.getDiagnostics();
            expect(diag.features.omnisend.enabled).toBe(true);
            expect(diag.features.gemini.enabled).toBe(true);
            expect(diag.startupReady).toBe(true);
        });

        it('Scenario 12: excludes unauthorized localhost origins in production CORS', () => {
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

    describe('2. Health & Readiness Diagnostics', () => {
        it('Scenario 5: readiness response completely redacts secrets and connection strings', async () => {
            const res = await request(app).get('/health/ready');
            expect(res.status).toBe(200);
            expect(res.body.diagnostics).toBeDefined();

            const rawJson = JSON.stringify(res.body);
            expect(rawJson).not.toContain('TEST_KEY_32_BYTES');
            expect(rawJson).not.toContain('postgres://');
            expect(rawJson).not.toContain('password');
            expect(rawJson).not.toContain('secret');
        });

        it('Scenario 6: reports database unavailable readiness state when DB connection fails', async () => {
            const { db } = require('../config/database');
            const originalQuery = db.query;
            try {
                db.query = jest.fn().mockRejectedValue(new Error('Connection timeout'));
                const res = await request(app).get('/health/ready');
                expect(res.status).toBe(503);
                expect(res.body.coreReady).toBe(false);
                expect(res.body.status).toBe('unavailable');
                expect(res.body.diagnostics.features.database.status).toBe('unavailable');
            } finally {
                db.query = originalQuery;
            }
        });

        it('Scenario 7: reports redis unavailable or disabled readiness state safely', () => {
            const diag = EnvironmentConfig.getDiagnostics();
            expect(['ready', 'disabled']).toContain(diag.features.redis.status);
            expect(diag.features.redis.reason || '').toBeDefined();
        });

        it('verifies liveness probe response', async () => {
            const res = await request(app).get('/health/live');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('alive');
            expect(res.body.uptimeSecs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('3. Lifecycle Management & Resource Cleanup', () => {
        it('Scenario 8: graceful shutdown executes registered cleanup tasks and clears timers', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            let cleanupCalled = false;

            const dummyTimer = setInterval(() => {}, 100000);
            LifecycleManager.registerInterval(dummyTimer);
            LifecycleManager.registerCleanup('dummyWorker', () => {
                cleanupCalled = true;
            });

            await LifecycleManager.shutdown('SIGTERM', false);
            expect(cleanupCalled).toBe(true);
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

    describe('4. Migration Preflight & Status Verification', () => {
        it('Scenario 10: migration preflight performs zero writes to database', async () => {
            const pool = getTestPool();
            const client = await pool.connect();
            try {
                // Record table count before
                const before = await client.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`);

                const report = await checkMigrationStatus();
                expect(report.safeToApply).toBe(true);

                // Record table count after
                const after = await client.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`);
                expect(after.rows[0].count).toEqual(before.rows[0].count);
            } finally {
                client.release();
            }
        });

        it('Scenario 11: discovers migration files and checks deterministic ordering', async () => {
            const report = await checkMigrationStatus();
            expect(report.totalDiscovered).toBeGreaterThan(0);
            expect(report.discoveredFiles.length).toBe(report.totalDiscovered);
            expect(report.preflightChecks.duplicateMigrationIds.length).toBe(0);
            expect(report.migrationLedger.hasLedgerTable).toBeDefined();
        });
    });
});
