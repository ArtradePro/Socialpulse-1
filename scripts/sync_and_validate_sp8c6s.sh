#!/bin/bash
# ==============================================================================
# SOCIALPULSE PHASE SP-8C-6S: CONTROLLED HOST SYNCHRONIZATION & STATIC VALIDATION
# Target Host: srv1935605
# Revision: R33
# Execution: root prepares files, github-runner (UID 1001) runs validation
# ==============================================================================
set -euo pipefail

echo "========================================================================"
echo ">>> [PHASE SP-8C-6S] Controlled Synchronization & Verification (R33)"
echo "========================================================================"

# Preflight: Root execution required for file synchronization and ownership assignment
if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Synchronization must be executed as root (EUID 0)."
    exit 1
fi

ZIP_FILE="/root/socialpulse_phase_sp8c6r_r33_review_package.zip"
EXPECTED_ZIP_SHA="c29f189dcb1554444566f7348274f794803b7030a61682b1922c27bf960423fc"
EXPECTED_ZIP_BYTES=21479

# 1. Obtain Approved R33 Review Package ZIP if not already present
if [ ! -f "${ZIP_FILE}" ]; then
    echo "Downloading approved R33 review package archive from GitHub..."
    curl -fsSL "https://raw.githubusercontent.com/ArtradePro/Socialpulse-1/scripts/backup-r10/socialpulse_phase_sp8c6r_r33_review_package.zip" -o "${ZIP_FILE}"
fi

# 2. Cryptographically Verify ZIP Integrity
echo "Verifying R33 review package archive integrity..."
ACTUAL_ZIP_SHA=$(sha256sum "${ZIP_FILE}" | awk '{print $1}')
ACTUAL_ZIP_BYTES=$(stat -c "%s" "${ZIP_FILE}")

if [ "${ACTUAL_ZIP_SHA}" != "${EXPECTED_ZIP_SHA}" ]; then
    echo "CRITICAL ERROR: Archive SHA-256 mismatch!"
    echo "  Expected: ${EXPECTED_ZIP_SHA}"
    echo "  Actual:   ${ACTUAL_ZIP_SHA}"
    exit 1
fi

if [ "${ACTUAL_ZIP_BYTES}" -ne "${EXPECTED_ZIP_BYTES}" ]; then
    echo "CRITICAL ERROR: Archive byte count mismatch!"
    echo "  Expected: ${EXPECTED_ZIP_BYTES}"
    echo "  Actual:   ${ACTUAL_ZIP_BYTES}"
    exit 1
fi
echo "✓ Archive Verified: ${ZIP_FILE} (${ACTUAL_ZIP_BYTES} bytes, SHA-256 ${ACTUAL_ZIP_SHA})"

# 3. Unpack Flat Archive to Clean Temporary Staging Area
TEMP_UNPACK_DIR=$(mktemp -d /tmp/sp8c6r_unzip_XXXXXX)
trap 'rm -rf "${TEMP_UNPACK_DIR}"' EXIT

unzip -q -o "${ZIP_FILE}" -d "${TEMP_UNPACK_DIR}"
echo "✓ Archive unzipped to temporary staging directory: ${TEMP_UNPACK_DIR}"

# 4. Explicit Governed Path Mapping
mkdir -p /opt/socialpulse/scripts

# Explicit map: docker-compose.staging.yml -> /opt/socialpulse/
cp -p "${TEMP_UNPACK_DIR}/docker-compose.staging.yml" /opt/socialpulse/docker-compose.staging.yml

# Explicit map: all other six files -> /opt/socialpulse/scripts/
cp -p "${TEMP_UNPACK_DIR}/approved_release_manifest.json" /opt/socialpulse/scripts/approved_release_manifest.json
cp -p "${TEMP_UNPACK_DIR}/audit_compose_model.js" /opt/socialpulse/scripts/audit_compose_model.js
cp -p "${TEMP_UNPACK_DIR}/validate_staging_compose.sh" /opt/socialpulse/scripts/validate_staging_compose.sh
cp -p "${TEMP_UNPACK_DIR}/deploy_staging.sh" /opt/socialpulse/scripts/deploy_staging.sh
cp -p "${TEMP_UNPACK_DIR}/migration_prohibition_proof.md" /opt/socialpulse/scripts/migration_prohibition_proof.md
cp -p "${TEMP_UNPACK_DIR}/package_evidence_manifest.json" /opt/socialpulse/scripts/package_evidence_manifest.json

