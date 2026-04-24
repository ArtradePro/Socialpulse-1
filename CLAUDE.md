# CLAUDE.md — Project Intelligence File
# SocialPulse · AI-Powered Social Media Management Platform
# Last updated: 2026-04-29
# Purpose: This file tells Claude (and any AI assistant) everything it needs
#          to understand, navigate, and extend this codebase correctly.
#          Read this entire file before writing a single line of code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 0. QUICK ORIENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SocialPulse is a full-stack SaaS application similar to Ocoya / Buffer.
It lets users create, schedule, and publish social media content across
multiple platforms using AI assistance.

Stack at a glance:
  Frontend  →  React 18 + TypeScript + Tailwind CSS + Redux Toolkit
  Backend   →  Node.js + Express + TypeScript
  Mobile    →  React Native (Expo) + TypeScript
  Database  →  PostgreSQL (primary) + Redis (cache + queues)
  Queue     →  Bull (post scheduling + publishing)
  AI        →  OpenAI GPT-4 + DALL-E 3
  Storage   →  Cloudinary (default) or AWS S3 (env-switchable)
  Billing   →  Stripe (subscriptions + webhooks)
  Auth      →  JWT (access token in Authorization header)
  Infra     →  Docker Compose (local), deployable to any VPS/cloud

Monorepo layout:
  socialPulse-app/frontend/  →  React web frontend (Vite)
  socialPulse-app/backend/   →  Express backend
  socialPulse-app/mobile/    →  React Native (Expo) mobile app
  CLAUDE.md                  →  this file — always at repo root


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. REPOSITORY STRUCTURE — AUTHORITATIVE MAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

