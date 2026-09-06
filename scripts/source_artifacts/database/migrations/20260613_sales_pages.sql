-- Migration: AI Mobile Sales Pages & Storefront Checkout Tables

-- Sales Pages Table
CREATE TABLE IF NOT EXISTS sales_pages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    slug           VARCHAR(100) UNIQUE NOT NULL,
    product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
    theme          VARCHAR(50) DEFAULT 'modern', -- 'modern', 'dark-neon', 'glassmorphism'
    headline       VARCHAR(255) NOT NULL,
    description    TEXT,
    features       JSONB DEFAULT '[]', -- benefit bullet points
    price          DECIMAL(12, 2) NOT NULL,
    currency       VARCHAR(10) DEFAULT 'USD',
    image_url      TEXT,
    cta_text       VARCHAR(50) DEFAULT 'Buy Now',
    visits         INTEGER DEFAULT 0,
    sales_count    INTEGER DEFAULT 0,
    revenue        DECIMAL(12, 2) DEFAULT 0.00,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW()
);

-- Storefront Orders Table
CREATE TABLE IF NOT EXISTS sales_orders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_page_id  UUID NOT NULL REFERENCES sales_pages(id) ON DELETE CASCADE,
    customer_name  VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    amount         DECIMAL(12, 2) NOT NULL,
    currency       VARCHAR(10) DEFAULT 'USD',
    status         VARCHAR(50) DEFAULT 'paid', -- 'paid', 'pending'
    created_at     TIMESTAMP DEFAULT NOW()
);

-- Indexes for search performance and workspace isolation
CREATE INDEX IF NOT EXISTS idx_sales_pages_ws   ON sales_pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sales_pages_slug ON sales_pages(slug);
CREATE INDEX IF NOT EXISTS idx_sales_orders_pg  ON sales_orders(sales_page_id);

-- Auto-update trigger for updated_at column
CREATE OR REPLACE TRIGGER trg_sales_pages_updated_at
  BEFORE UPDATE ON sales_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
