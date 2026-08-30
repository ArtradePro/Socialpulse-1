import { Request, Response } from 'express';
import { db, pool } from '../config/database';

const slugify = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start
        .replace(/-+$/, '');            // Trim - from end
};

// List sales pages for a workspace
export const listSalesPages = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        const { rows } = await db.query(
            `SELECT sp.*, p.title AS product_title
             FROM sales_pages sp
             LEFT JOIN products p ON p.id = sp.product_id
             WHERE sp.workspace_id = $1
             ORDER BY sp.created_at DESC`,
            [req.workspaceId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[SalesPages] listSalesPages error:', err);
        res.status(500).json({ message: 'Failed to load sales pages' });
    }
};

// Get single sales page
export const getSalesPage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        const { rows } = await db.query(
            `SELECT sp.*, p.title AS product_title
             FROM sales_pages sp
             LEFT JOIN products p ON p.id = sp.product_id
             WHERE sp.id = $1 AND sp.workspace_id = $2`,
            [id, req.workspaceId]
        );
        if (!rows[0]) {
            res.status(404).json({ message: 'Sales page not found' });
            return;
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[SalesPages] getSalesPage error:', err);
        res.status(500).json({ message: 'Failed to load sales page' });
    }
};

// Create sales page
export const createSalesPage = async (req: Request, res: Response): Promise<void> => {
    try {
                const { 
            title, product_id, theme, headline, description, features, price, currency, image_url, cta_text,
            stripe_secret_key, paypal_client_id, use_live_payments, meta_pixel_id, gtm_id,
            is_ab_test, variant_theme, variant_headline, variant_description, variant_price
        } = req.body;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        if (!title || !headline || !price) {
            res.status(400).json({ message: 'Title, headline, and price are required' });
            return;
        }

        let slug = slugify(title);
        const { rows: existing } = await db.query('SELECT 1 FROM sales_pages WHERE slug = $1', [slug]);
        if (existing.length > 0) {
            slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const { rows } = await db.query(
            `INSERT INTO sales_pages (
                workspace_id, title, slug, product_id, theme, headline, description, features, price, currency, image_url, cta_text,
                stripe_secret_key, paypal_client_id, use_live_payments, meta_pixel_id, gtm_id,
                is_ab_test, variant_theme, variant_headline, variant_description, variant_price
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
             RETURNING *`,
            [
                req.workspaceId,
                title,
                slug,
                product_id || null,
                theme || 'modern',
                headline,
                description || null,
                JSON.stringify(features || []),
                price,
                currency || 'USD',
                image_url || null,
                cta_text || 'Buy Now',
                stripe_secret_key || null,
                paypal_client_id || null,
                use_live_payments || false,
                meta_pixel_id || null,
                gtm_id || null,
                is_ab_test || false,
                variant_theme || 'dark-neon',
                variant_headline || null,
                variant_description || null,
                variant_price !== undefined ? variant_price : null
            ]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[SalesPages] createSalesPage error:', err);
        res.status(500).json({ message: 'Failed to create sales page' });
    }
};

// Update sales page
export const updateSalesPage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { 
            title, theme, headline, description, features, price, currency, image_url, cta_text,
            stripe_secret_key, paypal_client_id, use_live_payments, meta_pixel_id, gtm_id,
            is_ab_test, variant_theme, variant_headline, variant_description, variant_price
        } = req.body;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }

        const { rows } = await db.query(
            `UPDATE sales_pages
             SET title = COALESCE($1, title),
                 theme = COALESCE($2, theme),
                 headline = COALESCE($3, headline),
                 description = COALESCE($4, description),
                 features = COALESCE($5, features),
                 price = COALESCE($6, price),
                 currency = COALESCE($7, currency),
                 image_url = COALESCE($8, image_url),
                 cta_text = COALESCE($9, cta_text),
                 stripe_secret_key = COALESCE($10, stripe_secret_key),
                 paypal_client_id = COALESCE($11, paypal_client_id),
                 use_live_payments = COALESCE($12, use_live_payments),
                 meta_pixel_id = COALESCE($13, meta_pixel_id),
                 gtm_id = COALESCE($14, gtm_id),
                 is_ab_test = COALESCE($15, is_ab_test),
                 variant_theme = COALESCE($16, variant_theme),
                 variant_headline = COALESCE($17, variant_headline),
                 variant_description = COALESCE($18, variant_description),
                 variant_price = COALESCE($19, variant_price),
                 updated_at = NOW()
              WHERE id = $20 AND workspace_id = $21
              RETURNING *`,
            [
                title ?? null,
                theme ?? null,
                headline ?? null,
                description ?? null,
                features ? JSON.stringify(features) : null,
                price ?? null,
                currency ?? null,
                image_url ?? null,
                cta_text ?? null,
                stripe_secret_key ?? null,
                paypal_client_id ?? null,
                use_live_payments !== undefined ? use_live_payments : null,
                meta_pixel_id ?? null,
                gtm_id ?? null,
                is_ab_test !== undefined ? is_ab_test : null,
                variant_theme ?? null,
                variant_headline ?? null,
                variant_description ?? null,
                variant_price !== undefined ? variant_price : null,
                id,
                req.workspaceId
            ]
        );

        if (!rows[0]) {
            res.status(404).json({ message: 'Sales page not found' });
            return;
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[SalesPages] updateSalesPage error:', err);
        res.status(500).json({ message: 'Failed to update sales page' });
    }
};