socialPulse-1/
│
├── CLAUDE.md                          ← YOU ARE HERE
├── docker-compose.yml                 ← dev: postgres + redis + server + client (hot-reload)
├── docker-compose.prod.yml            ← prod overlay: built images + nginx + healthchecks
├── nginx/
│   ├── nginx.conf                     ← production reverse proxy (HTTP→HTTPS, rate-limits)
│   └── ssl/                           ← cert.pem + key.pem (never committed)
├── .gitignore
│
└── socialPulse-app/
    │
    ├── backend/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── Dockerfile                 ← multi-stage: builder → production
    │   └── src/
    │       ├── server.ts              ← entry: express app + route wiring + job init
    │       │
    │       ├── config/
    │       │   ├── database.ts        ← PostgreSQL pool (pg)
    │       │   ├── redis.ts           ← Redis client (ioredis)
    │       │   └── plans.ts           ← CANONICAL plan definitions (source of truth)
    │       │
    │       ├── middleware/
    │       │   ├── auth.middleware.ts         ← JWT verify → sets req.user
    │       │   ├── apiKey.middleware.ts        ← X-API-Key header → sets req.user (alt auth)
    │       │   ├── workspace.middleware.ts     ← X-Workspace-Id → sets req.workspaceId/Role
    │       │   ├── teamRole.middleware.ts      ← requireTeamRole(minRole) factory
    │       │   ├── upload.middleware.ts        ← multer memory + per-plan size/quota check
    │       │   ├── planEnforcement.middleware.ts ← post/AI/account/feature limits
    │       │   ├── rateLimit.ts               ← express-rate-limit config
    │       │   └── errorHandler.ts            ← global Express error handler
    │       │
    │       ├── controllers/
    │       │   ├── auth.controller.ts         ← register, login, profile, forgotPassword, resetPassword, notif-prefs
    │       │   ├── post.controller.ts         ← CRUD + publishNow + bulkCreatePosts
    │       │   ├── aiController.ts            ← generate, hashtags, improve, caption, generateImage (DALL-E 3)
    │       │   ├── analyticsController.ts     ← getDashboard (single endpoint)
    │       │   ├── media.controller.ts        ← upload, list, delete, bulkDelete, usage, update
    │       │   ├── billing.controller.ts      ← checkout, portal, subscription, usage, webhook
    │       │   ├── oauth.controller.ts        ← OAuth connect + callback for all 4 platforms
    │       │   ├── workspacesController.ts    ← CRUD + invite/accept + branding + public /brand/:domain
    │       │   ├── hashtagSetsController.ts
    │       │   ├── templatesController.ts
    │       │   ├── teamsController.ts         ← CRUD, invite, cancelInvite, acceptInvite, role, remove
    │       │   ├── campaignsController.ts
    │       │   ├── rssController.ts           ← CRUD feeds + fetchAndStoreFeedEntries (exported for cron)
    │       │   ├── apiKeysController.ts       ← generate (raw key once), list, revoke, delete
    │       │   ├── listeningController.ts     ← rules CRUD + fetchRuleResults (exported for cron)
    │       │   ├── inboxController.ts         ← list, markRead, markAllRead, syncInbox
    │       │   └── referralsController.ts     ← getMyReferral + applyReferralCode
    │       │
    │       ├── routes/
    │       │   ├── auth.routes.ts
    │       │   ├── post.routes.ts
    │       │   ├── ai.ts
    │       │   ├── analytics.ts
    │       │   ├── social.ts              ← /api/social/accounts — list + disconnect
    │       │   ├── oauth.ts               ← /api/oauth/* — all platform connect + callback
    │       │   ├── media.ts
    │       │   ├── billing.ts             ← webhook uses raw body parser
    │       │   ├── workspaces.ts          ← /api/workspaces — workspace + branding CRUD
    │       │   ├── hashtagSets.ts
    │       │   ├── templates.ts
    │       │   ├── teams.ts
    │       │   ├── campaigns.ts
    │       │   ├── notifications.ts
    │       │   ├── rss.ts
    │       │   ├── apiKeys.ts
    │       │   ├── listening.ts
    │       │   ├── inbox.ts
    │       │   └── referrals.ts
    │       │
    │       ├── services/
    │       │   ├── storage.service.ts     ← S3 + Cloudinary unified API
    │       │   ├── ai.service.ts          ← OpenAI wrapper (text + DALL-E 3 image)
    │       │   ├── email.service.ts       ← Nodemailer singleton; no-op if SMTP_PASS unset
    │       │   ├── notification.service.ts
    │       │   ├── twitterService.ts      ← publish + analytics + searchRecent + getMentions
    │       │   ├── instagramService.ts    ← single image, video/Reels, carousel (up to 10)
    │       │   ├── linkedinService.ts     ← text + up to 9 images via UGC Post API
    │       │   └── facebookService.ts     ← text, single image, multi-image, video
    │       │
    │       ├── jobs/
    │       │   ├── postPublisher.ts       ← Bull queue worker + 60s safety-net tick
    │       │   ├── mediaCleanup.job.ts    ← daily cron: purge 30-day soft-deletes
    │       │   ├── analyticsSync.ts       ← Bull queue + daily cron: sync post metrics
    │       │   ├── rssJob.ts              ← hourly cron: fetch feeds
    │       │   ├── listeningJob.ts        ← every 30 min: poll listening rules
    │       │   └── inboxJob.ts            ← every 15 min: fetch mentions
    │       │
    │       └── database/
    │           ├── schema.sql             ← idempotent DDL (CREATE IF NOT EXISTS + ALTER IF NOT EXISTS)
    │           └── migrate.ts             ← reads schema.sql and applies it; run via `npm run migrate`
    │
    ├── frontend/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── Dockerfile                 ← multi-stage: builder → nginx:alpine
    │   ├── nginx.conf                 ← SPA routing + static asset caching (inside container)
    │   └── src/
    │       ├── App.tsx                ← router + route tree + BrandProvider wrapper
    │       │
    │       ├── services/
    │       │   ├── api.ts             ← axios instance (JWT + X-Workspace-Id interceptors)
    │       │   ├── aiService.ts
    │       │   ├── socialService.ts
    │       │   └── media.service.ts
    │       │
    │       ├── hooks/
    │       │   ├── useAuth.ts
    │       │   ├── usePosts.ts
    │       │   ├── useAnalytics.ts
    │       │   ├── useUpload.ts
    │       │   └── usePlan.ts
    │       │
    │       ├── store/
    │       │   ├── store.ts
    │       │   ├── authSlice.ts
    │       │   ├── postsSlice.ts
    │       │   └── workspaceSlice.ts  ← activeWorkspaceId persisted to localStorage
    │       │
    │       ├── contexts/
    │       │   └── BrandContext.tsx   ← fetches workspace branding; injects --brand-color CSS var
    │       │
    │       ├── components/
    │       │   ├── layout/
    │       │   │   └── AppLayout.tsx  ← sidebar (navSections) + top navbar + WorkspaceSwitcher
    │       │   ├── common/
    │       │   │   ├── PrivateRoute.tsx
    │       │   │   └── WorkspaceSwitcher.tsx ← dropdown; dispatches switchWorkspace + reload
    │       │   ├── notifications/
    │       │   │   └── NotificationBell.tsx
    │       │   ├── scheduler/
    │       │   │   └── BulkScheduler.tsx
    │       │   ├── media/
    │       │   │   ├── MediaCard.tsx
    │       │   │   ├── MediaUploader.tsx
    │       │   │   └── MediaPicker.tsx
    │       │   └── billing/
    │       │       ├── PlanCard.tsx
    │       │       ├── PlanBadge.tsx
    │       │       ├── UsageBar.tsx
    │       │       └── UpgradeModal.tsx
    │       │
    │       └── pages/
    │           ├── Login.tsx / Register.tsx / AcceptInvite.tsx
    │           ├── Dashboard.tsx / ContentStudio.tsx / Scheduler.tsx
    │           ├── Analytics.tsx / Campaigns.tsx / Settings.tsx
    │           ├── MediaLibrary.tsx / Billing.tsx
    │           ├── HashtagSets.tsx / Templates.tsx
    │           ├── RssFeeds.tsx / ApiKeys.tsx / Referrals.tsx
    │           ├── ImageGenerator.tsx ← DALL-E 3; "Edit" button → ImageEditor
    │           ├── ImageEditor.tsx    ← fabric.js canvas; tools/filters/undo/redo/save-to-library
    │           ├── SocialListening.tsx / UnifiedInbox.tsx
    │           └── Workspaces.tsx     ← workspace list + members tab + branding tab
    │
    └── mobile/
        ├── App.tsx                    ← SafeAreaProvider + AppNavigator + Toast
        ├── app.json                   ← extra.apiUrl for BASE_URL config
        ├── tsconfig.json
        └── src/
            ├── types/index.ts         ← User, Post, Platform, AnalyticsSummary
            ├── services/api.ts        ← axios; reads apiUrl from expo-constants extra
            ├── store/authStore.ts     ← pub/sub singleton; persists token+user to AsyncStorage
            ├── hooks/useAuth.ts
            ├── components/LoadingScreen.tsx
            ├── navigation/index.tsx   ← auth stack (Login/Register) + bottom tab navigator
            └── screens/
                ├── LoginScreen.tsx / RegisterScreen.tsx
                ├── DashboardScreen.tsx    ← greeting, AI credits, stat cards, recent posts
                ├── ContentStudioScreen.tsx ← platform picker, AI writer, char counter, schedule toggle
                ├── SchedulerScreen.tsx    ← paginated post list, status filter chips, delete
                ├── AnalyticsScreen.tsx    ← range picker, overview metrics, platform breakdown
                └── ProfileScreen.tsx      ← edit name, change password, connected accounts, logout


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. DATABASE SCHEMA — COMPLETE REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All tables live in the default public schema of PostgreSQL.
Use UUID primary keys everywhere (gen_random_uuid()).
All timestamps are TIMESTAMP DEFAULT NOW() unless noted.

TABLE: users
  id                  UUID PK
  email               VARCHAR(255) UNIQUE NOT NULL
  password_hash       VARCHAR(255)
  full_name           VARCHAR(255) NOT NULL
  avatar_url          TEXT
  plan                VARCHAR(50) DEFAULT 'free'       -- free|starter|pro|enterprise
  ai_credits          INTEGER DEFAULT 10
  notification_prefs  JSONB DEFAULT '{"postFailed":true,"paymentFailed":true,"trialEnding":true,"weeklyDigest":false}'
  created_at          TIMESTAMP
  updated_at          TIMESTAMP

TABLE: social_accounts
  id                UUID PK
  user_id           UUID FK → users.id CASCADE
  platform          VARCHAR(50)                    -- twitter|instagram|linkedin|facebook
  platform_user_id  VARCHAR(255)
  username          VARCHAR(255)
  access_token      TEXT
  refresh_token     TEXT
  token_expires_at  TIMESTAMP
  profile_image     TEXT
  followers_count   INTEGER DEFAULT 0
  is_active         BOOLEAN DEFAULT true
  created_at        TIMESTAMP

TABLE: posts
  id            UUID PK
  user_id       UUID FK → users.id CASCADE
  content       TEXT NOT NULL
  media_urls    JSONB DEFAULT '[]'
  hashtags      TEXT[]
  platforms     TEXT[]                             -- ['twitter','instagram']
  status        VARCHAR(50) DEFAULT 'draft'        -- draft|scheduled|published|partial|failed
  scheduled_at  TIMESTAMP
  published_at  TIMESTAMP
  ai_generated  BOOLEAN DEFAULT false
  campaign_id   UUID                               -- nullable FK → campaigns.id
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

TABLE: post_analytics
  id                UUID PK
  post_id           UUID FK → posts.id CASCADE
  platform          VARCHAR(50)
  platform_post_id  VARCHAR(255)
  likes             INTEGER DEFAULT 0
  comments          INTEGER DEFAULT 0
  shares            INTEGER DEFAULT 0
  impressions       INTEGER DEFAULT 0
  reach             INTEGER DEFAULT 0
  clicks            INTEGER DEFAULT 0
  engagement_rate   DECIMAL(5,2) DEFAULT 0.00
  synced_at         TIMESTAMP DEFAULT NOW()

TABLE: campaigns
  id          UUID PK
  user_id     UUID FK → users.id CASCADE
  name        VARCHAR(255)
  description TEXT
  start_date  DATE
  end_date    DATE
  status      VARCHAR(50) DEFAULT 'active'
  created_at  TIMESTAMP

TABLE: templates
  id          UUID PK
  user_id     UUID FK → users.id           -- NULL = system template
  name        VARCHAR(255)
  content     TEXT
  category    VARCHAR(100)
  platforms   TEXT[]
  is_public   BOOLEAN DEFAULT false
  created_at  TIMESTAMP

TABLE: hashtag_sets
  id        UUID PK
  user_id   UUID FK → users.id CASCADE
  name      VARCHAR(255)
  hashtags  TEXT[]
  created_at TIMESTAMP

TABLE: media_files
  id            UUID PK
  user_id       UUID FK → users.id CASCADE
  original_name VARCHAR(255)
  file_name     VARCHAR(255)
  mime_type     VARCHAR(100)
  size_bytes    BIGINT
  width         INTEGER
  height        INTEGER
  duration_secs NUMERIC(8,2)
  provider      VARCHAR(20)                        -- 's3' | 'cloudinary'
  provider_id   VARCHAR(512)                       -- S3 key or Cloudinary public_id
  url           TEXT
  thumbnail_url TEXT
  folder        VARCHAR(255) DEFAULT 'uploads'
  tags          TEXT[] DEFAULT '{}'
  is_deleted    BOOLEAN DEFAULT false              -- soft delete
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

TABLE: stripe_customers
  id                      UUID PK
  user_id                 UUID UNIQUE FK → users.id CASCADE
  stripe_customer_id      VARCHAR(255) UNIQUE
  stripe_subscription_id  VARCHAR(255)
  stripe_price_id         VARCHAR(255)
  status                  VARCHAR(50) DEFAULT 'inactive'
                                                   -- inactive|trialing|active|past_due|canceled
  current_period_end      TIMESTAMP
  cancel_at_period_end    BOOLEAN DEFAULT false
  created_at              TIMESTAMP
  updated_at              TIMESTAMP

TABLE: usage_events
  id          UUID PK
  user_id     UUID FK → users.id CASCADE
  event_type  VARCHAR(50)                          -- post_published|ai_credit_used|media_uploaded
  quantity    INTEGER DEFAULT 1
  recorded_at TIMESTAMP DEFAULT NOW()

  INDEX: (user_id, event_type, recorded_at DESC)

TABLE: password_reset_tokens
  id          UUID PK
  user_id     UUID FK → users.id CASCADE
  token_hash  VARCHAR(64) UNIQUE                   -- SHA-256 hex of the raw token
  expires_at  TIMESTAMP NOT NULL                   -- 1 hour from creation
  used        BOOLEAN DEFAULT false
  created_at  TIMESTAMP DEFAULT NOW()

TABLE: teams
  id         UUID PK
  owner_id   UUID FK → users.id CASCADE
  name       VARCHAR(255) NOT NULL
  created_at TIMESTAMP DEFAULT NOW()

TABLE: team_members
  id          UUID PK
  team_id     UUID FK → teams.id CASCADE
  user_id     UUID FK → users.id CASCADE
  role        VARCHAR(50) DEFAULT 'member'          -- owner|admin|member|viewer
  invited_by  UUID FK → users.id
  accepted    BOOLEAN DEFAULT false
  joined_at   TIMESTAMP DEFAULT NOW()

  UNIQUE (team_id, user_id)

TABLE: team_invites
  id           UUID PK
  team_id      UUID FK → teams.id CASCADE
  email        VARCHAR(255) NOT NULL
  role         VARCHAR(50) DEFAULT 'member'
  token_hash   VARCHAR(64) UNIQUE                   -- SHA-256 of raw 24-byte token
  invited_by   UUID FK → users.id
  expires_at   TIMESTAMP NOT NULL                   -- 7 days from creation
  accepted     BOOLEAN DEFAULT false
  created_at   TIMESTAMP DEFAULT NOW()

TABLE: notifications
  id         UUID PK
  user_id    UUID FK → users.id CASCADE
  type       VARCHAR(100)                          -- post_published|post_failed|payment_failed|etc.
  title      VARCHAR(255)
  message    TEXT
  link       TEXT                                  -- optional in-app or external URL
  read       BOOLEAN DEFAULT false
  metadata   JSONB DEFAULT '{}'
  created_at TIMESTAMP DEFAULT NOW()

TABLE: rss_feeds
  id              UUID PK
  user_id         UUID FK → users.id CASCADE
  name            VARCHAR(255)
  url             TEXT NOT NULL
  platforms       TEXT[]
  auto_post       BOOLEAN DEFAULT false
  interval_hours  INTEGER DEFAULT 6
  last_fetched_at TIMESTAMP
  is_active       BOOLEAN DEFAULT true
  created_at      TIMESTAMP DEFAULT NOW()

TABLE: rss_entries
  id       UUID PK
  feed_id  UUID FK → rss_feeds.id CASCADE
  guid     TEXT NOT NULL
  title    TEXT
  url      TEXT
  posted   BOOLEAN DEFAULT false
  UNIQUE (feed_id, guid)

TABLE: api_keys
  id           UUID PK
  user_id      UUID FK → users.id CASCADE
  name         VARCHAR(255)
  key_hash     VARCHAR(64) UNIQUE    -- SHA-256 of raw key; raw key returned once at creation
  key_prefix   VARCHAR(12)           -- first 8 chars for display
  last_used_at TIMESTAMP
  is_active    BOOLEAN DEFAULT true
  created_at   TIMESTAMP DEFAULT NOW()

TABLE: listening_rules
  id         UUID PK
  user_id    UUID FK → users.id CASCADE
  keyword    VARCHAR(255) NOT NULL
  platforms  TEXT[]
  is_active  BOOLEAN DEFAULT true
  created_at TIMESTAMP DEFAULT NOW()

TABLE: listening_results
  id             UUID PK
  rule_id        UUID FK → listening_rules.id CASCADE
  platform       VARCHAR(50)
  external_id    VARCHAR(255)
  author_name    TEXT
  author_handle  TEXT
  author_avatar  TEXT
  content        TEXT
  url            TEXT
  likes          INTEGER DEFAULT 0
  reposts        INTEGER DEFAULT 0
  published_at   TIMESTAMP
  fetched_at     TIMESTAMP DEFAULT NOW()
  UNIQUE (rule_id, external_id)

TABLE: inbox_messages
  id             UUID PK
  user_id        UUID FK → users.id CASCADE
  platform       VARCHAR(50)
  type           VARCHAR(50)           -- mention|comment|dm
  external_id    VARCHAR(255)
  author_name    TEXT
  author_handle  TEXT
  author_avatar  TEXT
  content        TEXT
  url            TEXT
  is_read        BOOLEAN DEFAULT false
  published_at   TIMESTAMP
  created_at     TIMESTAMP DEFAULT NOW()
  UNIQUE (user_id, platform, external_id)

TABLE: referrals
  id              UUID PK
  referrer_id     UUID FK → users.id CASCADE
  referred_id     UUID FK → users.id CASCADE
  code            VARCHAR(16)
  status          VARCHAR(50) DEFAULT 'completed'
  reward_credits  INTEGER DEFAULT 20
  created_at      TIMESTAMP DEFAULT NOW()
  completed_at    TIMESTAMP

  users.referral_code  VARCHAR(16) UNIQUE   -- generated on first /referrals/me call

KEY INDEXES:
  media_files (user_id)
  media_files (created_at DESC)
  usage_events (user_id, event_type, recorded_at DESC)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. API ROUTES — COMPLETE REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All routes are prefixed with /api
🔒 = requires Authorization: Bearer <token> header
⚡ = enforces plan limit middleware
📦 = expects multipart/form-data

── Auth ──────────────────────────────────────────────────────────────────────
POST   /api/auth/register             body: { email, password, fullName }
POST   /api/auth/login                body: { email, password }
GET    /api/auth/profile              🔒
POST   /api/auth/forgot-password      body: { email }
POST   /api/auth/reset-password       body: { token, newPassword }
GET    /api/auth/notification-prefs   🔒
PATCH  /api/auth/notification-prefs   🔒  body: { postFailed?, paymentFailed?, trialEnding?, weeklyDigest? }

── Posts ─────────────────────────────────────────────────────────────────────
GET    /api/posts                     🔒  ?status=&platform=&page=&limit=
POST   /api/posts                     🔒 ⚡(post limit)
GET    /api/posts/:id                 🔒
PATCH  /api/posts/:id                 🔒
DELETE /api/posts/:id                 🔒
POST   /api/posts/:id/publish         🔒  immediate publish
POST   /api/posts/bulk                🔒  body: { posts: [{content,platforms,scheduledAt,hashtags?,mediaUrls?}] }
                                           feature-gated to pro/enterprise in controller; returns 207

── AI ────────────────────────────────────────────────────────────────────────
POST   /api/ai/generate               🔒 ⚡(AI credits)
        body: { topic, platform, tone, length, includeHashtags,
                includeEmojis, language, targetAudience?, keywords? }
POST   /api/ai/hashtags               🔒 ⚡(AI credits)
        body: { topic, platform, count? }
POST   /api/ai/improve                🔒 ⚡(AI credits)
        body: { content, platform, improvement }
POST   /api/ai/caption                🔒 ⚡(AI credits)
        body: { imageDescription, platform, tone }

── Analytics ─────────────────────────────────────────────────────────────────
GET    /api/analytics/dashboard       🔒  ?range=7d|14d|30d|90d&platform=all|twitter|...

── Media ─────────────────────────────────────────────────────────────────────
POST   /api/media                     🔒 📦  field: files (up to 10)
POST   /api/media/single              🔒 📦  field: file
GET    /api/media                     🔒  ?folder=&type=image|video|all&search=
                                           &page=&limit=&sort=newest|oldest|name|size
GET    /api/media/usage               🔒
PATCH  /api/media/:id                 🔒  body: { tags?, folder? }
DELETE /api/media/bulk                🔒  body: { ids: string[] }
DELETE /api/media/:id                 🔒

── Billing ───────────────────────────────────────────────────────────────────
POST   /api/billing/webhook           ⚠️  RAW BODY — no JWT — Stripe signature verified
POST   /api/billing/checkout          🔒  body: { priceId, interval }
POST   /api/billing/portal            🔒
GET    /api/billing/subscription      🔒
GET    /api/billing/usage             🔒

── Social OAuth ──────────────────────────────────────────────────────────────
GET    /api/oauth/twitter/connect     🔒  → redirect to Twitter OAuth (PKCE)
GET    /api/oauth/twitter/callback         ← Twitter redirects here
GET    /api/oauth/instagram/connect   🔒  → redirect to Instagram OAuth
GET    /api/oauth/instagram/callback       ← Instagram redirects here
GET    /api/oauth/linkedin/connect    🔒  → redirect to LinkedIn OAuth
GET    /api/oauth/linkedin/callback        ← LinkedIn redirects here
GET    /api/oauth/facebook/connect    🔒  → redirect to Facebook OAuth
GET    /api/oauth/facebook/callback        ← Facebook redirects here
DELETE /api/oauth/:accountId          🔒  disconnect account

── Teams ─────────────────────────────────────────────────────────────────────
GET    /api/teams/invite/:token/accept       PUBLIC — accept invite by token
GET    /api/teams                       🔒  list caller's teams
POST   /api/teams                       🔒  body: { name }
GET    /api/teams/:id                   🔒  includes members + pending_invites
PATCH  /api/teams/:id                   🔒  body: { name } (admin+)
DELETE /api/teams/:id                   🔒  owner only
POST   /api/teams/:id/invite            🔒  body: { email, role } (admin+)
DELETE /api/teams/:id/invites/:inviteId 🔒  cancel pending invite (admin+)
PATCH  /api/teams/:id/members/:userId/role 🔒 body: { role } (admin+)
DELETE /api/teams/:id/members/:userId   🔒  remove member (admin+)

── AI Image Generation ───────────────────────────────────────────────────────
POST   /api/ai/image                  🔒 ⚡(2 AI credits)
        body: { prompt, size? }  size: '1024x1024'|'1792x1024'|'1024x1792'

── RSS Auto-posting ──────────────────────────────────────────────────────────
GET    /api/rss                       🔒  list feeds
POST   /api/rss                       🔒  body: { name, url, platforms, autoPost, intervalHours }
PATCH  /api/rss/:id                   🔒  body: { name?, platforms?, autoPost?, intervalHours?, isActive? }
DELETE /api/rss/:id                   🔒
POST   /api/rss/:id/fetch             🔒  manual fetch trigger

── API Key Management ────────────────────────────────────────────────────────
GET    /api/api-keys                  🔒  list keys (prefix + metadata only — no raw key)
POST   /api/api-keys                  🔒  body: { name } — returns rawKey once; store it client-side
PATCH  /api/api-keys/:id/revoke       🔒  set is_active = false
DELETE /api/api-keys/:id              🔒

── Social Listening ──────────────────────────────────────────────────────────
GET    /api/listening/rules           🔒  list rules
POST   /api/listening/rules           🔒  body: { keyword, platforms }
DELETE /api/listening/rules/:id       🔒
PATCH  /api/listening/rules/:id/toggle 🔒  toggle is_active
GET    /api/listening/results         🔒  ?ruleId=&platform=&page=&limit=
POST   /api/listening/rules/:id/fetch 🔒  manual fetch trigger

── Unified Inbox ─────────────────────────────────────────────────────────────
GET    /api/inbox                     🔒  ?unread=true&platform=&page=&limit=
POST   /api/inbox/sync                🔒  manual sync trigger
PATCH  /api/inbox/:id/read            🔒  mark single message read
PATCH  /api/inbox/read-all            🔒  mark all messages read

── Referrals ─────────────────────────────────────────────────────────────────
GET    /api/referrals/me              🔒  returns { code, referrals, totalCreditsEarned }
  Note: referralCode is accepted in POST /api/auth/register body

── Other routes ──────────────────────────────────────────────────────────────
GET/POST/DELETE /api/hashtag-sets     🔒
GET/POST/PATCH/DELETE /api/templates  🔒
GET/POST/PATCH/DELETE /api/campaigns  🔒
GET/PATCH /api/notifications          🔒


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. PLAN SYSTEM — HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source of truth: server/src/config/plans.ts
Do NOT duplicate plan limits anywhere else. Always import from plans.ts.

Plan IDs: 'free' | 'starter' | 'pro' | 'enterprise'

Limits per plan:
  free:        2 accounts  20 posts/mo   10 AI credits   100 MB storage   5 MB/file
  starter:     5 accounts  100 posts/mo  100 AI credits  2 GB storage     25 MB/file
  pro:        15 accounts  500 posts/mo  500 AI credits  20 GB storage    100 MB/file
  enterprise: unlimited    unlimited     2000 AI credits unlimited        500 MB/file

How plan is known at runtime:
  JWT payload includes { userId, email, plan }
  plan is set at login time from users.plan column
  When Stripe webhook fires customer.subscription.updated → update users.plan
    AND re-issue a new JWT token so the client stays in sync

  plan is read from JWT with a ?? 'free' fallback in auth.ts.
  Both register and login sign the JWT with plan from users.plan column.

How enforcement works:
  1. enforcePostLimit        — checks usage_events COUNT this month
  2. enforceAILimit          — checks usage_events COUNT this month
  3. enforceSocialAccountLimit — checks social_accounts COUNT
  4. enforceFeature('key')   — checks plan.limits[key] is truthy
  5. validateUpload          — checks file size and storage quota

Usage recording:
  After a successful action call recordUsage(userId, eventType) from
  planEnforcement.middleware.ts. This inserts a row into usage_events.
  Events reset naturally because queries filter by current month.

Stripe price ID mapping:
  planByPriceId(priceId) → Plan object
  All price IDs are in .env — see section 8.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. STORAGE SERVICE — HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: server/src/services/storage.service.ts

Provider is selected by env var:
  STORAGE_PROVIDER=cloudinary   ← default, recommended for new installs
  STORAGE_PROVIDER=s3           ← use for AWS deployments

Public API (provider-agnostic):
  StorageService.upload(UploadInput)  → UploadResult
  StorageService.delete(providerId, mimeType)
  StorageService.getUrl(providerId, provider)

UploadInput shape:
  { buffer, originalName, mimeType, userId, folder? }

UploadResult shape:
  { provider, providerId, url, thumbnailUrl, width, height,
    durationSecs, sizeByte, mimeType, fileName }

Image pipeline:
  1. Sharp resizes images >2048px longest edge
  2. Sharp converts to JPEG quality 82 progressive
  3. Sharp generates 300×300 cover-crop thumbnail
  4. Both main file and thumbnail are uploaded

Video:
  Cloudinary generates poster frame automatically
  S3 stores raw video, no server-side thumbnail generation

After upload, media.controller.ts persists the result to media_files table.
Never call StorageService directly from a route — always go through the controller.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. JOB SYSTEM — HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── Post Publisher (Bull queue) ───────────────────────────────────────────────
File: server/src/jobs/postPublisher.ts
Queue name: 'post-publishing'
Job name: 'publish-post'
Payload: { postId: string }
Retry: 3 attempts, exponential backoff starting at 5 seconds

Scheduling flow:
  1. User creates post with scheduled_at → status = 'scheduled'
  2. schedulePost(postId, scheduledAt) adds job to Bull with delay
  3. Every 60 seconds a setInterval polls for posts where
     status='scheduled' AND scheduled_at <= NOW() (safety net)
  4. Worker calls platform service for each platform in post.platforms
  5. On success → post.status = 'published', inserts post_analytics row
  6. On partial → post.status = 'partial'
  7. On full failure → post.status = 'failed'

Publishing dispatch:
  'twitter'   → TwitterService.publishPost()   ✅ complete
  'instagram' → InstagramService.publishPost() ⚠️  stub
  'linkedin'  → LinkedInService.publishPost()  ⚠️  stub
  'facebook'  → FacebookService.publishPost()  ⚠️  stub

── Media Cleanup (node-cron) ─────────────────────────────────────────────────
File: server/src/jobs/mediaCleanup.job.ts
Schedule: 0 2 * * * (daily at 02:00 UTC)
Action: Finds media_files WHERE is_deleted=true AND updated_at < NOW()-30days
        Calls StorageService.delete() then hard-deletes the DB row
Batch size: 200 per run to avoid timeouts

── Analytics Sync (Bull queue + node-cron) ───────────────────────────────────
File: server/src/jobs/analyticsSync.ts
Queue name: 'analytics-sync'
Job name: 'sync-user'
Payload: { userId: string }

Two trigger paths:
  1. Daily cron 0 2 * * * (02:00 UTC) → fans out one job per active user
  2. triggerUserSync(userId) → adds a job with a 30-minute delay immediately
     after a successful publish (called from postPublisher on anySuccess)

Per-job flow:
  1. Load all social_accounts for the user (keyed by platform)
  2. Query post_analytics rows where:
       platform_post_id IS NOT NULL
       AND synced_at < NOW() - 1h
       AND published_at > NOW() - 30 days
  3. For each row call the platform-specific fetcher
  4. UPDATE post_analytics SET likes/comments/shares/impressions/reach/clicks/
     engagement_rate/synced_at

Platform fetchers:
  twitter   → TwitterApi public_metrics (like, reply, retweet, quote, impression)
  instagram → Graph API /insights (impressions, reach, engagement) + media object
  linkedin  → /socialMetadata (likesSummary, commentsSummary, shareStatistics)
  facebook  → /insights (post_impressions, post_engagements, post_clicks)

── RSS Auto-posting (node-cron) ──────────────────────────────────────────────
File: server/src/jobs/rssJob.ts
Schedule: 0 * * * * (every hour)
Action: Queries rss_feeds WHERE is_active=true AND last_fetched_at < NOW()-interval_hours
        Calls fetchAndStoreFeedEntries(feed) per feed

── Social Listening (node-cron) ──────────────────────────────────────────────
File: server/src/jobs/listeningJob.ts
Schedule: */30 * * * * (every 30 minutes)
Action: Queries all active listening_rules; calls fetchRuleResults(rule, userId) per rule
        Twitter searchRecent API used; results stored in listening_results (UNIQUE on external_id)

