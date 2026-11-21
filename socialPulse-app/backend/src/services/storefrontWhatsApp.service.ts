import { db } from '../config/database';

export interface WhatsAppOrderPayload {
    sales_page_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    delivery_address?: string;
    notes?: string;
    variant_used?: 'A' | 'B';
}

export interface CartPingPayload {
    sales_page_id: string;
    customer_phone?: string;
    customer_email?: string;
    customer_name?: string;
    step?: string;
}

export const storefrontWhatsAppService = {
    // Generate pre-formatted WhatsApp link for Higiene / Higienlabs
    generateOrderUrl: (params: {
        sellerPhone?: string;
        productTitle: string;
        price: number;
        currency: string;
        customerName: string;
        customerPhone: string;
        deliveryAddress?: string;
        notes?: string;
    }) => {
        // Default official Higiene / Higienlabs South Africa WhatsApp contact if not provided
        const rawSeller = params.sellerPhone || '27820000000'; // South Africa country code 27
        const cleanSeller = rawSeller.replace(/[^0-9]/g, '');

        const message = 
`*NEW ORDER INQUIRY — HIGIENE LABS* 🌿

Product: ${params.productTitle}
Total: ${params.currency} ${params.price} (Free Courier Delivery)

👤 *Customer Details:*
• Name: ${params.customerName}
• Phone: ${params.customerPhone}
• Delivery Address: ${params.deliveryAddress || 'To be confirmed in chat'}
${params.notes ? `• Special Notes: ${params.notes}` : ''}

Please confirm my order and send dispatch details.
_"Love The Skin You're In."*`;

        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${cleanSeller}?text=${encodedMessage}`;
    },

    // Record an initiated WhatsApp order
    recordWhatsAppOrder: async (payload: WhatsAppOrderPayload) => {
        const { sales_page_id, customer_name, customer_phone, customer_email, delivery_address, notes, variant_used = 'A' } = payload;

        // Fetch sales page details
        const { rows: pages } = await db.query(
            `SELECT id, workspace_id, title, price, currency, variant_price, is_ab_test 
             FROM sales_pages 
             WHERE id = $1`,
            [sales_page_id]
        );

        if (!pages[0]) {
            throw new Error('Sales page not found');
        }

        const page = pages[0];
        let amount = Number(page.price);
        if (variant_used === 'B' && page.is_ab_test && page.variant_price) {
            amount = Number(page.variant_price);
        }

        const cleanPhone = customer_phone.trim();
        const email = customer_email?.trim() || `${cleanPhone.replace(/[^0-9]/g, '')}@whatsapp.socialpulse.app`;

        // 1. Insert Sales Order with status 'whatsapp_pending'
        const { rows: orderRows } = await db.query(
            `INSERT INTO sales_orders (sales_page_id, customer_name, customer_email, amount, currency, variant_used, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'whatsapp_pending')
             RETURNING id, sales_page_id, amount, currency, status, created_at`,
            [page.id, customer_name, email, amount, page.currency, variant_used]
        );

        // 2. Upsert Customer in CRM
        const { rows: customerRows } = await db.query(
            `INSERT INTO storefront_customers (workspace_id, name, email, total_orders, total_spent, last_order_at)
             VALUES ($1, $2, $3, 1, $4, NOW())
             ON CONFLICT (workspace_id, email)
             DO UPDATE SET
                total_orders = storefront_customers.total_orders + 1,
                last_order_at = NOW(),
                name = EXCLUDED.name
             RETURNING id`,
            [page.workspace_id, customer_name, email, amount]
        );

        // 3. Record interaction in customer thread
        if (customerRows[0]) {
            await db.query(
                `INSERT INTO customer_messages (customer_id, sender, message)
                 VALUES ($1, 'CUSTOMER', $2)`,
                [
                    customerRows[0].id,
                    `📱 WhatsApp Order Initiated: ${page.title} (${page.currency} ${amount}). Phone: ${cleanPhone}. Address: ${delivery_address || 'Unspecified'}. ${notes ? `Notes: ${notes}` : ''}`
                ]
            );
        }

        // Generate the redirect link
        const whatsappUrl = storefrontWhatsAppService.generateOrderUrl({
            productTitle: page.title,
            price: amount,
            currency: page.currency,
            customerName: customer_name,
            customerPhone: cleanPhone,
            deliveryAddress: delivery_address,
            notes
        });

        return {
            order: orderRows[0],
            whatsappUrl,
            message: 'WhatsApp order logged successfully'
        };
    },

    // Record cart ping for abandonment tracking
    recordCartPing: async (payload: CartPingPayload) => {
        const { sales_page_id, customer_phone, customer_email, customer_name, step = 'cart_initiated' } = payload;
        if (!customer_phone && !customer_email) {
            return { recorded: false, reason: 'No contact info provided' };
        }

        const { rows: pages } = await db.query(
            `SELECT id, workspace_id, title, price, currency FROM sales_pages WHERE id = $1`,
            [sales_page_id]
        );
        if (!pages[0]) return { recorded: false, reason: 'Page not found' };

        const page = pages[0];
        const rawContact = customer_email || customer_phone || 'guest';
        const cleanEmail = customer_email?.trim() || `${customer_phone?.replace(/[^0-9]/g, '')}@lead.socialpulse.app`;
        const name = customer_name?.trim() || 'Storefront Visitor';

        // Upsert customer as lead
        const { rows: customerRows } = await db.query(
            `INSERT INTO storefront_customers (workspace_id, name, email, total_orders, total_spent, last_order_at)
             VALUES ($1, $2, $3, 0, 0, NOW())
             ON CONFLICT (workspace_id, email)
             DO UPDATE SET last_order_at = NOW()
             RETURNING id`,
            [page.workspace_id, name, cleanEmail]
        );

        if (customerRows[0]) {
            await db.query(
                `INSERT INTO customer_messages (customer_id, sender, message)
                 VALUES ($1, 'USER', $2)`,
                [
                    customerRows[0].id,
                    `🛒 [Cart Ping] Visitor initiated checkout step '${step}' for ${page.title}. Phone: ${customer_phone || 'None'}`
                ]
            );
        }

        return { recorded: true, customerId: customerRows[0]?.id };
    },

    // Get abandoned carts for workspace with pre-formatted recovery messages
    getAbandonedCarts: async (workspace_id: string) => {
        // Query recent cart pings or orders that remained in 'whatsapp_pending' or unpurchased
        const { rows: carts } = await db.query(
            `SELECT so.id AS order_id, so.customer_name, so.customer_email, so.amount, so.currency, 
                    so.status, so.created_at, sp.title AS product_title, sp.slug AS page_slug
             FROM sales_orders so
             JOIN sales_pages sp ON sp.id = so.sales_page_id
             WHERE sp.workspace_id = $1
               AND so.status = 'whatsapp_pending'
               AND so.created_at >= NOW() - INTERVAL '7 days'
             ORDER BY so.created_at DESC
             LIMIT 50`,
            [workspace_id]
        );

        return carts.map(cart => {
            const rawPhone = cart.customer_email.includes('@whatsapp.socialpulse.app')
                ? cart.customer_email.split('@')[0]
                : '';
            
            const recoveryMessage = encodeURIComponent(
`Hi ${cart.customer_name}! 👋 
We noticed you started an order for ${cart.product_title} at Higiene Labs. 

To help you get started, we're giving you an extra *10% OFF + Free Express Courier Delivery*! 📦
Reply 'YES' to confirm your order or complete it online here: https://fungusnomore.co.za

_"Love The Skin You're In."*`
            );

            return {
                ...cart,
                detected_phone: rawPhone,
                recovery_whatsapp_url: rawPhone ? `https://wa.me/${rawPhone}?text=${recoveryMessage}` : null
            };
        });
    }
};
