-- Migration: Add Omnichannel Marketing Automation Engine tables (Phase 1)

-- 1. marketing_contacts table
CREATE TABLE IF NOT EXISTS marketing_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_subscribed_email BOOLEAN DEFAULT true,
    is_subscribed_sms BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

-- 2. marketing_campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms')),
    subject_line VARCHAR(255),
    body_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed')),
    scheduled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. marketing_automations table
CREATE TABLE IF NOT EXISTS marketing_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(255) NOT NULL,
    logic_payload JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true
);

-- 4. marketing_delivery_logs table
CREATE TABLE IF NOT EXISTS marketing_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES marketing_contacts(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
    error_message TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for workspace / tenant scoping performance
CREATE INDEX IF NOT EXISTS idx_mkt_contacts_tenant ON marketing_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_tenant ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mkt_automations_tenant ON marketing_automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mkt_delivery_logs_campaign ON marketing_delivery_logs(campaign_id);