── Unified Inbox Sync (node-cron) ───────────────────────────────────────────
File: server/src/jobs/inboxJob.ts
Schedule: */15 * * * * (every 15 minutes)
Action: Queries all users with active social_accounts; calls fetchMentionsForUser(userId)
        Results stored in inbox_messages (UNIQUE on user_id+platform+external_id)

── Initialisation ────────────────────────────────────────────────────────────
All jobs are started in socialPulse-app/backend/src/server.ts start() function:
  initScheduler()      ← from postPublisher.ts
  initMediaCleanup()   ← from mediaCleanup.job.ts
  initAnalyticsSync()  ← from analyticsSync.ts
  initRssJob()         ← from rssJob.ts
  initListeningJob()   ← from listeningJob.ts
  initInboxJob()       ← from inboxJob.ts


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 7. FRONTEND ARCHITECTURE — KEY PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── API calls ─────────────────────────────────────────────────────────────────
Always use the configured Axios instance from services/api.ts.
It automatically attaches the JWT from localStorage/Redux store.
Never use fetch() directly. Never import axios directly in components.

  import api from '../services/api';
  const { data } = await api.get('/posts');

── State management ──────────────────────────────────────────────────────────
Global auth state   → Redux (authSlice)
Global posts state  → Redux (postsSlice)
Server data / async → custom hooks (useAnalytics, usePlan, useUpload, etc.)
Local UI state      → useState inside components

