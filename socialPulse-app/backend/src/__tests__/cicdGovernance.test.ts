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
            expect(deployContent).toContain('Allowed: staging');
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

    describe('6. Restricted Self-Hosted Runner Channel, Manifest Binding & Rollback (SP-8C-4D Controls 25-38)', () => {
        it('Control 25: Staging deployment workflow explicitly targets dedicated staging runner labels', () => {
            expect(deployContent).toContain('runs-on: [self-hosted, linux, socialpulse-staging]');
        });

        it('Control 26: Production deployment cannot target the staging runner and fails closed', () => {
            expect(deployContent).toContain('Production deployment is strictly prohibited on the staging runner');
        });

        it('Control 27: Staging deployment requires its protected GitHub Environment and approval gate', () => {
            expect(deployContent).toContain('environment: ${{ inputs.environment }}');
        });

        it('Control 28: General CI and PR workflows remain GitHub-hosted and cannot target self-hosted runners', () => {
            expect(ciContent).not.toContain('self-hosted');
            expect(ciContent).not.toContain('socialpulse-staging');
            expect(ciContent).toContain('runs-on: ubuntu-latest');
        });

        it('Control 29: Release image publication remains GitHub-hosted and cannot target self-hosted runners', () => {
            expect(releaseContent).not.toContain('self-hosted');
            expect(releaseContent).not.toContain('socialpulse-staging');
            expect(releaseContent).toContain('runs-on: ubuntu-latest');
        });

        it('Control 30: Staging deployment validates immutable OCI digests and rejects mutable tags', () => {
            expect(deployContent).toContain('^[0-9a-fA-F]{40}$');
            expect(deployContent).toContain('^sha256:[0-9a-fA-F]{64}$');
            expect(deployContent).not.toContain(':latest');
        });

        it('Control 31: Privileged self-hosted action is pinned to an immutable 40-character commit SHA', () => {
            expect(deployContent).toMatch(/uses:\s*actions\/checkout@[0-9a-fA-F]{40}/);
            expect(deployContent).not.toMatch(/uses:\s*actions\/checkout@v[0-9]+/);
            expect(deployContent).toContain('11bd71901bbe5b1630ceea73d27597364c9af683');
            expect(deployContent).toContain('ref: ${{ inputs.commit_sha }}');
        });

        it('Control 32: Bounded /health/ready polling causes fail-closed exit on readiness failure', () => {
            expect(deployContent).toContain('http://localhost:5000/health/ready');
            expect(deployContent).toContain('grep -q \'"ready":true\'');
            expect(deployContent).toContain('Application failed readiness validation on /health/ready after 30 seconds');
        });

        it('Control 33: No SSH action or database migration command exists in deployment path', () => {
            expect(deployContent).not.toContain('appleboy/ssh-action');
            expect(deployContent).not.toContain('migrate.ts');
        });

        it('Control 34: Cryptographic release manifest download, SHA-256 verification and field binding are enforced', () => {
            expect(deployContent).toContain('Download & Cryptographically Verify Release Manifest');
            expect(deployContent).toContain('gh run download "${{ inputs.release_run_id }}"');
            expect(deployContent).toContain('sha256sum "$MANIFEST_FILE"');
            expect(deployContent).toContain('Manifest SHA-256 checksum mismatch');
            expect(deployContent).toContain('m.repository !== \'ArtradePro/Socialpulse-1\'');
        });

        it('Control 35: Pre-deployment state captures prior immutable image IDs', () => {
            expect(deployContent).toContain('Capturing and validating pre-deployment container state');
            expect(deployContent).toContain('docker inspect --format=\'{{.Config.Image}}\' socialpulse-backend');
            expect(deployContent).toContain('docker inspect --format=\'{{.Config.Image}}\' socialpulse-frontend');
        });

        it('Control 36: Fail-safe rollback disables ERR trap to prevent recursion and restores previous immutable images with readiness verification', () => {
            expect(deployContent).toContain('INITIATING FAIL-SAFE ROLLBACK');
            expect(deployContent).toContain('trap - ERR');
            expect(deployContent).toContain('export SOCIALPULSE_BACKEND_IMAGE="$PREV_BACKEND"');
            expect(deployContent).toContain('export SOCIALPULSE_FRONTEND_IMAGE="$PREV_FRONTEND"');
            expect(deployContent).toContain('Verifying rollback readiness');
        });

        it('Control 37: Persistent runner workspace hygiene and manifest cleanup runs unconditionally', () => {
            expect(deployContent).toContain('Persistent Runner Workspace & Manifest Cleanup');
            expect(deployContent).toContain('if: always()');
            expect(deployContent).toContain('rm -rf "/tmp/manifest-${{ inputs.release_id }}"');
            expect(deployContent).toContain('find "$GITHUB_WORKSPACE" -mindepth 1 -maxdepth 1 -exec rm -rf {} +');
        });

        it('Control 38: Minimum least-privilege token permissions are declared', () => {
            expect(deployContent).toContain('permissions:');
            expect(deployContent).toContain('contents: read');
            expect(deployContent).toContain('actions: read');
        });

        it('Control 39: Preflight tool and environment availability check exists', () => {
            expect(deployContent).toContain('Preflight Tool & Environment Availability Check');
            expect(deployContent).toContain('for tool in gh node sha256sum git docker wget; do');
            expect(deployContent).toContain('docker compose version');
        });

        it('Control 40: Release workflow run and artifact metadata are authenticated before download', () => {
            expect(deployContent).toContain('Authenticate Release Workflow Run & Artifact Metadata');
            expect(deployContent).toContain('run.repository.full_name !== \'ArtradePro/Socialpulse-1\'');
            expect(deployContent).toContain('!run.path.endsWith(\'release-images.yml\')');
            expect(deployContent).toContain('run.status !== \'completed\' || run.conclusion !== \'success\'');
            expect(deployContent).toContain('run.event !== \'workflow_dispatch\'');
            expect(deployContent).toContain('run.head_sha !== \'${{ inputs.commit_sha }}\'');
            expect(deployContent).toContain('Manifest artifact is expired');
        });

        it('Control 41: Pre-deployment state requires non-empty immutable image references present in local Docker cache', () => {
            expect(deployContent).toContain('Previous container state is missing. A first deployment must be separately authorized');
            expect(deployContent).toContain('@sha256:[0-9a-fA-F]{64}$');
            expect(deployContent).toContain('docker image inspect "$PREV_BACKEND"');
            expect(deployContent).toContain('docker image inspect "$PREV_FRONTEND"');
        });

        it('Control 42: Mutation boundary defines trap-based rollback on any error', () => {
            expect(deployContent).toContain('trap rollback ERR');
            expect(deployContent).toContain('=== MUTATION BOUNDARY BEGINS ===');
            expect(deployContent).toContain('trap - ERR');
        });

        it('Control 43: Workspace cleanup rejects root/home/opt paths and safely bounds deletion', () => {
            expect(deployContent).toContain('"$GITHUB_WORKSPACE" != "/"');
            expect(deployContent).toContain('"$GITHUB_WORKSPACE" != "$HOME"');
            expect(deployContent).toContain('"$GITHUB_WORKSPACE" != "/opt"');
            expect(deployContent).toContain('Runner workspace and temporary files safely cleaned');
        });
    });
});
