#!/bin/bash
# ==============================================================================
# HIGIENE (PTY) LTD — PROJECT EVERGREEN / SOCIALPULSE
# GATE SP-8C-7A REVISION R5: CONTROLLED HOST STAGING, VERIFICATION & EXECUTION
# Target Host: srv1935605 (2.24.130.251)
# Execution Role: root (EUID 0)
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Must be executed directly as root (EUID 0)." >&2
    exit 1
fi

echo "========================================================================"
echo ">>> [1/5] Creating Secure Temporary Staging Directory"
echo "========================================================================"

STAGE_DIR="$(mktemp -d /tmp/sp8c7a_stage.XXXXXX)"
chmod 0700 "${STAGE_DIR}"

cleanup_stage() {
    rm -rf "${STAGE_DIR}"
}
trap cleanup_stage EXIT INT TERM HUP

echo "Staging directory created: ${STAGE_DIR}"

echo ""
echo "========================================================================"
echo ">>> [2/5] Downloading Approved Gate SP-8C-7A R5 Artifacts into Staging"
echo "========================================================================"

BASE_URL="https://raw.githubusercontent.com/ArtradePro/Socialpulse-1/scripts/backup-r10"

CURL_STATUS_SH=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_preflight.sh" -o "${STAGE_DIR}/sp8c7a_preflight.sh" || CURL_STATUS_SH=$?
if [ "${CURL_STATUS_SH}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_preflight.sh (curl exit ${CURL_STATUS_SH})" >&2
    exit 1
fi
echo "✓ Downloaded sp8c7a_preflight.sh (curl exit ${CURL_STATUS_SH})"

CURL_STATUS_SIG=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_preflight.sh.sha256" -o "${STAGE_DIR}/sp8c7a_preflight.sh.sha256" || CURL_STATUS_SIG=$?
if [ "${CURL_STATUS_SIG}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_preflight.sh.sha256 (curl exit ${CURL_STATUS_SIG})" >&2
    exit 1
fi
echo "✓ Downloaded sp8c7a_preflight.sh.sha256 (curl exit ${CURL_STATUS_SIG})"

CURL_STATUS_DOC=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_preflight_runbook.md" -o "${STAGE_DIR}/sp8c7a_preflight_runbook.md" || CURL_STATUS_DOC=$?
if [ "${CURL_STATUS_DOC}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_preflight_runbook.md (curl exit ${CURL_STATUS_DOC})" >&2
    exit 1
fi
echo "✓ Downloaded sp8c7a_preflight_runbook.md (curl exit ${CURL_STATUS_DOC})"

CURL_STATUS_MAN=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_manifest.json" -o "${STAGE_DIR}/sp8c7a_manifest.json" || CURL_STATUS_MAN=$?
if [ "${CURL_STATUS_MAN}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_manifest.json (curl exit ${CURL_STATUS_MAN})" >&2
    exit 1
fi
echo "✓ Downloaded sp8c7a_manifest.json (curl exit ${CURL_STATUS_MAN})"

echo ""
echo "========================================================================"
echo ">>> [3/5] Verifying Staged Artifacts, Syntax & Manifest Integrity"
echo "========================================================================"

verify_staged_artifact() {
    local target="$1"
    local exp_bytes="$2"
    local exp_sha256="$3"

    if [ ! -f "${target}" ]; then
        echo "CRITICAL ERROR: Staged file ${target} is missing or not a regular file." >&2
        exit 1
    fi
    if [ -L "${target}" ]; then
        echo "CRITICAL ERROR: Staged file ${target} is a symlink. Symlinks rejected." >&2
        exit 1
    fi

    local act_bytes
    act_bytes="$(stat -c '%s' "${target}")"
    if [ "${act_bytes}" -ne "${exp_bytes}" ]; then
        echo "CRITICAL ERROR: Byte mismatch for ${target##*/}: expected ${exp_bytes}, got ${act_bytes}" >&2
        exit 1
    fi

    local act_sha256
    act_sha256="$(sha256sum "${target}" | awk '{print $1}')"
    if [ "${act_sha256}" != "${exp_sha256}" ]; then
        echo "CRITICAL ERROR: SHA-256 mismatch for ${target##*/}: expected ${exp_sha256}, got ${act_sha256}" >&2
        exit 1
    fi

    echo "✓ Staged artifact verified: ${target##*/} (${act_bytes} bytes, SHA-256 ${act_sha256})"
}

verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh" 49060 "d704fadd700f5ba1eaa9321c39c7e269aed6a7cebdb3fa890287a0e9c3fa8595"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh.sha256" 101 "13c16183a74a84f6f9d67e8b3eb2136cc22e7f681be77b84a80594d681ab1541"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight_runbook.md" 5029 "a42211132d80010ff939e7373c0fdd9297f0ec5c90dddd1b3d948081b893e778"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_manifest.json" 2737 "54794c89623096eb678d04b7ce0d25912c1fbe666e8044504c3cf0ec10284a04"

# Validate staged script syntax
BASH_N_STATUS=0
/bin/bash -n "${STAGE_DIR}/sp8c7a_preflight.sh" || BASH_N_STATUS=$?
if [ "${BASH_N_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: bash -n syntax validation failed for staged script (status ${BASH_N_STATUS})" >&2
    exit 1
fi
echo "✓ Staged script syntax valid: bash -n exit 0"

# Validate staged manifest using Python
PYTHON_JSON_STATUS=0
python3 -c '
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
assert data.get("schema_version") == "1.0.0", "Invalid schema_version"
assert data.get("gate") == "SP-8C-7A", "Invalid gate"
assert len(data.get("manifest", [])) == 4, f"Expected 4 manifest items, got {len(data.get(\"manifest\", []))}"
for item in data["manifest"]:
    assert "file" in item and "bytes" in item and "sha256" in item and "mode" in item and "owner" in item
' "${STAGE_DIR}/sp8c7a_manifest.json" || PYTHON_JSON_STATUS=$?

if [ "${PYTHON_JSON_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Python JSON validation failed for staged manifest (status ${PYTHON_JSON_STATUS})" >&2
    exit 1
fi
echo "✓ Staged manifest JSON valid: Python validation exit 0"

echo ""
echo "========================================================================"
echo ">>> [4/5] Pre-Publish Collision Check & Individual File Installation"
echo "========================================================================"

DEST_DIR="/opt/socialpulse/scripts"

if [ -L "${DEST_DIR}" ]; then
    echo "CRITICAL ERROR: Destination directory ${DEST_DIR} is a symlink. Symlinks rejected." >&2
    exit 1
fi

if [ ! -d "${DEST_DIR}" ]; then
    mkdir -p "${DEST_DIR}"
    chown 1001:1001 "${DEST_DIR}"
    chmod 0755 "${DEST_DIR}"
fi

# Reject destination collisions and symlinks before publishing
for FNAME in sp8c7a_preflight.sh sp8c7a_preflight.sh.sha256 sp8c7a_preflight_runbook.md sp8c7a_manifest.json; do
    DEST_PATH="${DEST_DIR}/${FNAME}"
    if [ -L "${DEST_PATH}" ]; then
        echo "CRITICAL ERROR: Destination ${DEST_PATH} is a symlink. Symlinks rejected." >&2
        exit 1
    fi
    if [ -e "${DEST_PATH}" ]; then
        echo "CRITICAL ERROR: Destination collision detected. ${DEST_PATH} already exists. Collision rejected." >&2
        exit 1
    fi
done

echo "✓ Zero destination collisions and zero symlinks verified in ${DEST_DIR}."

# Install each file individually with explicit owner and mode (NO recursive chown/chmod)
install -m 0700 -o 1001 -g 1001 "${STAGE_DIR}/sp8c7a_preflight.sh" "${DEST_DIR}/sp8c7a_preflight.sh"
install -m 0600 -o 1001 -g 1001 "${STAGE_DIR}/sp8c7a_preflight.sh.sha256" "${DEST_DIR}/sp8c7a_preflight.sh.sha256"
install -m 0600 -o 1001 -g 1001 "${STAGE_DIR}/sp8c7a_preflight_runbook.md" "${DEST_DIR}/sp8c7a_preflight_runbook.md"
install -m 0600 -o 1001 -g 1001 "${STAGE_DIR}/sp8c7a_manifest.json" "${DEST_DIR}/sp8c7a_manifest.json"

echo "✓ Published 4 artifacts individually with explicit owner (1001:1001) and strict modes."

echo ""
echo "========================================================================"
echo ">>> [5/5] Post-Publication Independent Destination Reverification"
echo "========================================================================"

reverify_destination_file() {
    local target="$1"
    local exp_bytes="$2"
    local exp_sha256="$3"
    local exp_owner="$4"
    local exp_mode="$5"

    local canon_path
    canon_path="$(readlink -f "${target}")"
    if [ "${canon_path}" != "${target}" ]; then
        echo "CRITICAL ERROR: Canonical path mismatch for ${target}: resolved to ${canon_path}." >&2
        exit 1
    fi

    if [ ! -f "${target}" ]; then
        echo "CRITICAL ERROR: Destination file ${target} is missing or not a regular file." >&2
        exit 1
    fi

    if [ -L "${target}" ]; then
        echo "CRITICAL ERROR: Destination file ${target} is a symlink. Symlinks rejected." >&2
        exit 1
    fi

    local act_bytes
    act_bytes="$(stat -c '%s' "${target}")"
    if [ "${act_bytes}" -ne "${exp_bytes}" ]; then
        echo "CRITICAL ERROR: Destination byte mismatch for ${target##*/}: expected ${exp_bytes}, got ${act_bytes}." >&2
        exit 1
    fi

    local act_sha256
    act_sha256="$(sha256sum "${target}" | awk '{print $1}')"
    if [ "${act_sha256}" != "${exp_sha256}" ]; then
        echo "CRITICAL ERROR: Destination SHA-256 mismatch for ${target##*/}: expected ${exp_sha256}, got ${act_sha256}." >&2
        exit 1
    fi

    local act_owner
    act_owner="$(stat -c '%u:%g' "${target}")"
    if [ "${act_owner}" != "${exp_owner}" ]; then
        echo "CRITICAL ERROR: Destination owner mismatch for ${target##*/}: expected ${exp_owner}, got ${act_owner}." >&2
        exit 1
    fi

    local act_mode
    act_mode="$(stat -c '%a' "${target}")"
    if [ "${act_mode}" != "${exp_mode}" ]; then
        echo "CRITICAL ERROR: Destination mode mismatch for ${target##*/}: expected ${exp_mode}, got ${act_mode}." >&2
        exit 1
    fi

    echo "✓ Reverified destination: ${target##*/} (canonical=${canon_path}, bytes=${act_bytes}, mode=${act_mode}, owner=${act_owner}, sha256=${act_sha256})"
}

reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh" 49060 "d704fadd700f5ba1eaa9321c39c7e269aed6a7cebdb3fa890287a0e9c3fa8595" "1001:1001" "700"
reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh.sha256" 101 "13c16183a74a84f6f9d67e8b3eb2136cc22e7f681be77b84a80594d681ab1541" "1001:1001" "600"
reverify_destination_file "${DEST_DIR}/sp8c7a_preflight_runbook.md" 5029 "a42211132d80010ff939e7373c0fdd9297f0ec5c90dddd1b3d948081b893e778" "1001:1001" "600"
reverify_destination_file "${DEST_DIR}/sp8c7a_manifest.json" 2737 "54794c89623096eb678d04b7ce0d25912c1fbe666e8044504c3cf0ec10284a04" "1001:1001" "600"

echo ""
echo "========================================================================"
echo ">>> Invoking Approved SP-8C-7A Preflight with External Trust Anchor"
echo "========================================================================"

PREFLIGHT_STATUS=0
EXPECTED_SP8C7A_SHA256="d704fadd700f5ba1eaa9321c39c7e269aed6a7cebdb3fa890287a0e9c3fa8595" \
EXPECTED_SP8C7A_BYTES="49060" \
/bin/bash "${DEST_DIR}/sp8c7a_preflight.sh" || PREFLIGHT_STATUS=$?

echo ""
echo "========================================================================"
echo ">>> SP-8C-7A Preflight Execution Concluded"
echo ">>> Captured Preflight Script Exit Status: ${PREFLIGHT_STATUS}"
echo "========================================================================"

LATEST_LOG="$(ls -1t /root/sp8c7a_preflight_*.log 2>/dev/null | head -n 1 || true)"
if [ -n "${LATEST_LOG}" ] && [ -f "${LATEST_LOG}" ]; then
    echo "Canonical Root Log Telemetry:"
    echo "  Path:        ${LATEST_LOG}"
    echo "  Bytes:       $(stat -c '%s' "${LATEST_LOG}")"
    echo "  SHA-256:     $(sha256sum "${LATEST_LOG}" | awk '{print $1}')"
    echo "  Owner:       $(stat -c '%U:%G (%u:%g)' "${LATEST_LOG}")"
    echo "  Permissions: $(stat -c '%a' "${LATEST_LOG}")"
fi

exit "${PREFLIGHT_STATUS}"