Do not put server data in Redux. Use hooks that own their own
loading/error/data state and expose a refetch() function.

Hook pattern to follow (see useAnalytics.ts as the reference):
  - accepts filter params (or manages them internally)
  - uses useEffect with a cleanup cancelled flag
  - exposes { data, loading, error, refetch, ...filterState }

── Plan enforcement on the client ───────────────────────────────────────────
1. usePlan() hook fetches /billing/usage on mount
2. Components read isAtLimit('posts') / usedPercent('aiCredits') etc.
3. When an API call returns { upgrade: true } the component should
   fire window.dispatchEvent(new CustomEvent('plan:upgrade-required', ...))
4. useUpload already fires this event on 413 quota errors
5. UpgradeModal listens for this event and opens automatically

── Upgrade flow ──────────────────────────────────────────────────────────────
Any component can trigger the upgrade modal:
  window.dispatchEvent(new CustomEvent('plan:upgrade-required', {
    detail: { reason: 'storage' | 'posts' | 'ai' | 'feature' }
  }))
UpgradeModal is mounted in AppLayout so it's always available.
Modal navigates to /billing on "View Plans" click.

── Styling rules ─────────────────────────────────────────────────────────────
Tailwind CSS utility classes only. No custom CSS files.
Rounded corners: rounded-xl (cards), rounded-2xl (page sections), rounded-lg (buttons)
Primary gradient: from-purple-600 to-blue-600
Shadows: shadow-sm on cards, shadow-md on hover
Skeleton loading: animate-pulse with bg-gray-100/200 placeholder divs
Toast notifications: react-hot-toast, position top-right


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 8. ENVIRONMENT VARIABLES — FULL REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── App ───────────────────────────────────────────────────────
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# ── Database ──────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:password@localhost:5432/socialpulse

