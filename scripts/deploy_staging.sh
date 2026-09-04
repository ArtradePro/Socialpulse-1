#!/bin/bash
# ==============================================================================
# SOCIALPULSE PHASE SP-8C-6T: CONTROLLED STAGING HOST DEPLOYMENT & ROLLBACK SCRIPT
# Execution: github-runner (Unprivileged UID 1001) targeting Rootless Docker
# Safety: Bounded Health Deadlines, Zero Evergreen Impact, Project-Scoped Rollback
# ==============================================================================
set -euo pipefail
set -E

echo "========================================================================"
echo ">>> [PHASE SP-8C-6T] Controlled Staging Host Deployment"
echo "========================================================================"

# 1. Authoritative External Trust Anchor (Release 03 Baseline)
TRUST_ANCHOR_RELEASE_ID="sp-8c-staging-release-03"
TRUST_ANCHOR_SOURCE_COMMIT="721e731a2e4af9c9903af92a788ab52a3c21b47e"
TRUST_ANCHOR_MANIFEST_SHA256="856de11c682858e6639f820b45277a96e101149599420073f7c4c010b54d1de7"
APPROVED_BACKEND_IMAGE="artradepro/socialpulse-backend@sha256:73e9d3366edd4e714e4ade1acd45e78cc20c9e84803572dda96b0ba65818eb2a"
APPROVED_FRONTEND_IMAGE="artradepro/socialpulse-frontend@sha256:8fa2708cfbff2c38b7708e7d3a7830ba738d3407e2ae986561da008a965d9aa8"
APPROVED_POSTGRES_IMAGE="postgres@sha256:fe0737ba566a2c5b2a28f34433c0a423261900ec17b9bf7ad115e1aae7e57f1b"
APPROVED_REDIS_IMAGE="redis@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf"

# 2. Exhaustive External Tool Preflight (15 Tools)
REQUIRED_TOOLS=("id" "grep" "wc" "node" "docker" "ss" "curl" "realpath" "stat" "cat" "awk" "sed" "cut" "sleep" "sha256sum")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "${tool}" &>/dev/null; then
        echo "ERROR: Required tool '${tool}' is missing on runner."
        exit 1
    fi
done
echo "Tool Preflight: All ${#REQUIRED_TOOLS[@]} required tools verified."

# 3. Node Version Preflight (Node.js >= 18)
NODE_VER_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "${NODE_VER_MAJOR}" -lt 18 ]; then
    echo "ERROR: Node.js version >= 18 is strictly required (found $(node -v))."
    exit 1
fi
echo "Node Runtime: Verified $(node -v)."

# 4. Identity Check: Must execute as github-runner (UID 1001)
CURRENT_UID=$(id -u)
if [ "${CURRENT_UID}" -ne 1001 ]; then
    echo "ERROR: Deployment script must run as github-runner (UID 1001, got ${CURRENT_UID})."
    exit 1
fi
echo "Identity Check: github-runner (UID 1001) Verified."

# 5. Mandatory Profile Isolation: Clear and assert absence of COMPOSE_PROFILES
unset COMPOSE_PROFILES
if [ -n "${COMPOSE_PROFILES:-}" ]; then
    echo "CRITICAL ERROR: COMPOSE_PROFILES must be absent to prevent accidental activation of migration profile."
    exit 1
fi
echo "Profile Isolation: Confirmed COMPOSE_PROFILES is unset."

export XDG_RUNTIME_DIR="/run/user/1001"
export DOCKER_HOST="unix:///run/user/1001/docker.sock"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE="/opt/socialpulse/.env"
PROJECT_NAME="socialpulse-staging"
MANIFEST_FILE="scripts/approved_release_manifest.json"
AUDITOR_SCRIPT="scripts/audit_compose_model.js"

DEPLOYMENT_MUTATION_BEGUN=0
DEPLOYMENT_COMMITTED=0
ROLLBACK_RUNNING=0

# Helper: Canonical Evergreen Health Verification
verify_evergreen_live_health() {
    local CONTEXT="${1:-check}"
    if ! curl -fsS --connect-timeout 5 --max-time 15 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
        echo "CRITICAL HEALTH ALERT [${CONTEXT}]: Evergreen /api/health probe failed."
        return 1
    fi
    echo "Evergreen Live Health [${CONTEXT}]: Verified 100% healthy (200 OK)."
    return 0
}

# 6. File Invariants
for f in "${COMPOSE_FILE}" "${ENV_FILE}" "${AUDITOR_SCRIPT}" "${MANIFEST_FILE}"; do
    if [ ! -f "${f}" ] || [ -L "${f}" ]; then
        echo "ERROR: Required file '${f}' is missing or is a symbolic link."
        exit 1
    fi
