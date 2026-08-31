import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool } from './helpers/db';
import { request, registerAndLogin, bearer } from './helpers/request';
import { ClaimsGuardService } from '../services/marketing/claimsGuard.service';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Claims Library & Brand Governance (Phase SP-3 / Pillar 3)', () => {
    let dbClient: PoolClient;
    let token: string;
    let fnmWorkspaceId: string;
    let higieneCorpWorkspaceId: string;

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const pool = getTestPool();
        dbClient = await pool.connect();

        // Register user
        const reg = await registerAndLogin({ email: `brand_admin_${Date.now()}@example.com` });
        token = reg.token;

        // Create Fungus No More™ workspace
        const ws1 = await dbClient.query(
            `INSERT INTO workspaces (name, brand_type, owner_id) VALUES ($1, $2, $3) RETURNING id`,
            ['Fungus No More Flagship', 'FUNGUS_NO_MORE', reg.userId]
        );
        fnmWorkspaceId = ws1.rows[0].id;
        await dbClient.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)', [fnmWorkspaceId, reg.userId, 'owner']);

        // Create Higiene Corporate workspace
        const ws2 = await dbClient.query(
            `INSERT INTO workspaces (name, brand_type, owner_id) VALUES ($1, $2, $3) RETURNING id`,
            ['Higiene Corporate B2B', 'HIGIENE_CORP', reg.userId]
        );
        higieneCorpWorkspaceId = ws2.rows[0].id;
        await dbClient.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)', [higieneCorpWorkspaceId, reg.userId, 'owner']);
    });

    afterAll(async () => {
        if (dbClient) {
            dbClient.release();
        }
        await closeTestPool();
    });

    describe('Slogan Exclusivity Rules ("Love The Skin You\'re In.")', () => {
        it('permits "Love The Skin You\'re In." exclusively for Fungus No More™ workspace', async () => {
            const content = 'Rediscover healthy confidence. Love The Skin You\'re In. with Fungus No More™!';
            const check = await ClaimsGuardService.validateSloganExclusivity(fnmWorkspaceId, content);

            expect(check.valid).toBe(true);
            expect(check.violations).toHaveLength(0);
        });

        it('strictly rejects "Love The Skin You\'re In." for Higiene Corporate workspace', async () => {
            const content = 'Higiene Commercial Cleaning: Love The Skin You\'re In.';
            const check = await ClaimsGuardService.validateSloganExclusivity(higieneCorpWorkspaceId, content);

            expect(check.valid).toBe(false);
            expect(check.violations.length).toBeGreaterThan(0);
            expect(check.violations[0]).toContain('exclusively to Fungus No More™');
        });

        it('catches case-insensitive and varied apostrophe variations of the slogan for non-FNM workspaces', async () => {
            const content = 'We believe you should LOVE THE SKIN YOU’RE IN every single day.';
            const check = await ClaimsGuardService.validateSloganExclusivity(higieneCorpWorkspaceId, content);

            expect(check.valid).toBe(false);
            expect(check.violations[0]).toContain('exclusively to Fungus No More™');
        });
    });

    describe('Claims Library Management Endpoints', () => {
        let claimId: string;

        it('creates an approved claim in claims_library', async () => {
            const res = await request
                .post('/api/claims')
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId)
                .send({
                    claim_text: 'Soothes cracked, dry skin on heels within 7 days',
                    claim_category: 'COSMETIC',
                    disclaimer_required: true,
                    disclaimer_text: 'Individual results may vary.'
                });

            expect(res.status).toBe(201);
            expect(res.body.claim_text).toBe('Soothes cracked, dry skin on heels within 7 days');
            expect(res.body.disclaimer_required).toBe(true);
            claimId = res.body.id;
        });

        it('lists approved claims for the active workspace', async () => {
            const res = await request
                .get('/api/claims')
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.some((c: any) => c.id === claimId)).toBe(true);
        });

        it('validates content and attaches mandatory disclaimers when claims match', async () => {
            const res = await request
                .post('/api/claims/validate')
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId)
                .send({
                    content: 'Try our advanced formula that soothes cracked, dry skin on heels!'
                });

            expect(res.status).toBe(200);
            expect(res.body.valid).toBe(true);
            expect(res.body.requiresDisclaimer).toBe(true);
            expect(res.body.disclaimers).toContain('Individual results may vary.');
        });

        it('rejects prohibited medical cure guarantees', async () => {
            const res = await request
                .post('/api/claims/validate')
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId)
                .send({
                    content: 'This product is a 100% guaranteed cure for all skin fungal infections.'
                });

            expect(res.status).toBe(200);
            expect(res.body.valid).toBe(false);
            expect(res.body.violations[0]).toContain('Unverified medical cure claims');
        });

        it('deletes a claim from the library', async () => {
            const res = await request
                .delete(`/api/claims/${claimId}`)
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
