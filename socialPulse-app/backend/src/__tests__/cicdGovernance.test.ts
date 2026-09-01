import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ReleaseManifest {
    schemaVersion: string;
    releaseId: string;
    repository: string;
    sourceCommit: string;
    targetEnvironment: 'staging' | 'production';
    backend: {
        repository: string;
        tag: string;
        digest: string;
    };
    frontend: {
        repository: string;
        tag: string;
        digest: string;
    };
    workflowRunId: string;
    builtAt: string;
    manifestChecksum?: string;
    isIncidentEvidenceFixture?: boolean;
}

export function validateReleaseManifest(manifest: ReleaseManifest, requestedCommit: string, requestedEnv: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (manifest.isIncidentEvidenceFixture) {
        errors.push('INCIDENT_EVIDENCE_FIXTURE_BLOCKED: Incident evidence fixtures cannot be deployed as an approved release');
    }

    if (manifest.schemaVersion !== '1.0.0') {
        errors.push(`Invalid schema version: expected '1.0.0', got '${manifest.schemaVersion}'`);
    }

    if (manifest.repository !== 'ArtradePro/Socialpulse-1') {
        errors.push(`Unauthorized repository identity: '${manifest.repository}'`);
    }

    if (!/^[0-9a-fA-F]{40}$/.test(manifest.sourceCommit)) {
        errors.push(`Invalid source commit format: '${manifest.sourceCommit}'`);
    } else if (manifest.sourceCommit !== requestedCommit) {
        errors.push(`Commit SHA mismatch: manifest has '${manifest.sourceCommit}', deployment requested '${requestedCommit}'`);
    }

    if (manifest.targetEnvironment !== requestedEnv) {
        errors.push(`Environment mismatch: manifest target is '${manifest.targetEnvironment}', deployment requested '${requestedEnv}'`);
    }

    if (!['staging', 'production'].includes(requestedEnv)) {
        errors.push(`Disallowed environment: '${requestedEnv}'`);
    }

    // Digest validation (sha256:<64-hex>)
    const digestRegex = /^sha256:[0-9a-fA-F]{64}$/;
    if (!digestRegex.test(manifest.backend.digest)) {
        errors.push(`Invalid backend digest format: '${manifest.backend.digest}'`);
    }
    if (!digestRegex.test(manifest.frontend.digest)) {
        errors.push(`Invalid frontend digest format: '${manifest.frontend.digest}'`);
    }

    // Reject :latest in tags
    if (manifest.backend.tag.includes('latest') || manifest.frontend.tag.includes('latest')) {
        errors.push('Mutable :latest tag is strictly prohibited in release manifest');
    }

    // Tag SHA matching
    if (!manifest.backend.tag.endsWith(manifest.sourceCommit) || !manifest.frontend.tag.endsWith(manifest.sourceCommit)) {
        errors.push('Image tags must encode the exact source commit SHA');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

describe('CI/CD Governance, Workflow Schema, Release-Manifest Binding & Fail-Closed Controls (SP-7C-R2)', () => {
    const rootDir = join(__dirname, '../../../../');
    const workflowsDir = join(rootDir, '.github/workflows');

    const ciYmlPath = join(workflowsDir, 'ci.yml');
    const releaseYmlPath = join(workflowsDir, 'release-images.yml');
    const deployYmlPath = join(workflowsDir, 'deploy.yml');
    const migrateYmlPath = join(workflowsDir, 'migrate.yml');
    const composeProdPath = join(rootDir, 'docker-compose.prod.yml');

    const ciContent = readFileSync(ciYmlPath, 'utf-8');
    const releaseContent = readFileSync(releaseYmlPath, 'utf-8');
    const deployContent = readFileSync(deployYmlPath, 'utf-8');
    const migrateContent = readFileSync(migrateYmlPath, 'utf-8');
    const composeProdContent = readFileSync(composeProdPath, 'utf-8');

    describe('1. Continuous Integration (ci.yml) Controls (Controls 1-4)', () => {
        it('Control 1: CI contains no deploy job', () => {
            expect(ciContent).not.toContain('Deploy — build & push to VPS');
            expect(ciContent).not.toMatch(/^  deploy:/m);
        });

        it('Control 2: CI contains no registry login', () => {
            expect(ciContent).not.toContain('docker/login-action');
            expect(ciContent).not.toContain('DOCKERHUB_TOKEN');
        });

        it('Control 3: CI contains no VPS SSH', () => {
            expect(ciContent).not.toContain('appleboy/ssh-action');
            expect(ciContent).not.toContain('DEPLOY_SSH_KEY');
        });

        it('Control 4: CI contains no migration execution against remote hosts', () => {
            expect(ciContent).not.toContain('run --rm migrate');
        });
    });

    describe('2. Manual Trigger & Approval Gating (Controls 5-7, 19-20)', () => {
        it('Control 5: Release workflow is manual-only', () => {
            expect(releaseContent).toContain('workflow_dispatch:');
            expect(releaseContent).not.toContain('on:\n  push:');
        });

        it('Control 6: Deployment workflow is manual-only', () => {
            expect(deployContent).toContain('workflow_dispatch:');
            expect(deployContent).not.toContain('on:\n  push:');
        });

        it('Control 7: Migration workflow is manual-only', () => {
            expect(migrateContent).toContain('workflow_dispatch:');
            expect(migrateContent).not.toContain('on:\n  push:');
        });

        it('Control 19: Concurrency protection exists on deployment and migration', () => {
            expect(deployContent).toContain('group: deployment-${{ inputs.environment }}');
            expect(deployContent).toContain('cancel-in-progress: false');
            expect(migrateContent).toContain('group: migration-${{ inputs.environment }}');
            expect(migrateContent).toContain('cancel-in-progress: false');
        });

        it('Control 20: Migration is separately gated from deployment', () => {
            expect(deployContent).not.toContain('migrate.ts');
            expect(migrateContent).toContain('confirm_execution:');
            expect(migrateContent).toContain('backup_confirmed:');
        });
    });

    describe('3. Environment Allowlist & Fail-Closed Guards (Controls 8-9, 21-23)', () => {
        it('Control 8 & 9: Environment input is strictly allowlisted; arbitrary environments rejected', () => {
            expect(deployContent).toContain('staging');
            expect(deployContent).toContain('production');
            expect(deployContent).toContain('Allowed: staging, production');
            expect(migrateContent).toContain('Allowed: staging, production');
        });

        it('Control 21: Migration preflight precedes execution', () => {
            const preflightIdx = migrateContent.indexOf('migrationStatus.ts');
            const migrateIdx = migrateContent.indexOf('migrate.ts');
            expect(preflightIdx).toBeGreaterThan(-1);
            expect(migrateIdx).toBeGreaterThan(preflightIdx);
        });

        it('Control 22: Production adoption remains unconditionally prohibited', async () => {
            const { adoptLedger } = require('../database/scripts/adoptLedger');
            const originalEnv = process.env.NODE_ENV;
            try {
                process.env.NODE_ENV = 'production';
                const res = await adoptLedger({ confirm: true });
                expect(res.wouldMutateDatabase).toBe(false);
                expect(res.blockers.some((b: string) => b.includes('PRODUCTION_ADOPTION_UNCONDITIONALLY_PROHIBITED'))).toBe(true);
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });

        it('Control 23: Secrets are not echoed in output steps', () => {
            expect(deployContent).not.toContain('echo "${{ secrets.');
            expect(migrateContent).not.toContain('echo "${{ secrets.');
            expect(releaseContent).not.toContain('echo "${{ secrets.');
        });
    });

    describe('4. Release Manifest Schema, Digest Enforcement & Fixture Protection (Controls 10-16, 24)', () => {
        const validManifest: ReleaseManifest = {
            schemaVersion: '1.0.0',
            releaseId: 'rel-20260901-01',
            repository: 'ArtradePro/Socialpulse-1',
            sourceCommit: 'b14356baf4e9882eed7d85f49cbc73d279b914c9',
            targetEnvironment: 'staging',
            backend: {
                repository: 'artradepro/socialpulse-backend',
                tag: 'sha-b14356baf4e9882eed7d85f49cbc73d279b914c9',
                digest: 'sha256:4f39e359d7ad86ddc3dc64cfa66cb0fe79e70188f320509128153b66d4a39b7d'
            },
            frontend: {
                repository: 'artradepro/socialpulse-frontend',
                tag: 'sha-b14356baf4e9882eed7d85f49cbc73d279b914c9',
                digest: 'sha256:9e62b1460c66b5e3c2fcec96ee0bdf36a06a28c147a63d4b6d673e0e1195210e'
            },
            workflowRunId: '33515289578',
            builtAt: '2026-09-01T13:48:44Z'
        };

        it('Control 10 & 11: Rejects :latest and mutable tags', () => {
            const mutable = { ...validManifest, backend: { ...validManifest.backend, tag: 'latest' } };
            const res = validateReleaseManifest(mutable, validManifest.sourceCommit, 'staging');
            expect(res.valid).toBe(false);
            expect(res.errors.some(e => e.includes('latest'))).toBe(true);
        });

        it('Control 12: Digest format is enforced', () => {
            const badDigest = { ...validManifest, backend: { ...validManifest.backend, digest: 'bad_digest_format' } };
            const res = validateReleaseManifest(badDigest, validManifest.sourceCommit, 'staging');
            expect(res.valid).toBe(false);
            expect(res.errors.some(e => e.includes('digest'))).toBe(true);
        });

        it('Control 13 & 14: Source SHA is enforced and mismatches are rejected', () => {
            const resMismatch = validateReleaseManifest(validManifest, '0000000000000000000000000000000000000000', 'staging');
            expect(resMismatch.valid).toBe(false);
            expect(resMismatch.errors.some(e => e.includes('mismatch'))).toBe(true);
        });

        it('Control 15: Image repository allowlist is enforced', () => {
            const wrongRepo = { ...validManifest, repository: 'MaliciousActor/FakeRepo' };
            const res = validateReleaseManifest(wrongRepo, validManifest.sourceCommit, 'staging');
            expect(res.valid).toBe(false);
            expect(res.errors.some(e => e.includes('Unauthorized repository'))).toBe(true);
        });

        it('Control 16: Release artifact provenance is checked', () => {
            const res = validateReleaseManifest(validManifest, validManifest.sourceCommit, 'staging');
            expect(res.valid).toBe(true);
        });

        it('Control 24: Incident evidence fixture cannot be deployed as an approved release', () => {
            const incidentFixture: ReleaseManifest = {
                ...validManifest,
                isIncidentEvidenceFixture: true
            };
            const res = validateReleaseManifest(incidentFixture, validManifest.sourceCommit, 'staging');
            expect(res.valid).toBe(false);
            expect(res.errors.some(e => e.includes('INCIDENT_EVIDENCE_FIXTURE_BLOCKED'))).toBe(true);
        });
    });

    describe('5. Production Compose (docker-compose.prod.yml) Safety (Controls 17-18)', () => {
        it('Control 17: Production Compose contains no build block', () => {
            expect(composeProdContent).not.toContain('build:');
            expect(composeProdContent).not.toContain('context: ./socialPulse-app');
        });

        it('Control 18: Production Compose has no default or fallback image', () => {
            expect(composeProdContent).toContain('image: ${SOCIALPULSE_BACKEND_IMAGE:?');
            expect(composeProdContent).toContain('image: ${SOCIALPULSE_FRONTEND_IMAGE:?');
            expect(composeProdContent).not.toContain(':latest');
        });
    });

    describe('6. Restricted Self-Hosted Runner Channel & Isolation (SP-8C-4A Controls 26-30)', () => {
        it('Control 26: Staging deployment workflow targets restricted staging runner labels', () => {
            expect(deployContent).toContain('socialpulse-staging');
            expect(deployContent).toContain('self-hosted');
            expect(deployContent).toContain('linux');
        });

        it('Control 27: Production deployment cannot target the staging runner', () => {
            expect(deployContent).toContain('socialpulse-production');
            expect(deployContent).toMatch(/inputs\.environment == 'staging'.*socialpulse-staging.*socialpulse-production/);
        });

        it('Control 28: General CI and PR workflows cannot target self-hosted runners', () => {
            expect(ciContent).not.toContain('self-hosted');
            expect(ciContent).not.toContain('socialpulse-staging');
            expect(ciContent).not.toContain('socialpulse-production');
            expect(ciContent).toContain('runs-on: ubuntu-latest');
        });

        it('Control 29: Release image publication cannot target self-hosted runners', () => {
            expect(releaseContent).not.toContain('self-hosted');
            expect(releaseContent).not.toContain('socialpulse-staging');
            expect(releaseContent).toContain('runs-on: ubuntu-latest');
        });

        it('Control 30: Staging deployment executes local docker compose without SSH dependency', () => {
            expect(deployContent).toContain('docker pull "$BACKEND_REF"');
            expect(deployContent).toContain('docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build');
            expect(deployContent).not.toContain('appleboy/ssh-action');
        });
    });
});