done

# 7. Cryptographic Trust Anchor Verification of Manifest File
COMPUTED_MANIFEST_SHA=$(sha256sum "${MANIFEST_FILE}" | awk '{print $1}')
if [ "${COMPUTED_MANIFEST_SHA}" != "${TRUST_ANCHOR_MANIFEST_SHA256}" ]; then
    echo "CRITICAL ERROR: Manifest cryptographic checksum mismatch."
    echo "  Expected trust anchor: ${TRUST_ANCHOR_MANIFEST_SHA256}"
    echo "  Computed from file:    ${COMPUTED_MANIFEST_SHA}"
    exit 1
fi
echo "Trust Anchor: Manifest cryptographic checksum verified (${COMPUTED_MANIFEST_SHA})."

# 8. Unmasked Fail-Closed Manifest Parsing & Trust Anchor Equality Check
node -e "
    const m = require('./${MANIFEST_FILE}');
    if (m.releaseId !== '${TRUST_ANCHOR_RELEASE_ID}') {
        console.error('CRITICAL ERROR: Release ID mismatch:', m.releaseId);
        process.exit(1);
    }
    if (m.sourceCommit !== '${TRUST_ANCHOR_SOURCE_COMMIT}') {
        console.error('CRITICAL ERROR: Source commit mismatch:', m.sourceCommit);
        process.exit(1);
    }
    const b = (m.backend?.repository || '') + '@' + (m.backend?.digest || '');
    const f = (m.frontend?.repository || '') + '@' + (m.frontend?.digest || '');
    if (b !== '${APPROVED_BACKEND_IMAGE}') {
        console.error('CRITICAL ERROR: Backend image mismatch:', b);
        process.exit(1);
    }
    if (f !== '${APPROVED_FRONTEND_IMAGE}') {
        console.error('CRITICAL ERROR: Frontend image mismatch:', f);
        process.exit(1);
    }
"

# Set image environment variables to the exact approved values
export SOCIALPULSE_BACKEND_IMAGE="${APPROVED_BACKEND_IMAGE}"
export SOCIALPULSE_FRONTEND_IMAGE="${APPROVED_FRONTEND_IMAGE}"

echo "Approved Release Images Verified:"
echo "  Backend:    ${APPROVED_BACKEND_IMAGE}"
echo "  Frontend:   ${APPROVED_FRONTEND_IMAGE}"
echo "  PostgreSQL: ${APPROVED_POSTGRES_IMAGE}"
echo "  Redis:      ${APPROVED_REDIS_IMAGE}"

# 9. Dual-Mode Independent Pre-Mutation Static Security Model Gate
echo "=== EXECUTING PRE-MUTATION STATIC SECURITY GATE ==="
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" config --quiet

echo "--- Running: Dual-Mode AST Security Audit: 1. Default Runtime Mode ---"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" config --format json | \
    node "${AUDITOR_SCRIPT}" --manifest "${MANIFEST_FILE}" --mode default

echo "--- Running: Dual-Mode AST Security Audit: 2. Migration Profile Mode ---"
docker compose --profile migration -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" config --format json | \
    node "${AUDITOR_SCRIPT}" --manifest "${MANIFEST_FILE}" --mode migration

# Reassert COMPOSE_PROFILES remains unset after profile evaluation
unset COMPOSE_PROFILES
if [ -n "${COMPOSE_PROFILES:-}" ]; then
    echo "CRITICAL ERROR: COMPOSE_PROFILES became set after read-only profile audit."
    exit 1
fi
echo "Static Security Gate: Dual-mode audit 100% PASSED prior to any host mutation."

# 10. Capture Pre-Deployment Invariants for Evergreen & Resource Cleanliness
verify_evergreen_live_health "Pre-Deployment Baseline"

STAGING_CONTAINERS=$(docker ps -a --filter "name=socialpulse-staging" -q | wc -l)
STAGING_VOLUMES=$(docker volume ls --filter "name=socialpulse-staging" -q | wc -l)
STAGING_NETWORKS=$(docker network ls --filter "name=socialpulse-staging" -q | wc -l)

if [ "${STAGING_CONTAINERS}" -ne 0 ] || [ "${STAGING_VOLUMES}" -ne 0 ] || [ "${STAGING_NETWORKS}" -ne 0 ]; then
    echo "ERROR: Pre-existing staging resources detected on rootless daemon. Clean state required."
    echo "  Containers: ${STAGING_CONTAINERS}, Volumes: ${STAGING_VOLUMES}, Networks: ${STAGING_NETWORKS}"
    exit 1
