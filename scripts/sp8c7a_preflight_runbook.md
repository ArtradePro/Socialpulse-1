# Phase SP-8C-7A: Strictly Read-Only Host Preflight Runbook (Revision R7)

**Governing Entity:** Higiene (Pty) Ltd — Project Evergreen — Higiene / Higienlabs Technology Division  
**Corporate Spelling:** Strictly **"Higiene"** (never "Hygiene")  
**Authorized Owner & Sole GitHub Approval Authority:** Vernon la Cock, CEO (`@ArtradePro`, `vernon@lcsh.co.za`)  
**Executive Oversight:** Ziona la Cock, Vice President  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Target Host Identity:** `srv1935605` (`2.24.130.251`)  
**Gate:** `SP-8C-7A` (Read-Only Host Preflight Reconnaissance & Baseline)  
**Revision:** `R7` (Single Consolidated Package Architecture)  
**Status:** `AWAITING_INDEPENDENT_REVIEW — EXECUTION NOT AUTHORIZED`  
**Guarantees & Scope:** Zero application/database mutations, zero snapshot creation, zero migration container execution. Acknowledges controlled root log file creation (`/root/sp8c7a_preflight_<TIMESTAMP>.log`) and unprivileged temporary file creation (`/tmp/sp8c7a_...`).

---

## 1. Scope & Execution Invariants

Gate SP-8C-7A Revision R7 executes via one single self-contained unified script: `sp8c7a_preflight.sh`.
* **Script SHA-256:** `225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54`
* **Script Size:** `48336 bytes` (1166 lines)
* **Corroborating Sidecar SHA-256:** `06296f97a98738794cdcabc16d8c85bed732823b9e4b9cd5c03105f37f92e700` (86 bytes, `225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54  sp8c7a_preflight.sh`)
* **Mandatory Invocation Invariant:**
  The caller must externally provide the exact trust anchor environment variables:
  ```bash
  export EXPECTED_SP8C7A_SHA256="225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54"
  export EXPECTED_SP8C7A_BYTES="48336"
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
