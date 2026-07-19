import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool } from './helpers/db';
import { request } from './helpers/request';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Webhooks endpoints', () => {
    let dbClient: PoolClient;
    const testSecret = 'test-webhook-secret-xyz';

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        process.env.WEBHOOK_SECRET = testSecret;
        const pool = getTestPool();
        dbClient = await pool.connect();
    });

    afterAll(async () => {
        dbClient.release();
        await closeTestPool();
    });

    describe('POST /api/webhooks/contract-signed', () => {
        it('returns 401 if x-webhook-secret header is missing or incorrect', async () => {
            const res = await request
                .post('/api/webhooks/contract-signed')
                .send({ tenantId: 'e8a1a6f3-c619-472e-acb5-bef69811ce72' });

            expect(res.status).toBe(401);
        });

        it('returns 400 if tenantId is missing', async () => {
            const res = await request
                .post('/api/webhooks/contract-signed')
                .set('x-webhook-secret', testSecret)
                .send({
                    contractDetails: {},
                    contactInfo: {}
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('tenantId is required');
        });

        it('returns 400 if tenantId is not a valid UUID', async () => {
            const res = await request
                .post('/api/webhooks/contract-signed')
                .set('x-webhook-secret', testSecret)
                .send({
                    tenantId: 'invalid-tenant-id-123',
                    contractDetails: {},
                    contactInfo: {}
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Invalid tenantId format');
        });

        it('returns 200 and processes event if valid secret and tenantId UUID are provided', async () => {
            const validTenantId = 'e8a1a6f3-c619-472e-acb5-bef69811ce72';
            
            const res = await request
                .post('/api/webhooks/contract-signed')
                .set('x-webhook-secret', testSecret)
                .send({
                    tenantId: validTenantId,
                    contractDetails: { amount: 5000 },
                    contactInfo: { email: 'client@example.com', firstName: 'John' }
                });

            expect(res.status).toBe(200);
            expect(res.body.received).toBe(true);
        });
    });
});
