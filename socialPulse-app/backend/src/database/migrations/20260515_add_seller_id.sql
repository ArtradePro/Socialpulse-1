-- Migration to add seller_id to ecommerce_stores
ALTER TABLE ecommerce_stores ADD COLUMN IF NOT EXISTS seller_id VARCHAR(100);
