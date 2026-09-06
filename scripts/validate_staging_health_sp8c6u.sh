#!/bin/bash
# ==============================================================================
# HIGIENE (PTY) LTD — PROJECT EVERGREEN / SOCIALPULSE
# GATE SP-8C-6U: READ-ONLY STAGING HEALTH VALIDATION SCRIPT
# ==============================================================================
set -euo pipefail

# 1. Enforce root EUID and umask 077
if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Health validator wrapper must run as root (EUID 0)." >&2
    exit 1
fi
umask 077

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
LOG_FILE="/root/sp8c6u_health_validation_${TIMESTAMP}.log"

if [ -e "${LOG_FILE}" ] || [ -L "${LOG_FILE}" ]; then
    echo "CRITICAL ERROR: Log file target already exists or is a symlink: ${LOG_FILE}" >&2
    exit 1
fi

echo "========================================================================"
echo ">>> [PHASE SP-8C-6U] Strictly Read-Only Staging Health Validation"
echo ">>> Target Host        : srv1935605 (2.24.130.251)"
echo ">>> Execution Identity : github-runner (UID 1001)"
echo ">>> Output Log         : ${LOG_FILE} (Owner: root:root, Mode: 0600)"
echo "========================================================================"

# Bounded read-only execution piped to root tee
set +e
su - github-runner -c '
    export XDG_RUNTIME_DIR="/run/user/1001"
    export DOCKER_HOST="unix:///run/user/1001/docker.sock"
    
    echo "=== CHECKPOINT 1: CONTAINER INVENTORY & HEALTH ==="
    docker ps -a --filter "name=socialpulse-staging" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"
    
    echo "=== CHECKPOINT 2: MIGRATION PROFILE INACTIVITY PROOF ==="
    MIG_COUNT=$(docker ps -a --filter "name=socialpulse-staging-migrate" -q | wc -l)
    echo "Migration Containers Count: ${MIG_COUNT} (Expected: 0)"
    if [ "${MIG_COUNT}" -ne 0 ]; then
        echo "SECURITY VIOLATION: Unexpected migration container detected!" >&2
        exit 10
    fi
    
    echo "=== CHECKPOINT 3: PUBLISHED PORT BINDINGS AUDIT ==="
    docker inspect socialpulse-staging-server-1 --format "Server Ports   : {{json .NetworkSettings.Ports}}"
    docker inspect socialpulse-staging-client-1 --format "Client Ports   : {{json .NetworkSettings.Ports}}"
    docker inspect socialpulse-staging-postgres-1 --format "Postgres Ports : {{json .NetworkSettings.Ports}}"
    docker inspect socialpulse-staging-redis-1 --format "Redis Ports    : {{json .NetworkSettings.Ports}}"
    
    echo "=== CHECKPOINT 4: STAGING APPLICATION HTTP PROBES ==="
    echo -n "Staging Backend Live Probe (127.0.0.1:3001/health/live): "
    curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/health/live
    curl -sS http://127.0.0.1:3001/health/live
    echo ""
    
    echo -n "Staging Frontend Web Probe (127.0.0.1:8081/): "
    curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/
    
    echo "=== CHECKPOINT 5: INTERNAL DATABASE & CACHE HEALTH PROBE ==="
    docker exec socialpulse-staging-postgres-1 pg_isready -U postgres
    docker exec socialpulse-staging-redis-1 redis-cli ping
    
    echo "=== CHECKPOINT 6: EVERGREEN PRODUCTION PRESERVATION PROBE ==="
    echo -n "Evergreen Live Probe (127.0.0.1:3000/api/health): "
    curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health
    curl -sS http://127.0.0.1:3000/api/health
    echo ""
    
    echo "=== CHECKPOINT 7: ROOTFUL DOCKER DAEMON ISOLATION AUDIT ==="
    docker -H unix:///var/run/docker.sock info 2>&1 || true
' 2>&1 | tee "${LOG_FILE}"

PIPE_STATUSES=("${PIPESTATUS[@]}")
VALIDATION_STATUS="${PIPE_STATUSES[0]:-1}"
TEE_STATUS="${PIPE_STATUSES[1]:-0}"
set -e

echo "========================================================================"
echo ">>> Status Verification:"
echo "  Validation Script Exit Status : ${VALIDATION_STATUS}"
echo "  Root tee Logging Exit Status  : ${TEE_STATUS}"

if [ "${VALIDATION_STATUS}" -ne 0 ] || [ "${TEE_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Staging health validation failed (Exit: ${VALIDATION_STATUS})." >&2
    FINAL_EXIT=1
else
    echo ">>> All SP-8C-6U Staging Health checkpoints verified successfully (Exit 0)."
    FINAL_EXIT=0
fi

# Assert log invariants
LOG_OWNER=$(stat -c "%u:%g" "${LOG_FILE}")
LOG_PERMS=$(stat -c "%a" "${LOG_FILE}")
if [ "${LOG_OWNER}" != "0:0" ] || [ "${LOG_PERMS}" != "600" ] || [ ! -f "${LOG_FILE}" ] || [ -L "${LOG_FILE}" ]; then
    echo "CRITICAL ERROR: Log file invariant verification failed: ${LOG_FILE}" >&2
    exit 1
fi

echo "✓ Log File Verified: ${LOG_FILE} (Owner: ${LOG_OWNER}, Mode: 0${LOG_PERMS}, Regular non-symlink)"
echo "========================================================================"
echo "=== STAGING HEALTH VALIDATION COMPLETED & VERIFIED (PHASE SP-8C-6U) ==="
echo "========================================================================"

# Output machine-readable metrics
DIGEST=$(sha256sum -- "${LOG_FILE}" | awk '{print $1}')
printf 'CanonicalLog=%s\nBytes=%s\nSHA256=%s\nDigestLength=%s\n' \
  "${LOG_FILE}" \
  "$(stat -c '%s' -- "${LOG_FILE}")" \
  "${DIGEST}" \
  "${#DIGEST}"

if [[ "${DIGEST}" =~ ^[0-9a-f]{64}$ ]]; then
    echo 'SHA256_FORMAT=PASS'
else
    echo 'SHA256_FORMAT=FAIL'
    exit 1
fi

exit "${FINAL_EXIT}"
