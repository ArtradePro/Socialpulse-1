import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import request from 'supertest';
import { app } from '../app';
import { EnvironmentConfig } from '../config/environment';
import { LifecycleManager } from '../lifecycle';
import { checkMigrationStatus } from '../database/scripts/migrationStatus';
import { closeTestPool } from './helpers/db';

describe('Lifecycle, Configuration Hardening & Readiness (Phase SP-7A)', () => {
    afterEach(() => {
        LifecycleManager.resetForTesting();
    });

    afterAll(async () => {
        LifecycleManager.resetForTesting();
        await closeTestPool();
    });

    describe('Centralized Environment Validation & Production Lockout', () => {
        it('validates startup critical configuration', () => {
            const result = EnvironmentConfig.validateStartup();
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('excludes unauthorized localhost origins when NODE_ENV is production', () => {
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

        it('provides redacted feature diagnostics without leaking secrets', () => {
            const diag = EnvironmentConfig.getDiagnostics();
            expect(diag.nodeEnv).toBeDefined();
            expect(diag.features.database.status).toBe('ready');
            expect(diag.features.encryption.status).toBe('ready');
            // Ensure no secret keys appear in the diagnostic object
            const json = JSON.stringify(diag);
            expect(json).not.toContain('TEST_KEY_32_BYTES');
            expect(json).not.toContain('password');
        });
    });

    describe('Health & Readiness Endpoints (/health/live & /health/ready)', () => {
        it('responds to liveness probe with process status and uptime', async () => {
            const res = await request(app).get('/health/live');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('alive');
            expect(res.body.uptimeSecs).toBeGreaterThanOrEqual(0);
        });

        it('responds to readiness probe with core status and feature diagnostics', async () => {
            const res = await request(app).get('/health/ready');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ready');
            expect(res.body.coreReady).toBe(true);
            expect(res.body.diagnostics).toBeDefined();
            expect(res.body.diagnostics.features.database.status).toBe('ready');
        });
    });

    describe('Graceful Shutdown Lifecycle', () => {
        it('handles duplicate shutdown signals safely without crashing', async () => {
            const shutdownSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            // First signal triggers shutdown logic
            const p1 = LifecycleManager.shutdown('SIGTERM');
            // Duplicate signal should be ignored
            const p2 = LifecycleManager.shutdown('SIGINT');

            await Promise.all([p1, p2]);
            expect(LifecycleManager.getIsShuttingDown()).toBe(true);

            shutdownSpy.mockRestore();
        });
    });

    describe('Read-Only Migration Preflight and Status', () => {
        it('performs non-mutating preflight check of migration files and schema status', async () => {
            const report = await checkMigrationStatus();
            expect(report.totalDiscovered).toBeGreaterThan(0);
            expect(report.discoveredFiles.length).toBeGreaterThan(0);
            expect(report.preflightChecks.destructiveStatementsFound.length).toBe(0);
            expect(report.safeToApply).toBe(true);
        });
    });
});
