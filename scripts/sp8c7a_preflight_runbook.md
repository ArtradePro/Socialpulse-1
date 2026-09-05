# Phase SP-8C-7A: Strictly Read-Only Host Preflight Runbook (Revision R19)

**Governing Entity:** Higiene (Pty) Ltd — Project Evergreen — Higiene / Higienlabs Technology Division  
**Corporate Spelling:** Strictly **"Higiene"** (never "Hygiene")  
**Authorized Owner & Sole GitHub Approval Authority:** Vernon la Cock, CEO (`@ArtradePro`, `vernon@lcsh.co.za`)  
**Executive Oversight:** Ziona la Cock, Vice President  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Target Host Identity:** `srv1935605` (`2.24.130.251`)  
**Gate:** `SP-8C-7A` (Read-Only Host Preflight Reconnaissance & Baseline)  
**Revision:** `R19` (Single Consolidated Package Architecture)  
**Status:** `AWAITING_INDEPENDENT_REVIEW — EXECUTION NOT AUTHORIZED`  
**Guarantees & Scope:** Zero application/database mutations, zero snapshot creation, zero migration container execution. Acknowledges controlled root log file creation (`/root/sp8c7a_preflight_<TIMESTAMP>.log`) and unprivileged temporary file creation (`/tmp/sp8c7a_...`).

---

## 1. Scope & Execution Invariants

Gate SP-8C-7A Revision R19 executes via one single self-contained unified script: `sp8c7a_preflight.sh`.
* **Script SHA-256:** `81ab86857bb50dfcbfb41833ae77e7bc96db32730741033ea5b0e2e870ef143f`
* **Script Size:** `61362 bytes` (1460 lines)
* **Corroborating Sidecar SHA-256:** `95638fbe712b44cc45119cb8f83b7072b6d853d7934de5475bc0784c39072123` (86 bytes, `81ab86857bb50dfcbfb41833ae77e7bc96db32730741033ea5b0e2e870ef143f  sp8c7a_preflight.sh`)
* **Mandatory Invocation Invariant:**
  The caller must externally provide the exact trust anchor environment variables:
  ```bash
  export EXPECTED_SP8C7A_SHA256="81ab86857bb50dfcbfb41833ae77e7bc96db32730741033ea5b0e2e870ef143f"
  export EXPECTED_SP8C7A_BYTES="61362"
  ```
  The script enforces these variables prior to log creation or workload execution.
