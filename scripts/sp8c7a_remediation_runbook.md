# Gate SP-8C-7A / SP-8C-7B Remediation Runbook (Revision R6)

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project:** Evergreen / SocialPulse  
**Authorized Owner:** Vernon la Cock, CEO  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Document Revision:** Remediation Package R6  
**Operating Mode:** Strictly Passive Read-Only Standstill  

---

## 1. Executive Summary & Resolution of R5 Blocking Findings

Remediation Package Revision R6 addresses and definitively resolves all eight blocking findings from the independent review of Revision R5:

1. **Portable, Reproducible Executable Negative Test Suite (Finding 1):**  
   Eliminated all hardcoded absolute Windows paths in `run_negative_tests.py`. The test harness dynamically resolves package and script paths relative to `__file__`, safely locates Git Bash or system bash across Windows and Linux, and runs portably from any extracted directory location.

2. **NEG-04 Strict Exit Code Assertion (Finding 2):**  
   Added explicit test assertion `assert code == 1` and captured `exit_code: 1` in `test_evidence_negative_cases.json`, proving verifier cleanup failure strictly enforces exit code 1.

3. **Direct Testing of Actual Governed Scripts (Finding 3):**  
   Replaced synthetic bash inline strings with sourcing and execution of the actual governed scripts (`scripts/prepare_backup_directory.sh`, `scripts/verify_remediation.sh`, `scripts/run_sp8c7a_backup_prep.sh`) under isolated mock environments.

4. **Embedded Python In-Image Heredoc Normalization & Syntax Fix (Finding 4):**  
   Replaced problematic raw newline split string formatting in Heredoc #4 with clean byte-level POSIX LF normalization (`b"\n".join(src_bytes.splitlines())`). All four embedded Python heredocs compile cleanly with 0 syntax errors.

5. **Exhaustive Docker Compose JSON AST Model Verification (Finding 5):**  
   Expanded the Compose AST auditor in `verify_remediation.sh` to enforce complete exact invariants: exact image references (`artradepro/...@sha256:...`), profile `["migration"]`, normalized command `node dist/database/migrate.js`, `restart: "no"`, dependency condition `service_healthy`, zero published ports, zero devices, zero privileged or host namespaces, zero Docker socket mounts, and volume model checks.

6. **Trap-Managed Temporary Compose Model Files (Finding 6):**  
   Temporary Compose JSON and stderr files are now registered in a trap-managed array (`TEMP_COMPOSE_FILES=()`) and reliably cleaned up on any normal exit, error, or signal termination (`SIGHUP`, `SIGINT`, `SIGQUIT`, `SIGTERM`).

7. **Rootless Docker Daemon Enforcement (Finding 7):**  
   The verifier enforces `DOCKER_HOST="unix:///run/user/1001/docker.sock"`, strictly forbids root socket `/var/run/docker.sock`, and asserts execution as `github-runner` (UID 1001). The root wrapper (`run_sp8c7a_backup_prep.sh`) invokes the verifier specifically as UID 1001 with rootless Docker environment exported.

8. **Signal Trap Hardening & Sourcing Guards (Finding 8):**  
   Added comprehensive signal traps (`SIGHUP:129`, `SIGINT:130`, `SIGQUIT:131`, `SIGTERM:143`, `EXIT`) and rollback failure exit 1 enforcement to `prepare_backup_directory.sh`, along with sourcing protection `if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi`.

---

## 2. Remediation Package Member Inventory (Exactly 28 Members)

The consolidated package contains exactly 28 members: 13 governance, verification, and test execution files, plus 15 raw database schema and migration assets:

