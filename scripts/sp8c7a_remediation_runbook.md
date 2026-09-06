# Gate SP-8C-7A / SP-8C-7B Remediation Runbook (Revision R5)

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project:** Evergreen / SocialPulse  
**Authorized Owner:** Vernon la Cock, CEO  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Document Revision:** Remediation Package R5  
**Operating Mode:** Strictly Passive Read-Only Standstill  

---

## 1. Executive Summary & Resolution of R4 Blocking Findings

Remediation Package Revision R5 addresses and resolves all six blocking findings from the independent review of Revision R4:

1. **True Rendered Docker Compose JSON AST Model Audit (Finding 1):**  
   Eliminated raw YAML regex parsing in `verify_remediation.sh`. The verifier invokes `docker compose --project-directory "${BASE_DIR}" -f "${COMPOSE_FILE}" --profile migration config --format json` with unmasked exit status capture (`compose_status=$?`). Rendered JSON is written to a protected temporary file (`umask 077`, mode `0600`) without leaking secrets. A Python JSON AST parser structurally asserts all services (`postgres`, `redis`, `server`, `client`, `migrate`), profile `["migration"]`, normalized command `node dist/database/migrate.js`, image digests matching trust anchors, networks (`staging_net`), and confirms absence of rogue named backup volumes.

2. **Pre-Armed Inspection Container Race Protection (Finding 2):**  
   Eliminated the container creation race. Before executing `docker create`, `INSPECTION_CONTAINER_TARGET` is set and `INSPECTION_CONTAINER_PREARMED=1` is armed. If an interruption occurs between container creation and flag assignment, the cleanup handler detects the pre-armed container name and removes it safely.

3. **Confirmed Absence vs. Docker Operational Failure (Finding 3):**  
   Absence verification after `docker rm` now checks the exit code of `docker ps -a --filter "name=^/${INSPECTION_CONTAINER_TARGET}$"`. If Docker returns a non-zero exit status (e.g. daemon unreachable, socket timeout), it is recognized as a containment failure and forces exit code 1, rather than being mistaken for confirmed absence.

4. **Complete Signal Trap Protocol (HUP, INT, QUIT, TERM) (Finding 4):**  
   Both `prepare_backup_directory.sh` and `verify_remediation.sh` implement dedicated trap handlers for `SIGHUP` (129), `SIGINT` (130), `SIGQUIT` (131), and `SIGTERM` (143), preserving exact POSIX exit codes upon signal interruption. Any failure during rollback or container cleanup forces an immediate exit code 1.

5. **Executable Negative Tests & Machine-Readable Ledger (Finding 5):**  
   Delivered [`run_negative_tests.py`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/run_negative_tests.py), an executable test harness validating 8 negative execution boundaries, generating machine-readable proof in [`test_evidence_negative_cases.json`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/test_evidence_negative_cases.json). Documentation in [`test_evidence_negative_cases.md`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/test_evidence_negative_cases.md) quotes enclosed code verbatim.

6. **Reconciled Manifest Governance Claims (Finding 6):**  
   The manifest claim `"structural_compose_ast_audit": true` is now strictly supported by the enclosed, executable Compose JSON AST model verifier.

---

## 2. Package Inventory & Structure (28 Members)

The package contains exactly 28 members:

### Governance Components & Verifiers (13 Files)
1. `run_sp8c7a_backup_prep.sh`: Governed root wrapper with 0600 evidence logging, atomic PIPESTATUS, and signal traps.
2. `prepare_backup_directory.sh`: Non-destructive host backup prep script (owner `1001:1001`, mode `0700`, zero ACLs).
3. `verify_remediation.sh`: Read-only verifier auditing rendered Compose JSON AST, in-image assets, and container lifecycle.
4. `approved_release_manifest.json`: Release manifest cryptographic trust anchor (725 bytes, `2f4cb998...`).
5. `governed_migration_inventory.json`: 15-artifact migration ledger.
6. `baseline_reconciliation.md`: Mathematical proof of CRLF vs LF normalization.
7. `release_04_provenance_evidence.json`: Build provenance and GitHub Actions run evidence.
8. `release_04_provenance_evidence.md`: Human-readable provenance document.
9. `run_negative_tests.py`: Executable negative test harness.
10. `test_evidence_negative_cases.json`: Machine-readable negative test results.
11. `test_evidence_negative_cases.md`: Documented negative test evidence and verbatim code proofs.
12. `sp8c7a_remediation_runbook.md`: This operational runbook.
13. `sp8c7a_remediation_manifest.json`: Package manifest with exact byte, line, and hash metrics.

### Raw Enclosed Database Artifacts (15 Files under `source_artifacts/database/`)
14. `migrate.js`
15. `scripts/migrationStatus.js`
16. `schema.sql`
17. `migrations/20260515_ecommerce.sql`
18. `migrations/20260515_ecommerce_add_seller_id.sql`
19. `migrations/20260522_add_workspace_id_to_missing_tables.sql`
20. `migrations/20260613_paid_ads.sql`
21. `migrations/20260613_sales_pages.sql`
22. `migrations/20260613_zeely_expansion.sql`
23. `migrations/20260614_add_product_info_to_workspaces.sql`
24. `migrations/20260717_omnichannel_marketing.sql`
25. `migrations/20260830_add_unique_stripe_session_id.sql`
26. `migrations/20260831_claims_library_and_brand_governance.sql`
27. `migrations/20260831_evergreen_integration_and_suppression.sql`
28. `migrations/20260831_omnisend_and_q2c_sync.sql`

---

## 3. Post-Approval Controlled Execution Protocol

Upon receipt of explicit owner authorization from Vernon la Cock:
1. Verify package archive SHA-256 against authorized signature.
2. Synchronize package artifacts to `/opt/socialpulse/` on `srv1935605`.
3. Execute `bash scripts/run_sp8c7a_backup_prep.sh` as root (`EUID 0`).
4. The wrapper verifies script trust anchors, executes host preparation and read-only verification, writes canonical log to `/root/sp8c7a_backup_prep_<TIMESTAMP>.log`, and returns to passive standstill.
5. Zero snapshot creation, container restart, or database migration is authorized.
