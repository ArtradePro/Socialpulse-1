# Gate SP-8C-7A / SP-8C-7B Remediation Runbook (Revision R3)

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project:** Evergreen / SocialPulse  
**Authorized Owner:** Vernon la Cock, CEO  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Document Revision:** Remediation Package R3  
**Operating Mode:** Strictly Passive Read-Only Standstill  

---

## 1. Executive Summary & Resolution of Blocking Findings

Remediation Package Revision R3 addresses and resolves all eight blocking findings from the independent review of Revision R2:

1. **Packaging of Raw Migration Source Artifacts (Finding 3):**
   All 15 raw approved database artifacts (`migrate.js`, `migrationStatus.js`, `schema.sql`, and all 12 SQL migration files) are packaged directly inside the archive under `source_artifacts/database/`.

2. **Reconciliation of Runner and SQL Baselines (Findings 4 & 5):**
   A dedicated document (`baseline_reconciliation.md`) provides complete mathematical and byte-level proof explaining the CRLF (Windows) vs LF (POSIX/Docker) line-ending normalization. Crucially, the LF checksum of `migrationStatus.js` (`b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4`) is verified to be identical to the checksum captured directly inside the live container during the R22 and R25 host preflights.

3. **Release-04 Build Provenance & OCI Registry Evidence (Finding 1):**
   Full provenance is supplied in `release_04_provenance_evidence.json` and `.md`. Direct inspection of the Docker Hub OCI image configuration blob (`sha256:ec70c9d300e27ce96eb5f05514570539bfe53c9fcf517438bc2f140e504b5a5b`) proves that Docker Buildx executed:
   ```dockerfile
   COPY /app/dist ./dist # buildkit
   COPY /app/src/database/migrations ./dist/database/migrations # buildkit
   COPY /app/src/database/schema.sql ./dist/database/schema.sql # buildkit
   ```

4. **Fail-Closed Runtime Image Verifier (`verify_remediation.sh`) (Findings 2 & 7):**
   - Mandatory tool preflights (`readlink`, `stat`, `df`, `python3`, `docker`, `getfacl`).
   - Structural AST / JSON model parsing for Docker Compose mounts (zero text grep).
   - In-image inspection via controlled, non-started container (`docker create`), copying out `/app/dist/database` for byte-for-byte and hash-for-hash verification against the 15 enclosed source artifacts.
   - Immediate inspection container removal and absence verification.
   - Zero `|| true` masking; operational ACL or inspect failures immediately fail closed.

5. **Hardened Backup Directory Script (`prepare_backup_directory.sh`) (Finding 6):**
   - Mandatory `getfacl` and `setfacl` preflight check.
   - Zero `|| true` masking.
   - Non-destructive collision rejection: fails closed if `/opt/socialpulse/backups` is non-empty, a symlink, a non-directory, or deviates in ownership (`1001:1001`), permissions (`0700`), or ACLs. Never mutates pre-existing state.
   - Safe rollback: removes directory via `rmdir` only if created during that execution run and uncommitted. Rollback failure forces exit 1.

6. **Governed Root Execution Wrapper (`run_sp8c7a_backup_prep.sh`) (Finding 8):**
   - Dedicated root execution wrapper.
   - Enforces cryptographic trust anchors for `prepare_backup_directory.sh` and `verify_remediation.sh`.
   - Captures output to a root-owned `0600` canonical log: `/root/sp8c7a_backup_prep_<TIMESTAMP>.log`.
   - Uses `PIPESTATUS[0]` to capture payload exit codes without masking.
   - Verifies canonical log presence, ownership, mode, and non-empty status before exit.

---

## 2. Package Inventory & Structure

The package comprises the following components:

- **Root Governed Execution Wrapper:** `run_sp8c7a_backup_prep.sh`
- **Host Preparation Script:** `prepare_backup_directory.sh`
- **Read-Only Verifier Script:** `verify_remediation.sh`
- **Release Manifest Trust Anchor:** `approved_release_manifest.json` (725 bytes, `2f4cb998...`)
- **Governed Migration Inventory Ledger:** `governed_migration_inventory.json` (15 artifacts)
- **Cryptographic Baseline Reconciliation:** `baseline_reconciliation.md`
- **Release 04 Provenance & OCI Registry Evidence:** `release_04_provenance_evidence.json` & `.md`
- **Operational Runbook:** `sp8c7a_remediation_runbook.md`
- **Package Manifest:** `sp8c7a_remediation_manifest.json`
- **Enclosed Raw Source Artifacts (`source_artifacts/database/`):**
  - `migrate.js`
  - `scripts/migrationStatus.js`
  - `schema.sql`
  - Exactly 12 sequential SQL migration files (`20260515_ecommerce.sql` through `20260831_omnisend_and_q2c_sync.sql`)

---

## 3. Controlled Execution Protocol (Post-Approval Only)

Upon receipt of explicit authorization:
1. Copy the approved package to `/opt/socialpulse/` on `srv1935605`.
2. Execute `bash scripts/run_sp8c7a_backup_prep.sh` as root (`EUID 0`).
3. The wrapper verifies script trust anchors, executes `prepare_backup_directory.sh` and `verify_remediation.sh`, logs evidence to `/root/sp8c7a_backup_prep_<TIMESTAMP>.log` (`0600`), and returns to passive standstill.
4. No container restart, migration execution, or database mutation is authorized.