# ── Redis ─────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ── Auth ──────────────────────────────────────────────────────
JWT_SECRET=change-me-minimum-32-chars
JWT_EXPIRES_IN=7d

# ── AI ────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Storage ───────────────────────────────────────────────────
STORAGE_PROVIDER=cloudinary            # 'cloudinary' | 's3'

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=social-pulse-media
AWS_REGION=us-east-1

# ── Stripe ────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_ENT_MONTHLY=price_...
STRIPE_PRICE_ENT_YEARLY=price_...

# ── Social Platforms ──────────────────────────────────────────
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CALLBACK_URL=http://localhost:5000/api/oauth/twitter/callback

INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_CALLBACK_URL=http://localhost:5000/api/oauth/instagram/callback

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=http://localhost:5000/api/oauth/linkedin/callback

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:5000/api/oauth/facebook/callback

# ── URLs ──────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
APP_URL=http://localhost:3000

# ── Email ─────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@socialpulse.io


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 9. KNOWN GAPS & STUBS — READ BEFORE TOUCHING THESE FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following are explicitly incomplete. Do not assume they work end-to-end.

1. Social publishing
   twitterService.ts:   publishPost() ✅ complete
   instagramService.ts: publishPost() ✅ complete
     — single image, single video (REELS), carousel (up to 10 items, mixed image/video)
     — waitForContainer polls up to 6×5s (image) or 12×5s (video)
   linkedinService.ts:  publishPost() ✅ complete
     — text-only and up to 9 images via originalUrl (publicly-accessible URLs required)
     — video not supported (LinkedIn requires binary registerUpload flow; images use originalUrl)
   facebookService.ts:  publishPost() ✅ complete
     — text-only, single image (/photos), multi-image (staged upload + /feed attached_media)
     — video via /videos endpoint with file_url

