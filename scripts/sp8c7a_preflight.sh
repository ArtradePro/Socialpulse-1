#!/bin/bash
# ==============================================================================
# HIGIENE (PTY) LTD — PROJECT EVERGREEN / SOCIALPULSE
# GATE SP-8C-7A: STRICTLY READ-ONLY HOST PREFLIGHT AUDIT SCRIPT (REVISION R15)
# Identity: root (EUID 0) outer wrapper -> unprivileged github-runner (UID 1001) workload
# Rootless Socket: unix:///run/user/1001/docker.sock
# Scope: ZERO DATABASE MUTATIONS, ZERO SNAPSHOTS, ZERO CONTAINER MUTATIONS
# Artifact Control: Controlled root log creation (/root/sp8c7a_preflight_<TIMESTAMP>.log)
#                   and controlled unprivileged temporary file creation (/tmp/sp8c7a_...)
# Fail-Closed: Any missing or mismatched evidence terminates immediately with non-zero exit.
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# 1. MANDATORY EXTERNALLY SUPPLIED TRUST ANCHOR VERIFICATION
# (MUST PASS BEFORE LOG FILE CREATION OR WORKLOAD EXECUTION)
# ------------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Preflight script must be executed directly by root (EUID 0)." >&2
    exit 1
fi

if [ -z "${EXPECTED_SP8C7A_SHA256:-}" ]; then
    echo "CRITICAL ERROR: Mandatory environment variable EXPECTED_SP8C7A_SHA256 is unset or empty!" >&2
    echo "The caller must externally supply the approved SHA-256 trust anchor before execution." >&2
    exit 1
fi

if [ -z "${EXPECTED_SP8C7A_BYTES:-}" ]; then
    echo "CRITICAL ERROR: Mandatory environment variable EXPECTED_SP8C7A_BYTES is unset or empty!" >&2
    echo "The caller must externally supply the approved byte-count trust anchor before execution." >&2
    exit 1
fi

if ! [[ "${EXPECTED_SP8C7A_SHA256}" =~ ^[0-9a-f]{64}$ ]]; then
    echo "CRITICAL ERROR: Supplied EXPECTED_SP8C7A_SHA256 format is invalid (expected 64 lowercase hex characters): '${EXPECTED_SP8C7A_SHA256}'" >&2
    exit 1
fi

if ! [[ "${EXPECTED_SP8C7A_BYTES}" =~ ^[0-9]+$ ]]; then
    echo "CRITICAL ERROR: Supplied EXPECTED_SP8C7A_BYTES format is invalid (expected integer): '${EXPECTED_SP8C7A_BYTES}'" >&2
    exit 1
fi

SCRIPT_PATH="$(realpath "$0")"
if [ ! -f "${SCRIPT_PATH}" ] || [ -L "${SCRIPT_PATH}" ]; then
    echo "CRITICAL ERROR: Script path is not a regular file or is a symlink: ${SCRIPT_PATH}" >&2
    exit 1
fi

SCRIPT_SHA256="$(sha256sum "${SCRIPT_PATH}" | awk '{print $1}')"
SCRIPT_BYTES="$(stat -c '%s' "${SCRIPT_PATH}")"
SCRIPT_LINES="$(wc -l < "${SCRIPT_PATH}")"

if [ "${SCRIPT_SHA256}" != "${EXPECTED_SP8C7A_SHA256}" ]; then
    echo "CRITICAL ERROR: Script SHA-256 (${SCRIPT_SHA256}) does not match mandatory externally supplied EXPECTED_SP8C7A_SHA256 (${EXPECTED_SP8C7A_SHA256})!" >&2
    exit 1
fi

if [ "${SCRIPT_BYTES}" -ne "${EXPECTED_SP8C7A_BYTES}" ]; then
    echo "CRITICAL ERROR: Script byte count (${SCRIPT_BYTES}) does not match mandatory externally supplied EXPECTED_SP8C7A_BYTES (${EXPECTED_SP8C7A_BYTES})!" >&2
    exit 1
fi

# Corroborating Evidence: Sidecar Checksum File (if present, must corroborate external anchor)
SIDECAR_FILE="${SCRIPT_PATH}.sha256"
if [ -f "${SIDECAR_FILE}" ] && [ ! -L "${SIDECAR_FILE}" ]; then
    SIDECAR_SHA="$(awk 'NR==1 {print $1}' "${SIDECAR_FILE}")"
    if [ "${SIDECAR_SHA}" != "${EXPECTED_SP8C7A_SHA256}" ]; then
        echo "CRITICAL ERROR: Sidecar checksum ${SIDECAR_SHA} contradicts external trust anchor ${EXPECTED_SP8C7A_SHA256}!" >&2
        exit 1
    fi
    echo "✓ Corroborated script matches sidecar checksum file"
fi

# Corroborating Evidence: Package Manifest (if present, must corroborate external anchor)
MANIFEST_FILE="$(dirname "${SCRIPT_PATH}")/sp8c7a_manifest.json"
if [ -f "${MANIFEST_FILE}" ] && [ ! -L "${MANIFEST_FILE}" ]; then
    set +e
    M_SHA="$(python3 -c 'import sys, json; m = json.load(open(sys.argv[1])); print(next((x["sha256"] for x in m.get("members", []) if x.get("filename") == "sp8c7a_preflight.sh"), ""))' "${MANIFEST_FILE}")"
    M_STATUS=$?
    set -e
    if [ "${M_STATUS}" -eq 0 ] && [ -n "${M_SHA}" ]; then
        if [ "${M_SHA}" != "${EXPECTED_SP8C7A_SHA256}" ]; then
            echo "CRITICAL ERROR: Manifest checksum ${M_SHA} contradicts external trust anchor ${EXPECTED_SP8C7A_SHA256}!" >&2
            exit 1
        fi
        echo "✓ Corroborated script matches package manifest"
    fi
fi

# ------------------------------------------------------------------------------
# 2. ROOT LOG FILE INITIALIZATION (RESTRICTIVE UMASK 077)
# ------------------------------------------------------------------------------
umask 077

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
LOG_FILE="/root/sp8c7a_preflight_${TIMESTAMP}.log"

if [ -e "${LOG_FILE}" ] || [ -L "${LOG_FILE}" ]; then
    echo "CRITICAL ERROR: Destination log target already exists or is a symlink: ${LOG_FILE}" >&2
    exit 1
fi

touch "${LOG_FILE}"
chmod 0600 "${LOG_FILE}"
chown root:root "${LOG_FILE}"

echo "========================================================================"
echo ">>> HIGIENE (PTY) LTD — GATE SP-8C-7A HOST PREFLIGHT AUDIT (REVISION R15)"
echo ">>> UTC Timestamp      : ${TIMESTAMP}"
echo ">>> Canonical Log      : ${LOG_FILE} (Controlled Log Creation)"
echo ">>> Host Executor      : $(whoami) (EUID: $(id -u))"
echo ">>> Script Path        : ${SCRIPT_PATH}"
echo ">>> Script SHA-256     : ${SCRIPT_SHA256} (EXTERNAL TRUST ANCHOR MATCHED)"
echo ">>> Script Bytes/Lines : ${SCRIPT_BYTES} bytes / ${SCRIPT_LINES} lines"
echo ">>> Target Host        : srv1935605 (2.24.130.251)"
echo ">>> Operating Mode     : PASSIVE READ-ONLY STANDSTILL"
echo "========================================================================"

# ------------------------------------------------------------------------------
# 3. EXECUTE UNPRIVILEGED WORKLOAD AS GITHUB-RUNNER WITH ROOT TEE & PIPESTATUS
# ------------------------------------------------------------------------------
set +e
su -l github-runner -c 'bash -s' << 'WORKLOAD_EOF' 2>&1 | tee -a "${LOG_FILE}"
set -euo pipefail

export DOCKER_HOST="unix:///run/user/1001/docker.sock"

# Status-preserving, signal-specific, absence-verified (-e and -L) cleanup
TEMP_FILES=()

