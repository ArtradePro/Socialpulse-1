-- SocialPulse Database Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name     VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    plan          VARCHAR(50)  DEFAULT 'free',
    ai_credits    INTEGER      DEFAULT 10,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- Social Accounts Table
CREATE TABLE IF NOT EXISTS social_accounts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
    platform          VARCHAR(50)  NOT NULL,
    platform_user_id  VARCHAR(255) NOT NULL,
    username          VARCHAR(255) NOT NULL,
    access_token      TEXT         NOT NULL,
    refresh_token     TEXT,
    token_expires_at  TIMESTAMP,
    profile_image     TEXT,
    followers_count   INTEGER      DEFAULT 0,
    is_active         BOOLEAN      DEFAULT true,
    created_at        TIMESTAMP    DEFAULT NOW(),
    UNIQUE (user_id, platform)
);

-- Posts Table
CREATE TABLE IF NOT EXISTS posts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    content       TEXT         NOT NULL,
    media_urls    JSONB        DEFAULT '[]',
    hashtags      TEXT[],
    platforms     TEXT[]       NOT NULL,
    status        VARCHAR(50)  DEFAULT 'draft',
    scheduled_at  TIMESTAMP,
    published_at  TIMESTAMP,
    ai_generated  BOOLEAN      DEFAULT false,
    campaign_id   UUID,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- Post Analytics Table
CREATE TABLE IF NOT EXISTS post_analytics (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id          UUID REFERENCES posts(id) ON DELETE CASCADE,
    platform         VARCHAR(50)    NOT NULL,
    platform_post_id VARCHAR(255),
    likes            INTEGER        DEFAULT 0,
    comments         INTEGER        DEFAULT 0,
    shares           INTEGER        DEFAULT 0,
    impressions      INTEGER        DEFAULT 0,
    reach            INTEGER        DEFAULT 0,
    clicks           INTEGER        DEFAULT 0,
    engagement_rate  DECIMAL(5,2)   DEFAULT 0.00,
    synced_at        TIMESTAMP      DEFAULT NOW(),
    UNIQUE (post_id, platform)
);

-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    start_date  DATE,
    end_date    DATE,
    status      VARCHAR(50)  DEFAULT 'active',
    created_at  TIMESTAMP    DEFAULT NOW()
);

-- Templates Table
CREATE TABLE IF NOT EXISTS templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    name        VARCHAR(255) NOT NULL,
    content     TEXT         NOT NULL,
    category    VARCHAR(100),
    platforms   TEXT[],
    is_public   BOOLEAN      DEFAULT false,
    created_at  TIMESTAMP    DEFAULT NOW()
);