* **Enforced Controls:**
  1. Mandatory externally supplied trust anchor (`EXPECTED_SP8C7A_SHA256` and `EXPECTED_SP8C7A_BYTES`) verified before log creation or workload execution. Sidecar and manifest serve as corroborating evidence only.
  2. Exactly four project services running (`client`, `postgres`, `redis`, `server`).
  3. Exact `.Config.Image` equality for all four approved immutable image references (`postgres@sha256:fe0737...`, `redis@sha256:ff02b5...`, `backend@sha256:73e9d3...`, `frontend@sha256:8fa270...`); RepoDigests corroboration removed.
  4. Pre-migration runtime health baseline with explicit exit status capture and zero `|| true` (Redis PING, Postgres SELECT 1, `/health/live` HTTP 200, `/health/ready` HTTP 200 with structured JSON `coreReady:true` validation via protected temporary file, Frontend HTTP 200, Evergreen HTTP 200).
  5. Observational-only database classification (`foundation_name_set_match` across 25 foundation tables; complete ledger schema and record collection; explicit policy stating NO migration branch is authorized).
  6. Governed runtime migrations directory enforced strictly as `/app/dist/database/migrations` (non-symlink regular directory); exact sorted twelve-file basename set comparison; exact 12 SQL migration hashes; exact compiled runner hashes (`migrate.js`, `migrationStatus.js`).
  7. Single canonical `/opt/socialpulse/docker-compose.staging.yml` verified against approved hash (`e97d729f597657d589257f74acaa8467d2e5d034b32bb946692dfef73ee3a008`, 5051 bytes); `COMPOSE_PROFILES` verified unset prior to and reverified unset after rendering; migration profile rendered explicitly without creating containers with unmasked exit status.
  8. Extended 11-point JSON Compose auditor: exact migration image, exact profile `["migration"]`, exact normalized command `node dist/database/migrate.js`, exact restart policy `"no"`, sole healthy PostgreSQL dependency, exact sole network `["staging_net"]`, zero ports, zero bind mounts, zero devices, zero privileged/host namespaces, zero Docker-socket mounts. All JSON passed to Python via stdin or protected temporary files rather than source interpolation.
  9. PostgreSQL persistent volume mount verified: `socialpulse-staging_postgres_data` -> `/var/lib/postgresql/data` (rw).
  10. Canonical non-symlink backup directory verified (`/opt/socialpulse/backups`, `0700`, `1001:1001`, >= 100 MB); filesystem type, mount source, mount target, and mount options captured explicitly; mandatory `getfacl -p` inspection requiring success and strictly rejecting named-user, named-group, mask, or default ACL entries.
  11. Status-preserving, signal-specific, absence-verified (`-e` and `-L`) temporary file cleanup (`trap ... EXIT HUP INT QUIT TERM`) without `|| true`, where containment failure produces non-zero exit status.
  12. Fail-closed: Any mismatch immediately exits non-zero and never produces a PASS banner.
  13. Root outer wrapper with restrictive `umask 077`, log file `/root/sp8c7a_preflight_<TIMESTAMP>.log`, PIPESTATUS capture for runner and tee, and `0600 root:root` log verification.
---

## 2. Historical Execution Evidence: Revision R12 Execution Log
* **Canonical Host Log Path:** `/root/sp8c7a_preflight_20260905_130932Z.log`
* **Log File Size:** `1866` bytes
* **Log File SHA-256:** `9456e01a8efadb8e0d6dc0bb014fb066cb5fb49c7bcde312e0e5a864e46c24b6`
* **Log File Ownership:** `0:0` (`root:root`)
* **Log File Permissions:** `0600` (`-rw-------`)
* **Verified Runtime Health Outcomes in R12 Execution:**
  - Authenticated Redis PING: `PONG` (status: `0`, stdin contained) — **PASS**
  - PostgreSQL Query Probe: `SELECT 1;` -> `1` (status: `0`) — **PASS**
  - Backend Staging Liveness Probe (`:8080/health/live`): HTTP `200` — **PASS**
  - Backend Staging Readiness Probe (`:8080/health/ready`): HTTP `200` — **PASS**
  - Structured Readiness JSON Validation: Halted on Python <= 3.11 f-string backslash syntax restriction (`SyntaxError`), completely resolved in R13 via pre-interpolation local variable assignment.
---

## 3. Historical Execution Evidence: Revision R13 Execution Log
* **Canonical Host Log Path:** `/root/sp8c7a_preflight_20260905_142738Z.log`
* **Log File Size:** `3591` bytes
* **Log File SHA-256:** `a2690ee31ecff2047372d8e6cb7e990040e326bf608ff2cc5e9db45ef4b8fb60`
* **Log File Ownership:** `0:0` (`root:root`)
* **Log File Permissions:** `0600` (`-rw-------`)
* **Verified Runtime Health Outcomes in R13 Host Execution:**
  - Step 1 (Identity & Rootless Socket): UID `1001`, `unix:///run/user/1001/docker.sock` — **PASS**
  - Step 2 (Service Inventory): Exactly 4 services, zero migration containers, exact `.Config.Image` equality for 4 approved images — **PASS**
  - Step 3 (Authenticated Redis PING): `PONG` (status: `0`, stdin contained) — **PASS**
  - Step 3 (PostgreSQL SELECT 1): `1` (status: `0`) — **PASS**
  - Step 3 (Backend Staging Liveness): HTTP `200` — **PASS**
  - Step 3 (Backend Staging Readiness): HTTP `200` (`{"status":"degraded","coreReady":true,...}`) — **PASS**
  - Step 3 (Structured Readiness JSON Validation): `coreReady: true` — **PASS** (Python 3.10 f-string fix verified)
  - Step 3 (Frontend Staging): HTTP `200` — **PASS**
  - Step 3 (Evergreen Production Health): HTTP `200` — **PASS**
  - Step 4 (Observational DB Classification): Halted due to PostgreSQL string quoting syntax error (`\x27`), completely resolved in R14 via PostgreSQL native dollar quoting (`$$...$$`).