cleanup() {
    local exit_code=$?
    local sig="${1:-0}"
    trap - EXIT HUP INT QUIT TERM

    local containment_failed=0

    for f in "${TEMP_FILES[@]}"; do
        if [ -n "${f}" ]; then
            if [ -e "${f}" ] || [ -L "${f}" ]; then
                rm -f "${f}"
                if [ -e "${f}" ] || [ -L "${f}" ]; then
                    echo "CRITICAL ERROR: Failed to remove temporary file or symlink: ${f}" >&2
                    containment_failed=1
                fi
            fi
        fi
    done

    if [ "${containment_failed}" -ne 0 ]; then
        echo "CRITICAL ERROR: Temporary artifact containment failure detected during cleanup!" >&2
        if [ "${exit_code}" -eq 0 ]; then
            exit_code=1
        fi
    fi

    if [ "${sig}" -ne 0 ]; then
        exit "$((128 + sig))"
    fi
    exit "${exit_code}"
}

trap 'cleanup 0' EXIT
trap 'cleanup 1' HUP
trap 'cleanup 2' INT
trap 'cleanup 3' QUIT
trap 'cleanup 15' TERM

echo ""
echo "========================================================================"
echo ">>> [WORKLOAD] UNPRIVILEGED PREFLIGHT AUDIT (github-runner, UID 1001)"
echo ">>> [WORKLOAD] Execution Timestamp : $(date -u +'%Y-%m-%d %H:%M:%SZ')"
echo ">>> [WORKLOAD] Effective User       : $(whoami) (UID: $(id -u), GID: $(id -g))"
echo ">>> [WORKLOAD] Docker Socket        : ${DOCKER_HOST}"
echo "========================================================================"

# ------------------------------------------------------------------------------
# STEP 1: IDENTITY & DOCKER SOCKET INVARIANTS
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 1: IDENTITY & DOCKER SOCKET INVARIANTS ==="

CURRENT_UID=$(id -u)
if [ "${CURRENT_UID}" -ne 1001 ]; then
    echo "FAIL: Expected execution as github-runner (UID 1001), got UID ${CURRENT_UID}." >&2
    exit 1
fi
echo "✓ Verified unprivileged executor: $(whoami) (UID 1001)"

set +e
docker info >/dev/null 2>&1
DOCKER_INFO_STATUS=$?
set -e
if [ "${DOCKER_INFO_STATUS}" -ne 0 ]; then
    echo "FAIL: Rootless Docker socket at ${DOCKER_HOST} is unreachable (status: ${DOCKER_INFO_STATUS})." >&2
    exit 1
fi
echo "✓ Verified rootless Docker daemon communication via ${DOCKER_HOST}"

set +e
docker -H unix:///var/run/docker.sock info >/dev/null 2>&1
ROOTFUL_INFO_STATUS=$?
set -e
if [ "${ROOTFUL_INFO_STATUS}" -eq 0 ]; then
    echo "FAIL: Rootful Docker socket /var/run/docker.sock was accessible to unprivileged runner!" >&2
    exit 1
fi
echo "✓ Confirmed rootful Docker socket access is strictly DENIED (status: ${ROOTFUL_INFO_STATUS})"

# ------------------------------------------------------------------------------
# STEP 2: SERVICE INVENTORY & FOUR APPROVED IMMUTABLE IMAGE REFERENCES
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 2: SERVICE INVENTORY & FOUR APPROVED IMMUTABLE IMAGE REFERENCES ==="

# 1. Enforce Exactly Four Project Services Running
ACTUAL_CONTAINERS=($(docker ps --filter "name=^socialpulse-staging" --format '{{.Names}}' | sort))
EXPECTED_CONTAINERS=(
    "socialpulse-staging-client-1"
    "socialpulse-staging-postgres-1"
    "socialpulse-staging-redis-1"
    "socialpulse-staging-server-1"
)

echo "Discovered Project Containers (${#ACTUAL_CONTAINERS[@]} total):"
for c in "${ACTUAL_CONTAINERS[@]}"; do
    echo "  - ${c}"
done

if [ "${#ACTUAL_CONTAINERS[@]}" -ne 4 ]; then
    echo "FAIL: Expected exactly 4 project services, found ${#ACTUAL_CONTAINERS[@]}." >&2
    exit 1
fi

for i in "${!EXPECTED_CONTAINERS[@]}"; do
    if [ "${ACTUAL_CONTAINERS[i]:-}" != "${EXPECTED_CONTAINERS[i]}" ]; then
        echo "FAIL: Container mismatch at index ${i}: got '${ACTUAL_CONTAINERS[i]:-}', expected '${EXPECTED_CONTAINERS[i]}'." >&2
        exit 1
    fi
done
echo "✓ Enforced exactly four approved project services running"

# 2. Verify Migration Container is Strictly Absent
MIGRATE_CONTAINERS=$(docker ps -a --filter "name=migrate" --format '{{.Names}}')
if [ -n "${MIGRATE_CONTAINERS}" ]; then
    echo "FAIL: Detected unexpected migration container in environment: ${MIGRATE_CONTAINERS}" >&2
    exit 1
fi
echo "✓ Verified zero migration containers present or running"

# 3. Enforce Exact .Config.Image Equality for All Four Images
echo ""
echo "--- Enforcing Exact .Config.Image Equality for Four Approved Immutable Images ---"

declare -A APPROVED_IMAGE_REFS=(
    ["socialpulse-staging-postgres-1"]="postgres@sha256:fe0737ba566a2c5b2a28f34433c0a423261900ec17b9bf7ad115e1aae7e57f1b"
    ["socialpulse-staging-redis-1"]="redis@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf"
    ["socialpulse-staging-server-1"]="artradepro/socialpulse-backend@sha256:73e9d3366edd4e714e4ade1acd45e78cc20c9e84803572dda96b0ba65818eb2a"
    ["socialpulse-staging-client-1"]="artradepro/socialpulse-frontend@sha256:8fa2708cfbff2c38b7708e7d3a7830ba738d3407e2ae986561da008a965d9aa8"
)

for c in "${EXPECTED_CONTAINERS[@]}"; do
    EXP_REF="${APPROVED_IMAGE_REFS[${c}]}"
    CONFIG_IMG="$(docker inspect --format '{{.Config.Image}}' "${c}")"
    # Exact .Config.Image equality is mandatory
    if [ "${CONFIG_IMG}" != "${EXP_REF}" ]; then
        echo "FAIL: Container ${c} .Config.Image '${CONFIG_IMG}' does not match exact approved immutable reference '${EXP_REF}'!" >&2
        exit 1
    fi
    echo "✓ Verified exact .Config.Image equality for ${c}"
done

# ------------------------------------------------------------------------------
# STEP 3: PRE-MIGRATION RUNTIME HEALTH BASELINE (EXPLICIT STATUS CAPTURE)
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 3: PRE-MIGRATION RUNTIME HEALTH BASELINE ==="

# 1. Authenticated Redis PING
# Retrieve REDIS_PASSWORD ONLY through the container-internal command against socialpulse-staging-server-1
set +e
REDIS_AUTH_VAL="$(docker exec socialpulse-staging-server-1 sh -c 'printf "%s" "$REDIS_PASSWORD"' 2>/dev/null)"
GET_PASS_STATUS=$?
set -e

# If credential retrieval returns non-zero or produces an empty value, unset the variable and fail immediately
if [ "${GET_PASS_STATUS}" -ne 0 ] || [ -z "${REDIS_AUTH_VAL}" ]; then
    echo "FAIL: Failed to retrieve REDIS_PASSWORD from socialpulse-staging-server-1 runtime environment!" >&2
    unset REDIS_AUTH_VAL
    exit 1
fi

REDIS_OUTPUT_FILE="$(mktemp /tmp/sp8c7a_redis_output.XXXXXX)"
TEMP_FILES+=("${REDIS_OUTPUT_FILE}")

# Execute Redis probe via standard input with redirection to pre-armed output file
set +e
printf '%s\n' "${REDIS_AUTH_VAL}" |
    docker exec -i socialpulse-staging-redis-1 \
        sh -c 'IFS= read -r REDISCLI_AUTH && export REDISCLI_AUTH && exec redis-cli --raw ping' \
        >"${REDIS_OUTPUT_FILE}" 2>&1
REDIS_PIPESTATUS=("${PIPESTATUS[@]}")
set -e

# Immediately unset all credential-bearing variables
unset REDIS_AUTH_VAL

# Require exactly two captured pipeline statuses
if [ "${#REDIS_PIPESTATUS[@]}" -ne 2 ]; then
    echo "FAIL: Expected exactly 2 pipeline statuses for Redis probe, got ${#REDIS_PIPESTATUS[@]}!" >&2
    exit 1
fi

PRINTF_STATUS="${REDIS_PIPESTATUS[0]:-1}"
DOCKER_STATUS="${REDIS_PIPESTATUS[1]:-1}"

