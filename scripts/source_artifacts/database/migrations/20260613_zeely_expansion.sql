-- Storefront CRM Customers
CREATE TABLE IF NOT EXISTS storefront_customers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    total_orders   INTEGER DEFAULT 0,
    total_spent    DECIMAL(12, 2) DEFAULT 0.00,
    last_order_at  TIMESTAMP DEFAULT NOW(),
    created_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

-- Customer Chat Messages
CREATE TABLE IF NOT EXISTS customer_messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    UUID NOT NULL REFERENCES storefront_customers(id) ON DELETE CASCADE,
    sender         VARCHAR(50) NOT NULL, -- 'CUSTOMER' or 'USER'
    message        TEXT NOT NULL,
    created_at     TIMESTAMP DEFAULT NOW()
);

-- Alter Sales Pages to support payments, tracking pixels, and A/B testing
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT;
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS paypal_client_id TEXT;
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS use_live_payments BOOLEAN DEFAULT FALSE;

ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS meta_pixel_id VARCHAR(50);
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS gtm_id VARCHAR(50);

ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS is_ab_test BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS variant_theme VARCHAR(50) DEFAULT 'dark-neon';
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS variant_headline VARCHAR(255);
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS variant_description TEXT;
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS variant_price DECIMAL(12, 2);

ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS variant_visits INTEGER DEFAULT 0;
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS variant_sales_count INTEGER DEFAULT 0;
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS variant_revenue DECIMAL(12, 2) DEFAULT 0.00;

-- Alter Sales Orders to log variant used
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS variant_used VARCHAR(10) DEFAULT 'A'; -- 'A' or 'B'
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_storefront_customers_ws ON storefront_customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_customer_messages_cust ON customer_messages(customer_id);