4. Settings page
   Fully implemented. Sections: profile edit, password change, connected accounts,
   email notification toggles, team management, danger zone (delete account).
   Notification toggles persist via GET/PATCH /api/auth/notification-prefs.
   Prefs stored in users.notification_prefs JSONB column.

6. MediaPicker component
   Built as a self-contained modal — does not re-use the MediaLibrary page component
   because that component has API shape mismatches (data.items vs data.files).
   Uses MediaService directly with correct response shape.

7. Campaigns
   Fully implemented. Backend controller (campaignsController.ts) + routes
   (routes/campaigns.ts) + frontend page (pages/Campaigns.tsx) all built and wired.
   Linked in sidebar and App.tsx routing. Posts are unlinked (not deleted) on
   campaign delete. campaign_id field on posts is nullable for future use.

8. Team Members / RBAC
   Backend fully built. RBAC middleware (teamRole.middleware.ts) enforces
   minimum role on all /:id team routes via requireTeamRole(minRole) factory.
   req.teamRole is set after successful check. AcceptInvite.tsx public page
   built. Settings.tsx includes full team management UI.
   Cross-resource RBAC (enforcing team role on posts/content routes) not
   built — would require team-scoped resources, a larger architectural change.

9. Bulk Scheduling
   Fully implemented. POST /api/posts/bulk accepts up to 100 posts, returns 207.
   Feature-gated to pro/enterprise inside the controller. BulkScheduler.tsx
   component built; Scheduler.tsx exposes it via a Queue/Bulk tab switcher.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 10. CODING RULES — ALWAYS FOLLOW THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── TypeScript ────────────────────────────────────────────────────────────────
