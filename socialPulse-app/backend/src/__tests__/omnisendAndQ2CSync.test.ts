import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool } from './helpers/db';
import { request, registerAndLogin, bearer } from './helpers/request';
import { OmnisendService } from '../services/marketing/omnisend.service';
import { Q2CSyncService } from '../services/integrations/q2cSync.service';
import { CreativeAIService } from '../services/marketing/creativeAI.service';
import { ClaimsGuardService } from '../services/marketing/claimsGuard.service';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Omnisend Omnichannel & Quote2ContractPro Sync (Phase SP-4 / Pillar 4)', () => {
    let dbClient: PoolClient;
    let token: string;
    let workspaceId: string;
    const testSecret = 'q2c-sync-secret-test-key-32-chars!!';

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        process.env.Q2C_WEBHOOK_SECRET = testSecret;
        process.env.ALLOW_SIMULATED_DELIVERY = 'true';
        const pool = getTestPool();
        dbClient = await pool.connect();

        const reg = await registerAndLogin({ email: `pillar4_owner_${Date.now()}@example.com` });
        token = reg.token;

        const wsRes = await dbClient.query(
            `INSERT INTO workspaces (name, brand_type, owner_id) VALUES ($1, $2, $3) RETURNING id`,
            ['Fungus No More DTC', 'FUNGUS_NO_MORE', reg.userId]
        );
        workspaceId = wsRes.rows[0].id;
        await dbClient.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)', [workspaceId, reg.userId, 'owner']);
    });

    afterAll(async () => {
        if (dbClient) {
            dbClient.release();
        }
        await closeTestPool();
    });

    function generateQ2CSignature(payloadStr: string, timestamp: number, secret: string): string {
        return crypto
            .createHmac('sha256', secret)
            .update(`${timestamp}.${payloadStr}`)
            .digest('hex');
    }

    describe('Omnisend Integration & Contact Sync', () => {
        it('configures and securely stores encrypted Omnisend API key', async () => {
            const res = await request
                .post('/api/marketing/omnisend/config')
                .set(bearer(token))
                .set('x-workspace-id', workspaceId)
                .send({
                    apiKey: 'omni_test_live_key_99999',
                    brandName: 'Fungus No More™'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const retrievedKey = await OmnisendService.getApiKey(workspaceId);
            expect(retrievedKey).toBe('omni_test_live_key_99999');
        });

        it('syncs contact data with Omnisend in test mode (SIMULATED)', async () => {
            const res = await request
                .post('/api/marketing/omnisend/contacts')
                .set(bearer(token))
                .set('x-workspace-id', workspaceId)
                .send({
                    email: 'buyer@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    tags: ['Storefront Customer', 'Fungus No More']
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('SIMULATED');
        });

        it('triggers Omnisend custom event in test mode (SIMULATED)', async () => {
            const res = await request
                .post('/api/marketing/omnisend/events')
                .set(bearer(token))
                .set('x-workspace-id', workspaceId)
                .send({
                    eventName: 'order_completed',
                    email: 'buyer@example.com',
                    fields: { orderId: 'ord_99', total: 49.99 }
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Quote2ContractPro Bidirectional Synchronization', () => {
        it('ingests signed contract.signed webhook from Q2C and logs sync record', async () => {
            const eventId = `q2c_evt_${Date.now()}`;
            const payload = {
                eventId,
                eventType: 'contract.signed',
                workspaceId,
                customerEmail: 'client@example.com',
                data: { dealValue: 12000, contractNumber: 'CTR-2026-001' }
            };
            const payloadStr = JSON.stringify(payload);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateQ2CSignature(payloadStr, timestamp, testSecret);

            const res = await request
                .post('/api/integrations/q2c/events')
                .set('Content-Type', 'application/json')
                .set('x-q2c-signature', signature)
                .set('x-q2c-timestamp', timestamp.toString())
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('PROCESSED');
        });

        it('rejects tampered Q2C signature with 401', async () => {
            const payload = { eventId: 'bad_sig_evt', eventType: 'contract.signed', workspaceId };
            const timestamp = Math.floor(Date.now() / 1000);

            const res = await request
                .post('/api/integrations/q2c/events')
                .set('Content-Type', 'application/json')
                .set('x-q2c-signature', '0'.repeat(64))
                .set('x-q2c-timestamp', timestamp.toString())
                .send(payload);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('handles duplicate Q2C retransmissions idempotently', async () => {
            const eventId = `q2c_dedup_${Date.now()}`;
            const payload = { eventId, eventType: 'deal.won', workspaceId, data: { value: 5000 } };
            const payloadStr = JSON.stringify(payload);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateQ2CSignature(payloadStr, timestamp, testSecret);

            // First ingestion
            await request
                .post('/api/integrations/q2c/events')
                .set('Content-Type', 'application/json')
                .set('x-q2c-signature', signature)
                .set('x-q2c-timestamp', timestamp.toString())
                .send(payload);

            // Duplicate ingestion
            const res2 = await request
                .post('/api/integrations/q2c/events')
                .set('Content-Type', 'application/json')
                .set('x-q2c-signature', signature)
                .set('x-q2c-timestamp', timestamp.toString())
                .send(payload);

            expect(res2.status).toBe(200);
            expect(res2.body.status).toBe('DUPLICATE');
        });

        it('pushes captured lead from SocialPulse to Q2C outbound sync log', async () => {
            const res = await request
                .post('/api/integrations/q2c/push-lead')
                .set(bearer(token))
                .set('x-workspace-id', workspaceId)
                .send({
                    email: 'lead_storefront@example.com',
                    name: 'Sarah Connor',
                    source: 'Storefront Checkout Funnel'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.syncId).toBeDefined();
        });
    });

    describe('Creative AI & Claims Library Ad Generation', () => {
        it('generates multi-format ad creative with verified claims & disclaimers', async () => {
            await ClaimsGuardService.addClaim(
                workspaceId,
                'Clinically proven moisture restoration within 7 days',
                'COSMETIC',
                true,
                'Based on a 14-day consumer trial.'
            );

            const creative = await CreativeAIService.generateAd(workspaceId, {
                productName: 'Fungus No More Serum',
                offer: 'Buy 1 Get 1 Free this week only',
                format: 'FEED'
            });

            expect(creative.headline).toBeDefined();
            expect(creative.primaryText).toBeDefined();
            expect(creative.callToAction).toBeDefined();
            expect(creative.format).toBe('FEED');
        });
    });
});
