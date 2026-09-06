-- Migration: 20260831_claims_library_and_brand_governance.sql
-- Description: Creates claims_library table and adds brand governance columns to workspaces.

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_type VARCHAR(32) DEFAULT 'GENERAL';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS restricted_slogans TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS claims_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    claim_category VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    status VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    disclaimer_required BOOLEAN NOT NULL DEFAULT false,
    disclaimer_text TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_library_workspace ON claims_library(workspace_id, status);