- Strict mode is ON. No implicit any. No ts-ignore without a comment.
- Every function must have explicit return types.
- Use Zod for all request body validation on the server.
- Use React.FC<Props> with explicit interface for every component.
- Prefer type over interface for union types and plain data shapes.
- Prefer interface for component props and class-like shapes.

── Backend ───────────────────────────────────────────────────────────────────
- Every controller function must be async and wrapped in try/catch.
- Never send stack traces to the client. Log errors server-side only.
- Always validate req.body before using it (express-validator or zod).
- Use parameterised queries ($1, $2) — NEVER string-interpolate SQL.
- Controllers must not import from other controllers.
- Services must not import from controllers or routes.
- Always call recordUsage() after a successful chargeable action.
- Stripe webhook handler must be registered BEFORE express.json() middleware.

── Frontend ──────────────────────────────────────────────────────────────────
- Never call fetch() directly — always use the api service.
- Never hardcode /api URLs — they are handled by the Axios base URL.
- All async operations in hooks must handle cancellation (cancelled flag pattern).
- Loading states must always be shown — use AnalyticsSkeleton pattern.
- Error states must always be shown — never silently swallow errors.
- All destructive actions (delete) must confirm with the user first.
- Components must not make API calls directly — use a service or hook.

── Git / commits ─────────────────────────────────────────────────────────────
- One concern per commit.
- Commit message format: type(scope): description
  Types: feat | fix | refactor | style | docs | chore | test
  Examples:
    feat(billing): add yearly/monthly toggle to PlanCard
    fix(auth): include plan in JWT payload
    refactor(analytics): extract heatmap logic into useBestTime hook

── File naming ───────────────────────────────────────────────────────────────
  Server controllers:   camelCase.controller.ts  or  camelCaseController.ts
  Server services:      camelCase.service.ts
  Server middleware:    camelCase.middleware.ts
  Client components:    PascalCase.tsx
  Client hooks:         useCamelCase.ts
  Client services:      camelCase.service.ts
  Client pages:         PascalCase.tsx


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 11. FEATURE COMPLETION STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATUS KEY:
  ✅ Complete      — built, wired, production-ready
  ⚠️  Partial      — backend OR frontend done, or stubs exist
  🔲 Not started   — nothing built yet

CORE FEATURES
  ✅ User authentication (register, login, JWT)
  ✅ Dashboard (stats, charts, recent posts)
  ✅ Content Studio (write + AI tabs, preview, schedule)
  ✅ Post Scheduler (calendar view, queue)
  ✅ Analytics Dashboard (4 tabs, heatmap, CSV export)
  ✅ Media Library (upload, library, grid/list, bulk ops)
  ✅ Subscription & Billing (Stripe, plan cards, usage bars)
  ✅ Plan enforcement (post/AI/account/storage/feature limits)
  ✅ AI content generation (GPT-4, hashtags, improve, caption)
  ✅ Storage service (Cloudinary + S3 dual-provider)

PRIORITY 1 — Required before launch
  ✅ req.user.plan in JWT            (reads from JWT with ?? 'free' fallback)
  ✅ Password reset flow             (forgot + reset endpoints + email service)
  ✅ OAuth callbacks (all platforms) (Twitter PKCE, Instagram, LinkedIn, Facebook)
  ✅ Email system                    (Nodemailer + SMTP, graceful no-op if unconfigured)
  ✅ Instagram publishing           (single image, video/Reels, carousel up to 10)
  ✅ LinkedIn publishing            (text + up to 9 images via UGC Post API)
  ✅ Facebook publishing            (text, single image, multi-image, video)
  ✅ Analytics sync cron job         (Bull queue + node-cron, all 4 platforms)
  ✅ Settings page                   (profile, password, accounts, notifs, teams, danger zone)

PRIORITY 2 — Important for quality
  ✅ MediaPicker component            (self-contained modal, search/filter/paginate, multi-select)
  ✅ Hashtag Sets CRUD               (backend controller + routes + full UI page)
  ✅ Templates CRUD                  (backend controller + routes + full UI page)
  ✅ Campaigns CRUD                  (controller + routes + full UI page, sidebar link added)
  ✅ Team Members + RBAC             (backend + invite flow + UI + requireTeamRole middleware)
  ✅ Notification system             (service, controller, routes, bell UI, triggers wired)
  ✅ Bulk scheduling                 (POST /api/posts/bulk + BulkScheduler.tsx, pro/enterprise gate)

PRIORITY 3 — Post-launch growth
  ✅ Social Listening             (rules CRUD + Twitter search + 30-min cron + results UI)
  ✅ Unified Inbox                (message list, unread filter, platform filter, sync, 15-min cron)
  ✅ RSS Auto-posting             (feed CRUD, per-feed interval, auto-post toggle, hourly cron)
  ✅ Public API + key management  (SHA-256 hashed keys, X-API-Key middleware, key lifecycle UI)
  ✅ AI Image Generation          (DALL-E 3, 3 sizes, 2 AI credits, download/copy, gallery UI)
  ✅ Referral system              (10-char code, 20 credit reward, register integration, stats UI)
  ✅ Advanced Image Editor        (fabric.js canvas; select/text/rect/circle tools; filters; undo/redo)
  ✅ Multi-workspace support      (workspaces table + workspace_members + workspace_invites; X-Workspace-Id
                                   header; resolveWorkspace middleware; WorkspaceSwitcher + Workspaces page)
  ✅ White-label support          (brand_color/name/logo_url/custom_domain on workspaces; BrandContext;
                                   CSS --brand-color var injection; public /brand/:domain endpoint)
  ✅ Mobile App (React Native)    (Expo app; auth, dashboard, content studio, scheduler, analytics, profile)