fi
echo "Clean Initial State: Confirmed 0 containers, 0 volumes, 0 networks for '${PROJECT_NAME}'."

# 11. Project-Scoped Fail-Closed Rollback Engine
execute_scoped_rollback() {
    local TRIGGER_REASON="${1:-unknown failure}"
    local ORIGINAL_CODE="${2:-1}"
    local ROLLBACK_OK=1

    if [ "${ROLLBACK_RUNNING}" -eq 1 ]; then
        return 0
    fi
    ROLLBACK_RUNNING=1

    echo "========================================================================"
    echo ">>> [PROJECT-SCOPED ROLLBACK] Triggered: ${TRIGGER_REASON}"
    echo ">>> Tearing down staging resources for project '${PROJECT_NAME}'..."
    echo "========================================================================"

    set +e
    if [ "${DEPLOYMENT_MUTATION_BEGUN}" -eq 1 ]; then
        docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" down --volumes --remove-orphans
        TEARDOWN_STATUS=$?
        if [ "${TEARDOWN_STATUS}" -ne 0 ]; then
            echo "CRITICAL ROLLBACK FAILURE: docker compose down exited with status ${TEARDOWN_STATUS}."
            ROLLBACK_OK=0
        fi

        # Post-Rollback Absence Verification
        POST_C=$(docker ps -a --filter "name=socialpulse-staging" -q | wc -l)
        POST_V=$(docker volume ls --filter "name=socialpulse-staging" -q | wc -l)
        POST_N=$(docker network ls --filter "name=socialpulse-staging" -q | wc -l)

        if [ "${POST_C}" -ne 0 ] || [ "${POST_V}" -ne 0 ] || [ "${POST_N}" -ne 0 ]; then
            echo "CRITICAL ROLLBACK FAILURE: Leftover resources detected (Containers: ${POST_C}, Volumes: ${POST_V}, Networks: ${POST_N})."
            ROLLBACK_OK=0
        else
            echo "Rollback Verification: All created containers, named volumes and networks removed."
        fi
    fi

    verify_evergreen_live_health "Post-Rollback Re-Check" || ROLLBACK_OK=0

    if [ "${ROLLBACK_OK}" -ne 1 ]; then
        echo "CRITICAL ALERT: Project rollback containment was incomplete."
    else
        echo ">>> Project-scoped rollback cleanly completed. Evergreen 100% preserved."
    fi

    exit "${ORIGINAL_CODE}"
}

trap 'ORIG=$?; if [ "${DEPLOYMENT_COMMITTED}" -eq 0 ]; then execute_scoped_rollback "Abnormal exit" "$ORIG"; fi' EXIT
trap 'execute_scoped_rollback "SIGINT received" 130' INT
trap 'execute_scoped_rollback "SIGTERM received" 143' TERM

# 12. PRE-ARM MUTATION BOUNDARY BEFORE FIRST PULL
DEPLOYMENT_MUTATION_BEGUN=1

# 13. Pull All Four Immutable Digest-Pinned Images Explicitly
echo "=== PULLING ALL 4 IMMUTABLE IMAGES BY DIGEST ==="
docker pull "${APPROVED_POSTGRES_IMAGE}"
docker pull "${APPROVED_REDIS_IMAGE}"
docker pull "${APPROVED_BACKEND_IMAGE}"
docker pull "${APPROVED_FRONTEND_IMAGE}"

# Verify Local RepoDigests
for img in "${APPROVED_POSTGRES_IMAGE}" "${APPROVED_REDIS_IMAGE}" "${APPROVED_BACKEND_IMAGE}" "${APPROVED_FRONTEND_IMAGE}"; do
    if ! docker image inspect "${img}" >/dev/null 2>&1; then
        echo "ERROR: Failed to inspect pulled image '${img}'."
        exit 1
    fi
done
echo "Image Pull Verification: All 4 approved immutable images pulled and verified locally."

# 14. Execute Docker Compose Up (Pull Never, No Migration Profile, Strictly Unprofiled)
echo "=== LAUNCHING STAGING SERVICES VIA DOCKER COMPOSE (UNPROFILED) ==="
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" up -d --no-build --pull never

