import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool } from './helpers/db';
import { request, registerAndLogin, bearer } from './helpers/request';
import { UGCVideoService } from '../services/marketing/ugcVideo.service';
import { ClaimsGuardService } from '../services/marketing/claimsGuard.service';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('Zeely AI UGC Video Generator (Phase SP-5 / Step 1)', () => {
    let dbClient: PoolClient;
    let token: string;
    let fnmWorkspaceId: string;
    let corpWorkspaceId: string;

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const pool = getTestPool();
        dbClient = await pool.connect();

        const reg = await registerAndLogin({ email: `ugc_director_${Date.now()}@example.com` });
        token = reg.token;

        // Create Fungus No More™ workspace
        const ws1 = await dbClient.query(
            `INSERT INTO workspaces (name, brand_type, owner_id) VALUES ($1, $2, $3) RETURNING id`,
            ['Fungus No More DTC', 'FUNGUS_NO_MORE', reg.userId]
        );
        fnmWorkspaceId = ws1.rows[0].id;
        await dbClient.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)', [fnmWorkspaceId, reg.userId, 'owner']);

        // Create Corporate workspace
        const ws2 = await dbClient.query(
            `INSERT INTO workspaces (name, brand_type, owner_id) VALUES ($1, $2, $3) RETURNING id`,
            ['Higiene Corporate B2B', 'HIGIENE_CORP', reg.userId]
        );
        corpWorkspaceId = ws2.rows[0].id;
        await dbClient.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)', [corpWorkspaceId, reg.userId, 'owner']);
    });

    afterAll(async () => {
        if (dbClient) {
            dbClient.release();
        }
        await closeTestPool();
    });

    describe('UGC Video Script Generation & Scene Breakdown', () => {
        it('generates 3-part UGC video script (Hook, Problem/Solution, CTA)', async () => {
            const script = await UGCVideoService.generateUGCScript(
                fnmWorkspaceId,
                'Fungus No More™ Active Serum',
                '50% Off First Bottle + Free Nationwide Delivery'
            );

            expect(script.title).toBeDefined();
            expect(script.scenes.length).toBe(3);
            expect(script.scenes[0].type).toBe('HOOK');
            expect(script.scenes[1].type).toBe('PROBLEM_SOLUTION');
            expect(script.scenes[2].type).toBe('CTA');
            expect(script.totalDurationSeconds).toBeGreaterThanOrEqual(25);
        });

        it('enforces slogan exclusivity and claims guard in UGC scripts', async () => {
            await ClaimsGuardService.addClaim(
                fnmWorkspaceId,
                'Visible comfort within 7 days of daily application',
                'COSMETIC',
                true,
                'Results may vary by individual skin type.'
            );

            const script = await UGCVideoService.generateUGCScript(
                fnmWorkspaceId,
                'Fungus No More™ Active Serum',
                'Special Launch Offer'
            );

            expect(script.brandAuthorized).toBe(true);
        });
    });

    describe('Zeely-Grade UGC Video Rendering & Captions', () => {
        it('renders 9:16 vertical video asset with timed kinetic captions', async () => {
            const video = await UGCVideoService.renderUGCVideo({
                workspaceId: fnmWorkspaceId,
                productName: 'Fungus No More™ Serum',
                offerHook: 'Buy 1 Get 1 Free',
                avatarStyle: 'ugc_female',
                voiceAccent: 'en-ZA',
                aspectRatio: '9:16'
            });

            expect(video.id).toBeDefined();
            expect(video.video_url).toBeDefined();
            expect(video.aspectRatio).toBe('9:16');
            expect(video.captions.length).toBeGreaterThan(0);
        });

        it('supports REST endpoints for script and video generation', async () => {
            // Script endpoint
            const resScript = await request
                .post('/api/ads/ugc-script')
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId)
                .send({
                    productName: 'Fungus No More™ Active Serum',
                    offerHook: 'Spring Clearance Special'
                });

            expect(resScript.status).toBe(200);
            expect(resScript.body.scenes).toBeDefined();

            // Video render endpoint
            const resVideo = await request
                .post('/api/ads/ugc-video')
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId)
                .send({
                    productName: 'Fungus No More™ Active Serum',
                    offerHook: 'Spring Clearance Special',
                    avatarStyle: 'ugc_female',
                    voiceAccent: 'en-ZA',
                    aspectRatio: '9:16'
                });

            expect(resVideo.status).toBe(201);
            expect(resVideo.body.video_url).toBeDefined();
        });
    });

    describe('Zeely-Grade Direct-Response Banner Generator', () => {
        it('generates direct-response ad banner with luxury marble theme, price badge, and compliance disclaimer', async () => {
            const res = await request
                .post('/api/ads/banner')
                .set(bearer(token))
                .set('x-workspace-id', fnmWorkspaceId)
                .send({
                    productTitle: 'Fungus No More™ 50ml Active Serum',
                    headline: 'Clear, Healthy Skin Starts Here',
                    subheadline: "Love The Skin You're In.",
                    badgeText: 'TOP SELLER IN SA',
                    priceText: 'R299.00',
                    ctaText: 'ORDER NOW',
                    theme: 'luxury_marble',
                    aspectRatio: '1:1'
                });

            expect(res.status).toBe(201);
            expect(res.body.url).toBeDefined();
            expect(res.body.mime_type).toBe('image/png');
        });
    });

    describe('Evergreen OS Product Catalog Ingestion & Sync', () => {
        it('automatically ingests and upserts Evergreen OS product into SocialPulse catalog', async () => {
            const { EvergreenIntegrationService } = await import('../services/integrations/evergreen.service');

            await EvergreenIntegrationService.syncProduct(fnmWorkspaceId, {
                id: 'prod_fnm_serum_01',
                title: 'Fungus No More™ Advanced Care Serum',
                description: 'Clinically formulated multi-active fungal defence serum.',
                price: 349.00,
                currency: 'ZAR',
                category: 'Dermatology & Footcare',
                tags: ['Skincare', 'Fungus No More', 'Top Seller']
            });

            const { rows } = await dbClient.query(
                `SELECT * FROM products WHERE workspace_id = $1 AND external_id = $2`,
                [fnmWorkspaceId, 'prod_fnm_serum_01']
            );

            expect(rows.length).toBe(1);
            expect(rows[0].title).toBe('Fungus No More™ Advanced Care Serum');
            expect(parseFloat(rows[0].price)).toBe(349.00);
            expect(rows[0].currency).toBe('ZAR');
        });
    });
});