OVERALL COMPLETION: 100% ✅
  Core product:     100% ✅
  Integrations:     100% ✅  (all 4 platforms fully implemented)
  Quality features: 100% ✅
  Growth features:  100% ✅  (all 10 P3 features complete)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 12. SUGGESTED BUILD ORDER FOR REMAINING WORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Week 1 — Make it shippable
  ~~Day 1  Fix req.user.plan in auth.ts + authController.ts~~         ✅ done
  ~~Day 1  Implement password reset (forgot + reset endpoints + email)~~ ✅ done
  ~~Day 2  Twitter OAuth callback (token exchange + social_accounts insert)~~ ✅ done
  ~~Day 3  Instagram OAuth + Graph API publishing~~                    ✅ OAuth done; publishing stub
  ~~Day 4  LinkedIn OAuth + UGC Post API publishing~~                  ✅ OAuth done; publishing stub
  ~~Day 4  Facebook OAuth + Pages API publishing~~                     ✅ OAuth done; publishing stub
  ~~Day 5  Analytics sync cron job~~                                  ✅ done

Week 2 — Polish
  ~~Day 6  Email system (Nodemailer) — welcome, reset, payment-failed, post-failed~~ ✅ done
  ~~Day 7  Settings page — profile, password, connected accounts~~     ✅ done
  ~~Day 8  MediaPicker component — wire into ContentStudio~~            ✅ done
  ~~Day 9  Hashtag Sets CRUD + UI~~                                   ✅ done
  ~~Day 10 Templates CRUD + UI~~                                      ✅ done

Week 3 — Team & scale
  ~~Day 11 teams + team_members tables, invite flow~~                  ✅ done
  ~~Day 12 RBAC middleware~~                                          ✅ done
  ~~Day 13 Notification system (table + triggers + bell UI)~~         ✅ done
  ~~Day 14 Bulk scheduling endpoint + UI~~                            ✅ already built
  ~~Day 15 End-to-end QA pass~~                                       ✅ done


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 13. DEPENDENCY VERSIONS — LOCKED REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Server
  express                  ^4.18
  cors                     ^2.8
  helmet                   ^7
  dotenv                   ^16
  bcryptjs                 ^2.4
  jsonwebtoken             ^9
  pg                       ^8.11
  redis                    ^4
  bull                     ^4
  @bull-board/api          ^5
  @aws-sdk/client-s3       ^3
  @aws-sdk/s3-request-presigner ^3
  cloudinary               ^2
  multer                   ^1.4
  sharp                    ^0.33
  openai                   ^4
  twitter-api-v2           ^1.15
  stripe                   ^14
  node-cron                ^3
  zod                      ^3
  express-validator        ^7
  express-rate-limit       ^7
  nodemailer               ^6
  rss-parser               ^3.13
  axios                    ^1.6

Client
  react                    ^18
  react-dom                ^18
  react-router-dom         ^6
  typescript               ^5
  @reduxjs/toolkit         ^2
  react-redux              ^9
  tailwindcss              ^3
  lucide-react             ^0.400
  recharts                 ^2.10
  axios                    ^1.6
  react-hot-toast          ^2
  react-hook-form          ^7
  @hookform/resolvers      ^3
  zod                      ^3

Mobile (Expo / React Native)
  expo                     ~54.0
  react-native             0.81
  typescript               ~5.9
  @react-navigation/native          ^7
  @react-navigation/native-stack    ^7
  @react-navigation/bottom-tabs     ^7
  react-native-screens              ^4
  react-native-safe-area-context    ^5
  @react-native-async-storage/async-storage ^3
  axios                             ^1.6
  react-native-toast-message        ^2


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 14. QUICK COMMAND REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Start full stack with Docker
docker-compose up -d

# Server only (development with hot-reload)
cd server && npm run dev

# Client only
cd client && npm start

# Run database migrations
cd server && npm run migrate

# Install all server dependencies
cd server && npm install

# Install all client dependencies
cd client && npm install

# Check TypeScript errors (backend)
cd socialPulse-app/backend && npx tsc --noEmit

# Check TypeScript errors (frontend)
cd socialPulse-app/frontend && npx tsc --noEmit

# Run integration tests (requires TEST_DATABASE_URL env var)
cd socialPulse-app/backend && TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/socialpulse_test npm test

# Run tests with coverage
cd socialPulse-app/backend && TEST_DATABASE_URL=... npm run test:coverage

# Stripe CLI — forward webhooks to local server (required for billing dev)
stripe listen --forward-to localhost:5000/api/billing/webhook

# View Bull queue dashboard (if @bull-board is configured)
http://localhost:5000/admin/queues

# Mobile app (Expo — run in Expo Go on device or emulator)
cd socialPulse-app/mobile && npm start
cd socialPulse-app/mobile && npm run android
cd socialPulse-app/mobile && npm run ios

# Check TypeScript errors (mobile)
cd socialPulse-app/mobile && npx tsc --noEmit

# psql shortcut
psql postgresql://postgres:password@localhost:5432/socialpulse


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 15. INSTRUCTIONS FOR AI ASSISTANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When asked to build a new feature:
  1. Check section 9 (Known Gaps) — is this already noted as a stub?
  2. Check section 3 (API Routes) — does the route exist already?
  3. Check section 2 (Database) — does the table exist already?
  4. Check section 11 (Status) — what priority is this feature?
  5. Follow the coding rules in section 10 without exception.
  6. Update this CLAUDE.md file to reflect the new status.

When asked to fix a bug:
  1. Identify which layer (DB / server / client / infra) the bug is in.
  2. Check section 9 — is this a known gap?
  3. Fix only the stated bug — do not refactor unrelated code.
  4. If the fix changes an API contract, update section 3.
  5. If the fix changes the schema, update section 2.

When asked to refactor:
  1. Do not change external API contracts without explicit instruction.
  2. Do not rename database columns without a migration plan.
  3. Do not move files without updating AppLayout.tsx imports and App.tsx routes.

When writing a new controller:
  - Wrap everything in try/catch
  - Validate input with Zod or express-validator
  - Use parameterised SQL ($1, $2 — never string interpolation)
  - Call recordUsage() if the action consumes a plan quota
  - Return consistent JSON: { data } on success, { message, code } on error

When writing a new React component:
  - Use React.FC<Props> with an explicit Props interface
  - Show a skeleton/loading state
  - Show an error state
  - Use the api service, not fetch
  - Use react-hot-toast for user feedback
  - Follow the Tailwind styling rules in section 7

When writing a new hook:
  - Follow the useAnalytics.ts pattern
  - Use a cancelled flag in useEffect cleanup
  - Expose { data, loading, error, refetch }
  - Accept filter params as arguments or manage them internally

Do not:
  - Introduce new dependencies without noting them in section 13
  - Add inline styles — Tailwind only
  - Use any — TypeScript strict mode is enforced
  - Duplicate plan limit values — always import from config/plans.ts
  - Write raw SQL strings with user input — always use $1 params
  - Skip error handling in async functions
  - Create a new file without placing it in the correct directory
    per the structure in section 1
