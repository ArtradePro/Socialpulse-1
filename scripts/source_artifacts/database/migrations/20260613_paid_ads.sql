-- Migration: Paid Ad Campaigns and AI Generated Avatar Videos

-- Paid Ads Campaigns Table
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    objective      VARCHAR(50) NOT NULL, -- 'TRAFFIC', 'LEADS', 'SALES'
    budget_type    VARCHAR(20) NOT NULL, -- 'DAILY', 'LIFETIME'
    budget_amount  DECIMAL(12, 2) NOT NULL,
    platforms      TEXT[] NOT NULL, -- '{facebook, instagram}'
    status         VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'
    target_url     TEXT NOT NULL,
    ad_copy        TEXT,
    media_url      TEXT,
    product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
    impressions    INTEGER DEFAULT 0,
    clicks         INTEGER DEFAULT 0,
    conversions    INTEGER DEFAULT 0,
    spend          DECIMAL(12, 2) DEFAULT 0.00,
    start_date     TIMESTAMP,
    end_date       TIMESTAMP,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW()
);

-- AI Generated Videos Table
CREATE TABLE IF NOT EXISTS generated_videos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    script         TEXT NOT NULL,
    avatar_style   VARCHAR(100) NOT NULL,
    voice_style    VARCHAR(100) NOT NULL,
    video_url      TEXT NOT NULL,
    created_at     TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_ws  ON ad_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gen_videos_ws    ON generated_videos(workspace_id);

-- Auto-update triggers
CREATE OR REPLACE TRIGGER trg_ad_campaigns_updated_at
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
