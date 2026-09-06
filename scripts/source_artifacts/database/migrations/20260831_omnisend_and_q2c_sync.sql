-- Migration: 20260831_omnisend_and_q2c_sync.sql
-- Description: Creates tables for Omnisend omnichannel integrations and Quote2ContractPro sync tracking.

CREATE TABLE IF NOT EXISTS omnisend_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_encrypted TEXT NOT NULL,
    brand_name VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS q2c_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    direction VARCHAR(16) NOT NULL, -- 'INBOUND' or 'OUTBOUND'
    entity_type VARCHAR(32) NOT NULL, -- 'LEAD', 'DEAL', 'QUOTE', 'CONTRACT'
    external_id VARCHAR(128),
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_q2c_sync_workspace ON q2c_sync_logs(workspace_id, entity_type);
