-- Migration: Add missing workspace_id columns to rss_feeds & listening_rules,
-- and create Lead Scraper & B2B Automation workflow tables.

-- 1. Ensure workspace_id exists on rss_feeds and listening_rules
ALTER TABLE rss_feeds       ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE listening_rules ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rss_feeds_workspace       ON rss_feeds(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listening_rules_workspace ON listening_rules(workspace_id) WHERE workspace_id IS NOT NULL;

-- 2. Lead Scraper & B2B Automation tables
CREATE TABLE IF NOT EXISTS scrape_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    query           TEXT NOT NULL,
    location        TEXT,
    limit_count     INTEGER DEFAULT 20,
    status          VARCHAR(50) DEFAULT 'PENDING',
    schedule        VARCHAR(100),
    leads_found     INTEGER DEFAULT 0,
    leads_ingested  INTEGER DEFAULT 0,
    error_message   TEXT,
    last_run_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scrape_tasks_workspace ON scrape_tasks(workspace_id);

CREATE TABLE IF NOT EXISTS scraped_leads (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    business_name     VARCHAR(255),
    email             VARCHAR(255),
    phone             VARCHAR(100),
    address           TEXT,
    city              VARCHAR(150),
    category          VARCHAR(150),
    rating            NUMERIC(3,2),
    reviews_count     INTEGER DEFAULT 0,
    website           TEXT,
    competitor_rating NUMERIC(3,2),
    status            VARCHAR(50) DEFAULT 'SCRAPED',
    tag_applied       VARCHAR(100),
    crm_lead_id       VARCHAR(255),
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_workspace ON scraped_leads(workspace_id);

CREATE TABLE IF NOT EXISTS automation_workflows (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL DEFAULT 'LEAD_SCRAPED',
    is_active    BOOLEAN DEFAULT true,
    steps        JSONB DEFAULT '[]'::jsonb,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_workspace ON automation_workflows(workspace_id);

CREATE TABLE IF NOT EXISTS automation_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    workflow_id     UUID REFERENCES automation_workflows(id) ON DELETE CASCADE,
    scraped_lead_id UUID REFERENCES scraped_leads(id) ON DELETE CASCADE,
    current_step    INTEGER DEFAULT 0,
    execute_at      TIMESTAMP DEFAULT NOW(),
    status          VARCHAR(50) DEFAULT 'PENDING',
    logs            JSONB DEFAULT '[]'::jsonb,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_queue_workspace ON automation_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_queue_status    ON automation_queue(status, execute_at);

CREATE TABLE IF NOT EXISTS automation_activity_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    task_name    VARCHAR(150),
    level        VARCHAR(32) DEFAULT 'INFO',
    message      TEXT NOT NULL,
    details      JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_workspace ON automation_activity_logs(workspace_id);

CREATE TABLE IF NOT EXISTS buyer_personas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    industry     VARCHAR(255),
    role         VARCHAR(255),
    pain_points  TEXT,
    tone         VARCHAR(100),
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buyer_personas_workspace ON buyer_personas(workspace_id);
