#!/bin/bash
set -euo pipefail

# 1. Require EUID 0 and set restrictive umask
if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Deployment wrapper must be executed as root (EUID 0)." >&2
    exit 1
fi
umask 077

# 2. Timestamped log path with collision and symlink rejection
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
LOG_FILE="/root/sp8c6t_deployment_${TIMESTAMP}.log"

if [ -e "${LOG_FILE}" ] || [ -L "${LOG_FILE}" ]; then
    echo "CRITICAL ERROR: Log file target already exists or is a symlink: ${LOG_FILE}" >&2
    exit 1
fi

echo "========================================================================"
echo ">>> Starting Controlled Staging Deployment (Phase SP-8C-6T)"
echo ">>> Log Path: ${LOG_FILE} (Owner: root:root, Mode: 0600)"
echo "========================================================================"

# 3. Execute deploy_staging.sh as github-runner and pipe to root tee
set +e
su - github-runner -c "
    export XDG_RUNTIME_DIR=\"/run/user/1001\"
    export DOCKER_HOST=\"unix:///run/user/1001/docker.sock\"
    cd /opt/socialpulse
    exec ./scripts/deploy_staging.sh
" 2>&1 | tee "${LOG_FILE}"

# 4. Immediately capture PIPESTATUS array before any other command
DEPLOY_STATUS=${PIPESTATUS[0]}
TEE_STATUS=${PIPESTATUS[1]}
set -e

# 5. Record numeric statuses and evaluate independent failures
echo "========================================================================"
echo ">>> Execution Status Summary:"
echo "  deploy_staging.sh Exit Status : ${DEPLOY_STATUS}"
echo "  tee Logging Exit Status       : ${TEE_STATUS}"

if [ "${DEPLOY_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Deployment script failed with status ${DEPLOY_STATUS}." >&2
    FINAL_EXIT="${DEPLOY_STATUS}"
elif [ "${TEE_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Root logging pipeline (tee) failed with status ${TEE_STATUS}." >&2
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
    echo "CRITICAL ERROR: Log file ownership mismatch: ${LOG_OWNER} (Expected 0:0 / root:root)." >&2
    exit 1
fi

if [ "${LOG_PERMS}" != "600" ]; then
    echo "CRITICAL ERROR: Log file permissions mismatch: ${LOG_PERMS} (Expected 0600)." >&2
    exit 1
fi

echo "✓ Log File Verified: ${LOG_FILE} (Owner: ${LOG_OWNER}, Mode: 0${LOG_PERMS}, Regular non-symlink)"
echo "========================================================================"

exit "${FINAL_EXIT}"
