-- Migration: Brandwatch Intelligence Upgrades (Social Listening Boolean/Sentiment/Crisis + Unified Inbox VIP/Sentiment + Competitive Benchmarking)

-- 1. Listening Rules & Results upgrades
ALTER TABLE listening_rules
    ADD COLUMN IF NOT EXISTS query_type VARCHAR(20) DEFAULT 'keyword',
    ADD COLUMN IF NOT EXISTS exclude_keywords TEXT[] DEFAULT '{}';

ALTER TABLE listening_results
    ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'neutral',
    ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(4,2) DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS author_followers INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listening_results_sentiment ON listening_results (sentiment);

-- 2. Unified Inbox upgrades
ALTER TABLE inbox_messages
    ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'neutral',
    ADD COLUMN IF NOT EXISTS author_followers INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_vip ON inbox_messages (is_vip) WHERE is_vip = true;
CREATE INDEX IF NOT EXISTS idx_inbox_messages_sentiment ON inbox_messages (sentiment);

-- 3. Competitive Benchmarking Table
CREATE TABLE IF NOT EXISTS competitor_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    competitor_name VARCHAR(100) NOT NULL,
    handle VARCHAR(100),
    share_of_voice_pct NUMERIC(5,2) DEFAULT 0.0,
    mentions_count INTEGER DEFAULT 0,
    sentiment_score NUMERIC(4,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(workspace_id, competitor_name)
);

CREATE INDEX IF NOT EXISTS idx_comp_benchmarks_workspace ON competitor_benchmarks (workspace_id);