---

## 4. Historical Execution Evidence: Revision R14 Execution Log
* **Canonical Host Log Path:** `/root/sp8c7a_preflight_20260905_144208Z.log`
* **Log File Size:** `6518` bytes
* **Log File SHA-256:** `a4170b06b9bba4697287ceabf1e6b3ebdc01563c3efc4055be6ee03abb903de3`
* **Log File Ownership:** `0:0` (`root:root`)
* **Log File Permissions:** `0600` (`-rw-------`)
* **Verified Runtime Health Outcomes in R14 Host Execution:**
  - Step 1 (Identity & Isolation): UID `1001`, `unix:///run/user/1001/docker.sock`, rootful socket denied — **PASS**
  - Step 2 (Service Inventory & Exact Image Digests): Exactly 4 containers, zero migration containers — **PASS**
  - Step 3 (Runtime Health Probes): Redis PING `PONG` (stdin contained), PostgreSQL `SELECT 1;` -> `1`, Backend Liveness HTTP 200, Backend Readiness HTTP 200 with structured JSON `coreReady: true`, Frontend Staging HTTP 200, Evergreen Production Health HTTP 200 preserved — **PASS**
  - Step 4 (Observational Database Classification): PostgreSQL dollar-quoting succeeded completely; catalog query classified staging database as `OBSERVED_BRANCH_B_CLEAN_EMPTY_BOOTSTRAP` (tables: `0`, ledger: `ABSENT`, trigger function: `ABSENT`) — **PASS**
  - Step 5 (Compiled Runners & Migrations): Captured actual compiled runner hashes: `migrate.js` (`6f49b8054ea60be4067b4ebd5ee49ea23f9273f627d3bdf90f47e3aebae20822`), `migrationStatus.js` (`b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4`); confirmed SQL migration files directory `/app/dist/database/migrations` is absent from production container image (`MIGRATION_FILES_ABSENT_FROM_IMAGE`).

---

## 5. Historical Execution Evidence: Revision R17 Execution Log & R18 Focus
* **Canonical Host Log Path:** `/root/sp8c7a_preflight_20260905_153146Z.log`
* **Log File Size:** `6376` bytes
* **Log File Ownership:** `0:0` (`root:root`)
* **Log File Permissions:** `0600` (`-rw-------`)
* **Verified Runtime Health Outcomes in R17 Host Execution:**
  - Step 1 (Identity & Isolation): UID `1001`, `unix:///run/user/1001/docker.sock`, rootful socket denied — **PASS**
  - Step 2 (Service Inventory & Exact Image Digests): Exactly 4 containers, zero migration containers, 4 immutable digests — **PASS**
  - Step 3 (Runtime Health Probes): Redis PING `PONG`, PostgreSQL `SELECT 1;` -> `1`, Backend Liveness HTTP 200, Backend Readiness HTTP 200 with structured JSON `coreReady: true`, Frontend Staging HTTP 200, Evergreen Production Health HTTP 200 preserved — **PASS**
  - Step 4 (Observational Database Classification): Catalog query classified staging database as `OBSERVED_BRANCH_B_CLEAN_EMPTY_BOOTSTRAP` (0 public tables, ledger `ABSENT`, trigger function `ABSENT`) with dynamic ledger banner `PASS (ABSENT, 0 records)` — **PASS**
  - Step 5 (Compiled Runners & Migrations): Captured actual compiled runner hashes; confirmed SQL migration files directory `/app/dist/database/migrations` is absent from container image (`MIGRATION_FILES_ABSENT_FROM_IMAGE`) — **FINDINGS RECORDED**
  - Step 6 (Docker Compose Profile Rendering): Halted on Compose variable interpolation (`SOCIALPULSE_FRONTEND_IMAGE` missing value because Compose was invoked from `/home/github-runner` without `--project-directory` or `--env-file`).