-- Hashtag Sets Table
CREATE TABLE IF NOT EXISTS hashtag_sets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    hashtags   TEXT[]       NOT NULL,
    created_at TIMESTAMP    DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id  ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id            ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status             ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at       ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_posts_campaign_id        ON posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id   ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id        ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id        ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_hashtag_sets_user_id     ON hashtag_sets(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- media_files: tracks every uploaded asset
CREATE TABLE IF NOT EXISTS media_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    original_name   VARCHAR(255)  NOT NULL,
    file_name       VARCHAR(255)  NOT NULL,
    mime_type       VARCHAR(100)  NOT NULL,
    size_bytes      BIGINT        NOT NULL,
    width           INTEGER,
    height          INTEGER,
    duration_secs   NUMERIC(8,2),          -- video/audio
    provider        VARCHAR(20)   NOT NULL, -- 's3' | 'cloudinary'
    provider_id     VARCHAR(512),           -- cloudinary public_id or S3 key
    url             TEXT          NOT NULL,
    thumbnail_url   TEXT,
    folder          VARCHAR(255)  DEFAULT 'uploads',
    tags            TEXT[]        DEFAULT '{}',
    is_deleted      BOOLEAN       DEFAULT false,
    created_at      TIMESTAMP     DEFAULT NOW(),
    updated_at      TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_user    ON media_files(user_id);
CREATE INDEX IF NOT EXISTS idx_media_mime    ON media_files(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_created ON media_files(created_at DESC);

CREATE OR REPLACE TRIGGER trg_media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- stripe_customers: 1-to-1 with users
CREATE TABLE IF NOT EXISTS stripe_customers (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id     VARCHAR(255) UNIQUE NOT NULL,
    stripe_subscription_id VARCHAR(255),
    stripe_price_id        VARCHAR(255),
    status                 VARCHAR(50)  DEFAULT 'inactive',
                                        -- inactive | trialing | active | past_due | canceled
    current_period_end     TIMESTAMP,
    cancel_at_period_end   BOOLEAN      DEFAULT false,
    created_at             TIMESTAMP    DEFAULT NOW(),
    updated_at             TIMESTAMP    DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- usage_events: lightweight counters reset monthly
CREATE TABLE IF NOT EXISTS usage_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL, -- 'post_published' | 'ai_credit_used' | 'media_uploaded'
    quantity    INTEGER     DEFAULT 1,
    recorded_at TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_type ON usage_events(user_id, event_type, recorded_at DESC);

-- password_reset_tokens: short-lived tokens for /auth/forgot-password flow
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used       BOOLEAN   DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_tokens(token_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- Priority-2 tables
-- ─────────────────────────────────────────────────────────────────────────────

-- teams: a workspace shared by multiple users
CREATE TABLE IF NOT EXISTS teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    owner_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- team_members: user membership + role inside a team
CREATE TABLE IF NOT EXISTS team_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) DEFAULT 'member', -- owner | admin | member | viewer
    invited_by UUID REFERENCES users(id),
    accepted   BOOLEAN   DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

-- team_invites: pending email invitations
CREATE TABLE IF NOT EXISTS team_invites (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID REFERENCES teams(id) ON DELETE CASCADE,
    email      VARCHAR(255) NOT NULL,
    role       VARCHAR(20) DEFAULT 'member',
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    accepted   BOOLEAN   DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner       ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_hash ON team_invites(token_hash);

-- notifications: in-app notification feed
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
                -- post_published | post_failed | ai_credits_low
                -- storage_near_limit | trial_ending | team_invite
    title      VARCHAR(255) NOT NULL,
    message    TEXT,
    link       TEXT,       -- optional deep-link into the app
    read       BOOLEAN   DEFAULT false,
    metadata   JSONB     DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read, created_at DESC);

-- Add campaign_id FK to posts now that campaigns table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_posts_campaign'
    ) THEN
        ALTER TABLE posts ADD CONSTRAINT fk_posts_campaign
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Notification preferences per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    notification_prefs JSONB DEFAULT '{"postFailed":true,"paymentFailed":true,"trialEnding":true,"weeklyDigest":false}';

-- ─── P3: RSS Auto-posting ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rss_feeds (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    url              TEXT        NOT NULL,
    platforms        TEXT[]      NOT NULL DEFAULT '{}',
    auto_post        BOOLEAN     NOT NULL DEFAULT false,
    interval_hours   INTEGER     NOT NULL DEFAULT 24,
    last_fetched_at  TIMESTAMP,
    is_active        BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON rss_feeds(user_id);

CREATE TABLE IF NOT EXISTS rss_entries (
    id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id    UUID      NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
    guid       TEXT      NOT NULL,
    title      TEXT,
    url        TEXT,
    posted     BOOLEAN   NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (feed_id, guid)
);
CREATE INDEX IF NOT EXISTS idx_rss_entries_feed ON rss_entries(feed_id);

-- ─── P3: Public API Keys ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    key_hash     VARCHAR(64) NOT NULL UNIQUE,
    key_prefix   VARCHAR(12) NOT NULL,
    last_used_at TIMESTAMP,
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- ─── P3: Social Listening ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listening_rules (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword    VARCHAR(255) NOT NULL,
    platforms  TEXT[]      NOT NULL DEFAULT '{twitter}',
    is_active  BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listening_rules_user ON listening_rules(user_id);

CREATE TABLE IF NOT EXISTS listening_results (
    id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id          UUID      NOT NULL REFERENCES listening_rules(id) ON DELETE CASCADE,
    platform         VARCHAR(50) NOT NULL,
    external_id      TEXT      NOT NULL,
    author_name      TEXT,
    author_handle    TEXT,
    author_avatar    TEXT,
    content          TEXT,
    url              TEXT,
    likes            INTEGER   DEFAULT 0,
    reposts          INTEGER   DEFAULT 0,
    published_at     TIMESTAMP,
    fetched_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE (rule_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_listening_results_rule ON listening_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_listening_results_fetched ON listening_results(fetched_at DESC);

-- ─── P3: Unified Inbox ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_messages (
    id             UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform       VARCHAR(50) NOT NULL,
    type           VARCHAR(50) NOT NULL,  -- mention | comment | dm
    external_id    TEXT      NOT NULL,
    author_name    TEXT,
    author_handle  TEXT,
    author_avatar  TEXT,
    content        TEXT,
    url            TEXT,
    is_read        BOOLEAN   NOT NULL DEFAULT false,
    published_at   TIMESTAMP,
    created_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, platform, external_id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_messages(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_messages(created_at DESC);

-- ─── P3: Referral System ─────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16) UNIQUE;

CREATE TABLE IF NOT EXISTS referrals (
    id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id     UUID      REFERENCES users(id) ON DELETE SET NULL,
    code            VARCHAR(16) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | completed
    reward_credits  INTEGER   NOT NULL DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    completed_at    TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);

-- ─── Multi-Workspace Support ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
    id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE,
    logo_url    TEXT,
    owner_id    UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

CREATE TABLE IF NOT EXISTS workspace_members (
    id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID      NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL DEFAULT 'member', -- owner|admin|member|viewer
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user     ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
    id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID      NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'member',
    token_hash      VARCHAR(64)  UNIQUE,
    invited_by      UUID      REFERENCES users(id) ON DELETE SET NULL,
    expires_at      TIMESTAMP NOT NULL,
    accepted        BOOLEAN   DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Scope key resources to workspaces (nullable for backward compat)
ALTER TABLE posts           ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE media_files     ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE campaigns       ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_workspace    ON posts(workspace_id)           WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sa_workspace       ON social_accounts(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_workspace    ON media_files(workspace_id)     WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id)      WHERE workspace_id IS NOT NULL;

-- ─── White-label Branding ─────────────────────────────────────────────────────
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_color    VARCHAR(20)  DEFAULT '#6366f1';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_name     VARCHAR(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS custom_domain  VARCHAR(255) UNIQUE;