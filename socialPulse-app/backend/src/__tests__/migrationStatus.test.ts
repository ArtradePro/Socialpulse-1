import { verifyMigrationCurrent, verifyMigrationModeState, MigrationPreflightReport } from '../database/scripts/migrationStatus';

describe('Migration Status Governance & Mode Verification (SP-8C-5C-R4)', () => {
    const baseReport: MigrationPreflightReport = {
        timestamp: new Date().toISOString(),
        ledgerStatus: 'active',
        applicationState: 'determinate',
        totalDiscovered: 2,
        discoveredFiles: ['001_initial.sql', '002_marketing.sql'],
        migrations: [
            { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'applied', checksumInDb: 'abc' },
            { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'applied', checksumInDb: 'def' }
        ],
        databaseEmptiness: {
            isCleanEmpty: false,
            userTableCount: 2,
            userTables: ['users', 'workspaces']
        },
        preflightChecks: {
            duplicateMigrationIds: [],
            destructiveStatementsFound: [],
            duplicateStripeSessions: 0,
            hasStripeUniqueIndex: true,
            stripeIndexState: 'present',
            requiredExtensions: ['uuid-ossp']
        },
        blockers: [],
        safeToApply: true
    };

    const emptyDbReport: MigrationPreflightReport = {
        timestamp: new Date().toISOString(),
        ledgerStatus: 'absent',
        applicationState: 'indeterminate',
        totalDiscovered: 2,
        discoveredFiles: ['001_initial.sql', '002_marketing.sql'],
        migrations: [
            { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'pending' },
            { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'pending' }
        ],
        databaseEmptiness: {
            isCleanEmpty: true,
            userTableCount: 0,
            userTables: []
        },
        preflightChecks: {
            duplicateMigrationIds: [],
            destructiveStatementsFound: [],
            duplicateStripeSessions: 0,
            hasStripeUniqueIndex: false,
            stripeIndexState: 'pending_migration',
            requiredExtensions: ['uuid-ossp']
        },
        blockers: ['MIGRATION_LEDGER_ABSENT', 'APPLIED_MIGRATIONS_UNKNOWN'],
        safeToApply: false
    };

    describe('1. verifyMigrationCurrent (Backward-Compatible Current State Check)', () => {
        it('returns isCurrent=true when all discovered migrations are applied and checksums match', () => {
            const result = verifyMigrationCurrent(baseReport);
            expect(result.isCurrent).toBe(true);
            expect(result.reasons).toHaveLength(0);
        });

        it('returns isCurrent=false when ledger table is absent', () => {
            const report: MigrationPreflightReport = {
                ...baseReport,
                ledgerStatus: 'absent',
                migrations: [
                    { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'pending' },
                    { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'pending' }
                ]
            };

            const result = verifyMigrationCurrent(report);
            expect(result.isCurrent).toBe(false);
            expect(result.reasons.some(r => r.includes('Migration ledger is absent'))).toBe(true);
        });

        it('returns isCurrent=false when pending migrations exist', () => {
            const report: MigrationPreflightReport = {
                ...baseReport,
                migrations: [
                    { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'applied', checksumInDb: 'abc' },
                    { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'pending' }
                ]
            };

            const result = verifyMigrationCurrent(report);
            expect(result.isCurrent).toBe(false);
            expect(result.reasons.some(e => e.includes('1 pending migration(s)'))).toBe(true);
        });

        it('returns isCurrent=false when checksum drift is detected', () => {
            const report: MigrationPreflightReport = {
                ...baseReport,
                migrations: [
                    { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'drift_detected', checksumInDb: 'old' },
                    { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'applied', checksumInDb: 'def' }
                ]
            };

            const result = verifyMigrationCurrent(report);
            expect(result.isCurrent).toBe(false);
            expect(result.reasons.some(e => e.includes('1 drift detected migration(s)'))).toBe(true);
        });

        it('returns isCurrent=false when unknown migrations exist in database', () => {
            const report: MigrationPreflightReport = {
                ...baseReport,
                migrations: [
                    { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'applied', checksumInDb: 'abc' },
                    { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'applied', checksumInDb: 'def' },
                    { filename: '999_rogue.sql', migrationId: '999', checksum: 'xyz', status: 'unknown_in_db' }
                ]
            };

            const result = verifyMigrationCurrent(report);
            expect(result.isCurrent).toBe(false);
            expect(result.reasons.some(e => e.includes('1 unknown migration(s)'))).toBe(true);
        });
    });

    describe('2. Mode Validation: Bootstrap Mode (--mode=bootstrap)', () => {
        it('accepts a verified empty database with zero user tables and absent ledger', () => {
            const result = verifyMigrationModeState(emptyDbReport, 'bootstrap', false);
            expect(result.isValid).toBe(true);
            expect(result.reasons).toHaveLength(0);
        });

        it('rejects bootstrap mode when untracked user tables already exist in public schema', () => {
            const dirtyDbReport: MigrationPreflightReport = {
                ...emptyDbReport,
                databaseEmptiness: {
                    isCleanEmpty: false,
                    userTableCount: 3,
                    userTables: ['orders', 'users', 'posts']
                }
            };
            const result = verifyMigrationModeState(dirtyDbReport, 'bootstrap', false);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('Database is not empty. Found 3 existing table(s)'))).toBe(true);
        });

        it('rejects bootstrap mode when schema_migrations ledger table already exists', () => {
            const ledgerExistsReport: MigrationPreflightReport = {
                ...emptyDbReport,
                ledgerStatus: 'active'
            };
            const result = verifyMigrationModeState(ledgerExistsReport, 'bootstrap', false);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('Migration ledger (schema_migrations) already exists'))).toBe(true);
        });

        it('rejects bootstrap mode when duplicate migration prefixes are detected', () => {
            const dupReport: MigrationPreflightReport = {
                ...emptyDbReport,
                preflightChecks: {
                    ...emptyDbReport.preflightChecks,
                    duplicateMigrationIds: ['20260515_ecommerce']
                }
            };
            const result = verifyMigrationModeState(dupReport, 'bootstrap', false);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('Duplicate migration prefixes detected'))).toBe(true);
        });

        it('rejects bootstrap mode when destructive SQL statements are detected', () => {
            const destructiveReport: MigrationPreflightReport = {
                ...emptyDbReport,
                preflightChecks: {
                    ...emptyDbReport.preflightChecks,
                    destructiveStatementsFound: ['003_drop.sql matches destructive pattern DROP TABLE']
                }
            };
            const result = verifyMigrationModeState(destructiveReport, 'bootstrap', false);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('Destructive SQL statements detected'))).toBe(true);
        });
    });

    describe('3. Mode Validation: Incremental Mode (--mode=incremental)', () => {
        it('accepts an active ledger with matching checksums and zero drift', () => {
            const result = verifyMigrationModeState(baseReport, 'incremental', false);
            expect(result.isValid).toBe(true);
            expect(result.reasons).toHaveLength(0);
        });

        it('rejects incremental mode when ledger table is absent', () => {
            const result = verifyMigrationModeState(emptyDbReport, 'incremental', false);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('Migration ledger is absent'))).toBe(true);
        });

        it('rejects incremental mode when drift is detected', () => {
            const driftReport: MigrationPreflightReport = {
                ...baseReport,
                migrations: [
                    { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'drift_detected', checksumInDb: 'old_sha' },
                    { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'applied', checksumInDb: 'def' }
                ]
            };
            const result = verifyMigrationModeState(driftReport, 'incremental', false);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('1 drift detected migration(s)'))).toBe(true);
        });

        it('rejects incremental mode with requireCurrent=true when pending migrations exist', () => {
            const pendingReport: MigrationPreflightReport = {
                ...baseReport,
                migrations: [
                    { filename: '001_initial.sql', migrationId: '001', checksum: 'abc', status: 'applied', checksumInDb: 'abc' },
                    { filename: '002_marketing.sql', migrationId: '002', checksum: 'def', status: 'pending' }
                ]
            };
            const result = verifyMigrationModeState(pendingReport, 'incremental', true);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('1 pending migration(s)'))).toBe(true);
        });

        it('rejects incremental mode when query errors occurred during preflight', () => {
            const errReport: MigrationPreflightReport = {
                ...baseReport,
                blockers: ['QUERY_ERROR: connection refused to postgres:5432']
            };
            const result = verifyMigrationModeState(errReport, 'incremental', false);
            expect(result.isValid).toBe(false);
            expect(result.reasons.some(r => r.includes('QUERY_ERROR: connection refused'))).toBe(true);
        });
    });
});
