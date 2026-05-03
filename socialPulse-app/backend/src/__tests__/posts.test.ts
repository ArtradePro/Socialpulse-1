import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../../.env') });

import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool, cleanDb } from './helpers/db';
import { request, registerAndLogin, bearer } from './helpers/request';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Posts endpoints', () => {
    let dbClient: PoolClient;
    let token: string;

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const pool = getTestPool();
        dbClient = await pool.connect();
    });

    beforeEach(async () => {
        await cleanDb(dbClient);
        ({ token } = await registerAndLogin({ email: 'poster@example.com' }));
    });

    afterAll(async () => {
        dbClient.release();
        await closeTestPool();
    });

    describe('POST /api/posts', () => {
        it('creates a draft post', async () => {
            const res = await request
                .post('/api/posts')
                .set(bearer(token))
                .send({
                    content:   'Hello world!',
                    platforms: ['twitter'],
                    status:    'draft',
                });

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({
                content:   'Hello world!',
                platforms: ['twitter'],
                status:    'draft',
            });
            expect(res.body).toHaveProperty('id');
        });

        it('creates a scheduled post with scheduledAt', async () => {
            const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

            const res = await request
                .post('/api/posts')
                .set(bearer(token))
                .send({
                    content:     'Scheduled post',
                    platforms:   ['instagram'],
                    status:      'scheduled',
                    scheduledAt,
                });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('scheduled');
        });

        it('returns 401 without authentication', async () => {
            const res = await request
                .post('/api/posts')
                .send({ content: 'Test', platforms: ['twitter'], status: 'draft' });

            expect(res.status).toBe(401);
        });

        it('returns 400 for empty content', async () => {
            const res = await request
                .post('/api/posts')
                .set(bearer(token))
                .send({ content: '', platforms: ['twitter'], status: 'draft' });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/posts', () => {
        it('returns an empty list for a new user', async () => {
            const res = await request
                .get('/api/posts')
                .set(bearer(token));

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.posts ?? res.body.data ?? res.body)).toBe(true);
        });

        it('returns created posts', async () => {
            await request
                .post('/api/posts')
                .set(bearer(token))
                .send({ content: 'Post A', platforms: ['twitter'], status: 'draft' });

            await request
                .post('/api/posts')
                .set(bearer(token))
                .send({ content: 'Post B', platforms: ['linkedin'], status: 'draft' });

            const res = await request
                .get('/api/posts')
                .set(bearer(token));

            expect(res.status).toBe(200);
            const posts = res.body.posts ?? res.body.data ?? res.body;
            expect(posts.length).toBeGreaterThanOrEqual(2);
        });

        it('filters by status', async () => {
            await request
                .post('/api/posts')
                .set(bearer(token))
                .send({ content: 'Draft post', platforms: ['twitter'], status: 'draft' });

            const res = await request
                .get('/api/posts?status=draft')
                .set(bearer(token));

            expect(res.status).toBe(200);
            const posts: { status: string }[] = res.body.posts ?? res.body.data ?? res.body;
            expect(posts.every((p) => p.status === 'draft')).toBe(true);
        });

        it('does not return another user posts', async () => {
            const { token: otherToken } = await registerAndLogin({ email: 'other@example.com' });
            await request
                .post('/api/posts')
                .set(bearer(otherToken))
                .send({ content: 'Other user post', platforms: ['twitter'], status: 'draft' });

            const res = await request
                .get('/api/posts')
                .set(bearer(token));

            const posts: { content: string }[] = res.body.posts ?? res.body.data ?? res.body;
            expect(posts.some((p) => p.content === 'Other user post')).toBe(false);
        });
    });

    describe('GET /api/posts/:id', () => {
        it('returns a single post', async () => {
            const createRes = await request
                .post('/api/posts')
                .set(bearer(token))
                .send({ content: 'Single post', platforms: ['twitter'], status: 'draft' });

            const id = createRes.body.id as string;

            const res = await request
                .get(`/api/posts/${id}`)
                .set(bearer(token));

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(id);
        });

        it('returns 404 for a non-existent post', async () => {
            const res = await request
                .get('/api/posts/00000000-0000-0000-0000-000000000000')
                .set(bearer(token));

            expect(res.status).toBe(404);
        });

        it('returns 403 or 404 when accessing another user post', async () => {
            const { token: otherToken } = await registerAndLogin({ email: 'owner@example.com' });
            const createRes = await request
                .post('/api/posts')
                .set(bearer(otherToken))
                .send({ content: 'Owner post', platforms: ['twitter'], status: 'draft' });

            const id = createRes.body.id as string;

            const res = await request
                .get(`/api/posts/${id}`)
                .set(bearer(token));

            expect([403, 404]).toContain(res.status);
        });
    });

    describe('PATCH /api/posts/:id', () => {
        it('updates post content', async () => {
            const createRes = await request
                .post('/api/posts')
                .set(bearer(token))
                .send({ content: 'Original', platforms: ['twitter'], status: 'draft' });

            const id = createRes.body.id as string;

            const res = await request
                .patch(`/api/posts/${id}`)
                .set(bearer(token))
                .send({ content: 'Updated content' });

            expect(res.status).toBe(200);
            expect(res.body.content).toBe('Updated content');
        });
    });

    describe('DELETE /api/posts/:id', () => {
        it('deletes a post', async () => {
            const createRes = await request
                .post('/api/posts')
                .set(bearer(token))
                .send({ content: 'To delete', platforms: ['twitter'], status: 'draft' });

            const id = createRes.body.id as string;

            const deleteRes = await request
                .delete(`/api/posts/${id}`)
                .set(bearer(token));

            expect(deleteRes.status).toBe(200);

            const getRes = await request
                .get(`/api/posts/${id}`)
                .set(bearer(token));

            expect(getRes.status).toBe(404);
        });

        it('returns 403 or 404 when deleting another user post', async () => {
            const { token: ownerToken } = await registerAndLogin({ email: 'postowner@example.com' });
            const createRes = await request
                .post('/api/posts')
                .set(bearer(ownerToken))
                .send({ content: 'Not yours', platforms: ['twitter'], status: 'draft' });

            const id = createRes.body.id as string;

            const res = await request
                .delete(`/api/posts/${id}`)
                .set(bearer(token));

            expect([403, 404]).toContain(res.status);
        });
    });
});