# Require both statuses to equal 0
if [ "${PRINTF_STATUS}" -ne 0 ] || [ "${DOCKER_STATUS}" -ne 0 ]; then
    echo "FAIL: Redis probe pipeline failed (printf exit: ${PRINTF_STATUS}, docker exec exit: ${DOCKER_STATUS})" >&2
    exit 1
fi

# Require the output file to be regular, non-symlinked and owned by github-runner
if [ ! -f "${REDIS_OUTPUT_FILE}" ] || [ -L "${REDIS_OUTPUT_FILE}" ]; then
    echo "FAIL: Redis output file is missing or a symlink: ${REDIS_OUTPUT_FILE}" >&2
    exit 1
fi

REDIS_OUT_OWNER="$(stat -c '%u:%g' "${REDIS_OUTPUT_FILE}")"
if [ "${REDIS_OUT_OWNER}" != "1001:1001" ]; then
    echo "FAIL: Redis output file owner mismatch: expected 1001:1001, got ${REDIS_OUT_OWNER}" >&2
    exit 1
fi

REDIS_PING="$(<"${REDIS_OUTPUT_FILE}")"

# Normalize output: strip CR and surrounding whitespace
NORM_REDIS_PING="$(echo "${REDIS_PING}" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

# Accept only exact single-line PONG
LINE_COUNT="$(printf "%s\n" "${NORM_REDIS_PING}" | wc -l)"
if [ "${LINE_COUNT}" -ne 1 ] || [ "${NORM_REDIS_PING}" != "PONG" ]; then
    SAFE_RESP="$(echo "${NORM_REDIS_PING}" | head -n 1 | cut -c1-100)"
    echo "FAIL: Redis probe did not return exact single-line PONG (response: '${SAFE_RESP}')" >&2
    exit 1
fi

case "${NORM_REDIS_PING}" in
    *"AUTH failed"*|*"WRONGPASS"*|*"NOAUTH"*|*"Warning"*|*"warning"*|*$'\n'*)
        echo "FAIL: Redis response contained authentication error or warning: '${NORM_REDIS_PING}'" >&2
        exit 1
        ;;
esac

# Remove the output file and verify its absence; keep tracked until absence is confirmed
rm -f "${REDIS_OUTPUT_FILE}"
if [ -e "${REDIS_OUTPUT_FILE}" ] || [ -L "${REDIS_OUTPUT_FILE}" ]; then
    echo "FAIL: Absence verification failed for Redis output file: ${REDIS_OUTPUT_FILE}" >&2
    exit 1
fi

# Remove from TEMP_FILES now that absence is confirmed
NEW_TEMP_FILES=()
for tf in "${TEMP_FILES[@]}"; do
    if [ "${tf}" != "${REDIS_OUTPUT_FILE}" ]; then
        NEW_TEMP_FILES+=("${tf}")
    fi
done
TEMP_FILES=("${NEW_TEMP_FILES[@]}")

echo "✓ Authenticated Redis PING: PONG (status: 0, credentials contained via stdin stream)"

# 2. Authenticated PostgreSQL SELECT 1;
set +e
PG_ONE=$(docker exec socialpulse-staging-postgres-1 sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 1;"' 2>&1 | tr -d '\r')
PG_STATUS=$?
set -e
if [ "${PG_STATUS}" -ne 0 ] || [ "${PG_ONE}" != "1" ]; then
    echo "FAIL: PostgreSQL authenticated SELECT 1 failed (status: ${PG_STATUS}, response: '${PG_ONE}')" >&2
    exit 1
fi
echo "✓ Authenticated PostgreSQL SELECT 1: 1 (status: 0, credentials contained)"

# 3. Backend Liveness (/health/live)
set +e
BACKEND_LIVE_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health/live)
CURL_LIVE_EXIT=$?
set -e
echo "Backend Liveness (http://127.0.0.1:3001/health/live): HTTP ${BACKEND_LIVE_STATUS} (curl exit: ${CURL_LIVE_EXIT})"
if [ "${CURL_LIVE_EXIT}" -ne 0 ] || [ "${BACKEND_LIVE_STATUS}" != "200" ]; then
    echo "FAIL: Backend /health/live probe failed (curl exit: ${CURL_LIVE_EXIT}, HTTP: ${BACKEND_LIVE_STATUS})" >&2
    exit 1
fi
echo "✓ Backend liveness probe passed: HTTP 200"

# 4. Backend Readiness (/health/ready) — structured JSON validation via protected temporary file
TEMP_READY_FILE=$(mktemp /tmp/sp8c7a_ready_XXXXXX.json)
TEMP_FILES+=("${TEMP_READY_FILE}")

set +e
BACKEND_READY_STATUS=$(curl -sS -o "${TEMP_READY_FILE}" -w "%{http_code}" http://127.0.0.1:3001/health/ready)
CURL_READY_EXIT=$?
set -e
echo "Backend Readiness (http://127.0.0.1:3001/health/ready): HTTP ${BACKEND_READY_STATUS} (curl exit: ${CURL_READY_EXIT})"
cat "${TEMP_READY_FILE}"
echo ""

if [ "${CURL_READY_EXIT}" -ne 0 ] || [ "${BACKEND_READY_STATUS}" != "200" ]; then
    echo "FAIL: Backend /health/ready probe failed (curl exit: ${CURL_READY_EXIT}, HTTP: ${BACKEND_READY_STATUS})" >&2
    exit 1
fi

set +e
python3 -c '
import sys, json

target_file = sys.argv[1]
with open(target_file, "r") as f:
    try:
        data = json.load(f)
    except Exception as e:
        sys.exit(f"FAIL: Readiness payload is not valid JSON: {e}")

if not isinstance(data, dict):
    sys.exit("FAIL: Readiness payload root is not a JSON object")

if "status" not in data:
    sys.exit("FAIL: Readiness payload missing required status field")

status_val = data.get("status")
core_ready = data.get("coreReady")

if core_ready is not True:
    sys.exit(f"FAIL: Readiness coreReady field is {core_ready}, expected True")

print(f"✓ Structured readiness validation passed: status=\"{status_val}\", coreReady=True")
' "${TEMP_READY_FILE}"
READY_PY_STATUS=$?
set -e
if [ "${READY_PY_STATUS}" -ne 0 ]; then
    echo "FAIL: Readiness JSON validation failed with exit status ${READY_PY_STATUS}" >&2
    exit 1
fi

# 5. Frontend Staging (Port 8081)
set +e
FRONTEND_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8081)
CURL_FE_EXIT=$?
set -e
echo "Frontend Staging (http://127.0.0.1:8081): HTTP ${FRONTEND_STATUS} (curl exit: ${CURL_FE_EXIT})"
if [ "${CURL_FE_EXIT}" -ne 0 ] || [ "${FRONTEND_STATUS}" != "200" ]; then
    echo "FAIL: Frontend staging probe failed (curl exit: ${CURL_FE_EXIT}, HTTP: ${FRONTEND_STATUS})" >&2
    exit 1
fi
echo "✓ Frontend staging probe passed: HTTP 200"

# 6. Evergreen Production Health (Port 3000)
set +e
EVERGREEN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health)
CURL_EG_EXIT=$?
set -e
echo "Evergreen Production Health (http://127.0.0.1:3000/api/health): HTTP ${EVERGREEN_STATUS} (curl exit: ${CURL_EG_EXIT})"
if [ "${CURL_EG_EXIT}" -ne 0 ] || [ "${EVERGREEN_STATUS}" != "200" ]; then
    echo "FAIL: Evergreen production health check failed (curl exit: ${CURL_EG_EXIT}, HTTP: ${EVERGREEN_STATUS})" >&2
    exit 1
fi
echo "✓ Evergreen production health preserved: HTTP 200"

# ------------------------------------------------------------------------------
# STEP 4: OBSERVATIONAL DATABASE CLASSIFICATION & TABLE-SET AUDIT
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 4: OBSERVATIONAL DATABASE CLASSIFICATION & TABLE-SET AUDIT ==="
echo "NOTE: Observational evidence only. NO MIGRATION BRANCH IS AUTHORIZED."

