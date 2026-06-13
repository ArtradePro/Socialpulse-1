import { Request, Response } from 'express';
import { db } from '../config/database';

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
        
        const { rows: pages } = await db.query('SELECT * FROM sales_pages WHERE slug = $1', [slug]);
        if (!pages[0]) {
            res.status(404).json({ message: 'Sales page not found' });
            return;
        }

        const page = pages[0];
        let assignedVariant = 'A';

        if (page.is_ab_test) {
            assignedVariant = Math.random() < 0.5 ? 'A' : 'B';
        }

        if (assignedVariant === 'B') {
            await db.query('UPDATE sales_pages SET variant_visits = variant_visits + 1 WHERE id = $1', [page.id]);
            page.variant_visits += 1;
            page.active_theme = page.variant_theme || page.theme;
            page.active_headline = page.variant_headline || page.headline;
            page.active_description = page.variant_description || page.description;
            page.active_price = page.variant_price !== null && page.variant_price !== undefined ? page.variant_price : page.price;
        } else {
            await db.query('UPDATE sales_pages SET visits = visits + 1 WHERE id = $1', [page.id]);
            page.visits += 1;
            page.active_theme = page.theme;
            page.active_headline = page.headline;
            page.active_description = page.description;
            page.active_price = page.price;
        }

        res.json({
            ...page,
            assigned_variant: assignedVariant
        });
    } catch (err) {
        console.error('[SalesPages] getSalesPageBySlug error:', err);
        res.status(500).json({ message: 'Failed to fetch storefront page' });
    }
};

// Process mock or live checkout order (Public API)
export const createCheckoutOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sales_page_id, customer_name, customer_email, amount, currency, variant_used, stripe_session_id } = req.body;
        if (!sales_page_id || !customer_name || !customer_email || !amount) {
            res.status(400).json({ message: 'All order details are required' });
            return;
        }

        // Fetch sales page details
        const { rows: pages } = await db.query('SELECT * FROM sales_pages WHERE id = $1', [sales_page_id]);
        if (!pages[0]) {
            res.status(404).json({ message: 'Sales page not found' });
            return;
        }
        const page = pages[0];

        // If Stripe checkout redirect is needed and not yet paid
        if (page.use_live_payments && page.stripe_secret_key && !stripe_session_id) {
            const Stripe = require('stripe');
            const stripeInstance = new Stripe(page.stripe_secret_key);
            
            const session = await stripeInstance.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: currency || 'usd',
                        product_data: {
                            name: page.title,
                            description: page.active_headline || page.headline
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                customer_email: customer_email,
                success_url: `${req.headers.origin || 'http://localhost:3000'}/s/${page.slug}?checkout_status=success&session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(customer_email)}&name=${encodeURIComponent(customer_name)}&amount=${amount}&variant=${variant_used || 'A'}`,
                cancel_url: `${req.headers.origin || 'http://localhost:3000'}/s/${page.slug}?checkout_status=cancel`,
            });
            
            res.status(200).json({ stripe_checkout_url: session.url });
            return;
        }

        // Avoid duplicate logging for Stripe redirects
        if (stripe_session_id) {
            const { rows: existing } = await db.query('SELECT 1 FROM sales_orders WHERE stripe_session_id = $1', [stripe_session_id]);
            if (existing.length > 0) {
                res.status(200).json({ message: 'Order already recorded' });
                return;
            }
        }

        // Insert new sales order
        const { rows: orderRows } = await db.query(
            `INSERT INTO sales_orders (sales_page_id, customer_name, customer_email, amount, currency, variant_used, stripe_session_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [sales_page_id, customer_name, customer_email, amount, currency || 'USD', variant_used || 'A', stripe_session_id || null]
        );

        // Update sales page stats
        if (variant_used === 'B') {
            await db.query(
                `UPDATE sales_pages
                 SET variant_sales_count = variant_sales_count + 1,
                     variant_revenue = variant_revenue + $1
                 WHERE id = $2`,
                [amount, sales_page_id]
            );
        } else {
            await db.query(
                `UPDATE sales_pages
                 SET sales_count = sales_count + 1,
                     revenue = revenue + $1
                 WHERE id = $2`,
                [amount, sales_page_id]
            );
        }

        // Upsert customer into CRM
        const { rows: customerRows } = await db.query(
            `INSERT INTO storefront_customers (workspace_id, name, email, total_orders, total_spent, last_order_at)
             VALUES ($1, $2, $3, 1, $4, NOW())
             ON CONFLICT (workspace_id, email) 
             DO UPDATE SET 
                total_orders = storefront_customers.total_orders + 1,
                total_spent = storefront_customers.total_spent + EXCLUDED.total_spent,
                last_order_at = NOW(),
                name = EXCLUDED.name
             RETURNING *`,
            [page.workspace_id, customer_name, customer_email, amount]
        );

        // Add automated welcome/order update message in CRM chat
        await db.query(
            `INSERT INTO customer_messages (customer_id, sender, message)
             VALUES ($1, 'USER', $2)`,
            [customerRows[0].id, `🎉 Thank you for your order, ${customer_name}! Your purchase of ${amount} ${currency || 'USD'} has been successfully processed.`]
        );

        res.status(201).json(orderRows[0]);
    } catch (err) {
        console.error('[SalesPages] createCheckoutOrder error:', err);
        res.status(500).json({ message: 'Failed to process payment' });
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
