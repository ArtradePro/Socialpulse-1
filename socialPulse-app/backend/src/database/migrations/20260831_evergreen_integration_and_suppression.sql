-- Migration: 20260831_evergreen_integration_and_suppression.sql
-- Description: Adds tables for Evergreen OS signed HMAC events, multi-channel suppression lists, and compliance consent audit logs.

CREATE TABLE IF NOT EXISTS evergreen_inbound_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}',
    processed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'received',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evergreen_inbound_events_event_id ON evergreen_inbound_events(event_id);
CREATE INDEX IF NOT EXISTS idx_evergreen_inbound_events_workspace_id ON evergreen_inbound_events(workspace_id);

CREATE TABLE IF NOT EXISTS marketing_suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    reason VARCHAR(64) NOT NULL DEFAULT 'UNSUBSCRIBED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_suppression_workspace_channel_ident UNIQUE (workspace_id, channel, identifier)
);

CREATE INDEX IF NOT EXISTS idx_marketing_suppression_lookup ON marketing_suppression_list(workspace_id, channel, identifier);

CREATE TABLE IF NOT EXISTS marketing_consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    contact_identifier VARCHAR(255) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    lawful_basis VARCHAR(64) NOT NULL DEFAULT 'CONSENT',
    consent_version VARCHAR(64),
    ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_consent_contact ON marketing_consent_logs(workspace_id, contact_identifier);
