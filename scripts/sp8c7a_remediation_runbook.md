# Gate SP-8C-7A / SP-8C-7B Remediation Runbook

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project:** Evergreen / SocialPulse  
**Authorized Owner:** Vernon la Cock, CEO  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Document Revision:** Remediation Package R1  
**Operating Mode:** Strictly Passive Read-Only Standstill  

---

## 1. Executive Summary & Review Invariants

Following the execution of the Gate SP-8C-7A Revision R25 preflight wrapper on `srv1935605`, independent review confirmed:
- **Transaction Safety & Atomicity:** Verified 100% intact. Governed payload artifacts were synchronized and committed safely. No mixed rollback occurred.
- **Database Classification:** Confirmed as `OBSERVED_BRANCH_B_CLEAN_EMPTY_BOOTSTRAP`. Zero migrations were authorized, zero database mutations occurred, zero snapshots were created, and zero container mutations were performed.
- **Safe Halt Confirmed:** Preflight halted fail-closed in Step 6.7 because the host backup directory `/opt/socialpulse/backups` was absent on `srv1935605`.
- **Image Inventory Finding:** Step 5 verified that while `scripts/migrationStatus.js` was present in the running backend container, SQL migration files and `schema.sql` were absent from `dist/database` because standard TypeScript compilation (`tsc`) does not emit non-TypeScript files.

This remediation package provides the complete, non-executing resolution required for review approval prior to any host mutations.

---

## 2. Remediation Package Contents & Inventory

The remediation package comprises the following governed components:

1. **`scripts/governed_migration_inventory.json`**:
   Authoritative JSON ledger enumerating all 15 database migration artifacts:
   - Migration runner: `/app/dist/database/migrate.js` (4,495 bytes, SHA-256 `6fa5f0895aa64ac46efb73bcbb36ed565ca2257972f027db43b519edeaa28022`)
   - Status reporter: `/app/dist/database/scripts/migrationStatus.js` (17,058 bytes, SHA-256 `b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4`)
   - Baseline schema: `/app/dist/database/schema.sql` (28,983 bytes, SHA-256 `77385a63886c8e520888d221afc935aa5b72230ef6d19ffc50a07e0fdcd710ca`)
   - Exactly 12 sequential SQL migration files (`20260515_ecommerce.sql` through `20260831_omnisend_and_q2c_sync.sql`).

2. **`scripts/prepare_backup_directory.sh`**:
   Narrowly scoped host preparation script for creating and governing `/opt/socialpulse/backups`:
   - Enforces EUID 0 (root execution).
   - Collision rejection: rejects symlinks or non-directory files immediately.
   - Canonical path verification: must resolve strictly to `/opt/socialpulse/backups`.
   - Ownership: enforces `1001:1001`.
   - Permissions: enforces mode `0700`.
   - Extended ACL audit: strips any named or default ACLs via `setfacl -b -k`.
   - Disk space check: verifies $\ge 100$ MB free on filesystem.
   - Atomic rollback: if execution fails or is interrupted before commit, removes the directory using `rmdir` (strictly non-recursive) **only** if the directory was created during that specific execution run (`CREATED_BY_SCRIPT=1`).

3. **`scripts/verify_remediation.sh`**:
   Comprehensive read-only verification script auditing all remediation invariants:
   - Audits existence, permissions (`0700`), ownership (`1001:1001`), canonical path, and zero ACLs of `/opt/socialpulse/backups`.
   - Audits Docker Compose configuration and volume mount `/opt/socialpulse/backups:/app/backups`.
   - Audits governed migration inventory and release manifest trust anchors.
   - Fully non-mutating; returns exit code 0 on complete pass, 1 on failure.

4. **`socialPulse-app/backend/package.json` & `Dockerfile`**:
   Build definitions updated to copy `src/database/migrations` and `src/database/schema.sql` into `dist/database/` during both local build and container image build stages.

5. **`scripts/approved_release_manifest.json`**:
   Canonical release manifest verified against external trust anchor (725 bytes, SHA-256 `856de11c682858e6639f820b45277a96e101149599420073f7c4c010b54d1de7`).

---

## 3. Governed Migration Files Baseline

