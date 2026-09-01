# SocialPulse Release and Deployment Governance Framework
## Project Evergreen — Higiene / Higienlabs Technology Division

**Authorized Owner:** Vernon la Cock (CEO and Authorized Owner, Higiene (Pty) Ltd)
**Executive Oversight and Approval:** Ziona la Cock (Vice President, Higiene (Pty) Ltd)
**Platform:** SocialPulse

---

## 1. Core Principles of Separation

To eliminate accidental, unapproved, or unverified deployments, the SocialPulse delivery pipeline strictly decouples:

1. **Continuous Integration (CI)**: Automated verification on pull requests and pushes to `main`.
2. **Release Image Building**: Explicitly triggered image builds that tag immutable commit-SHAs.
3. **Application Deployment (CD)**: Explicitly triggered rolling deployments targeting protected GitHub Environments.
4. **Database Migrations**: Independently authorized and audited transactional schema operations.

```
+-----------------------------------------------------------------------------------+
|  1. Continuous Integration (ci.yml)                                               |
|     - Triggers: pull_request to main, push to main                                |
|     - Actions: Typecheck, Integration Tests, Production Builds                    |
|     - PROHIBITIONS: Zero Docker logins, Zero Image Pushes, Zero SSH, Zero Deploys |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  2. Release Image Publication (release-images.yml)                                |
|     - Trigger: workflow_dispatch (Manual only)                                    |
|     - Inputs: commit_sha (40-char), release_id, target_environment                |
|     - Tags: sha-<commit_sha> (NEVER mutates :latest)                              |
|     - Output: release-manifest.json                                               |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  3. Application Deployment (deploy.yml)                                           |
|     - Trigger: workflow_dispatch (Manual only) + Protected GitHub Environment     |
|     - Inputs: backend_image (sha/digest), frontend_image, commit_sha, release_id  |
|     - Guards: Rejects :latest, requires immutable tags, concurrency control       |
|     - Actions: SSH pull of explicit images, rolling restart, health validation    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  4. Database Migrations (migrate.yml)                                             |
|     - Trigger: workflow_dispatch (Manual only) + Protected GitHub Environment     |
|     - Inputs: confirm_execution: true, backup_confirmed: true, commit_sha         |
|     - Actions: Status preflight, checksum verification, transactional migrate     |
+-----------------------------------------------------------------------------------+
```

---

## 2. Immutable Image Tagging Policy

- **Prohibition on `:latest` in Production**: The mutable tag `:latest` is strictly prohibited in production and staging deployments.
- **Canonical Tag Format**: All release images must be tagged using the full 40-character or approved short commit SHA:
  - `socialpulse-backend:sha-<commit_sha>`
  - `socialpulse-frontend:sha-<commit_sha>`
- **Digest Pinning**: When deployed, images are referenced via their immutable SHA tag or content-addressable OCI digest (`@sha256:<digest>`).

---

## 3. Production Compose Configuration

`docker-compose.prod.yml` enforces mandatory image variables and eliminates local host compilation:
```yaml
server:
  image: ${SOCIALPULSE_BACKEND_IMAGE:?required}
client:
  image: ${SOCIALPULSE_FRONTEND_IMAGE:?required}
```
If either variable is missing, `docker compose` fails immediately before modifying containers.

---

## 4. Release Manifest Specification

Every release build generates an immutable, auditable machine-readable manifest (`release-manifest.json`):
```json
{
  "releaseId": "rel-20260901-01",
  "sourceCommit": "b14356baf4e9882eed7d85f49cbc73d279b914c9",
  "targetEnvironment": "staging",
  "backend": {
    "image": "artradepro/socialpulse-backend:sha-b14356baf4e9882eed7d85f49cbc73d279b914c9",
    "digest": "sha256:4f39e359d7ad86ddc3dc64cfa66cb0fe79e70188f320509128153b66d4a39b7d"
  },
  "frontend": {
    "image": "artradepro/socialpulse-frontend:sha-b14356baf4e9882eed7d85f49cbc73d279b914c9",
    "digest": "sha256:9e62b1460c66b5e3c2fcec96ee0bdf36a06a28c147a63d4b6d673e0e1195210e"
  },
  "buildWorkflowRunId": "33515289578",
  "builtAt": "2026-09-01T13:48:44Z"
}
```

---

## 5. Rollback Procedures

1. **Application Rollback**:
   - To roll back application containers, run `deploy.yml` providing the previously verified and recorded `backend_image` and `frontend_image` SHA tags from the last known good release manifest.
   - Zero local image rebuilds occur during rollback.
2. **Database Schema Policy**:
   - Automated down-migrations are strictly prohibited.
   - Any database rollback must be executed via forward-compatible corrective migrations after explicit preflight verification.

---

## 6. GitHub Repository Settings & Branch Protection Requirements

Repository administrators must configure the following settings on GitHub:

### A. Branch Protection on `main`:
- [x] Require a pull request before merging
- [x] Require approvals (at least 1 authorized review)
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging (`Backend — typecheck & test`, `Frontend — typecheck & build`, `Mobile — typecheck`)
- [x] Require conversation resolution before merging
- [x] Do not allow bypassing the above settings

### B. Protected Environments (`staging` & `production`):
- Create environment `production` with:
  - Required reviewers (Vernon la Cock, Ziona la Cock)
  - Deployment branches restricted to `main`
- Create environment `staging` with required reviewers and branch restrictions.

---

## 7. Incident Lessons from Workflow Run `33515289578`

1. **Lesson 1**: Merging a pull request to `main` must never implicitly trigger automated deployments.
2. **Lesson 2**: Container image publication must never use mutable `:latest` as the primary production release tag.
3. **Lesson 3**: Deployments and database migrations must require explicit manual approval gates.
