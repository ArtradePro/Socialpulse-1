import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool } from './helpers/db';
import { request, registerAndLogin } from './helpers/request';
import { SuppressionService } from '../services/marketing/suppression.service';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Evergreen OS Signed Event Ingestion & Suppression Engine (Phase SP-2)', () => {
    let dbClient: PoolClient;
    const testSecret = 'evergreen-test-secret-key-32-chars-long!';
    let workspaceId: string;

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        process.env.EVERGREEN_INTEGRATION_SECRET = testSecret;
        const pool = getTestPool();
        dbClient = await pool.connect();

        // Create test user & workspace
        const reg = await registerAndLogin({ email: `evergreen_owner_${Date.now()}@example.com` });
        const wsRes = await dbClient.query(
            `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id`,
            ['Evergreen OS Workspace', reg.userId]
        );
        workspaceId = wsRes.rows[0].id;
    });

    afterAll(async () => {
        if (dbClient) {
            dbClient.release();
        }
        await closeTestPool();
    });

    function generateSignature(payloadStr: string, timestamp: number, secret: string): string {
        return crypto
            .createHmac('sha256', secret)
            .update(`${timestamp}.${payloadStr}`)
            .digest('hex');
    }

    describe('POST /api/integrations/evergreen/events (Cryptographic Verification)', () => {
        it('accepts and processes valid signed event payload', async () => {
            const eventId = `evt_test_${Date.now()}_1`;
            const payload = {
                eventId,
                eventType: 'order.completed',
                workspaceId,
                data: { orderId: 'ord_123', amount: 49.99, customerEmail: 'buyer@example.com' }
            };
            const payloadStr = JSON.stringify(payload);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateSignature(payloadStr, timestamp, testSecret);

            const res = await request
                .post('/api/integrations/evergreen/events')
                .set('Content-Type', 'application/json')
                .set('x-evergreen-signature', signature)
                .set('x-evergreen-timestamp', timestamp.toString())
                .set('x-evergreen-event-id', eventId)
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body.received).toBe(true);
            expect(res.body.status).toBe('PROCESSED');
            expect(res.body.eventId).toBe(eventId);
        });

        it('rejects event with tampered cryptographic signature with 401', async () => {
            const eventId = `evt_test_${Date.now()}_tampered`;
            const payload = {
                eventId,
                eventType: 'order.completed',
                workspaceId,
                data: { orderId: 'ord_123' }
            };
            const timestamp = Math.floor(Date.now() / 1000);
            const badSignature = 'a'.repeat(64);

            const res = await request
                .post('/api/integrations/evergreen/events')
                .set('Content-Type', 'application/json')
                .set('x-evergreen-signature', badSignature)
                .set('x-evergreen-timestamp', timestamp.toString())
                .set('x-evergreen-event-id', eventId)
                .send(payload);

            expect(res.status).toBe(401);
            expect(res.body.received).toBe(false);
            expect(res.body.message).toContain('signature');
        });

        it('rejects expired event outside replay tolerance window with 401', async () => {
            const eventId = `evt_test_${Date.now()}_expired`;
            const payload = {
                eventId,
                eventType: 'order.completed',
                workspaceId,
                data: { orderId: 'ord_123' }
            };
            const payloadStr = JSON.stringify(payload);
            const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
            const signature = generateSignature(payloadStr, expiredTimestamp, testSecret);

            const res = await request
                .post('/api/integrations/evergreen/events')
                .set('Content-Type', 'application/json')
                .set('x-evergreen-signature', signature)
                .set('x-evergreen-timestamp', expiredTimestamp.toString())
                .set('x-evergreen-event-id', eventId)
                .send(payload);

            expect(res.status).toBe(401);
            expect(res.body.received).toBe(false);
            expect(res.body.message).toContain('tolerance window');
        });

        it('handles duplicate event retransmission idempotently without reprocessing', async () => {
            const eventId = `evt_test_dedup_${Date.now()}`;
            const payload = {
                eventId,
                eventType: 'lead.qualified',
                workspaceId,
                data: { leadEmail: 'lead@example.com' }
            };
            const payloadStr = JSON.stringify(payload);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateSignature(payloadStr, timestamp, testSecret);

            // First ingestion: processed
            const res1 = await request
                .post('/api/integrations/evergreen/events')
                .set('Content-Type', 'application/json')
                .set('x-evergreen-signature', signature)
                .set('x-evergreen-timestamp', timestamp.toString())
                .set('x-evergreen-event-id', eventId)
                .send(payload);

            expect(res1.status).toBe(200);
            expect(res1.body.status).toBe('PROCESSED');

            // Second ingestion (retransmission): duplicate detected
            const res2 = await request
                .post('/api/integrations/evergreen/events')
                .set('Content-Type', 'application/json')
                .set('x-evergreen-signature', signature)
                .set('x-evergreen-timestamp', timestamp.toString())
                .set('x-evergreen-event-id', eventId)
                .send(payload);

            expect(res2.status).toBe(200);
            expect(res2.body.received).toBe(true);
            expect(res2.body.status).toBe('DUPLICATE');
        });

        it('processes customer.suppressed event and records in suppression list', async () => {
            const eventId = `evt_test_supp_${Date.now()}`;
            const testEmail = `suppressed_${Date.now()}@example.com`;
            const payload = {
                eventId,
                eventType: 'customer.suppressed',
                workspaceId,
                data: { email: testEmail, channel: 'EMAIL', reason: 'UNSUBSCRIBED' }
            };
            const payloadStr = JSON.stringify(payload);
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = generateSignature(payloadStr, timestamp, testSecret);

            const res = await request
                .post('/api/integrations/evergreen/events')
                .set('Content-Type', 'application/json')
                .set('x-evergreen-signature', signature)
                .set('x-evergreen-timestamp', timestamp.toString())
                .set('x-evergreen-event-id', eventId)
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('PROCESSED');

            const isSupp = await SuppressionService.isSuppressed(workspaceId, 'EMAIL', testEmail);
            expect(isSupp).toBe(true);
        });
    });

    describe('SuppressionService & Consent Management (POPIA Enforcement)', () => {
        it('normalizes identifiers and verifies suppression status accurately', async () => {
            const email = 'User.MixedCase@Example.Com';
            await SuppressionService.addSuppression(workspaceId, 'EMAIL', email, 'UNSUBSCRIBED');

            const isSupp1 = await SuppressionService.isSuppressed(workspaceId, 'EMAIL', 'user.mixedcase@example.com');
            const isSupp2 = await SuppressionService.isSuppressed(workspaceId, 'EMAIL', 'USER.MIXEDCASE@EXAMPLE.COM');
            const isOtherSupp = await SuppressionService.isSuppressed(workspaceId, 'EMAIL', 'other@example.com');

            expect(isSupp1).toBe(true);
            expect(isSupp2).toBe(true);
            expect(isOtherSupp).toBe(false);
        });

        it('removes suppression cleanly when customer re-subscribes', async () => {
            const phone = '+27821234567';
            await SuppressionService.addSuppression(workspaceId, 'SMS', phone, 'MANUAL');
            expect(await SuppressionService.isSuppressed(workspaceId, 'SMS', phone)).toBe(true);

            const removed = await SuppressionService.removeSuppression(workspaceId, 'SMS', phone);
            expect(removed).toBe(true);
            expect(await SuppressionService.isSuppressed(workspaceId, 'SMS', phone)).toBe(false);
        });

        it('records POPIA consent audit logs and suppresses on OPT_OUT', async () => {
            const optOutEmail = `optout_${Date.now()}@example.com`;
            await SuppressionService.recordConsent(workspaceId, {
                contactIdentifier: optOutEmail,
                channel: 'EMAIL',
                status: 'OPT_OUT',
                lawfulBasis: 'CONSENT',
                consentVersion: 'v2.0_checkout',
                ipAddress: '192.168.1.1'
            });

            const isSupp = await SuppressionService.isSuppressed(workspaceId, 'EMAIL', optOutEmail);
            expect(isSupp).toBe(true);
        });
    });
});