// Delete sales page
export const deleteSalesPage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        const { rowCount } = await db.query(
            'DELETE FROM sales_pages WHERE id = $1 AND workspace_id = $2',
            [id, req.workspaceId]
        );
        if (!rowCount) {
            res.status(404).json({ message: 'Sales page not found' });
            return;
        }
        res.status(204).send();
    } catch (err) {
        console.error('[SalesPages] deleteSalesPage error:', err);
        res.status(500).json({ message: 'Failed to delete sales page' });
    }
};

// Get sales page by slug (Public API, increments visits count)
export const getSalesPageBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;
        if (!slug || typeof slug !== 'string') {
            res.status(400).json({ message: 'Invalid storefront identifier' });
            return;
        }

        // Query public presentation fields plus internal keys needed solely for logic (never returned)
        const { rows: pages } = await db.query(
            `SELECT id, title, slug, headline, description, features, price, currency,
                    image_url, cta_text, theme, meta_pixel_id, gtm_id, is_ab_test,
                    variant_theme, variant_headline, variant_description, variant_price,
                    use_live_payments, stripe_secret_key
             FROM sales_pages
             WHERE slug = $1`,
            [slug]
        );

        if (!pages[0]) {
            res.status(404).json({ message: 'Sales page not found' });
            return;
        }

        const page = pages[0];
        let assignedVariant: 'A' | 'B' = 'A';

        if (page.is_ab_test) {
            assignedVariant = Math.random() < 0.5 ? 'A' : 'B';
        }

        let activeTheme = page.theme || 'modern';
        let activeHeadline = page.headline;
        let activeDescription = page.description;
        let activePrice = Number(page.price);

        if (assignedVariant === 'B') {
            await db.query('UPDATE sales_pages SET variant_visits = variant_visits + 1 WHERE id = $1', [page.id]);
            activeTheme = page.variant_theme || page.theme || 'modern';
            activeHeadline = page.variant_headline || page.headline;
            activeDescription = page.variant_description || page.description;
            activePrice = (page.variant_price !== null && page.variant_price !== undefined && Number(page.variant_price) > 0)
                ? Number(page.variant_price)
                : Number(page.price);
        } else {
            await db.query('UPDATE sales_pages SET visits = visits + 1 WHERE id = $1', [page.id]);
        }

        // Parse features safely
        let parsedFeatures: string[] = [];
        if (typeof page.features === 'string') {
            try {
                parsedFeatures = JSON.parse(page.features);
            } catch {
                parsedFeatures = [];
            }
        } else if (Array.isArray(page.features)) {
            parsedFeatures = page.features;
        }

        // Build strict whitelist public presentation object (NO secrets, NO internal stats, NO workspace IDs)
        const publicPage = {
            id: page.id,
            title: page.title,
            slug: page.slug,
            headline: page.headline,
            description: page.description,
            features: parsedFeatures,
            price: Number(page.price),
            currency: (page.currency || 'USD').toUpperCase(),
            image_url: page.image_url || null,
            cta_text: page.cta_text || 'Buy Now',
            theme: page.theme || 'modern',
            meta_pixel_id: page.meta_pixel_id || null,
            gtm_id: page.gtm_id || null,
            is_ab_test: Boolean(page.is_ab_test),
            variant_theme: page.variant_theme || null,
            variant_headline: page.variant_headline || null,
            variant_description: page.variant_description || null,
            variant_price: page.variant_price !== null && page.variant_price !== undefined ? Number(page.variant_price) : null,
            active_theme: activeTheme,
            active_headline: activeHeadline,
            active_description: activeDescription,
            active_price: activePrice,
            assigned_variant: assignedVariant,
            has_live_payments: Boolean(page.use_live_payments && page.stripe_secret_key)
        };

        res.json(publicPage);
    } catch (err) {
        console.error('[SalesPages] getSalesPageBySlug error:', err);
        res.status(500).json({ message: 'Failed to fetch storefront page' });
    }
};