# 15. Bounded Container Readiness & Healthcheck Loop (Up to 60 seconds)
echo "=== AWAITING SERVICE READINESS & HEALTHCHECKS ==="
SERVICES_READY=0
for ((attempt=1; attempt<=12; attempt++)); do
    echo "Health check verification (attempt ${attempt} of 12)..."
    PG_H=$(docker inspect --format '{{.State.Health.Status}}' socialpulse-staging-postgres-1 2>/dev/null || true)
    REDIS_H=$(docker inspect --format '{{.State.Health.Status}}' socialpulse-staging-redis-1 2>/dev/null || true)
    SERVER_H=$(docker inspect --format '{{.State.Health.Status}}' socialpulse-staging-server-1 2>/dev/null || true)
    CLIENT_S=$(docker inspect --format '{{.State.Status}}' socialpulse-staging-client-1 2>/dev/null || true)

    if [ "${PG_H}" = "healthy" ] && [ "${REDIS_H}" = "healthy" ] && [ "${SERVER_H}" = "healthy" ] && [ "${CLIENT_S}" = "running" ]; then
        SERVICES_READY=1
        break
    fi
    sleep 5
done

if [ "${SERVICES_READY}" -ne 1 ]; then
    echo "ERROR: Staging services failed to reach healthy status within 60 seconds."
    exit 1
fi
echo "Service Health: All staging services verified healthy and running."

# 16. Bounded HTTP Application Probes (Status Code Only, Zero Secret Leakage)
echo "=== VERIFYING APPLICATION HTTP PROBES ==="
BACKEND_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 http://127.0.0.1:3001/health/live || true)
FRONTEND_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 http://127.0.0.1:8081/ || true)

echo "  Backend Live Probe (http://127.0.0.1:3001/health/live): HTTP ${BACKEND_HTTP_CODE}"
echo "  Frontend Web Probe  (http://127.0.0.1:8081/):            HTTP ${FRONTEND_HTTP_CODE}"

if [ "${BACKEND_HTTP_CODE}" -ne 200 ]; then
    echo "ERROR: Backend live probe failed (Expected HTTP 200, got ${BACKEND_HTTP_CODE})."
    exit 1
fi
if [ "${FRONTEND_HTTP_CODE}" -ne 200 ]; then
    echo "ERROR: Frontend web probe failed (Expected HTTP 200, got ${FRONTEND_HTTP_CODE})."
    exit 1
fi
echo "Application Probes: Confirmed HTTP 200 on backend and frontend loopback endpoints."

# 17. Inspect Published Port Bindings on Containers
echo "=== VERIFYING PUBLISHED PORT BINDINGS ==="
SERVER_PORT_BINDINGS=$(docker inspect socialpulse-staging-server-1 --format '{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} -> {{range $conf}}{{.HostIp}}:{{.HostPort}}{{end}} {{end}}')
CLIENT_PORT_BINDINGS=$(docker inspect socialpulse-staging-client-1 --format '{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} -> {{range $conf}}{{.HostIp}}:{{.HostPort}}{{end}} {{end}}')

echo "  Server Port Bindings: ${SERVER_PORT_BINDINGS}"
echo "  Client Port Bindings: ${CLIENT_PORT_BINDINGS}"

if [[ "${SERVER_PORT_BINDINGS}" != *"3000/tcp -> 127.0.0.1:3001"* ]]; then
    echo "ERROR: Server port binding mismatch (Expected 3000/tcp -> 127.0.0.1:3001)."
    exit 1
fi

if [[ "${CLIENT_PORT_BINDINGS}" != *"3000/tcp -> 127.0.0.1:8081"* ]]; then
    echo "ERROR: Client port binding mismatch (Expected 3000/tcp -> 127.0.0.1:8081)."
    exit 1
fi

# Assert PostgreSQL and Redis have NO published ports
PG_PORTS=$(docker inspect socialpulse-staging-postgres-1 --format '{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}PUBLISHED{{end}}{{end}}')
REDIS_PORTS=$(docker inspect socialpulse-staging-redis-1 --format '{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}PUBLISHED{{end}}{{end}}')

if [ -n "${PG_PORTS}" ] || [ -n "${REDIS_PORTS}" ]; then
    echo "ERROR: Database or Redis container unexpectedly exposed host ports."
    exit 1
fi
echo "Port Security: Confirmed databases have 0 host-published ports; web services bound strictly to 127.0.0.1."

# 18. Assert Zero Access to Rootful Docker Socket
if docker -H unix:///var/run/docker.sock info >/dev/null 2>&1; then
    echo "CRITICAL SECURITY ERROR: github-runner gained access to system Docker socket!"
    exit 1
fi
echo "System Daemon Isolation: Confirmed ZERO access to /var/run/docker.sock."

# 19. Post-Deployment Evergreen Health Re-Check
verify_evergreen_live_health "Final Post-Deployment Check"

# Transaction Commit
DEPLOYMENT_COMMITTED=1

echo "========================================================================"
echo "=== STAGING DEPLOYMENT COMPLETED & COMMITTED (PHASE SP-8C-6T) ==="
echo "========================================================================"
