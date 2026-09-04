#!/bin/bash
# ==============================================================================
# SOCIALPULSE PHASE SP-8C-6S: CONTROLLED HOST SYNCHRONIZATION & STATIC VALIDATION
# Target Host: srv1935605
# Revision: R33
# Execution: root prepares files, github-runner (UID 1001) runs validation
# ==============================================================================
set -euo pipefail

echo "========================================================================"
echo ">>> [PHASE SP-8C-6S] Synchronizing Approved R33 Package to /opt/socialpulse"
echo "========================================================================"

# 1. Target Directory Setup
mkdir -p /opt/socialpulse/scripts

# 2. Download exact R33 deliverables from verified git backup branch
BASE_URL="https://raw.githubusercontent.com/ArtradePro/Socialpulse-1/scripts/backup-r10"

curl -fsSL "${BASE_URL}/docker-compose.staging.yml" -o /opt/socialpulse/docker-compose.staging.yml
curl -fsSL "${BASE_URL}/scripts/approved_release_manifest.json" -o /opt/socialpulse/scripts/approved_release_manifest.json
curl -fsSL "${BASE_URL}/scripts/audit_compose_model.js" -o /opt/socialpulse/scripts/audit_compose_model.js
curl -fsSL "${BASE_URL}/scripts/validate_staging_compose.sh" -o /opt/socialpulse/scripts/validate_staging_compose.sh
curl -fsSL "${BASE_URL}/scripts/deploy_staging.sh" -o /opt/socialpulse/scripts/deploy_staging.sh
curl -fsSL "${BASE_URL}/scripts/migration_prohibition_proof.md" -o /opt/socialpulse/scripts/migration_prohibition_proof.md
curl -fsSL "${BASE_URL}/scripts/package_evidence_manifest.json" -o /opt/socialpulse/scripts/package_evidence_manifest.json

# 3. Verify Checksums and Non-Symlink Status
echo "=== VERIFYING DELIVERABLE CHECKSUMS AGAINST R33 MANIFEST ==="
cd /opt/socialpulse

declare -A EXPECTED_SHAS=(
  ["docker-compose.staging.yml"]="e97d729f597657d589257f74acaa8467d2e5d034b32bb946692dfef73ee3a008"
  ["scripts/approved_release_manifest.json"]="856de11c682858e6639f820b45277a96e101149599420073f7c4c010b54d1de7"
  ["scripts/audit_compose_model.js"]="ae8d7fd8da35b0fef7eeeab29f30db8c914509715ca747d38d3eadaffc8d6b82"
  ["scripts/validate_staging_compose.sh"]="ea618e9a8a420457c54c7adda28bd72ef027e6044346d13f0cc574b3d5705098"
  ["scripts/deploy_staging.sh"]="c3d711460dcb154c15f6d0567779a8f1f7b58b9bc407015f9ffa41a73e522ab5"
  ["scripts/migration_prohibition_proof.md"]="01d797f8c64a6324ac6b475d56ae22fea1978723283bb65eb0b3311a00085d23"
  ["scripts/package_evidence_manifest.json"]="fdd87debe077172867b74c15b80ca4d574459a51adc8b3b65b7a1c9e25806ff7"
)

for file in "${!EXPECTED_SHAS[@]}"; do
    if [ -L "${file}" ]; then
        echo "CRITICAL ERROR: ${file} is a symlink."
        exit 1
    fi
    ACTUAL_SHA=$(sha256sum "${file}" | awk '{print $1}')
    if [ "${ACTUAL_SHA}" != "${EXPECTED_SHAS[$file]}" ]; then
        echo "CRITICAL ERROR: Hash mismatch for ${file}."
        echo "  Expected: ${EXPECTED_SHAS[$file]}"
        echo "  Actual:   ${ACTUAL_SHA}"
        exit 1
    fi
    echo "✓ Verified: ${file} (${ACTUAL_SHA})"
done

# 4. Set Permissions & Ownership (1001:1001)
chown -R github-runner:github-runner /opt/socialpulse
chmod 0640 /opt/socialpulse/docker-compose.staging.yml
chmod 0640 /opt/socialpulse/scripts/approved_release_manifest.json
chmod 0640 /opt/socialpulse/scripts/package_evidence_manifest.json
chmod 0640 /opt/socialpulse/scripts/migration_prohibition_proof.md
chmod 0750 /opt/socialpulse/scripts/audit_compose_model.js
chmod 0750 /opt/socialpulse/scripts/validate_staging_compose.sh
chmod 0750 /opt/socialpulse/scripts/deploy_staging.sh

echo "Permissions: Set ownership 1001:1001 and secure execution modes."

# 5. Execute Phase SP-8C-6S Read-Only Static Validation as github-runner
echo "========================================================================"
echo ">>> EXECUTING PHASE SP-8C-6S VALIDATION AS github-runner"
echo "========================================================================"

su - github-runner -c '
    export XDG_RUNTIME_DIR="/run/user/1001"
    export DOCKER_HOST="unix:///run/user/1001/docker.sock"
    cd /opt/socialpulse
    ./scripts/validate_staging_compose.sh
'
