# Gate SP-8C-7A / SP-8C-7B Remediation Runbook (Revision R4)

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project:** Evergreen / SocialPulse  
**Authorized Owner:** Vernon la Cock, CEO  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Document Revision:** Remediation Package R4  
**Operating Mode:** Strictly Passive Read-Only Standstill  

---

## 1. Executive Summary & Resolution of R3 Blocking Findings

Remediation Package Revision R4 resolves all nine blocking findings from the independent review of Revision R3 with mathematically verifiable, fail-closed boundaries:

1. **Image Absence Fail-Closed (Finding 1):**
   In `verify_remediation.sh`, image presence is verified before inspection. If `docker image inspect` fails, the verifier explicitly records `IMAGE_NOT_PRESENT` and `FAIL`, halting execution with exit code 1. It never emits a PASS verdict or proceeds when the image is absent locally.

2. **Inspection Container Cleanup Collision & Lifecycle Safety (Finding 2):**
   `INSPECTION_CONTAINER_CREATED` is initialized to 0. The script checks whether `sp8c7a_remediation_inspect` already exists prior to invocation; if present, execution aborts to prevent collision. When created, the container ID is captured via `docker create`, validated against `docker inspect -f '{{.Id}}'` prior to non-force removal, and container absence is verified post-removal. Any lingering container forces exit code 1.

3. **Elimination of Masked Cleanups (`|| true`) (Finding 3):**
   All occurrences of `|| true` and forced wildcard removals (`docker rm -f`, `rm -rf ... || true`) have been eradicated across all scripts. Cleanup operations verify targets and report errors deterministically. Containment failures force an immediate non-zero exit.

4. **Docker Compose Model AST Structural Audit (Finding 4):**
   Replaced regex pattern matching with Python-based JSON AST structural parsing of `docker compose config`. The parser inspects `services.backend.volumes` and `services.backend-migration.volumes` for exact bind mount source `/opt/socialpulse/backups` and target `/opt/socialpulse/backups`, asserts that the top-level `volumes` section contains only `postgres_data` (zero named backup volumes), and verifies that both services bind to `${SOCIALPULSE_BACKEND_IMAGE}`.

5. **Atomic Multi-Element PIPESTATUS Capture (Finding 5):**
   In `run_sp8c7a_backup_prep.sh`, `${PIPESTATUS[@]}` is atomically captured into an array immediately after pipeline execution. The wrapper asserts that the array contains exactly 2 elements and requires both `${PIPE_STATUSES[0]} -eq 0` and `${PIPE_STATUSES[1]} -eq 0`. A failure in either the payload script or the `tee` evidence logging process triggers an immediate halt and non-zero exit.

6. **Collision-Safe Canonical Root Log Creation (Finding 6):**
   The wrapper sets `umask 077` and verifies that `/root/sp8c7a_backup_prep_<TIMESTAMP>.log` does not pre-exist as a file or symlink (`! -e && ! -L`). After creation, it explicitly asserts mode `0600`, ownership `0:0`, regular file status (`-f`), and non-symlink status (`! -L`).

7. **Elimination of Ungoverned Permissions Mutations (`chmod +x`) (Finding 7):**
   Removed `chmod +x` from the wrapper entirely. Scripts are executed explicitly via `/bin/bash "${PREP_SCRIPT}"` and `/bin/bash "${VERIFY_SCRIPT}"` without mutating filesystem permissions on the host.

8. **Deterministic Fail-Closed ACL Parser (Finding 8):**
   Replaced loose parsing with an explicit `awk` parser without `|| true`. Any exit code deviation or unexpected ACL entry immediately halts with exit code 1.

9. **Signal-Specific Trap Handling & Rollback Override (Finding 9):**
   `prepare_backup_directory.sh` implements separate traps for `SIGINT` (exit code 130) and `SIGTERM` (exit code 143). If rollback fails during signal termination, the exit code is overridden to `1` to signal containment failure.

10. **Negative Test Evidence Document (Finding 10):**
    Enclosed `test_evidence_negative_cases.md` providing reproducible harness documentation for image absence, container collision, cleanup failure, Compose AST mismatches, pipeline logging failure, and signal handling.

---

## 2. Package Inventory & Structure (26 Members)

The package contains exactly 26 members across two logical tiers:

### Governance Components (11 Files)
1. `run_sp8c7a_backup_prep.sh`: Root execution wrapper (0600 evidence logging, atomic PIPESTATUS, no `chmod +x`).
2. `prepare_backup_directory.sh`: Non-destructive host backup directory preparation (`0700`, `1001:1001`, collision rejection).
3. `verify_remediation.sh`: Fail-closed verifier (AST Compose audit, in-image extraction, image absence fail-closed).
4. `approved_release_manifest.json`: Cryptographic trust anchor for staging release (725 bytes, `2f4cb998...`).
5. `governed_migration_inventory.json`: 15-member migration and runner asset ledger.
6. `baseline_reconciliation.md`: Line-ending (CRLF vs LF) reconciliation and mathematical proof.
7. `release_04_provenance_evidence.json`: Build provenance and GitHub Actions run evidence.
8. `release_04_provenance_evidence.md`: Human-readable build provenance report.
9. `sp8c7a_remediation_runbook.md`: This operational runbook.
10. `test_evidence_negative_cases.md`: Verification evidence for negative cases and fault boundaries.
11. `sp8c7a_remediation_manifest.json`: Cryptographic package manifest with exact byte, line, and hash metrics.

### Raw Enclosed Database Artifacts (15 Files under `source_artifacts/database/`)
12. `migrate.js`
13. `scripts/migrationStatus.js`
14. `schema.sql`
15. `migrations/20260515_ecommerce.sql`
16. `migrations/20260515_ecommerce_add_seller_id.sql`
17. `migrations/20260522_add_workspace_id_to_missing_tables.sql`
18. `migrations/20260613_paid_ads.sql`
19. `migrations/20260613_sales_pages.sql`
20. `migrations/20260613_zeely_expansion.sql`
21. `migrations/20260614_add_product_info_to_workspaces.sql`
22. `migrations/20260717_omnichannel_marketing.sql`
23. `migrations/20260830_add_unique_stripe_session_id.sql`
24. `migrations/20260831_claims_library_and_brand_governance.sql`
25. `migrations/20260831_evergreen_integration_and_suppression.sql`
26. `migrations/20260831_omnisend_and_q2c_sync.sql`

---

## 3. Post-Approval Controlled Execution Protocol

Upon receipt of explicit owner authorization from Vernon la Cock:
1. Verify package archive SHA-256 against the authorized signature.
2. Synchronize the package to `/opt/socialpulse/` on `srv1935605`.
3. Execute `bash scripts/run_sp8c7a_backup_prep.sh` as root (`EUID 0`).
4. The wrapper verifies script trust anchors, executes host preparation and read-only verification, writes the canonical log to `/root/sp8c7a_backup_prep_<TIMESTAMP>.log`, and halts at passive standstill.
5. Zero snapshot creation, container restarts, or database migrations are authorized.
