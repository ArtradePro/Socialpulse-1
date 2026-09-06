-- E-commerce Schema Migration

-- E-commerce Stores Table
CREATE TABLE IF NOT EXISTS ecommerce_stores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform        VARCHAR(50) NOT NULL, -- 'woocommerce', 'shopify', 'amazon', 'takealot'
    name            VARCHAR(255) NOT NULL,
    api_url         TEXT,
    api_key         TEXT,
    api_secret      TEXT,
    status          VARCHAR(50) DEFAULT 'active', -- active, inactive, error
    last_sync_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES ecommerce_stores(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    external_id     VARCHAR(255) NOT NULL, -- Platform specific ID
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    price           DECIMAL(12, 2),
    currency        VARCHAR(10) DEFAULT 'ZAR',
    image_url       TEXT,
    product_url     TEXT NOT NULL,
    category        VARCHAR(255),
    tags            TEXT[] DEFAULT '{}',
    status          VARCHAR(50) DEFAULT 'active', -- publish, draft, out_of_stock
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (store_id, external_id)
);

-- E-commerce Automations Table
CREATE TABLE IF NOT EXISTS ecommerce_automations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES ecommerce_stores(id) ON DELETE CASCADE,
    trigger_type    VARCHAR(50) NOT NULL, -- 'new_product', 'price_change', 'back_in_stock'
    action_type     VARCHAR(50) NOT NULL, -- 'create_draft', 'auto_publish'
    template_id     UUID REFERENCES templates(id) ON DELETE SET NULL,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ecommerce_stores_workspace ON ecommerce_stores(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_store             ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_workspace         ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_automations_ws   ON ecommerce_automations(workspace_id);

-- Auto-update triggers
CREATE OR REPLACE TRIGGER trg_ecommerce_stores_updated_at
  BEFORE UPDATE ON ecommerce_stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_ecommerce_automations_updated_at
  BEFORE UPDATE ON ecommerce_automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