# 5. Set Permissions & Ownership (1001:1001)
chown -R 1001:1001 /opt/socialpulse
chmod 0640 /opt/socialpulse/docker-compose.staging.yml
chmod 0640 /opt/socialpulse/scripts/approved_release_manifest.json
chmod 0640 /opt/socialpulse/scripts/package_evidence_manifest.json
chmod 0640 /opt/socialpulse/scripts/migration_prohibition_proof.md
chmod 0750 /opt/socialpulse/scripts/audit_compose_model.js
chmod 0750 /opt/socialpulse/scripts/validate_staging_compose.sh
chmod 0750 /opt/socialpulse/scripts/deploy_staging.sh

echo "✓ Ownership set to 1001:1001 and permissions locked."

# 6. Rigorous Destination File Verification (All 7 Files)
echo "========================================================================"
echo ">>> Verifying All Seven Destination Files Against Approved R33 Metrics"
echo "========================================================================"

EXPECTED_DELIVERABLES=(
  "/opt/socialpulse/docker-compose.staging.yml|e97d729f597657d589257f74acaa8467d2e5d034b32bb946692dfef73ee3a008|5051"
  "/opt/socialpulse/scripts/approved_release_manifest.json|856de11c682858e6639f820b45277a96e101149599420073f7c4c010b54d1de7|725"
  "/opt/socialpulse/scripts/audit_compose_model.js|ae8d7fd8da35b0fef7eeeab29f30db8c914509715ca747d38d3eadaffc8d6b82|22358"
  "/opt/socialpulse/scripts/validate_staging_compose.sh|ea618e9a8a420457c54c7adda28bd72ef027e6044346d13f0cc574b3d5705098|9121"
  "/opt/socialpulse/scripts/deploy_staging.sh|c3d711460dcb154c15f6d0567779a8f1f7b58b9bc407015f9ffa41a73e522ab5|15264"
  "/opt/socialpulse/scripts/migration_prohibition_proof.md|01d797f8c64a6324ac6b475d56ae22fea1978723283bb65eb0b3311a00085d23|5423"
  "/opt/socialpulse/scripts/package_evidence_manifest.json|fdd87debe077172867b74c15b80ca4d574459a51adc8b3b65b7a1c9e25806ff7|6118"
)

for item in "${EXPECTED_DELIVERABLES[@]}"; do
    IFS="|" read -r file expected_sha expected_bytes <<< "${item}"
    
    if [ ! -f "${file}" ]; then
        echo "CRITICAL ERROR: ${file} is missing or not a regular file."
        exit 1
    fi
    
    if [ -L "${file}" ]; then
        echo "CRITICAL ERROR: ${file} is a symlink."
        exit 1
    fi
    
    actual_owner=$(stat -c "%u:%g" "${file}")
    if [ "${actual_owner}" != "1001:1001" ]; then
        echo "CRITICAL ERROR: Ownership mismatch for ${file} (expected 1001:1001, got ${actual_owner})."
        exit 1
    fi
    
    actual_bytes=$(stat -c "%s" "${file}")
    if [ "${actual_bytes}" -ne "${expected_bytes}" ]; then
        echo "CRITICAL ERROR: Byte count mismatch for ${file} (expected ${expected_bytes}, got ${actual_bytes})."
        exit 1
    fi
    
    actual_sha=$(sha256sum "${file}" | awk '{print $1}')
    if [ "${actual_sha}" != "${expected_sha}" ]; then
        echo "CRITICAL ERROR: Checksum mismatch for ${file}!"
        echo "  Expected: ${expected_sha}"
        echo "  Actual:   ${actual_sha}"
        exit 1
    fi
    
    echo "✓ Verified [1001:1001, ${actual_bytes} B, regular file, non-symlink]: ${file}"
done

echo "All 7 destination files verified 100% compliant."

# 7. Execute Phase SP-8C-6S Read-Only Static Host Validation as github-runner
echo "========================================================================"
echo ">>> EXECUTING PHASE SP-8C-6S STATIC VALIDATION AS github-runner"
echo "========================================================================"

su - github-runner -c '
    export XDG_RUNTIME_DIR="/run/user/1001"
    export DOCKER_HOST="unix:///run/user/1001/docker.sock"
    cd /opt/socialpulse
    ./scripts/validate_staging_compose.sh
'