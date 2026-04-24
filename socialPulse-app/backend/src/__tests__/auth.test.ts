import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../../.env') });

import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool, cleanDb } from './helpers/db';
import { request, registerAndLogin, bearer } from './helpers/request';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Auth endpoints', () => {
    let dbClient: PoolClient;

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const pool = getTestPool();
        dbClient = await pool.connect();
    });

    beforeEach(async () => {
        await cleanDb(dbClient);
    });

    afterAll(async () => {
        dbClient.release();
        await closeTestPool();
    });

    describe('POST /api/auth/register', () => {
        it('creates a user and returns a JWT', async () => {
            const res = await request.post('/api/auth/register').send({
                email:    'alice@example.com',
                password: 'Password123!',
                fullName: 'Alice Smith',
            });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toMatchObject({
                email:    'alice@example.com',
                fullName: 'Alice Smith',
                plan:     'free',
            });
        });

        it('rejects duplicate email with 409', async () => {
            await request.post('/api/auth/register').send({
                email:    'dup@example.com',
                password: 'Password123!',
                fullName: 'Dup User',
            });

            const res = await request.post('/api/auth/register').send({
                email:    'dup@example.com',
                password: 'Password123!',
                fullName: 'Dup User',
            });

            expect(res.status).toBe(409);
        });

        it('rejects missing password with 400', async () => {
            const res = await request
                .post('/api/auth/register')
                .send({ email: 'nopassword@example.com', fullName: 'No Pass' });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/login', () => {
        it('returns a JWT for valid credentials', async () => {
            await registerAndLogin({ email: 'bob@example.com', password: 'Password123!' });

            const res = await request.post('/api/auth/login').send({
                email:    'bob@example.com',
                password: 'Password123!',
            });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
        });

        it('returns 401 for wrong password', async () => {
            await registerAndLogin({ email: 'charlie@example.com', password: 'CorrectPass1' });

            const res = await request.post('/api/auth/login').send({
                email:    'charlie@example.com',
                password: 'WrongPass!',
            });

            expect(res.status).toBe(401);
        });

        it('returns 401 for unknown email', async () => {
            const res = await request.post('/api/auth/login').send({
                email:    'nobody@example.com',
                password: 'Password123!',
            });
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/auth/profile', () => {
        it('returns the authenticated user', async () => {
            const { token } = await registerAndLogin({ email: 'dana@example.com' });

            const res = await request
                .get('/api/auth/profile')
                .set(bearer(token));

            expect(res.status).toBe(200);
            expect(res.body.email).toBe('dana@example.com');
        });

        it('returns 401 without a token', async () => {
            const res = await request.get('/api/auth/profile');
            expect(res.status).toBe(401);
        });

        it('returns 401 with a malformed token', async () => {
            const res = await request
                .get('/api/auth/profile')
                .set({ Authorization: 'Bearer notavalidtoken' });
            expect(res.status).toBe(401);
        });
    });

    describe('PUT /api/auth/profile', () => {
        it('updates the user full name', async () => {
            const { token } = await registerAndLogin({ email: 'eve@example.com', fullName: 'Eve Old' });

            const res = await request
                .put('/api/auth/profile')
                .set(bearer(token))
                .send({ fullName: 'Eve New' });

            expect(res.status).toBe(200);
            expect(res.body.fullName).toBe('Eve New');
        });
    });

    describe('PUT /api/auth/change-password', () => {
        it('changes the password and allows login with new password', async () => {
            const { token } = await registerAndLogin({
                email:    'frank@example.com',
                password: 'OldPass123!',
            });

            const changeRes = await request
                .put('/api/auth/change-password')
                .set(bearer(token))
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass456!' });

            expect(changeRes.status).toBe(200);

            const loginRes = await request.post('/api/auth/login').send({
                email:    'frank@example.com',
                password: 'NewPass456!',
            });
            expect(loginRes.status).toBe(200);
        });

        it('rejects incorrect current password with 401', async () => {
            const { token } = await registerAndLogin({
                email:    'grace@example.com',
                password: 'CorrectPass1',
            });

            const res = await request
                .put('/api/auth/change-password')
                .set(bearer(token))
                .send({ currentPassword: 'WrongPass!', newPassword: 'NewPass456!' });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/auth/forgot-password', () => {
        it('returns 200 even for unknown email (prevents user enumeration)', async () => {
            const res = await request
                .post('/api/auth/forgot-password')
                .send({ email: 'unknown@example.com' });

            expect(res.status).toBe(200);
        });
    });

    describe('GET /health', () => {
        it('returns status ok without auth', async () => {
            const res = await request.get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });
});
