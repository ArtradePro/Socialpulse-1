import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('CI/CD Governance, Workflow Separation & Immutable Artifact Verification (Phase SP-7C-R1)', () => {
    const rootDir = join(__dirname, '../../../../');
    const workflowsDir = join(rootDir, '.github/workflows');

    const ciYmlPath = join(workflowsDir, 'ci.yml');
    const releaseYmlPath = join(workflowsDir, 'release-images.yml');
    const deployYmlPath = join(workflowsDir, 'deploy.yml');
    const migrateYmlPath = join(workflowsDir, 'migrate.yml');
    const composeProdPath = join(rootDir, 'docker-compose.prod.yml');

    describe('1. Continuous Integration (ci.yml) Safeguards', () => {
        it('Rule 1: ci.yml must exist and contain automated test and typecheck jobs', () => {
            expect(existsSync(ciYmlPath)).toBe(true);
            const content = readFileSync(ciYmlPath, 'utf-8');
            expect(content).toContain('Backend — typecheck & test');
            expect(content).toContain('Frontend — typecheck & build');
            expect(content).toContain('Mobile — typecheck');
        });

        it('Rule 2: ci.yml must NOT contain deploy jobs or SSH actions', () => {
            const content = readFileSync(ciYmlPath, 'utf-8');
            expect(content).not.toContain('appleboy/ssh-action');
            expect(content).not.toContain('Deploy — build & push to VPS');
            expect(content).not.toContain('deploy:');
        });

        it('Rule 3: ci.yml must NOT log in to Docker Hub or push release images', () => {
            const content = readFileSync(ciYmlPath, 'utf-8');
            expect(content).not.toContain('docker/login-action');
            expect(content).not.toContain('docker/build-push-action');
            expect(content).not.toContain('push: true');
        });

        it('Rule 4: ci.yml must NOT execute migrations against remote hosts', () => {
            const content = readFileSync(ciYmlPath, 'utf-8');
            expect(content).not.toContain('run --rm migrate');
        });
    });

    describe('2. Release Images Workflow (release-images.yml) Safeguards', () => {
        it('Rule 5: release-images.yml must be manual-only via workflow_dispatch', () => {
            expect(existsSync(releaseYmlPath)).toBe(true);
            const content = readFileSync(releaseYmlPath, 'utf-8');
            expect(content).toContain('workflow_dispatch:');
            expect(content).not.toContain('push:\n    branches: [main]');
        });

        it('Rule 6: release-images.yml must require commit_sha and tag immutably with sha-', () => {
            const content = readFileSync(releaseYmlPath, 'utf-8');
            expect(content).toContain('commit_sha:');
            expect(content).toContain('sha-${{ inputs.commit_sha }}');
            expect(content).toContain('release-manifest.json');
        });
    });

    describe('3. Deployment Workflow (deploy.yml) Safeguards', () => {
        it('Rule 7: deploy.yml must be manual-only and target protected environments', () => {
            expect(existsSync(deployYmlPath)).toBe(true);
            const content = readFileSync(deployYmlPath, 'utf-8');
            expect(content).toContain('workflow_dispatch:');
            expect(content).toContain('environment: ${{ inputs.environment }}');
        });

        it('Rule 8: deploy.yml must reject :latest and enforce immutable image tags', () => {
            const content = readFileSync(deployYmlPath, 'utf-8');
            expect(content).toContain(':latest$');
            expect(content).toContain('Use of \':latest\' tag is strictly prohibited');
            expect(content).toContain('concurrency:');
            expect(content).toContain('group: deployment-${{ inputs.environment }}');
        });
    });

    describe('4. Migration Workflow (migrate.yml) Safeguards', () => {
        it('Rule 9: migrate.yml must be independent, manual-only, and require double confirmation', () => {
            expect(existsSync(migrateYmlPath)).toBe(true);
            const content = readFileSync(migrateYmlPath, 'utf-8');
            expect(content).toContain('workflow_dispatch:');
            expect(content).toContain('confirm_execution:');
            expect(content).toContain('backup_confirmed:');
            expect(content).toContain('migrationStatus.ts');
            expect(content).toContain('migrate.ts');
        });
    });

    describe('5. Production Compose (docker-compose.prod.yml) Safeguards', () => {
        it('Rule 10: docker-compose.prod.yml must have NO local build contexts', () => {
            expect(existsSync(composeProdPath)).toBe(true);
            const content = readFileSync(composeProdPath, 'utf-8');
            expect(content).not.toContain('build:\n      context: ./socialPulse-app/backend');
            expect(content).not.toContain('build:\n      context: ./socialPulse-app/frontend');
        });

        it('Rule 11: docker-compose.prod.yml must enforce required image variables', () => {
            const content = readFileSync(composeProdPath, 'utf-8');
            expect(content).toContain('image: ${SOCIALPULSE_BACKEND_IMAGE:?');
            expect(content).toContain('image: ${SOCIALPULSE_FRONTEND_IMAGE:?');
        });
    });
});
