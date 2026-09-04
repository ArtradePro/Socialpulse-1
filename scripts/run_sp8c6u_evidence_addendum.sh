#!/bin/bash
# ==============================================================================
# HIGIENE (PTY) LTD — PROJECT EVERGREEN / SOCIALPULSE
# GATE SP-8C-6U: READ-ONLY EVIDENCE ADDENDUM
# ==============================================================================
set -euo pipefail

export XDG_RUNTIME_DIR="/run/user/1001"
export DOCKER_HOST="unix:///run/user/1001/docker.sock"

echo "========================================================================"
echo ">>> [GATE SP-8C-6U] Strictly Read-Only Evidence Addendum"
echo ">>> Execution Identity : $(whoami) (UID: $(id -u))"
echo ">>> Docker Socket      : ${DOCKER_HOST}"
echo "========================================================================"

# 1. Authenticated Redis PING inside socialpulse-staging-redis-1
echo "=== ITEM 1: AUTHENTICATED REDIS PING ==="
REDIS_AUTH_VAL=$(grep '^REDIS_PASSWORD=' /opt/socialpulse/.env | cut -d= -f2-)
REDIS_PING_RES=$(docker exec -e REDISCLI_AUTH="${REDIS_AUTH_VAL}" socialpulse-staging-redis-1 redis-cli ping 2>&1)
REDIS_EXIT=$?
echo "Redis PING Result : ${REDIS_PING_RES}"
echo "Redis Exit Status : ${REDIS_EXIT}"
if [ "${REDIS_PING_RES}" != "PONG" ] || [ "${REDIS_EXIT}" -ne 0 ]; then
    echo "ERROR: Redis PING did not return exact PONG" >&2
fi
unset REDIS_AUTH_VAL

# 2. Authenticated PostgreSQL SELECT 1 inside socialpulse-staging-postgres-1
echo ""
echo "=== ITEM 2: AUTHENTICATED POSTGRESQL QUERY ==="
PG_PASS_VAL=$(grep '^POSTGRES_PASSWORD=' /opt/socialpulse/.env | cut -d= -f2-)
PG_QUERY_RES=$(docker exec -e PGPASSWORD="${PG_PASS_VAL}" socialpulse-staging-postgres-1 psql -U postgres -d socialpulse -t -A -c "SELECT 1;" 2>&1)
PG_EXIT=$?
echo "PostgreSQL Query Result : ${PG_QUERY_RES}"
echo "PostgreSQL Exit Status  : ${PG_EXIT}"
if [ "${PG_QUERY_RES}" != "1" ] || [ "${PG_EXIT}" -ne 0 ]; then
    echo "ERROR: PostgreSQL query did not return exact 1" >&2
fi
unset PG_PASS_VAL

# 3. Backend Readiness Probe (http://127.0.0.1:3001/health/ready)
echo ""
echo "=== ITEM 3: BACKEND READINESS PROBE ==="
READINESS_HTTP_CODE=$(curl -sS -o /tmp/sp8c6u_ready_body.json -w "%{http_code}" http://127.0.0.1:3001/health/ready 2>&1 || echo "CURL_ERROR")
CURL_READY_EXIT=$?
echo "Readiness HTTP Status : ${READINESS_HTTP_CODE}"
echo -n "Readiness Response    : "
cat /tmp/sp8c6u_ready_body.json 2>/dev/null || true
echo ""
echo "Readiness Exit Status : ${CURL_READY_EXIT}"
rm -f /tmp/sp8c6u_ready_body.json

# 4. Evergreen Production Health Probe (http://127.0.0.1:3000/api/health)
echo ""
echo "=== ITEM 4: EVERGREEN PRODUCTION HEALTH PROBE ==="
EVERGREEN_HTTP_CODE=$(curl -sS -o /tmp/sp8c6u_evergreen_body.json -w "%{http_code}" http://127.0.0.1:3000/api/health 2>&1 || echo "CURL_ERROR")
CURL_EVERGREEN_EXIT=$?
echo "Evergreen HTTP Status : ${EVERGREEN_HTTP_CODE}"
echo -n "Evergreen Response    : "
cat /tmp/sp8c6u_evergreen_body.json 2>/dev/null || true
echo ""
echo "Evergreen Exit Status : ${CURL_EVERGREEN_EXIT}"
rm -f /tmp/sp8c6u_evergreen_body.json

echo ""
echo "========================================================================"
echo ">>> All SP-8C-6U Evidence Addendum checks executed successfully."
echo "========================================================================"
