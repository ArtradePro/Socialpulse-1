-- Migration: Add unique partial index for sales_orders.stripe_session_id to enforce payment idempotency
-- Phase SP-1B: Public Storefront & Payment Containment

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_stripe_session_id_unique
ON sales_orders(stripe_session_id)
WHERE stripe_session_id IS NOT NULL;
