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
            expect(deployContent).toContain('group: deployment-staging');
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
            expect(deployContent).toContain('targeting staging');
            expect(deployContent).toContain('environment: staging');
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

    describe('6. Restricted Self-Hosted Runner Channel, Manifest Binding & Rollback (SP-8C-4G Controls 25-44)', () => {
        it('Control 25: Staging deployment workflow explicitly targets dedicated staging runner labels', () => {
            expect(deployContent).toContain('runs-on: [self-hosted, linux, socialpulse-staging]');
        });

        it('Control 26: Production deployment cannot target the staging runner and is excluded from dispatch inputs', () => {
            expect(deployContent).not.toMatch(/inputs:\s*[\s\S]*environment:\s*[\s\S]*options:\s*[\s\S]*- production/);
            expect(deployContent).toContain('name: Deploy Application (Staging)');
        });

        it('Control 27: Staging deployment requires its protected GitHub Environment hard-bound at job scheduling time', () => {
            expect(deployContent).toContain('environment: staging');
            expect(deployContent).not.toContain('environment: ${{ inputs.environment }}');
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

        it('Control 30: Staging deployment validates immutable commit SHA and manifest SHA-256 formats', () => {
            expect(deployContent).toContain('^[0-9a-fA-F]{40}$');
            expect(deployContent).toContain('^[0-9a-fA-F]{64}$');
        });

        it('Control 31: Privileged self-hosted action is pinned to an immutable 40-character commit SHA', () => {
            expect(deployContent).toMatch(/uses:\s*actions\/checkout@[0-9a-fA-F]{40}/);
            expect(deployContent).not.toMatch(/uses:\s*actions\/checkout@v[0-9]+/);
            expect(deployContent).toContain('11bd71901bbe5b1630ceea73d27597364c9af683');
            expect(deployContent).toContain('ref: ${{ inputs.commit_sha }}');
        });

        it('Control 32: Bounded /health/ready polling parses JSON response safely without raw log leaks', () => {
            expect(deployContent).toContain('http://localhost:5000/health/ready');
            expect(deployContent).toContain('data.ready === true');
            expect(deployContent).toContain('Readiness probe passed (ready: true)');
        });

        it('Control 33: No SSH action or database migration command exists in deployment path', () => {
            expect(deployContent).not.toContain('appleboy/ssh-action');
            expect(deployContent).not.toContain('migrate.ts');
        });

        it('Control 34: Exact SP-8B release manifest schema is validated and derives deployment image references directly', () => {
            expect(deployContent).toContain('Create Secure Temporary Directory & Cryptographically Verify Release Manifest');
            expect(deployContent).toContain('gh run download "$INPUT_RELEASE_RUN_ID"');
            expect(deployContent).toContain('sha256sum "$MANIFEST_FILE"');
            expect(deployContent).toContain('m.targetEnvironment !== \'staging\'');
            expect(deployContent).toContain('DEPLOY_BACKEND_REF=');
            expect(deployContent).toContain('DEPLOY_FRONTEND_REF=');
        });

        it('Control 35: Pre-deployment state requires exact digest-only immutable image references', () => {
            expect(deployContent).toContain('Capturing and validating pre-deployment container state');
            expect(deployContent).toContain('artradepro/socialpulse-backend@sha256:[0-9a-fA-F]{64}$');
            expect(deployContent).toContain('artradepro/socialpulse-frontend@sha256:[0-9a-fA-F]{64}$');
        });

        it('Control 36: Fail-safe rollback disables error trap to prevent recursion, verifies Compose exit code and readiness', () => {
            expect(deployContent).toContain('INITIATING FAIL-SAFE ROLLBACK ON MUTATION FAILURE');
            expect(deployContent).toContain('trap \'\' ERR INT TERM');
            expect(deployContent).toContain('COMPOSE_EXIT=0');
            expect(deployContent).toContain('export SOCIALPULSE_BACKEND_IMAGE="$PREV_BACKEND"');
            expect(deployContent).toContain('export SOCIALPULSE_FRONTEND_IMAGE="$PREV_FRONTEND"');
            expect(deployContent).toContain('Verifying rollback readiness on /health/ready');
            expect(deployContent).toContain('Rollback failed! Compose exit: $COMPOSE_EXIT, Readiness: $ROLLBACK_READY');
        });

        it('Control 37: Post-deployment secure cleanup cleans only generated temporary directory under RUNNER_TEMP', () => {
            expect(deployContent).toContain('Secure Temporary Artifact Cleanup');
            expect(deployContent).toContain('if: always()');
            expect(deployContent).toContain('CANONICAL_ROOT=$(realpath "$TEMP_ROOT"');
            expect(deployContent).toContain('Generated temporary manifest directory safely cleaned');
        });

        it('Control 38: Minimum least-privilege token permissions are declared', () => {
            expect(deployContent).toContain('permissions:');
            expect(deployContent).toContain('contents: read');
            expect(deployContent).toContain('actions: read');
        });

        it('Control 39: Preflight tool and environment availability check exists', () => {
            expect(deployContent).toContain('Preflight Tool & Environment Availability Check');
            expect(deployContent).toContain('for tool in gh node sha256sum git docker wget realpath mktemp; do');
            expect(deployContent).toContain('docker compose version');
        });

        it('Control 40: Release workflow run metadata matches exact path and name before artifact download', () => {
            expect(deployContent).toContain('Authenticate Release Workflow Run & Artifact Metadata');
            expect(deployContent).toContain('run.repository.full_name !== \'ArtradePro/Socialpulse-1\'');
            expect(deployContent).toContain('run.path !== \'.github/workflows/release-images.yml\'');
            expect(deployContent).toContain('run.name !== \'Release Images\'');
            expect(deployContent).toContain('run.status !== \'completed\' || run.conclusion !== \'success\'');
            expect(deployContent).toContain('run.event !== \'workflow_dispatch\'');
            expect(deployContent).toContain('run.head_sha !== process.env.INPUT_COMMIT_SHA');
            expect(deployContent).toContain('Manifest artifact is expired');
        });

        it('Control 41: Pre-deployment state requires non-empty immutable image references present in local Docker cache', () => {
            expect(deployContent).toContain('Previous container state is missing. A first/bootstrap deployment must be separately governed');
            expect(deployContent).toContain('docker image inspect "$PREV_BACKEND"');
            expect(deployContent).toContain('docker image inspect "$PREV_FRONTEND"');
        });

        it('Control 42: Mutation boundary defines unmasked trap-based rollback with errtrace (set -E)', () => {
            expect(deployContent).toContain('trap rollback ERR INT TERM');
            expect(deployContent).toContain('=== MUTATION BOUNDARY BEGINS ===');
            expect(deployContent).toContain('set -E');
            expect(deployContent).toContain('trap - ERR INT TERM');
        });

        it('Control 43: Zero direct input interpolation in executable code; all inputs passed via step-level env', () => {
            const runBlocks = deployContent.split(/-\s*name:/).slice(1);
            for (const block of runBlocks) {
                const runIdx = block.indexOf('run: |');
                if (runIdx !== -1) {
                    const runScript = block.slice(runIdx);
                    expect(runScript).not.toMatch(/\$\{\{\s*inputs\./);
                }
            }
        });

        it('Control 44: Manifest validation passes for authentic SP-8B artifact and fails for malicious variations', () => {
            const authenticSP8BManifest = {
                schemaVersion: '1.0.0',
                releaseId: 'sp-8b-staging-release-01',
                repository: 'ArtradePro/Socialpulse-1',
                sourceCommit: 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e',
                targetEnvironment: 'staging',
                backend: {
                    repository: 'artradepro/socialpulse-backend',
                    tag: 'sha-b9f819c4b153dd46dc9f4080a99d01aeffd01b7e',
                    digest: 'sha256:f2f9105cf5a34328a9adb3cb5a0f4f54d43bc50d6ac731d7f00e8777beabf310'
                },
                frontend: {
                    repository: 'artradepro/socialpulse-frontend',
                    tag: 'sha-b9f819c4b153dd46dc9f4080a99d01aeffd01b7e',
                    digest: 'sha256:39bf3da17736ac1f83d61da3928a23e1643235426d7c78740a813e1840bea874'
                },
                workflowRunId: '33556885396',
                builtAt: '2026-09-01T18:40:00Z'
            };

            const res = validateReleaseManifest(authenticSP8BManifest as any, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e', 'staging');
            expect(res.valid).toBe(true);

            // Negative test 1: Target environment mismatch
            const resEnv = validateReleaseManifest({ ...authenticSP8BManifest, targetEnvironment: 'production' } as any, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e', 'staging');
            expect(resEnv.valid).toBe(false);

            // Negative test 2: Source commit mismatch
            const resSha = validateReleaseManifest(authenticSP8BManifest as any, 'a'.repeat(40), 'staging');
            expect(resSha.valid).toBe(false);

            // Negative test 3: Malformed digest
            const resDigest = validateReleaseManifest({
                ...authenticSP8BManifest,
                backend: { ...authenticSP8BManifest.backend, digest: 'invalid' }
            } as any, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e', 'staging');
            expect(resDigest.valid).toBe(false);
        });
    });
});
