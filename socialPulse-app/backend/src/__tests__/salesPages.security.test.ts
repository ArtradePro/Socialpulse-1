import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import type { PoolClient } from 'pg';
import { getTestPool, closeTestPool } from './helpers/db';
import { request, registerAndLogin } from './helpers/request';
import { db, pool } from '../config/database';

// Mock the Stripe SDK
const mockStripeSessionCreate = jest.fn();
const mockStripeSessionRetrieve = jest.fn();

jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => {
        return {
            checkout: {
                sessions: {
                    create: mockStripeSessionCreate,
                    retrieve: mockStripeSessionRetrieve,
                },
            },
        };
    });
});

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('SalesPages & Storefront Security Tests (Phase SP-1B / SP-1B-R1)', () => {
    let dbClient: PoolClient;
    let workspaceId: string;
    let salesPageId: string;
    let abSalesPageId: string;
    const testSlug = 'fungus-no-more-test-serum';
    const abTestSlug = 'fungus-no-more-ab-serum';

    beforeAll(async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const testPool = getTestPool();
        dbClient = await testPool.connect();
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        delete process.env.NODE_ENV;
        process.env.CLIENT_URL = 'https://usesocialpulse.com';

        // Clean tables
        await dbClient.query('DELETE FROM customer_messages');
        await dbClient.query('DELETE FROM storefront_customers');
        await dbClient.query('DELETE FROM sales_orders');
        await dbClient.query('DELETE FROM sales_pages');

        // Create user & workspace
        const reg = await registerAndLogin({ email: `store_owner_${Date.now()}@example.com` });
        const wsRes = await dbClient.query(
            `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id`,
            ['Fungus No More SA', reg.userId]
        );
        workspaceId = wsRes.rows[0].id;

        // Insert Standard Single Test Page
        const pageRes = await dbClient.query(
            `INSERT INTO sales_pages (
                workspace_id, title, slug, headline, description, features, price, currency,
                image_url, cta_text, theme, meta_pixel_id, gtm_id, is_ab_test,
                stripe_secret_key, paypal_client_id, use_live_payments,
                revenue, sales_count, visits
             ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
             ) RETURNING id`,
            [
                workspaceId,
                'Fungus No More Advanced Serum',
                testSlug,
                'Restore Clear, Healthy Nails Fast',
                'Clinically formulated daily topical solution.',
                JSON.stringify(['Max Strength Formula', 'Fast Absorbing']),
                50.00,
                'USD',
                'https://example.com/product.png',
                'Order Now',
                'modern',
                '1234567890',
                'GTM-XXXXXX',
                false,
                'sk_test_FAKE_SOCIALPULSE_TEST_ONLY',
                'AZ_CONFIDENTIAL_PAYPAL_CLIENT_ID',
                true,
                15499.50,
                310,
                1250
            ]
        );
        salesPageId = pageRes.rows[0].id;

        // Insert A/B Testing Enabled Page
        const abPageRes = await dbClient.query(
            `INSERT INTO sales_pages (
                workspace_id, title, slug, headline, description, features, price, currency,
                image_url, cta_text, theme, is_ab_test,
                variant_theme, variant_headline, variant_description, variant_price,
                stripe_secret_key, use_live_payments,
                revenue, sales_count, variant_revenue, variant_sales_count, visits, variant_visits
             ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
             ) RETURNING id`,
            [
                workspaceId,
                'Fungus No More Serum AB',
                abTestSlug,
                'Restore Clear Nails Variant A',
                'Formula A Description',
                JSON.stringify(['Feature A']),
                50.00,
                'USD',
                'https://example.com/product.png',
                'Buy Variant A',
                'modern',
                true,
                'dark-neon',
                'Restore Clear Nails Variant B',
                'Formula B Description',
                75.00,
                'sk_test_FAKE_SOCIALPULSE_TEST_ONLY',
                true,
                0,
                0,
                0,
                0,
                0,
                0
            ]
        );
        abSalesPageId = abPageRes.rows[0].id;
    });

    afterAll(async () => {
        dbClient.release();
        await pool.end();
        await closeTestPool();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. PUBLIC STOREFRONT DATA CONTAINMENT
    // ─────────────────────────────────────────────────────────────────────────────
    describe('GET /api/storefront/public/:slug (Data Containment)', () => {
        it('returns HTTP 200 with whitelist public presentation fields and strictly redacts all secrets and internal metrics', async () => {
            const res = await request.get(`/api/storefront/public/${testSlug}`);

            expect(res.status).toBe(200);

            // 1. Public Presentation Fields
            expect(res.body.id).toBe(salesPageId);
            expect(res.body.title).toBe('Fungus No More Advanced Serum');
            expect(res.body.slug).toBe(testSlug);
            expect(res.body.headline).toBe('Restore Clear, Healthy Nails Fast');
            expect(res.body.price).toBe(50);
            expect(res.body.currency).toBe('USD');
            expect(res.body.features).toEqual(['Max Strength Formula', 'Fast Absorbing']);
            expect(res.body.has_live_payments).toBe(true);

            // 2. Strict Redaction: Confidential Secrets must NEVER be exposed
            expect(res.body.stripe_secret_key).toBeUndefined();
            expect(res.body.paypal_client_id).toBeUndefined();

            // 3. Strict Redaction: Internal Operational Fields must NEVER be exposed
            expect(res.body.workspace_id).toBeUndefined();
            expect(res.body.revenue).toBeUndefined();
            expect(res.body.sales_count).toBeUndefined();
            expect(res.body.variant_revenue).toBeUndefined();
            expect(res.body.variant_sales_count).toBeUndefined();
            expect(res.body.visits).toBeUndefined();
            expect(res.body.variant_visits).toBeUndefined();
        });

        it('returns 404 when sales page slug is not found', async () => {
            const res = await request.get('/api/storefront/public/non-existent-slug-xyz');
            expect(res.status).toBe(404);
            expect(res.body.message).toContain('not found');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. CHECKOUT SESSION CREATION & ORIGIN HARDENING
    // ─────────────────────────────────────────────────────────────────────────────
    describe('POST /api/storefront/public/checkout (Session Creation)', () => {
        it('ignores client-supplied price tampering and derives unit amount strictly from database price', async () => {
            mockStripeSessionCreate.mockResolvedValueOnce({
                id: 'cs_test_mock_session_123',
                url: 'https://checkout.stripe.com/pay/cs_test_mock_session_123'
            });

            // Attacker attempts to send amount: 0.01 and currency: EUR
            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    customer_name: 'John Doe',
                    customer_email: 'john@example.com',
                    amount: 0.01,
                    currency: 'EUR',
                    variant_used: 'A'
                });

            expect(res.status).toBe(200);
            expect(res.body.stripe_checkout_url).toBe('https://checkout.stripe.com/pay/cs_test_mock_session_123');

            // Verify Stripe Session was created with SERVER price ($50.00 = 5000 cents, USD)
            expect(mockStripeSessionCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    line_items: [{
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: 'Fungus No More Advanced Serum',
                                description: 'Restore Clear, Healthy Nails Fast'
                            },
                            unit_amount: 5000, // Derived from $50.00 in DB
                        },
                        quantity: 1,
                    }],
                    metadata: expect.objectContaining({
                        sales_page_id: salesPageId,
                        variant: 'A',
                        expected_amount_cents: '5000',
                        expected_currency: 'USD'
                    }),
                    // Success URL does NOT expose personal customer data
                    success_url: expect.stringContaining(`/s/${testSlug}?checkout_status=success&session_id={CHECKOUT_SESSION_ID}`)
                })
            );
        });

        it('disallows malicious request Origin header — CORS middleware rejects before controller', async () => {
            mockStripeSessionCreate.mockResolvedValueOnce({
                id: 'cs_test_mock_session_456',
                url: 'https://checkout.stripe.com/pay/cs_test_mock_session_456'
            });

            process.env.CLIENT_URL = 'https://usesocialpulse.com';

            const res = await request
                .post('/api/storefront/public/checkout')
                .set('Origin', 'https://evil-phishing-site.attacker.com')
                .send({
                    sales_page_id: salesPageId,
                    customer_email: 'buyer@example.com'
                });

            // CORS middleware blocks the request before it reaches the controller
            expect(res.status).toBe(500);
            // Stripe session creation must never be reached
            expect(mockStripeSessionCreate).not.toHaveBeenCalled();
        });

        it('fails closed when production frontend URL is missing or invalid', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.CLIENT_URL;
            delete process.env.FRONTEND_URL;

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    customer_email: 'buyer@example.com'
                });

            expect(res.status).toBe(500);
            expect(res.body.message).toContain('Invalid or unconfigured storefront redirect configuration');
            expect(mockStripeSessionCreate).not.toHaveBeenCalled();
        });

        it('fails closed when live payments are disabled on the sales page', async () => {
            await dbClient.query('UPDATE sales_pages SET use_live_payments = false WHERE id = $1', [salesPageId]);

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    customer_email: 'jane@example.com'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Live payment processing is not configured');
            expect(mockStripeSessionCreate).not.toHaveBeenCalled();
        });

        it('rejects checkout creation when storefront price is zero or negative', async () => {
            await dbClient.query('UPDATE sales_pages SET price = 0 WHERE id = $1', [salesPageId]);

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    customer_email: 'zero_price@example.com'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Invalid configured storefront pricing');
            expect(mockStripeSessionCreate).not.toHaveBeenCalled();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. PAYMENT VERIFICATION, STATUS CHECKS & METADATA BINDING
    // ─────────────────────────────────────────────────────────────────────────────
    describe('POST /api/storefront/public/checkout (Payment Verification & Completion)', () => {
        it('rejects session completion when session.status is not complete (e.g. open/expired)', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_status_open',
                status: 'open', // Incomplete session
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_status_open'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Payment session is not complete or unpaid');

            // Verify zero database writes
            const orderCheck = await dbClient.query('SELECT * FROM sales_orders WHERE stripe_session_id = $1', ['cs_test_status_open']);
            expect(orderCheck.rows.length).toBe(0);
        });

        it('rejects session completion when payment_status is not paid', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_unpaid_123',
                status: 'complete',
                payment_status: 'unpaid', // Unpaid
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_unpaid_123'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Payment session is not complete or unpaid');
        });

        it('rejects completion when sales-page metadata does not match database record', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_mismatched_page',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: '00000000-0000-0000-0000-000000000000', // Foreign sales page
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_mismatched_page'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Payment session does not match this storefront');
        });

        it('rejects completion when metadata variant is invalid (not A or B)', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_invalid_variant',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'C', // Invalid variant
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_invalid_variant'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Invalid payment session variant metadata');
        });

        it('rejects Variant B when A/B testing is disabled on the page', async () => {
            // salesPageId has is_ab_test = false
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_variant_b_disabled',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 7500,
                currency: 'usd',
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'B',
                    expected_amount_cents: '7500',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_variant_b_disabled'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Variant B is not valid for non-AB tested storefront');
        });

        it('strictly derives authoritative price from metadata variant and ignores client request variant', async () => {
            // abSalesPageId: Variant A is $50.00, Variant B is $75.00
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_ab_variant_b',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 7500,
                currency: 'usd',
                customer_details: { email: 'buyer_b@example.com' },
                metadata: {
                    sales_page_id: abSalesPageId,
                    variant: 'B',
                    expected_amount_cents: '7500',
                    expected_currency: 'USD'
                }
            });

            // Attacker tries sending variant_used: 'A' in request body to get lower price
            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: abSalesPageId,
                    variant_used: 'A',
                    stripe_session_id: 'cs_test_ab_variant_b'
                });

            expect(res.status).toBe(201);
            expect(res.body.amount).toBe('75.00'); // Authoritative Variant B price from metadata

            // Check variant_revenue in DB
            const pageCheck = await dbClient.query('SELECT variant_revenue, variant_sales_count FROM sales_pages WHERE id = $1', [abSalesPageId]);
            expect(Number(pageCheck.rows[0].variant_revenue)).toBe(75.00);
            expect(Number(pageCheck.rows[0].variant_sales_count)).toBe(1);
        });

        it('rejects completion when metadata expected amount mismatch occurs', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_mismatched_meta_amount',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '9999', // Mismatched
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_mismatched_meta_amount'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Session expected amount metadata mismatch');
        });

        it('rejects completion when Stripe session amount_total does not match offer price', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_mismatched_session_amount',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 1000, // $10.00 != $50.00
                currency: 'usd',
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_mismatched_session_amount'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Payment session amount does not match offer price');
        });

        it('rejects completion when session currency mismatches database currency', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_mismatched_currency',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'eur', // Mismatched currency
                customer_details: { email: 'buyer@example.com' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_mismatched_currency'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Payment session currency mismatch');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. IDENTITY HARDENING & ZERO BROWSER TRUST
    // ─────────────────────────────────────────────────────────────────────────────
    describe('POST /api/storefront/public/checkout (Identity Verification & Zero Browser Trust)', () => {
        it('uses verified provider email and never trusts browser-supplied email during completion', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_verified_identity',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'stripe_verified@realcustomer.com', name: 'Real Stripe Buyer' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            // Attacker attempts to pass spoofed email in req.body
            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    customer_email: 'attacker_spoofed@evil.com',
                    customer_name: 'Attacker Name',
                    stripe_session_id: 'cs_test_verified_identity'
                });

            expect(res.status).toBe(201);

            // Verify order in database uses stripe_verified@realcustomer.com
            const orderCheck = await dbClient.query('SELECT * FROM sales_orders WHERE stripe_session_id = $1', ['cs_test_verified_identity']);
            expect(orderCheck.rows[0].customer_email).toBe('stripe_verified@realcustomer.com');
            expect(orderCheck.rows[0].customer_name).toBe('Real Stripe Buyer');

            // Verify CRM customer is created under stripe_verified@realcustomer.com
            const crmCheck = await dbClient.query('SELECT * FROM storefront_customers WHERE email = $1', ['stripe_verified@realcustomer.com']);
            expect(crmCheck.rows.length).toBe(1);
        });

        it('fails closed when verified Stripe session contains no customer email', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_missing_email',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: null, // No email
                customer_email: null,
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            const res = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    customer_email: 'browser_email@example.com',
                    stripe_session_id: 'cs_test_missing_email'
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Verified customer email missing from payment provider');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. TRANSACTIONAL ATOMICITY, IDEMPOTENCY & SECURE REPLAY
    // ─────────────────────────────────────────────────────────────────────────────
    describe('POST /api/storefront/public/checkout (Transactional Atomicity & Idempotent Replay)', () => {
        it('idempotent replay returns generic status and strictly hides customer PII and financials', async () => {
            mockStripeSessionRetrieve.mockResolvedValue({
                id: 'cs_test_idempotent_replay',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'idempotent_user@example.com', name: 'Private User' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            // 1. Initial Request
            const res1 = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_idempotent_replay'
                });
            expect(res1.status).toBe(201);

            // 2. Replay Request
            const res2 = await request
                .post('/api/storefront/public/checkout')
                .send({
                    sales_page_id: salesPageId,
                    stripe_session_id: 'cs_test_idempotent_replay'
                });

            expect(res2.status).toBe(200);
            expect(res2.body.already_processed).toBe(true);
            expect(res2.body.message).toBe('Order already processed');

            // Assert zero customer PII or sensitive financials in public replay response
            expect(res2.body.customer_name).toBeUndefined();
            expect(res2.body.customer_email).toBeUndefined();
            expect(res2.body.total_spent).toBeUndefined();
            expect(res2.body.stripe_secret_key).toBeUndefined();

            // Assert revenue was only incremented once ($50.00)
            const pageCheck = await dbClient.query('SELECT revenue, sales_count FROM sales_pages WHERE id = $1', [salesPageId]);
            expect(Number(pageCheck.rows[0].revenue)).toBe(15499.50 + 50.00);
            expect(Number(pageCheck.rows[0].sales_count)).toBe(311);
        });

        it('enforces partial unique index on sales_orders.stripe_session_id in database', async () => {
            // Direct database insertion assertion for migration enforcement
            await dbClient.query(
                `INSERT INTO sales_orders (sales_page_id, customer_name, customer_email, amount, stripe_session_id)
                 VALUES ($1, 'Buyer 1', 'b1@example.com', 50.00, 'session_unique_test_123')`,
                [salesPageId]
            );

            // Attempting to insert duplicate non-null stripe_session_id must reject with unique constraint error
            await expect(
                dbClient.query(
                    `INSERT INTO sales_orders (sales_page_id, customer_name, customer_email, amount, stripe_session_id)
                     VALUES ($1, 'Buyer 2', 'b2@example.com', 50.00, 'session_unique_test_123')`,
                    [salesPageId]
                )
            ).rejects.toThrow();
        });

        it('returns generic 503 without leaking raw SQL or stack traces on internal errors', async () => {
            mockStripeSessionRetrieve.mockResolvedValueOnce({
                id: 'cs_test_mock_fail',
                status: 'complete',
                payment_status: 'paid',
                amount_total: 5000,
                currency: 'usd',
                customer_details: { email: 'buyer@example.com', name: 'Buyer' },
                metadata: {
                    sales_page_id: salesPageId,
                    variant: 'A',
                    expected_amount_cents: '5000',
                    expected_currency: 'USD'
                }
            });

            // 1. Mock db.query to return a complete synthetic sales-page row without calling original db.query
            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({
                rows: [{
                    id: salesPageId,
                    workspace_id: workspaceId,
                    title: 'Fungus No More Advanced Serum',
                    slug: testSlug,
                    headline: 'Restore Clear, Healthy Nails Fast',
                    price: '50.00',
                    currency: 'USD',
                    stripe_secret_key: 'sk_test_FAKE_SOCIALPULSE_TEST_ONLY',
                    use_live_payments: true,
                    is_ab_test: false,
                    variant_headline: null,
                    variant_price: null,
                }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: []
            } as any);

            // 2. Mock explicit pool.connect() to reject during transaction client acquisition
            const spyPoolConnect = jest.spyOn(pool, 'connect').mockRejectedValueOnce(new Error('FATAL: psql connection crash') as never);

            try {
                const res = await request
                    .post('/api/storefront/public/checkout')
                    .send({
                        sales_page_id: salesPageId,
                        stripe_session_id: 'cs_test_mock_fail'
                    });

                expect(res.status).toBe(503);
                expect(res.body.message).toBe('Unable to connect to database');
                expect(res.body.stack).toBeUndefined();
                expect(res.body.error).toBeUndefined();
            } finally {
                spyDbQuery.mockRestore();
                spyPoolConnect.mockRestore();
            }
        });
    });
});
