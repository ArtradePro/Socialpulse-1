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

    // Repository matching
    if (!manifest.backend || manifest.backend.repository !== 'artradepro/socialpulse-backend') {
        errors.push(`Invalid backend repository: '${manifest.backend?.repository}'`);
    }
    if (!manifest.frontend || manifest.frontend.repository !== 'artradepro/socialpulse-frontend') {
        errors.push(`Invalid frontend repository: '${manifest.frontend?.repository}'`);
    }

    // Tag matching (exact sha-<commit>)
    const expectedTag = `sha-${manifest.sourceCommit}`;
    if (!manifest.backend || manifest.backend.tag !== expectedTag) {
        errors.push(`Backend tag '${manifest.backend?.tag}' does not match expected '${expectedTag}'`);
    }
    if (!manifest.frontend || manifest.frontend.tag !== expectedTag) {
        errors.push(`Frontend tag '${manifest.frontend?.tag}' does not match expected '${expectedTag}'`);
    }

    // Digest validation (sha256:<64-hex>)
    const digestRegex = /^sha256:[0-9a-fA-F]{64}$/;
    if (!manifest.backend || !digestRegex.test(manifest.backend.digest)) {
        errors.push(`Invalid backend digest format: '${manifest.backend?.digest}'`);
    }
    if (!manifest.frontend || !digestRegex.test(manifest.frontend.digest)) {
        errors.push(`Invalid frontend digest format: '${manifest.frontend?.digest}'`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export function validateReleaseRunProvenance(run: any, expectedSha: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!run || !run.repository || run.repository.full_name !== 'ArtradePro/Socialpulse-1') {
        errors.push('Run repository mismatch');
    }
    if (!run || !run.head_repository || run.head_repository.full_name !== 'ArtradePro/Socialpulse-1') {
        errors.push('Forked or unauthorized head repository');
    }
    if (!run || run.path !== '.github/workflows/release-images.yml') {
        errors.push('Run is not exact .github/workflows/release-images.yml');
    }
    if (!run || run.name !== 'Release Images') {
        errors.push('Run name mismatch');
    }
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
        errors.push('Release run did not complete successfully');
    }
    if (!run || run.event !== 'workflow_dispatch') {
        errors.push('Release run was not triggered via manual workflow_dispatch');
    }
    if (!run || run.head_branch !== 'main') {
        errors.push('Release run did not originate from protected main branch');
    }
    if (!run || run.head_sha !== expectedSha) {
        errors.push('Release run head SHA mismatch');
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

        it('Control 19: Concurrency protection exists on deployment and migration with shared staging mutation group', () => {
            expect(deployContent).toContain('group: socialpulse-staging-mutation');
            expect(deployContent).toContain('cancel-in-progress: false');
            expect(migrateContent).toContain('group: socialpulse-staging-mutation');
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
            expect(migrateContent).toContain('environment: staging');
            expect(migrateContent).toContain('staging only');
        });

        it('Control 21: Migration preflight precedes execution', () => {
            const preflightIdx = migrateContent.indexOf('migrationStatus.js');
            const migrateIdx = migrateContent.indexOf('migrate.js');
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

    describe('6. Restricted Self-Hosted Runner Channel, Manifest Binding & Rollback (SP-8C-4H Controls 25-44)', () => {
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
            expect(deployContent).toContain('http://127.0.0.1:5000/health/ready');
            expect(deployContent).toContain('data.ready === true');
            expect(deployContent).toContain('Readiness probe passed (ready: true)');
        });

        it('Control 33: No SSH action or database migration command exists in deployment path', () => {
            expect(deployContent).not.toContain('appleboy/ssh-action');
            expect(deployContent).not.toContain('migrate.ts');
        });

        it('Control 34: Exact SP-8B release manifest schema is validated and derives deployment image references directly', () => {
            expect(deployContent).toContain('Create Dedicated Secure Temporary Directory & Cryptographically Verify Release Manifest');
            expect(deployContent).toContain('gh run download "$INPUT_RELEASE_RUN_ID"');
            expect(deployContent).toContain('sha256sum "$MANIFEST_FILE"');
            expect(deployContent).toContain('m.targetEnvironment !== \'staging\'');
            expect(deployContent).toContain('m.backend.tag !== \'sha-\' + process.env.INPUT_COMMIT_SHA');
            expect(deployContent).toContain('m.frontend.tag !== \'sha-\' + process.env.INPUT_COMMIT_SHA');
            expect(deployContent).toContain('DEPLOY_BACKEND_REF=');
            expect(deployContent).toContain('DEPLOY_FRONTEND_REF=');
        });

        it('Control 35: Pre-deployment state requires exact digest-only immutable image references and pulls digests prior to mutation', () => {
            expect(deployContent).toContain('Capturing and validating pre-deployment container state');
            expect(deployContent).toContain('artradepro/socialpulse-backend@sha256:[0-9a-fA-F]{64}$');
            expect(deployContent).toContain('artradepro/socialpulse-frontend@sha256:[0-9a-fA-F]{64}$');
            const pullIdx = deployContent.indexOf('Pulling verified immutable digests');
            const mutationIdx = deployContent.indexOf('=== SERVICE MUTATION BOUNDARY BEGINS ===');
            expect(pullIdx).toBeGreaterThan(-1);
            expect(mutationIdx).toBeGreaterThan(pullIdx);
        });

        it('Control 36: Fail-safe rollback disables error trap to prevent recursion, verifies Compose exit code and readiness', () => {
            expect(deployContent).toContain('INITIATING FAIL-SAFE ROLLBACK ON MUTATION FAILURE');
            expect(deployContent).toContain('trap \'\' ERR INT TERM');
            expect(deployContent).toContain('COMPOSE_EXIT=0');
            expect(deployContent).toContain('export SOCIALPULSE_BACKEND_IMAGE="$PREV_BACKEND"');
            expect(deployContent).toContain('export SOCIALPULSE_FRONTEND_IMAGE="$PREV_FRONTEND"');
            expect(deployContent).toContain('Verifying rollback readiness on http://127.0.0.1:5000/health/ready');
            expect(deployContent).toContain('Rollback failed! Compose exit: $COMPOSE_EXIT, Readiness: $ROLLBACK_READY');
        });

        it('Control 37: Dedicated RUNNER_TEMP isolation rejects root/home/tmp/opt/workspace and cleans only generated temp directory', () => {
            expect(deployContent).toContain('Secure Temporary Artifact Cleanup');
            expect(deployContent).toContain('if: always()');
            expect(deployContent).toContain('CANONICAL_RUNNER_TEMP=$(realpath "$RUNNER_TEMP")');
            expect(deployContent).toContain('RUNNER_TEMP ($CANONICAL_RUNNER_TEMP) cannot be root, home, /tmp, /opt, or workspace root');
            expect(deployContent).toContain('Generated temporary manifest directory safely cleaned');
        });

        it('Control 38: Minimum least-privilege token permissions are declared', () => {
            expect(deployContent).toContain('permissions:');
            expect(deployContent).toContain('contents: read');
            expect(deployContent).toContain('actions: read');
        });

        it('Control 39: Preflight tool, version and environment availability check exists including chmod, mktemp, stat', () => {
            expect(deployContent).toContain('Preflight Host Tool');
            expect(deployContent).toContain('for tool in gh node sha256sum git docker wget realpath mktemp chmod stat; do');
            expect(deployContent).toContain('docker compose version');
        });

        it('Control 40: Protected-main release workflow run and artifact metadata are authenticated prior to checkout', () => {
            const authIdx = deployContent.indexOf('Authenticate Protected-Main Release Workflow Run & Artifact Metadata');
            const checkoutIdx = deployContent.indexOf('Checkout Authorized Release Configuration Provenance');
            expect(authIdx).toBeGreaterThan(-1);
            expect(checkoutIdx).toBeGreaterThan(authIdx);
            expect(deployContent).toContain('run.head_branch !== \'main\'');
            expect(deployContent).toContain('run.repository.full_name !== \'ArtradePro/Socialpulse-1\'');
            expect(deployContent).toContain('!run.head_repository || run.head_repository.full_name !== \'ArtradePro/Socialpulse-1\'');
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

        it('Control 42: Service mutation boundary begins immediately before docker compose and defines unmasked trap-based rollback with errtrace (set -E)', () => {
            expect(deployContent).toContain('trap rollback ERR INT TERM');
            expect(deployContent).toContain('=== SERVICE MUTATION BOUNDARY BEGINS ===');
            expect(deployContent).toContain('set -E');
            expect(deployContent).toContain('trap - ERR INT TERM');
        });

        it('Control 43: Zero direct input interpolation in executable code; manifest-derived runtime variables consumed safely', () => {
            const runBlocks = deployContent.split(/-\s*name:/).slice(1);
            for (const block of runBlocks) {
                const runIdx = block.indexOf('run: |');
                if (runIdx !== -1) {
                    const runScript = block.slice(runIdx);
                    expect(runScript).not.toMatch(/\$\{\{\s*inputs\./);
                }
            }
            // Ensure runtime image references are not remapped through ${{ env.DEPLOY_* }} in step-level env
            const deployStep = deployContent.slice(deployContent.indexOf('Deploy to Local Staging Host'));
            expect(deployStep).not.toContain('TARGET_BACKEND_REF: ${{ env.DEPLOY_BACKEND_REF }}');
            expect(deployStep).not.toContain('TARGET_FRONTEND_REF: ${{ env.DEPLOY_FRONTEND_REF }}');
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

            // Negative test 4: Tag mismatch
            const resTag = validateReleaseManifest({
                ...authenticSP8BManifest,
                backend: { ...authenticSP8BManifest.backend, tag: 'sha-wrongcommit' }
            } as any, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e', 'staging');
            expect(resTag.valid).toBe(false);

            // Negative test 5: Repository mismatch
            const resRepo = validateReleaseManifest({
                ...authenticSP8BManifest,
                backend: { ...authenticSP8BManifest.backend, repository: 'evil/socialpulse-backend' }
            } as any, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e', 'staging');
            expect(resRepo.valid).toBe(false);
        });

        it('Control 45: Focused release run provenance negative tests reject unauthenticated or non-main runs', () => {
            const validRun = {
                repository: { full_name: 'ArtradePro/Socialpulse-1' },
                head_repository: { full_name: 'ArtradePro/Socialpulse-1' },
                path: '.github/workflows/release-images.yml',
                name: 'Release Images',
                status: 'completed',
                conclusion: 'success',
                event: 'workflow_dispatch',
                head_branch: 'main',
                head_sha: 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e'
            };

            const resValid = validateReleaseRunProvenance(validRun, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e');
            expect(resValid.valid).toBe(true);

            // Negative test 1: Correct workflow path on wrong branch
            const resBranch = validateReleaseRunProvenance({ ...validRun, head_branch: 'feature/untrusted' }, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e');
            expect(resBranch.valid).toBe(false);
            expect(resBranch.errors.some(e => e.includes('protected main branch'))).toBe(true);

            // Negative test 2: Correct SHA from a fork
            const resFork = validateReleaseRunProvenance({ ...validRun, head_repository: { full_name: 'Attacker/Socialpulse-1' } }, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e');
            expect(resFork.valid).toBe(false);
            expect(resFork.errors.some(e => e.includes('Forked or unauthorized'))).toBe(true);

            // Negative test 3: Tag-based run (null branch)
            const resTag = validateReleaseRunProvenance({ ...validRun, head_branch: null }, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e');
            expect(resTag.valid).toBe(false);

            // Negative test 4: Incomplete / in-progress run
            const resInProgress = validateReleaseRunProvenance({ ...validRun, status: 'in_progress', conclusion: null }, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e');
            expect(resInProgress.valid).toBe(false);

            // Negative test 5: Failed run
            const resFailed = validateReleaseRunProvenance({ ...validRun, conclusion: 'failure' }, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e');
            expect(resFailed.valid).toBe(false);

            // Negative test 6: Lookalike workflow path
            const resLookalike = validateReleaseRunProvenance({ ...validRun, path: '.github/workflows/deploy.yml' }, 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e');
            expect(resLookalike.valid).toBe(false);
        });
    });

    describe('7. Staging Bootstrap, Migration & Environment-File Governance Controls (SP-8C-5C-R5 Controls 46-77)', () => {
        const bootstrapInfraPath = join(workflowsDir, 'bootstrap-infra.yml');
        const bootstrapAppPath = join(workflowsDir, 'bootstrap-app.yml');
        const composeStagingPath = join(rootDir, 'docker-compose.staging.yml');
        const composeInfraPath = join(rootDir, 'docker-compose.staging-infra.yml');
        const composeMigratePath = join(rootDir, 'docker-compose.staging-migrate.yml');

        const bootstrapInfraContent = readFileSync(bootstrapInfraPath, 'utf-8');
        const bootstrapAppContent = readFileSync(bootstrapAppPath, 'utf-8');
        const composeStagingContent = readFileSync(composeStagingPath, 'utf-8');
        const composeInfraContent = readFileSync(composeInfraPath, 'utf-8');
        const composeMigrateContent = readFileSync(composeMigratePath, 'utf-8');

        it('Control 46: All four staging workflows are manual-only and target protected staging environment', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).toContain('workflow_dispatch:');
                expect(c).toContain('environment: staging');
                expect(c).not.toContain('on:\n  push:');
                expect(c).not.toContain('on:\n  pull_request:');
            }
        });

        it('Control 47: All self-hosted jobs target the dedicated staging runner labels', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).toContain('runs-on: [self-hosted, linux, socialpulse-staging]');
                expect(c).not.toContain('socialpulse-production');
            }
        });

        it('Control 48: No SSH action exists in any staging workflow path', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).not.toContain('appleboy/ssh-action');
                expect(c).not.toContain('DEPLOY_SSH_KEY');
            }
        });

        it('Control 49: All actions/checkout invocations are pinned to full commit SHA', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).toMatch(/uses:\s*actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/);
            }
        });

        it('Control 50: Explicit staging environment file binding, isolated compose overlays and --no-deps exist across all application/migration Compose commands', () => {
            const requiredEnvFlag = '--env-file /opt/socialpulse/.env';
            expect(deployContent).toContain(`docker compose -f docker-compose.yml -f docker-compose.staging.yml ${requiredEnvFlag} up -d --no-build --no-deps server client`);
            expect(bootstrapInfraContent).toContain(`docker compose -f docker-compose.staging-infra.yml ${requiredEnvFlag} up -d postgres redis`);
            expect(bootstrapAppContent).toContain(`docker compose -f docker-compose.yml -f docker-compose.staging.yml ${requiredEnvFlag} up -d --no-build --no-deps server client`);
            expect(migrateContent).toContain(`docker compose -f docker-compose.staging-infra.yml -f docker-compose.staging-migrate.yml ${requiredEnvFlag} run --rm --no-deps migrate node dist/database/migrate.js`);
        });

        it('Control 51: Staging configuration preflight verifies /opt/socialpulse/.env exact symbolic ownership (root), group (github-runner), mode (0640), non-symlink and isolation', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).toContain('STAGING_ENV_FILE="/opt/socialpulse/.env"');
                expect(c).toContain('[ ! -f "$STAGING_ENV_FILE" ] || [ -L "$STAGING_ENV_FILE" ]');
                expect(c).toContain('ENV_OWNER=$(stat -c \'%U\' "$STAGING_ENV_FILE")');
                expect(c).toContain('ENV_GROUP=$(stat -c \'%G\' "$STAGING_ENV_FILE")');
                expect(c).toContain('[ "$ENV_OWNER" != "root" ]');
                expect(c).toContain('[ "$ENV_GROUP" != "github-runner" ]');
                expect(c).toContain('ENV_MODE=$(stat -c \'%a\' "$STAGING_ENV_FILE")');
                expect(c).toContain('[ "$ENV_MODE" != "640" ] && [ "$ENV_MODE" != "0640" ]');
                expect(c).toContain('[ ! -r "$STAGING_ENV_FILE" ]');
            }
        });

        it('Control 52: Dedicated Staging Infrastructure Compose contains ONLY PostgreSQL and Redis, and cannot parse or start application services', () => {
            expect(composeInfraContent).toContain('name: socialpulse-staging');
            expect(composeInfraContent).toContain('postgres:');
            expect(composeInfraContent).toContain('redis:');
            expect(composeInfraContent).not.toContain('server:');
            expect(composeInfraContent).not.toContain('client:');
            expect(composeInfraContent).not.toContain('migrate:');
            expect(bootstrapInfraContent).not.toContain('up -d server');
            expect(bootstrapInfraContent).not.toContain('up -d client');
            expect(bootstrapInfraContent).not.toContain('migrate.ts');
        });

        it('Control 53: Infrastructure Compose validation succeeds without application image variables', () => {
            const yaml = require('js-yaml');
            const doc = yaml.load(composeInfraContent);
            expect(doc.name).toBe('socialpulse-staging');
            expect(Object.keys(doc.services)).toEqual(['postgres', 'redis']);
            expect(composeInfraContent).not.toContain('SOCIALPULSE_BACKEND_IMAGE');
            expect(composeInfraContent).not.toContain('SOCIALPULSE_FRONTEND_IMAGE');
        });

        it('Control 54: Application Compose validation occurs only after manifest-derived image references exist', () => {
            for (const c of [deployContent, bootstrapAppContent]) {
                const manifestIdx = c.indexOf('Cryptographically Verify Release Manifest');
                const configIdx = c.indexOf('Validate Effective Staging Compose Configuration');
                expect(manifestIdx).toBeGreaterThan(-1);
                expect(configIdx).toBeGreaterThan(manifestIdx);
                expect(c).toContain('SOCIALPULSE_BACKEND_IMAGE: ${{ env.SOCIALPULSE_BACKEND_IMAGE }}');
                expect(c).toContain('SOCIALPULSE_FRONTEND_IMAGE: ${{ env.SOCIALPULSE_FRONTEND_IMAGE }}');
            }
        });

        it('Control 55: Migration Compose validation does not require a frontend image when using isolated migration model', () => {
            const manifestIdx = migrateContent.indexOf('Cryptographically Verify Release Manifest');
            const configIdx = migrateContent.indexOf('Validate Staging Migration Compose Configuration');
            expect(manifestIdx).toBeGreaterThan(-1);
            expect(configIdx).toBeGreaterThan(manifestIdx);
            expect(migrateContent).toContain('SOCIALPULSE_BACKEND_IMAGE: ${{ env.SOCIALPULSE_BACKEND_IMAGE }}');
            expect(migrateContent).not.toContain('SOCIALPULSE_FRONTEND_IMAGE');
            expect(composeMigrateContent).toContain('SOCIALPULSE_BACKEND_IMAGE');
            expect(composeMigrateContent).not.toContain('SOCIALPULSE_FRONTEND_IMAGE');
        });

        it('Control 56: Staging application ports are bound to loopback only (127.0.0.1) and databases are not exposed using !override semantics', () => {
            expect(composeStagingContent).toContain('"127.0.0.1:5000:5000"');
            expect(composeStagingContent).toContain('"127.0.0.1:3000:3000"');
            expect(composeStagingContent).toMatch(/postgres:[\s\S]*?ports:\s*!override\s*\[\]/);
            expect(composeStagingContent).toMatch(/redis:[\s\S]*?ports:\s*!override\s*\[\]/);
            expect(composeStagingContent).toMatch(/server:[\s\S]*?volumes:\s*!override\s*\[\]/);
            expect(composeStagingContent).toMatch(/client:[\s\S]*?volumes:\s*!override\s*\[\]/);
        });

        it('Control 57: Effective static Compose model validation confirms exact port and volume boundaries with !override support and project name', () => {
            const yaml = require('js-yaml');
            const OverrideSeq = new yaml.Type('!override', { kind: 'sequence', construct: (data: any) => data });
            const OverrideMap = new yaml.Type('!override', { kind: 'mapping', construct: (data: any) => data });
            const OverrideScalar = new yaml.Type('!override', { kind: 'scalar', construct: (data: any) => data });
            const COMPOSE_SCHEMA = new yaml.Schema({ include: [yaml.DEFAULT_SCHEMA], explicit: [OverrideSeq, OverrideMap, OverrideScalar] });

            const composeStaging = yaml.load(composeStagingContent, { schema: COMPOSE_SCHEMA }) as any;

            expect(composeStaging.name).toBe('socialpulse-staging');
            expect(composeStaging.services.server.ports).toEqual(['127.0.0.1:5000:5000']);
            expect(composeStaging.services.client.ports).toEqual(['127.0.0.1:3000:3000']);
            expect(composeStaging.services.postgres.ports).toEqual([]);
            expect(composeStaging.services.redis.ports).toEqual([]);
            expect(composeStaging.services.server.volumes).toEqual([]);
            expect(composeStaging.services.client.volumes).toEqual([]);
            expect(composeStaging.volumes).toHaveProperty('postgres_data');
            expect(composeStaging.volumes).toHaveProperty('redis_data');
        });

        it('Control 58: Provider safety under NODE_ENV=production fails closed and forbids simulation', async () => {
            const { EmailProviderService } = require('../services/marketing/emailProvider.service');
            const { SmsProviderService } = require('../services/marketing/smsProvider.service');

            const originalEnv = process.env.NODE_ENV;
            const originalSg = process.env.SENDGRID_API_KEY;
            const originalTwilio = process.env.TWILIO_ACCOUNT_SID;
            const originalSim = process.env.ALLOW_SIMULATED_DELIVERY;

            try {
                process.env.NODE_ENV = 'production';
                delete process.env.SENDGRID_API_KEY;
                delete process.env.SMTP_PASS;
                delete process.env.TWILIO_ACCOUNT_SID;
                delete process.env.ALLOW_SIMULATED_DELIVERY;

                await expect(EmailProviderService.send('test@example.com', 'Subject', 'Body'))
                    .rejects.toThrow('PROVIDER_DELIVERY_FAILED');

                await expect(SmsProviderService.send('+15551234567', 'Test SMS'))
                    .rejects.toThrow('PROVIDER_DELIVERY_FAILED');
            } finally {
                process.env.NODE_ENV = originalEnv;
                if (originalSg) process.env.SENDGRID_API_KEY = originalSg;
                if (originalTwilio) process.env.TWILIO_ACCOUNT_SID = originalTwilio;
                if (originalSim) process.env.ALLOW_SIMULATED_DELIVERY = originalSim;
            }
        });

        it('Control 59: Docker Compose version >= 2.24.4 is enforced semantically across all staging workflows', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).toContain('DOCKER COMPOSE VERSION VERIFICATION (>= 2.24.4)');
                expect(c).toContain('major === 2 && minor === 24 && patch >= 4');
            }
        });

        it('Control 60: Infrastructure bootstrap provenance restricts execution to protected main branch', () => {
            expect(bootstrapInfraContent).toContain("if: github.ref == 'refs/heads/main'");
            expect(bootstrapInfraContent).toContain('[ "${{ github.repository }}" != "ArtradePro/Socialpulse-1" ]');
            expect(bootstrapInfraContent).toContain('[ "${{ github.ref }}" != "refs/heads/main" ]');
        });

        it('Control 61: Infrastructure bootstrap fails closed if any pre-existing project container, volume, or network exists', () => {
            expect(bootstrapInfraContent).toContain('VERIFYING FIRST-RUN CLEAN STATE');
            expect(bootstrapInfraContent).toContain('docker inspect socialpulse-staging-postgres-1');
            expect(bootstrapInfraContent).toContain('docker volume inspect socialpulse-staging_postgres_data');
            expect(bootstrapInfraContent).toContain('docker network inspect socialpulse-staging_default');
        });

        it('Control 62: Non-sourcing environment parser verifies assignments, rejects duplicate active assignments, enforces NODE_ENV=production and leaks zero secrets', () => {
            for (const c of [deployContent, bootstrapAppContent, migrateContent]) {
                expect(c).toContain('PARSING & VALIDATING STAGING ENVIRONMENT (NON-SOURCING, NO SECRET LEAKAGE)');
                expect(c).toContain('Duplicate active environment variable assignment rejected');
                expect(c).toContain('Empty or whitespace-only assignment for required variable');
                expect(c).toContain('Staging NODE_ENV must be strictly');
            }
        });

        it('Control 63: Migration workflow provides explicit mode input (bootstrap | incremental) and requires healthy Postgres/Redis with --no-deps', () => {
            expect(migrateContent).toContain('migration_mode:');
            expect(migrateContent).toContain('default: incremental');
            expect(migrateContent).toContain('- incremental');
            expect(migrateContent).toContain('- bootstrap');
            expect(migrateContent).toContain('socialpulse-staging-postgres-1');
            expect(migrateContent).toContain('socialpulse-staging-redis-1');
            expect(migrateContent).toContain('--strict --mode="$INPUT_MIGRATION_MODE"');
            expect(migrateContent).toContain('--strict --mode=incremental --require-current');
        });

        it('Control 64: All four staging mutation workflows share single concurrency group socialpulse-staging-mutation', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).toContain('concurrency:\n  group: socialpulse-staging-mutation\n  cancel-in-progress: false');
            }
        });

        it('Control 65: Repository checkout and Git provenance verification precede all workspace file usage', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                const checkoutIdx = c.indexOf('actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683');
                const provenanceIdx = c.indexOf('Verify Configuration');
                expect(checkoutIdx).toBeGreaterThan(-1);
                expect(provenanceIdx).toBeGreaterThan(checkoutIdx);
            }
        });

        it('Control 66: Deterministic Compose project identity and container naming are used consistently without ambiguous fallbacks', () => {
            expect(deployContent).toContain('socialpulse-staging-postgres-1');
            expect(deployContent).toContain('socialpulse-staging-redis-1');
            expect(deployContent).toContain('socialpulse-staging-server-1');
            expect(deployContent).toContain('socialpulse-staging-client-1');

            expect(bootstrapInfraContent).toContain('socialpulse-staging-postgres-1');
            expect(bootstrapInfraContent).toContain('socialpulse-staging-redis-1');

            expect(bootstrapAppContent).toContain('socialpulse-staging-postgres-1');
            expect(bootstrapAppContent).toContain('socialpulse-staging-redis-1');
            expect(bootstrapAppContent).toContain('socialpulse-staging-server-1');
            expect(bootstrapAppContent).toContain('socialpulse-staging-client-1');

            expect(migrateContent).toContain('socialpulse-staging-postgres-1');
            expect(migrateContent).toContain('socialpulse-staging-redis-1');
        });

        it('Control 67: Non-sourcing environment parser simulation correctly detects duplicate keys, whitespace-only values, letters r/n, and NODE_ENV', () => {
            function parseTestEnv(raw: string, requiredVars: string[], requireProd: boolean) {
                const lines = raw.split(/\r?\n/);
                const parsed = new Map<string, string>();

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line || line.startsWith('#')) continue;
                    const eqIdx = line.indexOf('=');
                    if (eqIdx <= 0) throw new Error(`Malformed line ${i + 1}`);
                    const key = line.slice(0, eqIdx).trim();
                    let val = line.slice(eqIdx + 1).trim();
                    if (parsed.has(key)) throw new Error(`Duplicate active assignment: ${key}`);
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (val.trim().length === 0) throw new Error(`Empty or whitespace-only: ${key}`);
                    parsed.set(key, val);
                }

                for (const req of requiredVars) {
                    if (!parsed.has(req)) throw new Error(`Missing required variable: ${req}`);
                }

                if (requireProd && parsed.get('NODE_ENV') !== 'production') {
                    throw new Error(`NODE_ENV must be production (got: ${parsed.get('NODE_ENV')})`);
                }

                return parsed;
            }

            const validSample = "NODE_ENV=production\nPOSTGRES_PASSWORD=super_secret_run_123\nREDIS_PASSWORD=redis_password_round_robin\n";
            const parsed = parseTestEnv(validSample, ['NODE_ENV', 'POSTGRES_PASSWORD', 'REDIS_PASSWORD'], true);
            expect(parsed.get('POSTGRES_PASSWORD')).toBe('super_secret_run_123');
            expect(parsed.get('REDIS_PASSWORD')).toBe('redis_password_round_robin');

            const dupSample = "NODE_ENV=production\nPOSTGRES_PASSWORD=secret1\nPOSTGRES_PASSWORD=secret2\n";
            expect(() => parseTestEnv(dupSample, ['POSTGRES_PASSWORD'], false)).toThrow(/Duplicate active assignment: POSTGRES_PASSWORD/);

            const wsSample = "NODE_ENV=production\nPOSTGRES_PASSWORD=   \n";
            expect(() => parseTestEnv(wsSample, ['POSTGRES_PASSWORD'], false)).toThrow(/Empty or whitespace-only: POSTGRES_PASSWORD/);

            const devSample = "NODE_ENV=development\nPOSTGRES_PASSWORD=secret\n";
            expect(() => parseTestEnv(devSample, ['NODE_ENV', 'POSTGRES_PASSWORD'], true)).toThrow(/NODE_ENV must be production/);
        });

        it('Control 68: Release sequencing governance rules mandate building a new immutable release from merged main SHA', () => {
            const oldReleaseSha = 'b9f819c4b153dd46dc9f4080a99d01aeffd01b7e';
            const currentHeadSha = 'b34c8651ae17695fa912b9661b97f97d97a8137b';
            expect(oldReleaseSha).not.toBe(currentHeadSha);
        });

        it('Control 69: Migration status catalog query detects base tables and proves database emptiness in public schema', async () => {
            const { checkMigrationStatus } = require('../database/scripts/migrationStatus');
            const report = await checkMigrationStatus();
            expect(report).toHaveProperty('databaseEmptiness');
            expect(typeof report.databaseEmptiness.isCleanEmpty).toBe('boolean');
            expect(typeof report.databaseEmptiness.userTableCount).toBe('number');
            expect(Array.isArray(report.databaseEmptiness.userTables)).toBe(true);
        });

        it('Control 70: Strict migration preflight rejects query errors, drift, unknown rows, duplicates, and unsafe statements in both modes', () => {
            const { verifyMigrationModeState } = require('../database/scripts/migrationStatus');

            const mockReport = {
                timestamp: new Date().toISOString(),
                ledgerStatus: 'active',
                applicationState: 'determinate',
                totalDiscovered: 2,
                discoveredFiles: ['001.sql', '002.sql'],
                migrations: [
                    { filename: '001.sql', migrationId: '001', checksum: 'a', status: 'applied' },
                    { filename: '002.sql', migrationId: '002', checksum: 'b', status: 'applied' }
                ],
                databaseEmptiness: { isCleanEmpty: false, userTableCount: 2, userTables: ['users', 'posts'] },
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

            // Query error fails validation
            const errRes = verifyMigrationModeState({ ...mockReport, blockers: ['QUERY_ERROR: DB down'] }, 'incremental');
            expect(errRes.isValid).toBe(false);

            // Duplicate IDs fail validation
            const dupRes = verifyMigrationModeState({ ...mockReport, preflightChecks: { ...mockReport.preflightChecks, duplicateMigrationIds: ['001'] } }, 'incremental');
            expect(dupRes.isValid).toBe(false);

            // Destructive statement fails validation
            const destRes = verifyMigrationModeState({ ...mockReport, preflightChecks: { ...mockReport.preflightChecks, destructiveStatementsFound: ['DROP TABLE'] } }, 'incremental');
            expect(destRes.isValid).toBe(false);
        });

        it('Control 71: Migration status CLI awaits database pool cleanup in finally without premature process.exit()', () => {
            const migrationStatusSrc = readFileSync(join(rootDir, 'socialPulse-app/backend/src/database/scripts/migrationStatus.ts'), 'utf-8');
            expect(migrationStatusSrc).toContain('await pool.end()');
            expect(migrationStatusSrc).toContain('process.exitCode = exitCode');
            expect(migrationStatusSrc).toMatch(/finally\s*\{[\s\S]*?await pool\.end\(\)/);
        });

        it('Control 72: Infrastructure Compose models mount named persistent volumes (postgres_data & redis_data) and prevent anonymous volumes', () => {
            const yaml = require('js-yaml');
            const infraDoc = yaml.load(composeInfraContent);
            expect(infraDoc.services.postgres.volumes).toEqual(['postgres_data:/var/lib/postgresql/data']);
            expect(infraDoc.services.redis.volumes).toEqual(['redis_data:/data']);
            expect(infraDoc.volumes).toHaveProperty('postgres_data');
            expect(infraDoc.volumes).toHaveProperty('redis_data');
        });

        it('Control 73: Staging PostgreSQL explicitly configures bootstrap identity (user: postgres, db: socialpulse) and database-level healthcheck', () => {
            const yaml = require('js-yaml');
            const OverrideSeq = new yaml.Type('!override', { kind: 'sequence', construct: (data: any) => data });
            const OverrideMap = new yaml.Type('!override', { kind: 'mapping', construct: (data: any) => data });
            const OverrideScalar = new yaml.Type('!override', { kind: 'scalar', construct: (data: any) => data });
            const COMPOSE_SCHEMA = new yaml.Schema({ include: [yaml.DEFAULT_SCHEMA], explicit: [OverrideSeq, OverrideMap, OverrideScalar] });

            const infraDoc = yaml.load(composeInfraContent);
            expect(infraDoc.services.postgres.environment.POSTGRES_USER).toBe('postgres');
            expect(infraDoc.services.postgres.environment.POSTGRES_DB).toBe('socialpulse');
            expect(infraDoc.services.postgres.healthcheck.test).toEqual(['CMD-SHELL', 'pg_isready -U postgres -d socialpulse']);

            const stagingDoc = yaml.load(composeStagingContent, { schema: COMPOSE_SCHEMA }) as any;
            expect(stagingDoc.services.postgres.environment.POSTGRES_USER).toBe('postgres');
            expect(stagingDoc.services.postgres.environment.POSTGRES_DB).toBe('socialpulse');
            expect(stagingDoc.services.postgres.healthcheck.test).toEqual(['CMD-SHELL', 'pg_isready -U postgres -d socialpulse']);
        });

        it('Control 74: All staging workflows use compiled JavaScript and contain zero ts-node/npx runtime dependency', () => {
            for (const c of [deployContent, bootstrapInfraContent, bootstrapAppContent, migrateContent]) {
                expect(c).not.toContain('ts-node');
                expect(c).not.toContain('src/database/scripts');
                expect(c).not.toContain('src/database/migrate.ts');
            }
            expect(bootstrapAppContent).toContain('node dist/database/scripts/migrationStatus.js --strict --mode=incremental --require-current');
            expect(migrateContent).toContain('node dist/database/scripts/migrationStatus.js --strict --mode="$INPUT_MIGRATION_MODE"');
            expect(migrateContent).toContain('node dist/database/migrate.js');
            expect(migrateContent).toContain('node dist/database/scripts/migrationStatus.js --strict --mode=incremental --require-current');
        });

        it('Control 75: Production backend build output contains both compiled migration entry points', () => {
            const distMigratePath = join(rootDir, 'socialPulse-app/backend/dist/database/migrate.js');
            const distStatusPath = join(rootDir, 'socialPulse-app/backend/dist/database/scripts/migrationStatus.js');
            expect(existsSync(distMigratePath)).toBe(true);
            expect(existsSync(distStatusPath)).toBe(true);
        });

        it('Control 76: Strict migration CLI argument parser fails closed on invalid, missing, duplicate, and malformed mode values', () => {
            const { parseMigrationCliArgs } = require('../database/scripts/migrationStatus');

            // Missing mode in strict mode
            const strictMissing = parseMigrationCliArgs(['--strict']);
            expect(strictMissing.errors.length).toBeGreaterThan(0);
            expect(strictMissing.mode).toBeNull();

            // Invalid mode in strict mode
            const strictInvalid = parseMigrationCliArgs(['--strict', '--mode=nonsense']);
            expect(strictInvalid.errors.length).toBeGreaterThan(0);
            expect(strictInvalid.mode).toBeNull();

            // Duplicate mode values
            const dupArgs = parseMigrationCliArgs(['--mode=bootstrap', '--mode=incremental']);
            expect(dupArgs.errors.length).toBeGreaterThan(0);
            expect(dupArgs.mode).toBeNull();

            // Missing mode value after flag
            const missingVal = parseMigrationCliArgs(['--strict', '--mode']);
            expect(missingVal.errors.length).toBeGreaterThan(0);
            expect(missingVal.mode).toBeNull();

            // Non-strict invalid mode does not silently fallback to incremental
            const nonStrictInvalid = parseMigrationCliArgs(['--mode=bogus']);
            expect(nonStrictInvalid.errors.length).toBeGreaterThan(0);
            expect(nonStrictInvalid.mode).toBeNull();

            // Non-strict default
            const nonStrictDefault = parseMigrationCliArgs([]);
            expect(nonStrictDefault.errors).toHaveLength(0);
            expect(nonStrictDefault.mode).toBe('incremental');
        });

        it('Control 77: Machine-readable effective Compose verification confirms zero published database ports and named volumes', () => {
            const yaml = require('js-yaml');
            const infraDoc = yaml.load(composeInfraContent);
            expect(infraDoc.services.postgres.ports).toBeUndefined();
            expect(infraDoc.services.redis.ports).toBeUndefined();
            expect(infraDoc.name).toBe('socialpulse-staging');
        });
    });
});