| Order | Artifact Name | In-Image Path | Size (Bytes) | SHA-256 Checksum |
|---|---|---|---|---|
| Runner | `migrate.js` | `/app/dist/database/migrate.js` | 4,495 | `6fa5f0895aa64ac46efb73bcbb36ed565ca2257972f027db43b519edeaa28022` |
| Runner | `migrationStatus.js` | `/app/dist/database/scripts/migrationStatus.js` | 17,058 | `b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4` |
| Schema | `schema.sql` | `/app/dist/database/schema.sql` | 28,983 | `77385a63886c8e520888d221afc935aa5b72230ef6d19ffc50a07e0fdcd710ca` |
| 1 | `20260515_ecommerce.sql` | `/app/dist/database/migrations/20260515_ecommerce.sql` | 3,047 | `df7d737a8357296ebfff5139710dd25d644143ba24c7dca608327b2bff2ad9fa` |
| 2 | `20260515_ecommerce_add_seller_id.sql` | `/app/dist/database/migrations/20260515_ecommerce_add_seller_id.sql` | 128 | `a109f2a5bb37ac174a96b74979ad15abf82e539579127e6bee9724a927c5c4c9` |
| 3 | `20260522_add_workspace_id_to_missing_tables.sql` | `/app/dist/database/migrations/20260522_add_workspace_id_to_missing_tables.sql` | 805 | `a8bdf063875994117dd075eabb5a8fc3ac779d7026f9a4857623c53bc7e7655f` |
| 4 | `20260613_paid_ads.sql` | `/app/dist/database/migrations/20260613_paid_ads.sql` | 1,934 | `cd19a384496a427712f6638a380ea6e52bff2f55d8cf8762a2275bde6bb80a53` |
| 5 | `20260613_sales_pages.sql` | `/app/dist/database/migrations/20260613_sales_pages.sql` | 2,006 | `b747897965313186903008c21559301f9588d17fff68a55249f98e7634b9ca62` |
| 6 | `20260613_zeely_expansion.sql` | `/app/dist/database/migrations/20260613_zeely_expansion.sql` | 2,430 | `e921882476f3bf29d04dc72d2191f01667e1a826e4508a3d50f30fdb2f9ffada` |
| 7 | `20260614_add_product_info_to_workspaces.sql` | `/app/dist/database/migrations/20260614_add_product_info_to_workspaces.sql` | 67 | `1023eb17652d4fb3aea45786996a8b7ad543b8eee895a5d55412b057ba7ae435` |
| 8 | `20260717_omnichannel_marketing.sql` | `/app/dist/database/migrations/20260717_omnichannel_marketing.sql` | 2,442 | `5af3e7cb71db94d9d478e3ab72fbd9895a62685ecc802088f6994a6af2848987` |
| 9 | `20260830_add_unique_stripe_session_id.sql` | `/app/dist/database/migrations/20260830_add_unique_stripe_session_id.sql` | 310 | `3066fc96b7e79c1b59109902b68a2fab1859bc1c79aba98422aff779f1227b00` |
| 10 | `20260831_claims_library_and_brand_governance.sql` | `/app/dist/database/migrations/20260831_claims_library_and_brand_governance.sql` | 978 | `c6d9566a16f98ad117d0dd03eaa59e3de15984073518b7be3e7882555ef2982f` |
| 11 | `20260831_evergreen_integration_and_suppression.sql` | `/app/dist/database/migrations/20260831_evergreen_integration_and_suppression.sql` | 1,995 | `6b8c2106a3e5efbed2e12378e4ce7d3ac9de7baf9aadb58a7c0f6cca2fcead4e` |
| 12 | `20260831_omnisend_and_q2c_sync.sql` | `/app/dist/database/migrations/20260831_omnisend_and_q2c_sync.sql` | 1,109 | `b7c3a1b6c3bef1c2384780bd623d403c54180fcfbf5dc614700424006c4aa36c` |

---

## 4. Controlled Execution Protocol (Post-Approval Only)

Upon receipt of explicit review verdict `PASS — AUTHORIZED FOR REMEDIATION EXECUTION`, the following sequence will be authorized:

1. **Host Directory Preparation**:
   Run `prepare_backup_directory.sh` as root on `srv1935605`.
   Creates `/opt/socialpulse/backups` with mode `0700` and owner `1001:1001`.

2. **Invariant Verification**:
   Run `verify_remediation.sh` to confirm directory permissions, ownership, Compose volume mount, and inventory alignment.

3. **Preflight Re-Run**:
   Execute the approved preflight runner to complete Step 6 and record Step 6.7 pass.

4. **Passive Standstill**:
   Return immediately to passive standstill. Zero database migrations or mutations.