### A. Governance, Execution & Evidence (13 Members)
1. `approved_release_manifest.json`: Release manifest anchoring release-04 images and commit `89e1cb37b4bac97711580c19616df716ea48b648`.
2. `governed_migration_inventory.json`: Cryptographic inventory of all 15 raw database assets.
3. `release_04_provenance_evidence.json`: GitHub Actions build provenance for immutable runtime image.
4. `release_04_workflow_evidence.md`: CI/CD workflow run 33992192586 audit evidence and log verification.
5. `prepare_backup_directory.sh`: Narrowly scoped host preparation script (0700, 1001:1001, no ACLs, signal-safe rollback).
6. `verify_remediation.sh`: Read-only verification engine auditing images, container isolation, AST Compose, and host invariants.
7. `run_sp8c7a_backup_prep.sh`: Atomic root wrapper executing backup prep and delegating verification to UID 1001.
8. `run_negative_tests.py`: Portable executable negative test harness exercising actual governed scripts.
9. `test_evidence_negative_cases.json`: Machine-readable negative test ledger recording 8 PASS results.
10. `test_evidence_negative_cases.md`: Technical documentation of negative test assertions and proof traces.
11. `baseline_reconciliation.md`: Complete source vs image byte-level normalization audit report.
12. `sp8c7a_remediation_manifest.json`: Package manifest containing SHA-256 and size metadata for all members.
13. `sp8c7a_remediation_runbook.md`: This governed operational runbook.

### B. Raw Database Schema & Migration Assets (15 Members)
14. `source_artifacts/database/schema.sql`: Full baseline schema.
15. `source_artifacts/database/migrations/20260515_ecommerce.sql`
16. `source_artifacts/database/migrations/20260515_ecommerce_add_seller_id.sql`
17. `source_artifacts/database/migrations/20260522_add_workspace_id_to_missing_tables.sql`
18. `source_artifacts/database/migrations/20260613_paid_ads.sql`
19. `source_artifacts/database/migrations/20260613_sales_pages.sql`
20. `source_artifacts/database/migrations/20260613_zeely_expansion.sql`
21. `source_artifacts/database/migrations/20260614_add_product_info_to_workspaces.sql`
22. `source_artifacts/database/migrations/20260717_omnichannel_marketing.sql`
23. `source_artifacts/database/migrations/20260830_add_unique_stripe_session_id.sql`
24. `source_artifacts/database/migrations/20260831_claims_library_and_brand_governance.sql`
25. `source_artifacts/database/migrations/20260831_evergreen_integration_and_suppression.sql`
26. `source_artifacts/database/migrations/20260831_omnisend_and_q2c_sync.sql`
27. `source_artifacts/database/migrate.js`: Approved migration runner.
28. `source_artifacts/database/scripts/migrationStatus.js`: Approved migration status utility.

---

## 3. Operational Execution Sequence (Upon Authorization)

When authorized by Vernon la Cock (CEO) following review approval:

### Step 1: Pre-Execution Negative Verification
Run the negative test suite to prove failure containment:
```bash
python scripts/run_negative_tests.py
```
Expected output: All 8 test cases PASS, generating zero side effects on production host.

### Step 2: Governed Host Preparation & Read-Only Audit
Execute the governed atomic wrapper as root:
```bash
sudo bash scripts/run_sp8c7a_backup_prep.sh
```
What this performs:
1. Validates cryptographic hashes of `prepare_backup_directory.sh` and `verify_remediation.sh`.
2. Creates `/opt/socialpulse/backups` with mode 0700, owner 1001:1001, no ACLs, sufficient disk space.
3. Drops privileges to `github-runner` (UID 1001) and executes `verify_remediation.sh` with `DOCKER_HOST=unix:///run/user/1001/docker.sock`.
4. The verifier audits the runtime image, spins up a temporary inspection container, extracts and verifies all 15 migration assets against `governed_migration_inventory.json`, cleans up the container, verifies the rendered Compose AST, and validates the backup directory invariants.
5. Writes an atomic audit log to `/opt/socialpulse/logs/sp8c7a_prep_<timestamp>.log`.

### Step 3: Verification Sign-Off
Review the generated log file and confirm all checks report `PASS` with zero errors or warnings.