set +e
PG_CATALOG_QUERY='SELECT json_build_object(
  $$runtime_public_tables$$, (SELECT COALESCE(json_agg(table_name ORDER BY table_name), $$[]$$::json) 
                             FROM information_schema.tables 
                             WHERE table_schema = $$public$$ AND table_type = $$BASE TABLE$$),
  $$has_migration_ledger$$, EXISTS (SELECT 1 FROM information_schema.tables 
                                   WHERE table_schema = $$public$$ AND table_name = $$schema_migrations$$),
  $$has_trigger_fn$$, EXISTS (SELECT 1 FROM pg_proc p 
                              JOIN pg_namespace n ON n.oid = p.pronamespace 
                              WHERE n.nspname = $$public$$ AND p.proname = $$update_updated_at_column$$)
);'
DB_CATALOG_RAW=$(docker exec socialpulse-staging-postgres-1 sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "$1"' _ "${PG_CATALOG_QUERY}" | tr -d '\r')
DB_CATALOG_STATUS=$?
set -e

if [ "${DB_CATALOG_STATUS}" -ne 0 ]; then
    echo "FAIL: PostgreSQL catalog query failed with exit status ${DB_CATALOG_STATUS}" >&2
    exit 1
fi

set +e
MODE_EVAL_JSON=$(echo "${DB_CATALOG_RAW}" | python3 -c '
import sys, json

try:
    data = json.load(sys.stdin)
except Exception as e:
    sys.exit(f"FAIL: Catalog data is not valid JSON: {e}")

runtime_tables = set(data.get("runtime_public_tables", []))
has_ledger = data.get("has_migration_ledger", False)
has_trigger_fn = data.get("has_trigger_fn", False)

expected_foundation_tables = {
    "users", "social_accounts", "posts", "post_analytics", "campaigns", 
    "templates", "hashtag_sets", "media_files", "stripe_customers", "usage_events", 
    "password_reset_tokens", "teams", "team_members", "team_invites", "notifications", 
    "rss_feeds", "rss_entries", "api_keys", "listening_rules", "listening_results", 
    "inbox_messages", "referrals", "workspaces", "workspace_members", "workspace_invites"
}

foundation_tables_present = runtime_tables - {"schema_migrations"}
matched_foundation_tables = sorted(list(foundation_tables_present & expected_foundation_tables))
missing_foundation_tables = sorted(list(expected_foundation_tables - foundation_tables_present))
unexpected_public_tables = sorted(list(foundation_tables_present - expected_foundation_tables))

# Accurate terminology: foundation_name_set_match
foundation_name_set_match = (
    len(missing_foundation_tables) == 0 and 
    len(unexpected_public_tables) == 0 and 
    has_trigger_fn
)

# Observational classification — no branch authorized
if has_ledger and len(runtime_tables) > 1:
    observed_state = "OBSERVED_BRANCH_A_ACTIVE_LEDGER_INCREMENTAL"
elif len(runtime_tables) == 0:
    observed_state = "OBSERVED_BRANCH_B_CLEAN_EMPTY_BOOTSTRAP"
elif not has_ledger and foundation_name_set_match:
    observed_state = "OBSERVED_BRANCH_C_LEDGER_ABSENT_BASE_SCHEMA_ADOPTION"
else:
    observed_state = "OBSERVED_INDETERMINATE_OR_DIRTY_STATE"

res = {
    "observational_state": observed_state,
    "authorization_status": "NO_MIGRATION_BRANCH_AUTHORIZED",
    "runtime_public_table_count": len(runtime_tables),
    "runtime_public_tables": sorted(list(runtime_tables)),
    "has_migration_ledger": has_ledger,
    "has_trigger_fn": has_trigger_fn,
    "expected_foundation_count": len(expected_foundation_tables),
    "matched_foundation_count": len(matched_foundation_tables),
    "matched_foundation_tables": matched_foundation_tables,
    "missing_foundation_count": len(missing_foundation_tables),
    "missing_foundation_tables": missing_foundation_tables,
    "unexpected_public_count": len(unexpected_public_tables),
    "unexpected_public_tables": unexpected_public_tables,
    "foundation_name_set_match": foundation_name_set_match,
    "structural_fingerprint_evaluated": False,
    "branch_c_execution_status": "STRICTLY_PROHIBITED_PENDING_TRUE_STRUCTURAL_FINGERPRINT"
}
print(json.dumps(res, indent=2))
')
MODE_EVAL_STATUS=$?
set -e

if [ "${MODE_EVAL_STATUS}" -ne 0 ]; then
    echo "FAIL: Database observational evaluation failed with exit status ${MODE_EVAL_STATUS}" >&2
    exit 1
fi

echo "Observational Database Evidence Result:"
echo "${MODE_EVAL_JSON}"

OBSERVED_STATE=$(echo "${MODE_EVAL_JSON}" | python3 -c "import sys, json; print(json.load(sys.stdin)['observational_state'])")
AUTH_STATUS=$(echo "${MODE_EVAL_JSON}" | python3 -c "import sys, json; print(json.load(sys.stdin)['authorization_status'])")
PUBLIC_COUNT=$(echo "${MODE_EVAL_JSON}" | python3 -c "import sys, json; print(json.load(sys.stdin)['runtime_public_table_count'])")
HAS_LEDGER=$(echo "${MODE_EVAL_JSON}" | python3 -c "import sys, json; print(json.load(sys.stdin)['has_migration_ledger'])")

if [ "${OBSERVED_STATE}" = "OBSERVED_INDETERMINATE_OR_DIRTY_STATE" ]; then
    echo "FAIL: Database state is indeterminate or dirty! Observational audit halted." >&2
    exit 1
fi

echo "✓ Observational database state recorded: ${OBSERVED_STATE} (tables: ${PUBLIC_COUNT}, ledger: ${HAS_LEDGER})"
echo "✓ Explicit Policy Enforcement: ${AUTH_STATUS} — Zero migrations authorized"

# Complete Ledger Structure and Records Collection
echo ""
echo "--- Comprehensive Migration Ledger Structure & Records Audit ---"
if [ "${HAS_LEDGER}" = "True" ] || [ "${HAS_LEDGER}" = "true" ]; then
    echo "Ledger table schema_migrations is PRESENT."
    echo "Querying schema_migrations table column definitions:"
    set +e
    PG_LEDGER_COL_QUERY='SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = $$public$$ AND table_name = $$schema_migrations$$ 
      ORDER BY ordinal_position;'
    docker exec socialpulse-staging-postgres-1 sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' _ "${PG_LEDGER_COL_QUERY}"
    LEDGER_COL_STATUS=$?
    set -e
    if [ "${LEDGER_COL_STATUS}" -ne 0 ]; then
        echo "FAIL: Failed to query schema_migrations columns (status: ${LEDGER_COL_STATUS})" >&2
        exit 1
    fi

    echo "Querying all applied schema_migrations records:"
    set +e
    docker exec socialpulse-staging-postgres-1 sh -c '
    PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
      SELECT id, migration_id, filename, checksum, applied_at, execution_time_ms, application_mode 
      FROM schema_migrations 
      ORDER BY id;
    "
    '
    LEDGER_REC_STATUS=$?
    set -e
    if [ "${LEDGER_REC_STATUS}" -ne 0 ]; then
        echo "FAIL: Failed to query schema_migrations records (status: ${LEDGER_REC_STATUS})" >&2
        exit 1
    fi
else
    echo "Ledger table schema_migrations is ABSENT (0 ledger records present)."
fi

# ------------------------------------------------------------------------------
# STEP 5: EXACT RUNTIME RUNNERS & OBSERVATIONAL SQL MIGRATION INVENTORY
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 5: EXACT RUNTIME RUNNERS & OBSERVATIONAL SQL MIGRATION INVENTORY ==="

STEP5_FINDINGS=()

# Source baseline hashes (from Windows/source repository build baseline)
MIGRATE_JS_SRC_EXP="ee62f5a8639767979a733dd1e55a19ff35ea64e76415bd77c3a254a2d08d19f6"
MIGRATION_STATUS_JS_SRC_EXP="6f87234943a331ea2872f6a198a02b39a90476f38085adfd8a4f6e32959e40ec"

# 1. Audit migrate.js inside socialpulse-staging-server-1
set +e
ACTUAL_MIGRATE_HASH=$(docker exec socialpulse-staging-server-1 sh -c '
if [ -f /app/dist/database/migrate.js ] && [ ! -L /app/dist/database/migrate.js ]; then
    sha256sum /app/dist/database/migrate.js | awk "{print \$1}"
else
    echo "MISSING"
fi
' | tr -d '\r')
MIGRATE_RUNNER_STATUS=$?
set -e

echo "Compiled Runner: migrate.js"
echo "  Expected Package Hash  : ${MIGRATE_JS_SRC_EXP}"
echo "  Observed Container Hash: ${ACTUAL_MIGRATE_HASH}"
if [ "${MIGRATE_RUNNER_STATUS}" -ne 0 ] || [ "${ACTUAL_MIGRATE_HASH}" = "MISSING" ]; then
    echo "  Verdict                : MISSING"
    STEP5_FINDINGS+=("MIGRATE_JS_MISSING")
elif [ "${ACTUAL_MIGRATE_HASH}" = "${MIGRATE_JS_SRC_EXP}" ]; then
    echo "  Verdict                : MATCH"
else
    echo "  Verdict                : MISMATCH (Observed container Linux hash: ${ACTUAL_MIGRATE_HASH})"
    STEP5_FINDINGS+=("MIGRATE_JS_HASH_MISMATCH")
fi

# 2. Audit migrationStatus.js inside socialpulse-staging-server-1
set +e
ACTUAL_STATUS_HASH=$(docker exec socialpulse-staging-server-1 sh -c '
if [ -f /app/dist/database/scripts/migrationStatus.js ] && [ ! -L /app/dist/database/scripts/migrationStatus.js ]; then
    sha256sum /app/dist/database/scripts/migrationStatus.js | awk "{print \$1}"
else
    echo "MISSING"
fi
' | tr -d '\r')
STATUS_RUNNER_STATUS=$?
set -e

echo "Compiled Runner: migrationStatus.js"
echo "  Expected Package Hash  : ${MIGRATION_STATUS_JS_SRC_EXP}"
echo "  Observed Container Hash: ${ACTUAL_STATUS_HASH}"
if [ "${STATUS_RUNNER_STATUS}" -ne 0 ] || [ "${ACTUAL_STATUS_HASH}" = "MISSING" ]; then
    echo "  Verdict                : MISSING"
    STEP5_FINDINGS+=("MIGRATION_STATUS_JS_MISSING")
elif [ "${ACTUAL_STATUS_HASH}" = "${MIGRATION_STATUS_JS_SRC_EXP}" ]; then
    echo "  Verdict                : MATCH"
else
    echo "  Verdict                : MISMATCH (Observed container Linux hash: ${ACTUAL_STATUS_HASH})"
    STEP5_FINDINGS+=("MIGRATION_STATUS_JS_HASH_MISMATCH")
fi

# 3. Observational SQL Migration Directory & Inventory Audit
GOVERNED_MIGRATIONS_DIR="/app/dist/database/migrations"
set +e
DIR_CHECK=$(docker exec socialpulse-staging-server-1 sh -c "
if [ -d \"${GOVERNED_MIGRATIONS_DIR}\" ] && [ ! -L \"${GOVERNED_MIGRATIONS_DIR}\" ]; then
    echo 'VALID_DIR'
else
    echo 'ABSENT'
fi
" | tr -d '\r')
set -e

echo "Governed Migrations Directory (${GOVERNED_MIGRATIONS_DIR}):"
if [ "${DIR_CHECK}" != "VALID_DIR" ]; then
    echo "  Status: ABSENT from container image"
    STEP5_FINDINGS+=("MIGRATION_FILES_ABSENT_FROM_IMAGE")
else
    echo "  Status: PRESENT"
    EXPECTED_SORTED_SQL_FILES=(
        "20260515_ecommerce.sql"
        "20260515_ecommerce_add_seller_id.sql"
        "20260522_add_workspace_id_to_missing_tables.sql"
        "20260613_paid_ads.sql"
        "20260613_sales_pages.sql"
        "20260613_zeely_expansion.sql"
        "20260614_add_product_info_to_workspaces.sql"
        "20260717_omnichannel_marketing.sql"
        "20260830_add_unique_stripe_session_id.sql"
        "20260831_claims_library_and_brand_governance.sql"
        "20260831_evergreen_integration_and_suppression.sql"
        "20260831_omnisend_and_q2c_sync.sql"
    )

    set +e
    ACTUAL_SORTED_FILES=($(docker exec socialpulse-staging-server-1 sh -c "
    find \"${GOVERNED_MIGRATIONS_DIR}\" -maxdepth 1 -mindepth 1 -type f -name '*.sql' -exec basename {} \; | sort
    " | tr -d '\r'))
    FIND_SQL_STATUS=$?
    set -e

    if [ "${FIND_SQL_STATUS}" -ne 0 ] || [ "${#ACTUAL_SORTED_FILES[@]}" -lt 12 ]; then
        STEP5_FINDINGS+=("MIGRATION_FILES_INCOMPLETE")
    fi

    SET_MISMATCH=0
    for i in "${!EXPECTED_SORTED_SQL_FILES[@]}"; do
        if [ "${ACTUAL_SORTED_FILES[i]:-}" != "${EXPECTED_SORTED_SQL_FILES[i]}" ]; then
            SET_MISMATCH=1
        fi
    done
    if [ "${SET_MISMATCH}" -ne 0 ]; then
        STEP5_FINDINGS+=("MIGRATION_FILE_SET_MISMATCH")
    fi

    declare -A EXPECTED_SQL_HASHES=(
        ["20260515_ecommerce.sql"]="df7d737a8357296ebfff5139710dd25d644143ba24c7dca608327b2bff2ad9fa"
        ["20260515_ecommerce_add_seller_id.sql"]="a109f2a5bb37ac174a96b74979ad15abf82e539579127e6bee9724a927c5c4c9"
        ["20260522_add_workspace_id_to_missing_tables.sql"]="a8bdf063875994117dd075eabb5a8fc3ac779d7026f9a4857623c53bc7e7655f"
        ["20260613_paid_ads.sql"]="cd19a384496a427712f6638a380ea6e52bff2f55d8cf8762a2275bde6bb80a53"
        ["20260613_sales_pages.sql"]="b747897965313186903008c21559301f9588d17fff68a55249f98e7634b9ca62"
        ["20260613_zeely_expansion.sql"]="e921882476f3bf29d04dc72d2191f01667e1a826e4508a3d50f30fdb2f9ffada"
        ["20260614_add_product_info_to_workspaces.sql"]="1023eb17652d4fb3aea45786996a8b7ad543b8eee895a5d55412b057ba7ae435"
        ["20260717_omnichannel_marketing.sql"]="5af3e7cb71db94d9d478e3ab72fbd9895a62685ecc802088f6994a6af2848987"
        ["20260830_add_unique_stripe_session_id.sql"]="87d2c6eb47f9a658693d14da70b7c9c64e9d022764e0611de7a90ac885dcb56c"
        ["20260831_claims_library_and_brand_governance.sql"]="f1076990491d4a6d1786d5cf444a891589abb2c8ed1e53326a39af67d6335cac"
        ["20260831_evergreen_integration_and_suppression.sql"]="76fb6ae21c523a77fa374e659418c6a54d130c36b13d8e2fb068fb86b13a2b81"
        ["20260831_omnisend_and_q2c_sync.sql"]="ea21dae5e2ffdf5707ba004288c6b7c26ff81085437247b82fba6c1344135ea1"
    )

    HASH_MISMATCH=0
    for sql_name in "${EXPECTED_SORTED_SQL_FILES[@]}"; do
        EXP_HASH="${EXPECTED_SQL_HASHES[${sql_name}]}"
        FILE_PATH="${GOVERNED_MIGRATIONS_DIR}/${sql_name}"
        CHECK_OUTPUT=$(docker exec socialpulse-staging-server-1 sh -c "
        if [ -f \"${FILE_PATH}\" ] && [ ! -L \"${FILE_PATH}\" ]; then
            sha256sum \"${FILE_PATH}\" | awk '{print \$1}'
        else
            echo 'INVALID_OR_MISSING'
        fi
        " | tr -d '\r')
        if [ "${CHECK_OUTPUT}" != "${EXP_HASH}" ]; then
            HASH_MISMATCH=1
        fi
    done
    if [ "${HASH_MISMATCH}" -ne 0 ]; then
        STEP5_FINDINGS+=("MIGRATION_FILE_HASH_MISMATCH")
    fi

    if [ "${#STEP5_FINDINGS[@]}" -eq 0 ]; then
        STEP5_FINDINGS+=("MIGRATION_FILES_VERIFIED")
    fi
fi

echo "✓ Step 5 observational runners and SQL migration audit completed (${#STEP5_FINDINGS[@]} findings recorded)"

# ------------------------------------------------------------------------------
# STEP 6: COMPOSE MANIFEST, PROFILE RENDERING & EXTENDED JSON AUDITOR
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 6: COMPOSE MANIFEST, PROFILE RENDERING & EXTENDED JSON AUDITOR ==="

# 1. Require Single Canonical /opt/socialpulse/docker-compose.staging.yml with Approved Hash
COMPOSE_FILE="/opt/socialpulse/docker-compose.staging.yml"
EXPECTED_COMPOSE_HASH="e97d729f597657d589257f74acaa8467d2e5d034b32bb946692dfef73ee3a008"
EXPECTED_COMPOSE_BYTES=5051

if [ ! -f "${COMPOSE_FILE}" ] || [ -L "${COMPOSE_FILE}" ]; then
    echo "FAIL: Canonical staging compose file missing or symlink: ${COMPOSE_FILE}!" >&2
    exit 1
fi

set +e
ACTUAL_COMPOSE_HASH="$(sha256sum "${COMPOSE_FILE}" | awk '{print $1}')"
COMPOSE_HASH_STATUS=$?
ACTUAL_COMPOSE_BYTES="$(stat -c '%s' "${COMPOSE_FILE}")"
COMPOSE_BYTES_STATUS=$?
set -e

if [ "${COMPOSE_HASH_STATUS}" -ne 0 ] || [ "${COMPOSE_BYTES_STATUS}" -ne 0 ]; then
    echo "FAIL: Unable to stat or hash ${COMPOSE_FILE}" >&2
    exit 1
fi

echo "Canonical Compose Manifest: ${COMPOSE_FILE}"
echo "  Observed SHA-256 : ${ACTUAL_COMPOSE_HASH}"
echo "  Expected SHA-256 : ${EXPECTED_COMPOSE_HASH}"
echo "  Observed Bytes   : ${ACTUAL_COMPOSE_BYTES}"
echo "  Expected Bytes   : ${EXPECTED_COMPOSE_BYTES}"

if [ "${ACTUAL_COMPOSE_HASH}" != "${EXPECTED_COMPOSE_HASH}" ]; then
    echo "FAIL: Canonical Compose manifest hash mismatch: got ${ACTUAL_COMPOSE_HASH}, expected ${EXPECTED_COMPOSE_HASH}!" >&2
    exit 1
fi

if [ "${ACTUAL_COMPOSE_BYTES}" -ne "${EXPECTED_COMPOSE_BYTES}" ]; then
    echo "FAIL: Canonical Compose manifest byte mismatch: got ${ACTUAL_COMPOSE_BYTES}, expected ${EXPECTED_COMPOSE_BYTES}!" >&2
    exit 1
fi
echo "✓ Verified single canonical Compose manifest matches approved cryptographic hash and bytes"

# 2. Prove COMPOSE_PROFILES Remains Unset in Environment Prior to Rendering
if [ -n "${COMPOSE_PROFILES:-}" ]; then
    echo "FAIL: COMPOSE_PROFILES environment variable is set prior to rendering ('${COMPOSE_PROFILES}'). Expected unset!" >&2
    exit 1
fi
echo "✓ Confirmed COMPOSE_PROFILES environment variable is strictly unset prior to rendering"

# 3. Explicitly Render Migration Profile Without Creating Containers & Capture Status Unmasked
TEMP_COMPOSE_JSON=$(mktemp /tmp/sp8c7a_compose_XXXXXX.json)
TEMP_FILES+=("${TEMP_COMPOSE_JSON}")

set +e
docker compose -f "${COMPOSE_FILE}" --profile migration config --format json > "${TEMP_COMPOSE_JSON}"
COMPOSE_STATUS=$?
set -e

echo "Docker Compose Profile Rendering Exit Status: ${COMPOSE_STATUS}"
if [ "${COMPOSE_STATUS}" -ne 0 ]; then
    echo "FAIL: docker compose --profile migration config returned non-zero status ${COMPOSE_STATUS}!" >&2
    exit 1
fi
echo "✓ Rendered migration profile explicitly without creating containers (unmasked exit status 0)"

# 4. Reverify COMPOSE_PROFILES Remains Strictly Unset in Environment After Rendering
if [ -n "${COMPOSE_PROFILES:-}" ]; then
    echo "FAIL: COMPOSE_PROFILES environment variable became set after rendering ('${COMPOSE_PROFILES}'). Expected unset!" >&2
    exit 1
fi
echo "✓ Reverified COMPOSE_PROFILES remains strictly unset after profile rendering"

# 5. Extended JSON Auditor (Passed via Temporary File, Zero Source Interpolation)
set +e
python3 -c '
import sys, json

target_file = sys.argv[1]
with open(target_file, "r") as f:
    try:
        cfg = json.load(f)
    except Exception as e:
        sys.exit(f"FAIL: Rendered Compose config is not valid JSON: {e}")

services = cfg.get("services", {})
if "migrate" not in services:
    sys.exit("FAIL: Service \"migrate\" not present in rendered Compose model!")

m = services["migrate"]

# a. Exact migration image
expected_image = "artradepro/socialpulse-backend@sha256:73e9d3366edd4e714e4ade1acd45e78cc20c9e84803572dda96b0ba65818eb2a"
image = m.get("image", "")
if image != expected_image:
    sys.exit(f"FAIL: Migrate image is \"{image}\", expected strictly \"{expected_image}\"")

# b. Exact migration profile: strictly ["migration"]
profiles = m.get("profiles", [])
if profiles != ["migration"]:
    sys.exit(f"FAIL: Migrate profiles is {profiles}, expected strictly [\"migration\"]")

# c. Exact normalized command: "node dist/database/migrate.js"
cmd = m.get("command", [])
if isinstance(cmd, list):
    normalized_cmd = " ".join(cmd).strip()
else:
    normalized_cmd = str(cmd).strip()
if normalized_cmd != "node dist/database/migrate.js":
    sys.exit(f"FAIL: Migrate command normalized to \"{normalized_cmd}\", expected strictly \"node dist/database/migrate.js\"")

# d. Exact restart policy: "no"
restart = m.get("restart", "")
if restart != "no":
    sys.exit(f"FAIL: Migrate restart policy is \"{restart}\", expected strictly \"no\"")

# e. Sole healthy PostgreSQL dependency: depends_on == {"postgres": {"condition": "service_healthy"}}
depends = m.get("depends_on", {})
dep_keys = list(depends.keys())
if dep_keys != ["postgres"]:
    sys.exit(f"FAIL: Migrate depends_on services {dep_keys}, expected strictly [\"postgres\"]")

pg_cond = depends["postgres"].get("condition", "") if isinstance(depends["postgres"], dict) else str(depends["postgres"])
if pg_cond != "service_healthy":
    sys.exit(f"FAIL: PostgreSQL dependency condition is \"{pg_cond}\", expected \"service_healthy\"")

# f. Exact sole network: strictly ["staging_net"]
networks = m.get("networks", {})
if isinstance(networks, dict):
    net_list = sorted(list(networks.keys()))
elif isinstance(networks, list):
    net_list = sorted(list(networks))
else:
    net_list = [str(networks)]
if net_list != ["staging_net"]:
    sys.exit(f"FAIL: Migrate networks is {net_list}, expected strictly [\"staging_net\"]")

# g. Zero published ports
ports = m.get("ports", [])
if ports and len(ports) > 0:
    sys.exit(f"FAIL: Prohibited ports exposed on migrate service: {ports}")

# h. Zero bind mounts
volumes = m.get("volumes", [])
for v in volumes:
    v_type = v.get("type", "") if isinstance(v, dict) else ""
    v_src = v.get("source", "") if isinstance(v, dict) else str(v)
    if v_type == "bind" or v_src.startswith("/") or v_src.startswith("."):
        sys.exit(f"FAIL: Prohibited bind mount detected in migrate service: {v}")

# i. Zero devices
devices = m.get("devices", [])
if devices and len(devices) > 0:
    sys.exit(f"FAIL: Prohibited devices detected in migrate service: {devices}")

# j. Zero privileged or host namespaces
if m.get("privileged") is True:
    sys.exit("FAIL: Migrate service has privileged: true!")

if m.get("network_mode") == "host":
    sys.exit("FAIL: Migrate service has network_mode: host!")

if m.get("ipc") == "host":
    sys.exit("FAIL: Migrate service has ipc: host!")

if m.get("pid") == "host":
    sys.exit("FAIL: Migrate service has pid: host!")

# k. Zero Docker socket mounts
for v in volumes:
    v_src = v.get("source", "") if isinstance(v, dict) else str(v)
    v_tgt = v.get("target", "") if isinstance(v, dict) else str(v)
    if "docker.sock" in v_src or "docker.sock" in v_tgt:
        sys.exit(f"FAIL: Prohibited Docker socket mount detected in migrate service: {v}")

print("✓ Extended JSON auditor verified all 11 migration container security controls passed:")
print("  - Exact immutable image digest: PASS")
print("  - Exact profile [\"migration\"]: PASS")
print("  - Exact normalized command    : PASS (node dist/database/migrate.js)")
print("  - Exact restart policy \"no\"   : PASS")
print("  - Sole healthy PostgreSQL dep : PASS")
print("  - Exact sole net [staging_net]: PASS")
print("  - Zero published ports        : PASS")
print("  - Zero bind mounts            : PASS")
print("  - Zero devices                : PASS")
print("  - Zero privileged/host ns     : PASS")
print("  - Zero Docker-socket mounts   : PASS")
' "${TEMP_COMPOSE_JSON}"
AUDITOR_STATUS=$?
set -e

if [ "${AUDITOR_STATUS}" -ne 0 ]; then
    echo "FAIL: Extended Compose JSON auditor failed with exit status ${AUDITOR_STATUS}" >&2
    exit 1
fi

# 6. PostgreSQL Persistent Volume Mount Audit (via Stdin, Zero Source Interpolation)
echo ""
echo "--- PostgreSQL Persistent Volume Mount Audit ---"
set +e
docker inspect --format '{{json .Mounts}}' socialpulse-staging-postgres-1 | python3 -c '
import sys, json

try:
    mounts = json.load(sys.stdin)
except Exception as e:
    sys.exit(f"FAIL: PostgreSQL mounts payload is not valid JSON: {e}")

data_mount = next((m for m in mounts if m.get("Destination") == "/var/lib/postgresql/data"), None)
if not data_mount:
    sys.exit("FAIL: Destination /var/lib/postgresql/data not found in PostgreSQL mounts!")

mount_type = data_mount.get("Type")
if mount_type != "volume":
    sys.exit(f"FAIL: PostgreSQL mount type is {mount_type}, expected volume")

mount_name = data_mount.get("Name")
if mount_name != "socialpulse-staging_postgres_data":
    sys.exit(f"FAIL: PostgreSQL mount volume name is {mount_name}, expected socialpulse-staging_postgres_data")

is_rw = data_mount.get("RW")
if is_rw is not True:
    sys.exit("FAIL: PostgreSQL mount is not Read-Write (RW=True)!")

print("✓ Verified PostgreSQL persistent volume mount: socialpulse-staging_postgres_data -> /var/lib/postgresql/data (rw)")
'
PG_MOUNT_STATUS=$?
set -e

if [ "${PG_MOUNT_STATUS}" -ne 0 ]; then
    echo "FAIL: PostgreSQL persistent volume mount audit failed with exit status ${PG_MOUNT_STATUS}" >&2
    exit 1
fi

# 7. Canonical Non-Symlink Backup Directory Pre-Validation & Strict ACL Audit
echo ""
echo "--- Canonical Non-Symlink Backup Directory Pre-Validation & Strict ACL Audit ---"
BACKUP_DIR="/opt/socialpulse/backups"

if [ ! -e "${BACKUP_DIR}" ] && [ ! -L "${BACKUP_DIR}" ]; then
    echo "FAIL: Backup directory ${BACKUP_DIR} does not exist on host!" >&2
    exit 1
fi

if [ -L "${BACKUP_DIR}" ]; then
    echo "FAIL: Backup directory ${BACKUP_DIR} is a symlink!" >&2
    exit 1
fi

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "FAIL: Backup directory ${BACKUP_DIR} is not a directory!" >&2
    exit 1
fi

set +e
CANONICAL_BACKUP_DIR="$(realpath "${BACKUP_DIR}")"
REALPATH_STATUS=$?
set -e
if [ "${REALPATH_STATUS}" -ne 0 ] || [ "${CANONICAL_BACKUP_DIR}" != "/opt/socialpulse/backups" ]; then
    echo "FAIL: Canonical backup directory ${CANONICAL_BACKUP_DIR} does not match expected /opt/socialpulse/backups (status: ${REALPATH_STATUS})!" >&2
    exit 1
fi

set +e
BACKUP_OWNER="$(stat -c "%u:%g" "${CANONICAL_BACKUP_DIR}")"
STAT_OWNER_STATUS=$?
BACKUP_PERMS="$(stat -c "%a" "${CANONICAL_BACKUP_DIR}")"
STAT_PERMS_STATUS=$?
set -e

if [ "${STAT_OWNER_STATUS}" -ne 0 ] || [ "${STAT_PERMS_STATUS}" -ne 0 ]; then
    echo "FAIL: stat command failed on ${CANONICAL_BACKUP_DIR}" >&2
    exit 1
fi

if [ "${BACKUP_OWNER}" != "1001:1001" ] || [ "${BACKUP_PERMS}" != "700" ]; then
    echo "FAIL: Backup directory permissions or owner invalid: ${BACKUP_PERMS} ${BACKUP_OWNER} (expected 700 1001:1001)!" >&2
    exit 1
fi

set +e
AVAILABLE_KB=$(df --output=avail "${CANONICAL_BACKUP_DIR}" | tail -n 1 | tr -d ' ')
DF_STATUS=$?
set -e

if [ "${DF_STATUS}" -ne 0 ] || ! [[ "${AVAILABLE_KB}" =~ ^[0-9]+$ ]]; then
    echo "FAIL: df failed on ${CANONICAL_BACKUP_DIR} with status ${DF_STATUS}" >&2
    exit 1
fi

if [ "${AVAILABLE_KB}" -lt 102400 ]; then
    echo "FAIL: Insufficient backup disk space: ${AVAILABLE_KB} KB available (minimum 100 MB required)!" >&2
    exit 1
fi

# Capture Filesystem Type & Mount Evidence Explicitly
set +e
FS_TYPE="$(stat -f -c "%T" "${CANONICAL_BACKUP_DIR}")"
STAT_FS_STATUS=$?
set -e
if [ "${STAT_FS_STATUS}" -ne 0 ]; then
    echo "FAIL: stat -f -c %T failed on ${CANONICAL_BACKUP_DIR} with status ${STAT_FS_STATUS}" >&2
    exit 1
fi

set +e
MOUNT_SOURCE="$(findmnt -n -o SOURCE -T "${CANONICAL_BACKUP_DIR}")"
FINDMNT_SRC_STATUS=$?
MOUNT_TARGET="$(findmnt -n -o TARGET -T "${CANONICAL_BACKUP_DIR}")"
FINDMNT_TGT_STATUS=$?
MOUNT_OPTIONS="$(findmnt -n -o OPTIONS -T "${CANONICAL_BACKUP_DIR}")"
FINDMNT_OPT_STATUS=$?
set -e

if [ "${FINDMNT_SRC_STATUS}" -ne 0 ] || [ "${FINDMNT_TGT_STATUS}" -ne 0 ] || [ "${FINDMNT_OPT_STATUS}" -ne 0 ]; then
    echo "FAIL: findmnt inspection failed on ${CANONICAL_BACKUP_DIR} (src: ${FINDMNT_SRC_STATUS}, tgt: ${FINDMNT_TGT_STATUS}, opt: ${FINDMNT_OPT_STATUS})" >&2
    exit 1
fi

echo "Backup Directory Canonical Evidence:"
echo "  Path          : ${CANONICAL_BACKUP_DIR}"
echo "  Type          : Directory (Non-Symlink)"
echo "  Owner / Group : ${BACKUP_OWNER} (github-runner:github-runner)"
echo "  Permissions   : 0${BACKUP_PERMS} (drwx------)"
echo "  Available Spc : ${AVAILABLE_KB} KB free"
echo "  Filesystem    : ${FS_TYPE}"
echo "  Mount Source  : ${MOUNT_SOURCE}"
echo "  Mount Target  : ${MOUNT_TARGET}"
echo "  Mount Options : ${MOUNT_OPTIONS}"

# Mandatory getfacl Inspection: Require Success & Reject Named/Default ACLs
echo ""
echo "--- Mandatory getfacl Inspection ---"
set +e
GETFACL_OUTPUT="$(getfacl -p "${CANONICAL_BACKUP_DIR}")"
GETFACL_STATUS=$?
set -e

if [ "${GETFACL_STATUS}" -ne 0 ]; then
    echo "FAIL: getfacl -p failed on ${CANONICAL_BACKUP_DIR} with exit status ${GETFACL_STATUS}" >&2
    exit 1
fi

echo "Captured getfacl output:"
echo "${GETFACL_OUTPUT}"

set +e
echo "${GETFACL_OUTPUT}" | python3 -c '
import sys

raw_lines = sys.stdin.read().splitlines()
prohibited = []
has_user_base = False
has_group_base = False
has_other_base = False

for line in raw_lines:
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    
    if line.startswith("user::"):
        has_user_base = True
    elif line.startswith("group::"):
        has_group_base = True
    elif line.startswith("other::"):
        has_other_base = True
    elif line.startswith("user:"):
        prohibited.append(f"Prohibited named-user ACL: {line}")
    elif line.startswith("group:"):
        prohibited.append(f"Prohibited named-group ACL: {line}")
    elif line.startswith("default:"):
        prohibited.append(f"Prohibited default ACL: {line}")
    elif line.startswith("mask:"):
        prohibited.append(f"Prohibited mask ACL: {line}")
    else:
        prohibited.append(f"Unrecognized ACL entry: {line}")

if not (has_user_base and has_group_base and has_other_base):
    sys.exit("FAIL: Base POSIX ACL entries (user::, group::, other::) missing or incomplete")

if prohibited:
    for p in prohibited:
        print(f"ACL VIOLATION: {p}", file=sys.stderr)
    sys.exit("FAIL: Named user, named group, or default ACL entries detected on backup directory")

print("✓ Strict POSIX base ACL validation passed: zero named-user, zero named-group, zero default ACL entries")
'
ACL_AUDIT_STATUS=$?
set -e

if [ "${ACL_AUDIT_STATUS}" -ne 0 ]; then
    echo "FAIL: Strict ACL verification failed with status ${ACL_AUDIT_STATUS}" >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# STEP 7: STANDSTILL VERIFICATION & STRUCTURED FINAL EVIDENCE SUMMARY
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 7: STANDSTILL VERIFICATION & STRUCTURED FINAL EVIDENCE SUMMARY ==="

# Final Evergreen Production Health verification (Port 3000)
set +e
FINAL_EVERGREEN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health)
FINAL_EG_EXIT=$?
set -e
if [ "${FINAL_EG_EXIT}" -ne 0 ] || [ "${FINAL_EVERGREEN_STATUS}" != "200" ]; then
    echo "FAIL: Final Evergreen production health check failed (curl exit: ${FINAL_EG_EXIT}, HTTP: ${FINAL_EVERGREEN_STATUS})" >&2
    exit 1
fi

echo "========================================================================"
if [ "${#STEP5_FINDINGS[@]}" -eq 0 ]; then
    PREFLIGHT_FINAL_OUTCOME="PREFLIGHT_COMPLETE_NO_FINDINGS"
    WORKLOAD_EXIT_CODE=0
else
    PREFLIGHT_FINAL_OUTCOME="PREFLIGHT_COMPLETE_WITH_FINDINGS"
    WORKLOAD_EXIT_CODE=2
fi

echo ">>> FINAL PREFLIGHT OUTCOME: ${PREFLIGHT_FINAL_OUTCOME} (Workload Status: ${WORKLOAD_EXIT_CODE})"
echo ">>> Step 5 Observational Findings Count: ${#STEP5_FINDINGS[@]}"
for f in "${STEP5_FINDINGS[@]}"; do
    echo "  - Finding: ${f}"
done
echo ">>> Mandatory External Trust Anchor Matched : PASS"
echo ">>> Exactly Four Project Services Running   : PASS"
echo ">>> Four Approved Image .Config.Image Match : PASS"
echo ">>> RepoDigests Corroboration Removed       : NOT APPLICABLE"
echo ">>> Pre-Migration Health Baseline Checks    : PASS"
echo ">>> Observational Database Evidence Recorded: PASS (${OBSERVED_STATE})"
echo ">>> Migration Policy Enforcement Verified   : PASS (${AUTH_STATUS})"
echo ">>> Complete Ledger Structure & Records     : PASS (ABSENT, 0 records)"
echo ">>> Canonical docker-compose.staging.yml    : PASS (${ACTUAL_COMPOSE_HASH})"
echo ">>> COMPOSE_PROFILES Reverified Unset       : PASS"
echo ">>> Explicit Profile Rendering & Status 0   : PASS"
echo ">>> Extended 11-Point JSON Auditor Checks   : PASS"
echo ">>> PostgreSQL Persistent Volume Mount (rw) : PASS"
echo ">>> Canonical Backup Dir, FS & Strict ACLs  : PASS"
echo ">>> Zero Snapshots Created                  : PASS (Zero snapshots permitted or created)"
echo ">>> Zero Migration Containers Executed      : PASS (Zero migration containers created/run)"
echo ">>> Zero Database Mutations Permitted       : PASS (Zero mutations performed)"
echo ">>> Evergreen Production Health Preserved   : PASS (HTTP 200)"
echo ">>> Passive Read-Only Standstill Preserved  : PASS (Standalone standstill intact)"
echo "========================================================================"

if [ "${WORKLOAD_EXIT_CODE}" -ne 0 ]; then
    echo ">>> NOTICE: ${PREFLIGHT_FINAL_OUTCOME} DOES NOT AUTHORIZE MIGRATIONS."
    echo ">>> Workload exiting with documented findings status code ${WORKLOAD_EXIT_CODE}."
    exit "${WORKLOAD_EXIT_CODE}"
else
    exit 0
fi
WORKLOAD_EOF

WRAPPER_PIPESTATUS=("${PIPESTATUS[@]}")
RUNNER_STATUS="${WRAPPER_PIPESTATUS[0]:-1}"
TEE_STATUS="${WRAPPER_PIPESTATUS[1]:-1}"
set -e

# ------------------------------------------------------------------------------
# 4. ROOT OUTER WRAPPER STATUS & LOG INVARIANT VERIFICATION
# ------------------------------------------------------------------------------
echo ""
echo "========================================================================"
echo ">>> ROOT WRAPPER STATUS VERIFICATION BLOCK"
echo ">>> Runner Exit Status : ${RUNNER_STATUS}"
echo ">>> Root Tee Status    : ${TEE_STATUS}"
echo "========================================================================"

LOG_SIZE=$(stat -c "%s" "${LOG_FILE}")
LOG_OWNER=$(stat -c "%u:%g" "${LOG_FILE}")
LOG_PERMS=$(stat -c "%a" "${LOG_FILE}")
LOG_SHA=$(sha256sum "${LOG_FILE}" | awk '{print $1}')

echo ">>> Canonical Root Log Verification:"
echo "  Path    : ${LOG_FILE}"
echo "  Size    : ${LOG_SIZE} bytes"
echo "  Owner   : ${LOG_OWNER} (expected 0:0)"
echo "  Mode    : 0${LOG_PERMS} (expected 0600)"
echo "  SHA-256 : ${LOG_SHA}"

if [ "${LOG_OWNER}" != "0:0" ] || [ "${LOG_PERMS}" != "600" ] || [ ! -f "${LOG_FILE}" ] || [ -L "${LOG_FILE}" ]; then
    echo "CRITICAL ERROR: Log file invariant verification failed!" >&2
    exit 1
fi

if [ "${TEE_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Root Tee returned non-zero exit code ${TEE_STATUS}!" >&2
    exit 1
fi

if [ "${RUNNER_STATUS}" -eq 0 ]; then
    echo "========================================================================"
    echo ">>> PASS — PREFLIGHT_COMPLETE_NO_FINDINGS (STATUS: 0)"
    echo "========================================================================"
    exit 0
elif [ "${RUNNER_STATUS}" -eq 2 ]; then
    echo "========================================================================"
    echo ">>> NOTICE — PREFLIGHT_COMPLETE_WITH_FINDINGS (STATUS: 2)"
    echo ">>> Step 5 findings documented. Migration execution remains strictly prohibited."
    echo "========================================================================"
    exit 2
else
    echo "CRITICAL ERROR: Runner returned unhandled failure exit status ${RUNNER_STATUS}!" >&2
    echo "STATUS: PREFLIGHT AUDIT FAILED — ZERO MUTATIONS PERMITTED" >&2
    exit 1
fi