const ALLOWED_PRODUCTION_HOSTS = new Set([
    'usesocialpulse.com',
    'app.usesocialpulse.com',
    'socialpulse.app',
    'higiene.co.za',
    'fungusnomore.co.za',
    'fungusnomore.com'
]);

export function getSafeClientOrigin(): string | null {
    const rawUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL;
    if (!rawUrl) {
        if (process.env.NODE_ENV === 'production') {
            return null; // Fail closed in production if no client URL is configured
        }
        return 'http://localhost:3000';
    }

    try {
        const parsed = new URL(rawUrl);
        // Disallow fragments and credentials
        if (parsed.username || parsed.password || parsed.hash) {
            return null;
        }

        if (process.env.NODE_ENV === 'production') {
            if (parsed.protocol !== 'https:') {
                return null;
            }
            if (!ALLOWED_PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase())) {
                return null;
            }
            if (parsed.port && parsed.port !== '443') {
                return null;
            }
            return `${parsed.protocol}//${parsed.hostname}`;
        } else {
            // Local development / testing environments
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return null;
            }
            const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || ALLOWED_PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase());
            if (!isLocal) {
                return null;
            }
            return parsed.origin;
        }
    } catch {
        return null;
    }
}

// Process verified checkout order (Public API)
export const createCheckoutOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sales_page_id, customer_name, customer_email, variant_used, stripe_session_id } = req.body;

        if (!sales_page_id || typeof sales_page_id !== 'string') {
            res.status(400).json({ message: 'Valid sales_page_id is required' });
            return;
        }

        // Fetch sales page details from database
        const { rows: pages } = await db.query(
            `SELECT id, workspace_id, title, slug, headline, price, currency,
                    stripe_secret_key, use_live_payments,
                    is_ab_test, variant_headline, variant_price
             FROM sales_pages
             WHERE id = $1`,
            [sales_page_id]
        );

        if (!pages[0]) {
            res.status(404).json({ message: 'Sales page not found' });
            return;
        }
        const page = pages[0];

        // Fail-Closed: Both creation and completion require active live payments & credentials
        if (!page.use_live_payments || !page.stripe_secret_key) {
            res.status(400).json({ message: 'Live payment processing is not configured for this storefront' });
            return;
        }

        // CASE 1: Initiate Stripe Checkout Session (no session_id provided)
        if (!stripe_session_id) {
            if (!customer_email || typeof customer_email !== 'string' || !customer_email.includes('@')) {
                res.status(400).json({ message: 'Customer email is required to initiate checkout' });
                return;
            }

            // Validate and normalize initial variant selection
            const variant: 'A' | 'B' = (variant_used === 'B' && page.is_ab_test) ? 'B' : 'A';

            // Server-authoritative price & currency derivation
            let serverPrice = Number(page.price);
            if (variant === 'B' && page.variant_price !== null && page.variant_price !== undefined && Number(page.variant_price) > 0) {
                serverPrice = Number(page.variant_price);
            }

            if (!serverPrice || serverPrice <= 0 || isNaN(serverPrice)) {
                res.status(400).json({ message: 'Invalid configured storefront pricing' });
                return;
            }

            const serverCurrency = (page.currency || 'USD').toUpperCase();
            const unitAmountCents = Math.round(serverPrice * 100);

            // Derive safe redirect origin (never trusts arbitrary Origin header)
            const clientOrigin = getSafeClientOrigin();
            if (!clientOrigin) {
                res.status(500).json({ message: 'Invalid or unconfigured storefront redirect configuration' });
                return;
            }

            const Stripe = require('stripe');
            const stripeInstance = new Stripe(page.stripe_secret_key);

            const session = await stripeInstance.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: serverCurrency.toLowerCase(),
                        product_data: {
                            name: page.title,
                            description: page.headline
                        },
                        unit_amount: unitAmountCents,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                customer_email: customer_email,
                metadata: {
                    sales_page_id: page.id,
                    workspace_id: page.workspace_id,
                    variant: variant,
                    expected_amount_cents: String(unitAmountCents),
                    expected_currency: serverCurrency
                },
                // Clean success URL: contains only provider session ID and status indicator
                success_url: `${clientOrigin}/s/${page.slug}?checkout_status=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${clientOrigin}/s/${page.slug}?checkout_status=cancel`,
            });

            res.status(200).json({ stripe_checkout_url: session.url });
            return;
        }

        // CASE 2: Verify and Complete Order via Stripe Session ID
        const Stripe = require('stripe');
        const stripeInstance = new Stripe(page.stripe_secret_key);
        let session: any;

        try {
            session = await stripeInstance.checkout.sessions.retrieve(stripe_session_id);
        } catch (err: any) {
            console.error('[SalesPages] Stripe session retrieval failed:', err.message);
            res.status(400).json({ message: 'Invalid or expired payment session' });
            return;
        }

        if (!session) {
            res.status(400).json({ message: 'Payment session not found' });
            return;
        }

        // 1. Strict Status Verification: Must be both 'complete' and 'paid'
        if (session.status !== 'complete' || session.payment_status !== 'paid') {
            res.status(400).json({ message: 'Payment session is not complete or unpaid' });
            return;
        }

        // 2. Metadata binding: sales_page_id must match database page
        if (!session.metadata || session.metadata.sales_page_id !== page.id) {
            res.status(400).json({ message: 'Payment session does not match this storefront' });
            return;
        }

        // 3. Strict Metadata Variant & Authoritative Pricing Derivation (Do NOT trust req.body.variant_used)
        const sessionVariant = session.metadata.variant;
        if (sessionVariant !== 'A' && sessionVariant !== 'B') {
            res.status(400).json({ message: 'Invalid payment session variant metadata' });
            return;
        }

        if (sessionVariant === 'B' && !page.is_ab_test) {
            res.status(400).json({ message: 'Variant B is not valid for non-AB tested storefront' });
            return;
        }

        let authoritativePrice = Number(page.price);
        if (sessionVariant === 'B' && page.variant_price !== null && page.variant_price !== undefined && Number(page.variant_price) > 0) {
            authoritativePrice = Number(page.variant_price);
        }

        if (!authoritativePrice || authoritativePrice <= 0 || isNaN(authoritativePrice)) {
            res.status(400).json({ message: 'Invalid configured storefront pricing' });
            return;
        }

        const authoritativeAmountCents = Math.round(authoritativePrice * 100);
        const authoritativeCurrency = (page.currency || 'USD').toUpperCase();

        // 4. Expected Metadata Verification
        if (session.metadata.expected_amount_cents !== String(authoritativeAmountCents)) {
            res.status(400).json({ message: 'Session expected amount metadata mismatch' });
            return;
        }

        if (session.metadata.expected_currency !== authoritativeCurrency) {
            res.status(400).json({ message: 'Session expected currency metadata mismatch' });
            return;
        }

        // 5. Amount & Currency verification against provider session
        if (session.amount_total !== authoritativeAmountCents) {
            res.status(400).json({ message: 'Payment session amount does not match offer price' });
            return;
        }

        if (session.currency?.toUpperCase() !== authoritativeCurrency) {
            res.status(400).json({ message: 'Payment session currency mismatch' });
            return;
        }

        // 6. Strict Verified Identity from Stripe (NEVER fall back to req.body)
        const verifiedEmail = session.customer_details?.email || session.customer_email;
        if (!verifiedEmail || typeof verifiedEmail !== 'string' || !verifiedEmail.includes('@')) {
            res.status(400).json({ message: 'Verified customer email missing from payment provider' });
            return;
        }
        const verifiedName = session.customer_details?.name || 'Store Customer';

        // 7. Mandatory Real Database Transaction (Zero non-transactional fallback)
        if (!pool || typeof pool.connect !== 'function') {
            res.status(503).json({ message: 'Database connection pool unavailable' });
            return;
        }

        let client: any = null;
        try {
            client = await pool.connect();
        } catch (poolErr: any) {
            console.error('[SalesPages] DB pool connection failed:', poolErr.message);
            res.status(503).json({ message: 'Unable to connect to database' });
            return;
        }

        try {
            await client.query('BEGIN');

            // Idempotency check inside transaction
            const { rows: existingOrders } = await client.query(
                'SELECT id FROM sales_orders WHERE stripe_session_id = $1',
                [stripe_session_id]
            );
            if (existingOrders.length > 0) {
                await client.query('COMMIT');
                // Generic idempotent replay response: Zero customer data or financial info returned
                res.status(200).json({
                    message: 'Order already processed',
                    already_processed: true,
                    order_id: existingOrders[0].id
                });
                return;
            }

            // 1. Insert verified sales order (with ON CONFLICT safety against concurrent duplicates)
            const { rows: orderRows } = await client.query(
                `INSERT INTO sales_orders (sales_page_id, customer_name, customer_email, amount, currency, variant_used, stripe_session_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid')
                 ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
                 RETURNING id, sales_page_id, amount, currency, status, created_at`,
                [page.id, verifiedName, verifiedEmail, authoritativePrice, authoritativeCurrency, sessionVariant, stripe_session_id]
            );

            if (!orderRows[0]) {
                await client.query('COMMIT');
                res.status(200).json({
                    message: 'Order already processed',
                    already_processed: true
                });
                return;
            }

            // 2. Update sales page stats
            if (sessionVariant === 'B') {
                await client.query(
                    `UPDATE sales_pages
                     SET variant_sales_count = variant_sales_count + 1,
                         variant_revenue = variant_revenue + $1
                     WHERE id = $2`,
                    [authoritativePrice, page.id]
                );
            } else {
                await client.query(
                    `UPDATE sales_pages
                     SET sales_count = sales_count + 1,
                         revenue = revenue + $1
                     WHERE id = $2`,
                    [authoritativePrice, page.id]
                );
            }

            // 3. Upsert customer into CRM
            const { rows: customerRows } = await client.query(
                `INSERT INTO storefront_customers (workspace_id, name, email, total_orders, total_spent, last_order_at)
                 VALUES ($1, $2, $3, 1, $4, NOW())
                 ON CONFLICT (workspace_id, email)
                 DO UPDATE SET
                    total_orders = storefront_customers.total_orders + 1,
                    total_spent = storefront_customers.total_spent + EXCLUDED.total_spent,
                    last_order_at = NOW(),
                    name = EXCLUDED.name
                 RETURNING id`,
                [page.workspace_id, verifiedName, verifiedEmail, authoritativePrice]
            );

            // 4. Add automated internal confirmation record in customer CRM thread
            if (customerRows && customerRows[0]) {
                await client.query(
                    `INSERT INTO customer_messages (customer_id, sender, message)
                     VALUES ($1, 'USER', $2)`,
                    [customerRows[0].id, `🎉 Verified order recorded for ${authoritativePrice} ${authoritativeCurrency}.`]
                );
            }

            await client.query('COMMIT');

            // Safe, clean public response
            res.status(201).json({
                id: orderRows[0].id,
                sales_page_id: orderRows[0].sales_page_id,
                amount: orderRows[0].amount,
                currency: orderRows[0].currency,
                status: orderRows[0].status,
                created_at: orderRows[0].created_at
            });
        } catch (txErr: any) {
            await client.query('ROLLBACK');
            console.error('[SalesPages] Transaction execution error:', txErr);
            res.status(500).json({ message: 'Unable to complete payment verification' });
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('[SalesPages] createCheckoutOrder error:', err);
        res.status(500).json({ message: 'Unable to complete payment verification' });
    }
};

// List all sales orders for a workspace
export const listSalesOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        
        const { rows } = await db.query(
            `SELECT so.*, sp.title AS sales_page_title
             FROM sales_orders so
             INNER JOIN sales_pages sp ON sp.id = so.sales_page_id
             WHERE sp.workspace_id = $1
             ORDER BY so.created_at DESC`,
            [req.workspaceId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[SalesPages] listSalesOrders error:', err);
        res.status(500).json({ message: 'Failed to load storefront orders' });
    }
};
