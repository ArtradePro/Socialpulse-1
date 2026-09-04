#!/bin/bash
# ==============================================================================
# SOCIALPULSE PHASE SP-8C-6S: READ-ONLY CONTROLLED HOST STATIC VALIDATION SCRIPT
# Execution: github-runner (Unprivileged UID 1001) targeting Rootless Docker
# Safety: 100% Read-Only, ZERO Mutation, ZERO Secrets Leaked
# ==============================================================================
set -euo pipefail

echo "========================================================================"
echo ">>> [PHASE SP-8C-6S] Read-Only Staging Compose Static Host Validation"
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
    echo "ERROR: Validation script must run as github-runner (UID 1001, got ${CURRENT_UID})."
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
AUDITOR_SCRIPT="scripts/audit_compose_model.js"
MANIFEST_FILE="scripts/approved_release_manifest.json"

# 6. File Invariants
for f in "${COMPOSE_FILE}" "${ENV_FILE}" "${AUDITOR_SCRIPT}" "${MANIFEST_FILE}"; do
    if [ ! -f "${f}" ] || [ -L "${f}" ]; then
        echo "ERROR: Required file '${f}' is missing or is a symbolic link."
        exit 1
    fi
done
echo "File Invariants: All configuration, manifest and auditor files verified regular and non-symlink."

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

echo "Approved Release Manifest Bound:"
echo "  Backend:    ${APPROVED_BACKEND_IMAGE}"
echo "  Frontend:   ${APPROVED_FRONTEND_IMAGE}"
echo "  PostgreSQL: ${APPROVED_POSTGRES_IMAGE}"
echo "  Redis:      ${APPROVED_REDIS_IMAGE}"

# 9. Rootless Docker Daemon Accessibility
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Rootless Docker daemon is not accessible via ${DOCKER_HOST}."
    exit 1
fi
echo "Daemon Check: Rootless Docker Engine responsive at ${DOCKER_HOST}."

# 10. Syntax Validation (Suppressed Output)
echo "--- Running: docker compose config --quiet ---"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --project-name "${PROJECT_NAME}" config --quiet
echo "Status: Syntax valid."

# 11. Dual-Mode Programmatic AST Security Audit (scripts/audit_compose_model.js)
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
echo "Profile Isolation Re-Check: Confirmed COMPOSE_PROFILES remains unset."

# 12. Pre-Deployment Resource Cleanliness Audit (Containers, Volumes, Networks)
echo "========================================================================"
echo ">>> Pre-Deployment Resource Cleanliness Audit"
STAGING_CONTAINERS=$(docker ps -a --filter "name=socialpulse-staging" -q | wc -l)
STAGING_VOLUMES=$(docker volume ls --filter "name=socialpulse-staging" -q | wc -l)
STAGING_NETWORKS=$(docker network ls --filter "name=socialpulse-staging" -q | wc -l)

echo "  Staging Containers: ${STAGING_CONTAINERS} (Expected 0)"
echo "  Staging Volumes:    ${STAGING_VOLUMES} (Expected 0)"
echo "  Staging Networks:   ${STAGING_NETWORKS} (Expected 0)"

if [ "${STAGING_CONTAINERS}" -ne 0 ] || [ "${STAGING_VOLUMES}" -ne 0 ] || [ "${STAGING_NETWORKS}" -ne 0 ]; then
    echo "ERROR: Pre-existing staging resources detected on rootless daemon. Clean state required."
    exit 1
fi

# 13. Loopback Port Availability Audit (3001, 8081 free; 3000 active for Evergreen)
echo "========================================================================"
echo ">>> Port Allocation & Loopback Isolation Audit"
if ss -tulpn | grep -E ':(3001|8081)\b' &>/dev/null; then
    echo "ERROR: Collision detected on staging port 3001 or 8081."
    exit 1
fi
echo "  Staging Ports 3001 & 8081: Available on loopback."

if ! ss -tulpn | grep -E '127\.0\.0\.1:3000\b' &>/dev/null; then
    echo "ERROR: Evergreen application port 127.0.0.1:3000 is not active."
    exit 1
fi
echo "  Evergreen Port 3000: Active on loopback."

# 14. Canonical Evergreen Live Health Audit
echo "========================================================================"
echo ">>> Evergreen Live Health Probe"
if ! curl -fsS --connect-timeout 5 --max-time 15 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "ERROR: Evergreen /api/health probe failed."
    exit 1
fi
echo "  Evergreen HTTP Health: 100% Healthy (200 OK)."

# 15. Strict Rootful Socket Isolation Assertion
if docker -H unix:///var/run/docker.sock info >/dev/null 2>&1; then
    echo "CRITICAL ERROR: github-runner has unauthorized access to /var/run/docker.sock."
    exit 1
fi
echo "  Rootful Docker Isolation: DENIED (Confirmed zero access)."

echo "========================================================================"
echo "=== STAGING STATIC VALIDATION PASSED (PHASE SP-8C-6S) ==="
echo "========================================================================"