* **Focused R18 Corrections:**
  1. Step 6 Compose profile rendering explicitly supplies `--project-directory /opt/socialpulse` and `--env-file /opt/socialpulse/.env` (if present).
  2. Step 5 runner hash extraction uses `cut -d" " -f1` and `${var%% *}` to strip any trailing whitespace or filename artifacts.
  3. Destination artifact installation in `run_sp8c7a_r18.sh` allows atomic update when destination exists with differing contents.

---

## 6. Architectural Controls: Revision R19 Transactional Publication & Strict Validation
* **Transactional Publication, Backup & Rollback Architecture (`run_sp8c7a_r19.sh`):**
  - **Separate Tracking Arrays:**
    - `CREATED_BY_WRAPPER`: Tracks only destinations newly created by the wrapper (did not pre-exist).
    - `REPLACED_DESTINATIONS`: Tracks only pre-existing destinations replaced by the wrapper.
    - `DEST_BACKUP_MAP`: Maps each replaced destination to its verified backup file path.
  - **Pre-Replacement Verified Backup:**
    - Before replacing any existing destination, creates a protected backup (`chmod 0600`, `owner 1001:1001`).
    - Verifies backup bytes, SHA-256, owner, and mode against recorded destination metadata.
  - **Atomic Same-Filesystem Staged Rename:**
    - Staged replacement temporary file created inside `/opt/socialpulse/scripts/` (`mktemp "${DEST_DIR}/.tmp_${fname}.XXXXXX"`).
    - Temporary file completely verified (bytes, SHA-256, owner `1001:1001`, mode, non-symlink) prior to publication.
    - Published atomically via same-filesystem rename (`mv -f "${tmp_dest}" "${dest_file}"`).
  - **Deterministic Rollback on Pre-Commit Failure:**
    - Deletes only newly created destinations (`CREATED_BY_WRAPPER`).
    - Restores every replaced destination atomically from its verified backup.
    - Re-verifies restored bytes, SHA-256, owner, and mode.
    - Reports containment failure (`exit 1`) if any restoration is incomplete.
  - **Post-Publication Verification & Backup Cleanup:**
    - Backups are retained until all four destination files pass post-publication verification and `PUBLICATION_COMMITTED=1`.
    - Backups are then cleanly removed and their absence verified.
* **Step 5 Docker & Hash Command Status Capture & Regex Validation:**
  - `MIGRATE_RUNNER_STATUS` and `STATUS_RUNNER_STATUS` are captured immediately from `$?` after command substitution before any trimming or parameter expansion.
  - Every extracted runner and SQL migration hash is validated against regex `^[0-9a-f]{64}$`. Any non-missing invalid string format fails closed immediately.
* **Step 6 Strict `/opt/socialpulse/.env` Audit & Rendered JSON Protection:**
  - Requires `/opt/socialpulse/.env` to be a regular non-symlink at its canonical path (`readlink -f`).
  - Enforces approved ownership (UID `0` or `1001`, GID `0` or `1001`), readability, and restrictive permissions (others `0`). Missing or invalid `.env` fails closed.
  - Always invokes Compose with both `--project-directory /opt/socialpulse` and `--env-file /opt/socialpulse/.env`.
  - Rendered JSON is written to a protected temporary file (`0600`), never printed or logged, and immediately removed with absence verified.
