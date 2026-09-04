#!/bin/bash
# ==============================================================================
# SOCIALPULSE PHASE SP-8C-6T: CONTROLLED STAGING DEPLOYMENT ROOT WRAPPER
# Authoritative Execution Wrapper with Restrictive Umask & Independent Status Capture
# ==============================================================================
set -euo pipefail

# 1. Enforce EUID 0 and restrictive root umask
if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Deployment wrapper must run as root (EUID 0)." >&2
    exit 1
fi
umask 077

# 2. Timestamped log under /root with collision and symlink rejection
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
LOG_FILE="/root/sp8c6t_deployment_${TIMESTAMP}.log"

if [ -e "${LOG_FILE}" ] || [ -L "${LOG_FILE}" ]; then
    echo "CRITICAL ERROR: Log file target already exists or is a symlink: ${LOG_FILE}" >&2
    exit 1
fi

echo "========================================================================"
echo ">>> [PHASE SP-8C-6T] Controlled Staging Host Deployment"
echo ">>> Execution Identity : github-runner (UID 1001)"
echo ">>> Logging Pipeline   : root:root -> ${LOG_FILE} (umask 077, mode 0600)"
echo "========================================================================"

# 3. Execute deploy_staging.sh as github-runner and pipe combined output to root tee
set +e
su - github-runner -c "
    export XDG_RUNTIME_DIR=\"/run/user/1001\"
    export DOCKER_HOST=\"unix:///run/user/1001/docker.sock\"
    cd /opt/socialpulse
    exec ./scripts/deploy_staging.sh
" 2>&1 | tee "${LOG_FILE}"

# 4. Authoritative atomic PIPESTATUS capture immediately after pipeline
PIPE_STATUSES=("${PIPESTATUS[@]}")
DEPLOY_STATUS="${PIPE_STATUSES[0]:-1}"
TEE_STATUS="${PIPE_STATUSES[1]:-0}"
set -e

# 5. Independent status evaluation outside the pipeline
echo "========================================================================"
echo ">>> Status Verification:"
echo "  deploy_staging.sh Exit Status : ${DEPLOY_STATUS}"
echo "  root tee Logging Exit Status  : ${TEE_STATUS}"

if [ "${DEPLOY_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: deploy_staging.sh failed with exit code ${DEPLOY_STATUS}." >&2
    FINAL_EXIT="${DEPLOY_STATUS}"
elif [ "${TEE_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Root logging pipeline (tee) failed with exit code ${TEE_STATUS}." >&2
    FINAL_EXIT="${TEE_STATUS}"
else
    echo ">>> Deployment and logging pipeline succeeded (Exit 0)."
    FINAL_EXIT=0
fi

# 6. Verify completed log file invariants: regular file, non-symlink, root:root, mode 0600
if [ ! -f "${LOG_FILE}" ] || [ -L "${LOG_FILE}" ]; then
    echo "CRITICAL ERROR: Log file is missing, not a regular file, or is a symlink: ${LOG_FILE}" >&2
    exit 1
fi

LOG_OWNER=$(stat -c "%u:%g" "${LOG_FILE}")
LOG_PERMS=$(stat -c "%a" "${LOG_FILE}")

if [ "${LOG_OWNER}" != "0:0" ]; then
    echo "CRITICAL ERROR: Log file ownership mismatch: ${LOG_OWNER} (Expected 0:0 root:root)." >&2
    exit 1
fi

if [ "${LOG_PERMS}" != "600" ]; then
    echo "CRITICAL ERROR: Log file permissions mismatch: ${LOG_PERMS} (Expected 0600)." >&2
    exit 1
fi

echo "✓ Log File Verified: ${LOG_FILE} (Owner: ${LOG_OWNER}, Mode: 0${LOG_PERMS}, Regular non-symlink)"
echo "========================================================================"

# 7. Post-Deployment Evidence Collection (If deployment succeeded)
if [ "${FINAL_EXIT}" -eq 0 ]; then
    echo ">>> [POST-DEPLOYMENT EVIDENCE COLLECTION]"
    echo "--- LOG FILE METRICS ---"
    echo "LOG_FILE: ${LOG_FILE}"
    stat -c "Bytes: %s | Owner: %U:%G (%u:%g) | Mode: %a" "${LOG_FILE}"
    sha256sum "${LOG_FILE}"

    echo "--- CONTAINER INVENTORY & HEALTH ---"
    su - github-runner -c "
        export DOCKER_HOST=\"unix:///run/user/1001/docker.sock\"
        docker ps -a --filter \"name=socialpulse-staging\" --format \"table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}\"
    "

    echo "--- PORT BINDINGS DETAIL ---"
    su - github-runner -c "
        export DOCKER_HOST=\"unix:///run/user/1001/docker.sock\"
        docker inspect socialpulse-staging-server-1 --format \"Server Ports: {{json .NetworkSettings.Ports}}\"
        docker inspect socialpulse-staging-client-1 --format \"Client Ports: {{json .NetworkSettings.Ports}}\"
        docker inspect socialpulse-staging-postgres-1 --format \"Postgres Ports: {{json .NetworkSettings.Ports}}\"
        docker inspect socialpulse-staging-redis-1 --format \"Redis Ports: {{json .NetworkSettings.Ports}}\"
    "

    echo "--- VOLUME & NETWORK INVENTORY ---"
    su - github-runner -c "
        export DOCKER_HOST=\"unix:///run/user/1001/docker.sock\"
        docker volume ls --filter \"name=socialpulse-staging\"
        docker network ls --filter \"name=socialpulse-staging\"
    "

    echo "--- MIGRATION SERVICE EXCLUSION PROOF ---"
    su - github-runner -c "
        export DOCKER_HOST=\"unix:///run/user/1001/docker.sock\"
        MIG_C=\$(docker ps -a --filter \"name=socialpulse-staging-migrate\" -q | wc -l)
        echo \"Migration Containers Count: \${MIG_C} (Expected 0)\"
    "

    echo "--- EVERGREEN LIVE HEALTH PROBE ---"
    curl -sS -i http://127.0.0.1:3000/api/health | head -n 5
    echo "========================================================================"
fi

exit "${FINAL_EXIT}"