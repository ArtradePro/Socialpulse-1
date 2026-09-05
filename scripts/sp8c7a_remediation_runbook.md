# Gate SP-8C-7A / SP-8C-7B Remediation Runbook

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project:** Evergreen / SocialPulse  
**Authorized Owner:** Vernon la Cock, CEO  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Document Revision:** Remediation Package R2  
**Operating Mode:** Strictly Passive Read-Only Standstill  

---

## 1. Executive Summary & Review Invariants

Following the independent review of Remediation Package R1, two blocking findings were resolved:

1. **Remediated Runtime Image & Release Manifest Trust Anchor:**
   - Released immutable staging release **`sp-8c-staging-release-04`** generated via GitHub Actions workflow `Release Images` (Run ID: `33992192586`).
   - Built directly from commit **`89e1cb37b4bac97711580c19616df716ea48b648`**, containing the complete packaging fixes that ensure all 12 SQL migration files and `schema.sql` are copied into `dist/database/`.
   - Immutable Backend Digest:
     `sha256:627ccbd9d0f63169858d43bacc79e4d1e2b3482bfd482bc4932a7df5a622b5ba`
   - Immutable Frontend Digest:
     `sha256:84880b241c4c752d2ed928a60e9679c56995fdddd619ed0c1121e2391835d755`
   - Canonical `approved_release_manifest.json` size: **725 bytes**, SHA-256:
     `2f4cb9980ffeb9c00ac8dbee3c39e72094036843b903a44d07bd41eb30a77c1b`.

2. **Non-Destructive Host Backup Directory Preparation (`prepare_backup_directory.sh`):**
   - Refactored to completely eliminate any mutation of pre-existing state.
   - If `/opt/socialpulse/backups` already exists:
     - **Collision Rejection:** Fails closed (`exit 1`) if the path is a symlink, non-directory, or **not empty** (preventing any interference with existing files).
     - **Passive Invariant Validation:** Rejects the directory (`exit 1`) if owner is not `1001:1001`, mode is not `0700`, or extended ACLs exist. Zero `chown`, zero `chmod`, and zero `setfacl` are executed against pre-existing directories.
     - `CREATED_BY_SCRIPT=0`: Rollback will never touch or remove pre-existing directories.
   - If `/opt/socialpulse/backups` does not exist:
     - `CREATED_BY_SCRIPT=1`.
     - Creates directory with mode `0700` and owner `1001:1001`.
     - Rollback handler executes `rmdir` (strictly empty directory removal) **only if** `CREATED_BY_SCRIPT=1` and uncommitted.

---

## 2. Remediation Package Contents & Inventory

The package comprises 6 governed components:

1. **`prepare_backup_directory.sh`**:
   Narrowly scoped host preparation script for creating and governing `/opt/socialpulse/backups` with strict collision rejection and non-destructive invariant validation.

2. **`verify_remediation.sh`**:
   Comprehensive read-only verification script auditing all remediation invariants:
   - Audits existence, permissions (`0700`), ownership (`1001:1001`), canonical path, and zero ACLs of `/opt/socialpulse/backups`.
   - Audits Docker Compose configuration and volume mount `/opt/socialpulse/backups:/app/backups`.
   - Audits governed migration inventory and release manifest trust anchors.

3. **`governed_migration_inventory.json`**:
   Authoritative JSON ledger enumerating all 15 database migration artifacts:
   - Migration runner: `/app/dist/database/migrate.js` (4,495 bytes, SHA-256 `6fa5f0895aa64ac46efb73bcbb36ed565ca2257972f027db43b519edeaa28022`)
   - Status reporter: `/app/dist/database/scripts/migrationStatus.js` (17,058 bytes, SHA-256 `b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4`)
   - Baseline schema: `/app/dist/database/schema.sql` (28,983 bytes, SHA-256 `77385a63886c8e520888d221afc935aa5b72230ef6d19ffc50a07e0fdcd710ca`)
   - Exactly 12 sequential SQL migration files (`20260515_ecommerce.sql` through `20260831_omnisend_and_q2c_sync.sql`).

4. **`approved_release_manifest.json`**:
   Canonical release manifest artifact for `sp-8c-staging-release-04` (725 bytes, SHA-256 `2f4cb9980ffeb9c00ac8dbee3c39e72094036843b903a44d07bd41eb30a77c1b`).

5. **`sp8c7a_remediation_runbook.md`**:
   This operational and verification runbook.

6. **`sp8c7a_remediation_manifest.json`**:
   Package manifest detailing cryptographic metrics, guarantees, and provenance.

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

Upon receipt of explicit review verdict `PASS — AUTHORIZED FOR REMEDIATION EXECUTION`:

1. **Host Directory Preparation**:
   Run `prepare_backup_directory.sh` as root on `srv1935605`.
   Enforces collision safety; creates `/opt/socialpulse/backups` with mode `0700` and owner `1001:1001` only if absent.

2. **Invariant Verification**:
   Run `verify_remediation.sh` to confirm directory permissions, ownership, Compose volume mount, and inventory alignment.

3. **Preflight Re-Run**:
   Execute the preflight runner to complete Step 6 with all preflight checks passing.

4. **Passive Standstill**:
   Return immediately to passive standstill. Zero database migrations or mutations.
