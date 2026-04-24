import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../../.env') });

import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool, cleanDb } from './helpers/db';
import { request, registerAndLogin, bearer } from './helpers/request';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Workspaces endpoints', () => {
    let dbClient: PoolClient;
    let token: string;

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const pool = getTestPool();
        dbClient = await pool.connect();
    });

    beforeEach(async () => {
        await cleanDb(dbClient);
        ({ token } = await registerAndLogin({ email: 'wsuser@example.com' }));
    });

    afterAll(async () => {
        dbClient.release();
        await closeTestPool();
    });

    describe('POST /api/workspaces', () => {
        it('creates a workspace and auto-adds caller as owner', async () => {
            const res = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'My Agency' });

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ name: 'My Agency' });
            expect(res.body).toHaveProperty('id');
        });

        it('returns 400 for missing name', async () => {
            const res = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({});

            expect(res.status).toBe(400);
        });

        it('returns 401 without authentication', async () => {
            const res = await request
                .post('/api/workspaces')
                .send({ name: 'Anon Workspace' });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/workspaces', () => {
        it('returns workspaces the user belongs to', async () => {
            await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'WS One' });

            await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'WS Two' });

            const res = await request
                .get('/api/workspaces')
                .set(bearer(token));

            expect(res.status).toBe(200);
            const workspaces: { name: string }[] = Array.isArray(res.body) ? res.body : res.body.data;
            expect(workspaces.length).toBeGreaterThanOrEqual(2);
            const names = workspaces.map((w) => w.name);
            expect(names).toContain('WS One');
            expect(names).toContain('WS Two');
        });

        it('does not return workspaces from another user', async () => {
            const { token: otherToken } = await registerAndLogin({ email: 'otherws@example.com' });
            await request
                .post('/api/workspaces')
                .set(bearer(otherToken))
                .send({ name: 'Other WS' });

            const res = await request
                .get('/api/workspaces')
                .set(bearer(token));

            const workspaces: { name: string }[] = Array.isArray(res.body) ? res.body : res.body.data;
            expect(workspaces.some((w) => w.name === 'Other WS')).toBe(false);
        });
    });

    describe('GET /api/workspaces/:id', () => {
        it('returns workspace with members list', async () => {
            const createRes = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'Detail WS' });

            const id = createRes.body.id as string;

            const res = await request
                .get(`/api/workspaces/${id}`)
                .set({ ...bearer(token), 'X-Workspace-Id': id });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Detail WS');
            expect(Array.isArray(res.body.members)).toBe(true);
            expect(res.body.members.length).toBeGreaterThanOrEqual(1);
            expect(res.body.members[0].role).toBe('owner');
        });
    });

    describe('PATCH /api/workspaces/:id/branding', () => {
        it('saves branding fields', async () => {
            const createRes = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'Brand WS' });

            const id = createRes.body.id as string;

            const res = await request
                .patch(`/api/workspaces/${id}/branding`)
                .set({ ...bearer(token), 'X-Workspace-Id': id })
                .send({ brandName: 'Acme Corp', brandColor: '#FF5733' });

            expect(res.status).toBe(200);
            expect(res.body.brand_name).toBe('Acme Corp');
            expect(res.body.brand_color).toBe('#FF5733');
        });

        it('returns 409 on duplicate custom domain', async () => {
            const { token: t2 } = await registerAndLogin({ email: 'brand2@example.com' });

            const ws1 = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'WS1' });

            const ws2 = await request
                .post('/api/workspaces')
                .set(bearer(t2))
                .send({ name: 'WS2' });

            const id1 = ws1.body.id as string;
            const id2 = ws2.body.id as string;

            await request
                .patch(`/api/workspaces/${id1}/branding`)
                .set({ ...bearer(token), 'X-Workspace-Id': id1 })
                .send({ customDomain: 'acme.com' });

            const res = await request
                .patch(`/api/workspaces/${id2}/branding`)
                .set({ ...bearer(t2), 'X-Workspace-Id': id2 })
                .send({ customDomain: 'acme.com' });

            expect(res.status).toBe(409);
        });
    });

    describe('DELETE /api/workspaces/:id', () => {
        it('owner can delete workspace', async () => {
            const createRes = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'Delete Me' });

            const id = createRes.body.id as string;

            const res = await request
                .delete(`/api/workspaces/${id}`)
                .set({ ...bearer(token), 'X-Workspace-Id': id });

            expect(res.status).toBe(200);
        });

        it('non-member cannot delete workspace', async () => {
            const createRes = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'Protected WS' });

            const id = createRes.body.id as string;

            const { token: intruderToken } = await registerAndLogin({ email: 'intruder@example.com' });

            const res = await request
                .delete(`/api/workspaces/${id}`)
                .set({ Authorization: `Bearer ${intruderToken}`, 'X-Workspace-Id': id });

            expect([403, 404]).toContain(res.status);
        });
    });

    describe('GET /api/workspaces/brand/:domain', () => {
        it('returns branding for a known custom domain', async () => {
            const createRes = await request
                .post('/api/workspaces')
                .set(bearer(token))
                .send({ name: 'Public Brand WS' });

            const id = createRes.body.id as string;

            await request
                .patch(`/api/workspaces/${id}/branding`)
                .set({ ...bearer(token), 'X-Workspace-Id': id })
                .send({ brandName: 'MyBrand', customDomain: 'mybrand.io' });

            const res = await request.get('/api/workspaces/brand/mybrand.io');

            expect(res.status).toBe(200);
            expect(res.body.brand_name).toBe('MyBrand');
        });

        it('returns 404 for an unknown domain', async () => {
            const res = await request.get('/api/workspaces/brand/doesnotexist.xyz');
            expect(res.status).toBe(404);
        });
    });
});
