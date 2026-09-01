# Staging Readiness & Operational Runbook — SocialPulse

**Governing Context:** Project Evergreen — Higiene / Higienlabs Technology Division
**Authorized Owner:** Vernon la Cock (CEO and Authorized Owner, Higiene (Pty) Ltd)
**Executive Oversight:** Ziona la Cock (Vice President, Higiene (Pty) Ltd)
**Security Classification:** Confidential Internal Technical Runbook

---

## 1. Required Staging Infrastructure

The SocialPulse staging environment requires the following components:
1. **Node.js Runtime**: v20.x or v22.x LTS.
2. **PostgreSQL Database**: PostgreSQL 15+ with `uuid-ossp` and `pgcrypto` extensions enabled.
3. **Redis Service**: Redis 7.x (or Upstash Redis) for BullMQ queues and token blacklisting.
4. **Nginx Reverse Proxy**: Reverse proxy with TLS 1.3 termination, forwarding headers (`X-Forwarded-For`, `X-Forwarded-Proto`) to Node.js on port 5000.

---

## 2. Redacted Environment-Variable Checklist

Before starting the staging container or service, verify the presence of the following environment variables:

| Variable Name | Component | Required | Purpose |
|---|---|---|---|
| `NODE_ENV` | Global | **Yes** | Set to `production` or `staging`. |
| `DATABASE_URL` | PostgreSQL | **Yes** | Standard connection string (`postgresql://user:pass@host:5432/dbname`). |
| `ACTIVE_ENCRYPTION_KEY_ID` | Secret Encryption | **Yes** | Primary key ID (e.g., `staging-k1`). |
| `ENCRYPTION_KEYS_JSON` | Secret Encryption | **Yes** | Keyring JSON: `{"staging-k1":"<32-byte-base64-key>"}`. |
| `EVERGREEN_INTEGRATION_SECRET`| Inbound Gateway | **Yes** | Shared HMAC SHA-256 secret with Higiene Evergreen OS. |
| `JWT_SECRET` | Authentication | **Yes** | 256-bit cryptographically secure string. |
| `FRONTEND_URL` / `CLIENT_URL` | CORS / Links | **Yes** | Public frontend domain (`https://staging.usesocialpulse.com`). |
| `BACKEND_URL` / `APP_URL` | Server Links | **Yes** | Public API domain (`https://api-staging.usesocialpulse.com`). |
| `Q2C_WEBHOOK_SECRET` | Q2C Integration | Optional | Shared webhook secret with Quote2ContractPro. |
| `Q2C_API_URL` | Q2C Integration | Optional | Base URL for Quote2ContractPro instance. |
| `GEMINI_API_KEY` | Creative Studio | Optional | Google Gemini API key for live AI creative generation. |
| `SENDGRID_API_KEY` | Email Marketing | Optional | SendGrid API key for live email dispatch. |
| `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`| SMS Marketing | Optional | Twilio API credentials for live SMS dispatch. |
| `STRIPE_SECRET_KEY` | E-Commerce / Ads | Optional | Stripe sandbox secret key (`sk_test_...`). |

> [!CAUTION]
> **PROHIBITION AGAINST REUSING SECRETS**: Never reuse development keys or synthetic test keys in staging or production. Generate fresh, independent 32-byte Base64 keys for every deployment environment.

---

## 3. Database Backup & Migration Preflight Procedure

### Step 1: Pre-Deployment Database Backup
Always trigger a snapshot or dump before running migrations:
```bash
pg_dump -U postgres -d socialpulse_staging -F c -b -v -f /backups/socialpulse_staging_$(date +%Y%m%d_%H%M%S).dump
```

### Step 2: Read-Only Migration Preflight
Run the non-mutating preflight status tool:
```bash
npm run migrate:status
```
Verify that:
- `safeToApply` is `true`.
- `destructiveStatementsFound` is empty (`[]`).
- `duplicateStripeSessions` is `0`.

### Step 3: Migration Execution
Once preflight passes, execute the database migration suite:
```bash
npm run migrate
```

---

## 4. Rollback Decision Points & Protocol

If any migration or deployment step encounters errors:
1. **Application Rollback**: Revert deployment container to the previous stable release tag.
2. **Database Rollback**: In the event of schema failure, restore from the snapshot created in Step 1:
   ```bash
   pg_restore -U postgres -d socialpulse_staging -c -v /backups/socialpulse_staging_<timestamp>.dump
   ```

---

## 5. Health & Readiness Verification

After launching containers, query the health endpoints:

### Liveness Check:
```bash
curl -f https://api-staging.usesocialpulse.com/health/live
# Expected: HTTP 200 {"status":"alive","timestamp":"...","uptimeSecs":...}
```

### Readiness Check:
```bash
curl -f https://api-staging.usesocialpulse.com/health/ready
# Expected: HTTP 200 {"status":"ready","coreReady":true,"dbLatencyMs":...,"diagnostics":{...}}
```

---

## 6. External Provider Sandbox & Webhook Verification

1. **Higiene Evergreen OS HMAC Handshake**:
   - Send test signed webhook from Evergreen OS staging to `POST /api/integrations/evergreen/events`.
   - Verify `x-evergreen-signature` and `x-evergreen-timestamp` headers.
   - Confirm event is logged in `evergreen_inbound_events` with status `processed`.

2. **Stripe Sandbox Webhook**:
   - Trigger `checkout.session.completed` test event from Stripe CLI:
     ```bash
     stripe trigger checkout.session.completed --forward-to https://api-staging.usesocialpulse.com/api/webhooks/stripe
     ```
   - Verify idempotent order creation and absence of duplicate database records.

---

## 7. POPIA Operational Checklist

- [ ] Privacy Policy and Terms accessible at `/privacy` and `/terms`.
- [ ] Multi-channel opt-out link embedded in outbound email templates (`/api/marketing/suppression/opt-out`).
- [ ] Suppression list verified active across Email, SMS, and WhatsApp.
- [ ] Operator agreements signed with third-party processors (SendGrid, Twilio, AWS).
