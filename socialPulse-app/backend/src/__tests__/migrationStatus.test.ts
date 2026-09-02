import { verifyMigrationCurrent, MigrationPreflightReport } from '../database/scripts/migrationStatus';

describe('Migration Status Governance & Current Verification', () => {
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
        expect(result.reasons).toContain('Migration ledger is absent (schema_migrations table missing)');
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

    it('returns isCurrent=false when preflight report contains blockers', () => {
        const report: MigrationPreflightReport = {
            ...baseReport,
            blockers: ['Database connection timeout']
        };

        const result = verifyMigrationCurrent(report);
        expect(result.isCurrent).toBe(false);
        expect(result.reasons).toContain('Database connection timeout');
    });

    it('returns isCurrent=false when no migration files are discovered', () => {
        const report: MigrationPreflightReport = {
            ...baseReport,
            totalDiscovered: 0,
            discoveredFiles: [],
            migrations: []
        };

        const result = verifyMigrationCurrent(report);
        expect(result.isCurrent).toBe(false);
        expect(result.reasons).toContain('No migration files discovered in migrations directory');
    });
});
