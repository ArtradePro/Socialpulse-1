#!/bin/bash
# ==============================================================================
# HIGIENE (PTY) LTD — PROJECT EVERGREEN / SOCIALPULSE
# GATE SP-8C-7A REVISION R8: HOST STAGING, VERIFICATION & PREFLIGHT WRAPPER
# Target Host: srv1935605 (2.24.130.251)
# Script Name: run_sp8c7a_r8.sh
# Identity: root (EUID 0)
# Guarantees: Transactional publication, zero wildcard deletion, collision rejection,
#             mktemp validation, signal-specific exit statuses, absence-verified cleanup,
#             exact log path extraction from preflight output (no ls | head, no || true).
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Must be executed directly as root (EUID 0)." >&2
    exit 1
fi

STAGE_DIR=""
EXEC_OUT_FILE=""
CREATED_BY_WRAPPER=()
PUBLICATION_COMMITTED=0

cleanup_stage_dir() {
    if [ -n "${STAGE_DIR}" ]; then
        case "${STAGE_DIR}" in
            /tmp/sp8c7a_stage.*) ;;
            *)
                echo "CRITICAL ERROR: Refusing to clean stage dir with invalid prefix: ${STAGE_DIR}" >&2
                return 1
                ;;
        esac

        local canon_stage
        canon_stage="$(readlink -f "${STAGE_DIR}")"
        case "${canon_stage}" in
            /tmp/sp8c7a_stage.*) ;;
            *)
                echo "CRITICAL ERROR: Refusing to clean stage dir with non-canonical path: ${canon_stage}" >&2
                return 1
                ;;
        esac

        if [ -d "${STAGE_DIR}" ] && [ ! -L "${STAGE_DIR}" ]; then
            rm -rf "${STAGE_DIR}"
            if [ -e "${STAGE_DIR}" ] || [ -L "${STAGE_DIR}" ]; then
                echo "CRITICAL ERROR: Stage directory absence verification failed: ${STAGE_DIR}" >&2
                return 1
            fi
            echo "Stage directory cleaned and absence verified: ${STAGE_DIR}"
        fi
    fi
}

cleanup_exec_out() {
    if [ -n "${EXEC_OUT_FILE}" ]; then
        case "${EXEC_OUT_FILE}" in
            /tmp/sp8c7a_exec_out.*) ;;
            *)
                echo "CRITICAL ERROR: Refusing to clean execution output file with invalid prefix: ${EXEC_OUT_FILE}" >&2
                return 1
                ;;
        esac

        local canon_exec
        canon_exec="$(readlink -f "${EXEC_OUT_FILE}")"
        case "${canon_exec}" in
            /tmp/sp8c7a_exec_out.*) ;;
            *)
                echo "CRITICAL ERROR: Refusing to clean execution output file with non-canonical path: ${canon_exec}" >&2
                return 1
                ;;
        esac

        if [ -e "${EXEC_OUT_FILE}" ] || [ -L "${EXEC_OUT_FILE}" ]; then
            rm -f "${EXEC_OUT_FILE}"
            if [ -e "${EXEC_OUT_FILE}" ] || [ -L "${EXEC_OUT_FILE}" ]; then
                echo "CRITICAL ERROR: Execution output file absence verification failed: ${EXEC_OUT_FILE}" >&2
                return 1
            fi
            echo "Execution output file cleaned and absence verified: ${EXEC_OUT_FILE}"
        fi
    fi
}

rollback_created_files() {
    if [ "${PUBLICATION_COMMITTED}" -eq 0 ] && [ "${#CREATED_BY_WRAPPER[@]}" -gt 0 ]; then
        echo ">>> Initiating transactional rollback of files created by this wrapper..." >&2
        for f in "${CREATED_BY_WRAPPER[@]}"; do
            if [ -e "${f}" ] || [ -L "${f}" ]; then
                rm -f "${f}"
                if [ -e "${f}" ] || [ -L "${f}" ]; then
                    echo "CRITICAL ERROR: Rollback absence verification failed for ${f}!" >&2
                else
                    echo "Rolled back created file: ${f}" >&2
                fi
            fi
        done
    fi
}

handle_signal() {
    local sig_name="$1"
    local sig_code="$2"
    trap - EXIT HUP INT QUIT TERM
    echo "CRITICAL WARNING: Interrupted by signal ${sig_name} (exit ${sig_code}). Cleaning up..." >&2
    rollback_created_files
    cleanup_stage_dir
    cleanup_exec_out
    exit "${sig_code}"
}

trap 'handle_signal HUP 129' HUP
trap 'handle_signal INT 130' INT
trap 'handle_signal QUIT 131' QUIT
trap 'handle_signal TERM 143' TERM

cleanup_all() {
    local exit_code=$?
    trap - EXIT HUP INT QUIT TERM
    if [ "${exit_code}" -ne 0 ]; then
        rollback_created_files
    fi
    cleanup_stage_dir
    cleanup_exec_out
    exit "${exit_code}"
}
trap cleanup_all EXIT

echo "========================================================================"
echo ">>> [1/6] Initializing Secure Staging Directory"
echo "========================================================================"

STAGE_DIR="$(mktemp -d /tmp/sp8c7a_stage.XXXXXX)"
chmod 0700 "${STAGE_DIR}"

EXEC_OUT_FILE="$(mktemp /tmp/sp8c7a_exec_out.XXXXXX)"
chmod 0600 "${EXEC_OUT_FILE}"

echo "Staging directory : ${STAGE_DIR}"
echo "Execution output  : ${EXEC_OUT_FILE}"

echo ""
echo "========================================================================"
echo ">>> [2/6] Downloading Approved Gate SP-8C-7A R8 Artifacts into Staging"
echo "========================================================================"

BASE_URL="https://raw.githubusercontent.com/ArtradePro/Socialpulse-1/scripts/backup-r10"

CURL_STATUS_SH=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_preflight.sh" -o "${STAGE_DIR}/sp8c7a_preflight.sh" || CURL_STATUS_SH=$?
if [ "${CURL_STATUS_SH}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_preflight.sh (curl exit ${CURL_STATUS_SH})" >&2
    exit 1
fi
echo "Downloaded sp8c7a_preflight.sh (curl exit ${CURL_STATUS_SH})"

CURL_STATUS_SIG=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_preflight.sh.sha256" -o "${STAGE_DIR}/sp8c7a_preflight.sh.sha256" || CURL_STATUS_SIG=$?
if [ "${CURL_STATUS_SIG}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_preflight.sh.sha256 (curl exit ${CURL_STATUS_SIG})" >&2
    exit 1
fi
echo "Downloaded sp8c7a_preflight.sh.sha256 (curl exit ${CURL_STATUS_SIG})"

CURL_STATUS_DOC=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_preflight_runbook.md" -o "${STAGE_DIR}/sp8c7a_preflight_runbook.md" || CURL_STATUS_DOC=$?
if [ "${CURL_STATUS_DOC}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_preflight_runbook.md (curl exit ${CURL_STATUS_DOC})" >&2
    exit 1
fi
echo "Downloaded sp8c7a_preflight_runbook.md (curl exit ${CURL_STATUS_DOC})"

CURL_STATUS_MAN=0
curl -fsSL "${BASE_URL}/scripts/sp8c7a_manifest.json" -o "${STAGE_DIR}/sp8c7a_manifest.json" || CURL_STATUS_MAN=$?
if [ "${CURL_STATUS_MAN}" -ne 0 ]; then
    echo "CRITICAL ERROR: Failed to download sp8c7a_manifest.json (curl exit ${CURL_STATUS_MAN})" >&2
    exit 1
fi
echo "Downloaded sp8c7a_manifest.json (curl exit ${CURL_STATUS_MAN})"

echo ""
echo "========================================================================"
echo ">>> [3/6] Verifying Staged Artifacts, Syntax & Manifest Baseline"
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

    echo "Staged artifact verified: ${target##*/} (${act_bytes} bytes, SHA-256 ${act_sha256})"
}

verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh" 48336 "225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh.sha256" 86 "06296f97a98738794cdcabc16d8c85bed732823b9e4b9cd5c03105f37f92e700"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight_runbook.md" 5000 "81011acca889267a77fce33e6461dade5f63f021fb6d12e024785ac0b7de1f1c"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_manifest.json" 2995 "018d0e12fa34f1b1bbb0d9b38a200d3d4d35f7d77ab80ccc7a03f76e59af8ab8"

# Validate staged script syntax
BASH_N_STATUS=0
/bin/bash -n "${STAGE_DIR}/sp8c7a_preflight.sh" || BASH_N_STATUS=$?
if [ "${BASH_N_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: bash -n syntax validation failed for staged script (status ${BASH_N_STATUS})" >&2
    exit 1
fi
echo "Staged script syntax valid: bash -n exit 0"

# Validate staged manifest using Python (Python 3.10 compatible)
PYTHON_MANIFEST_STATUS=0
python3 -c '
import json, sys

manifest_path = sys.argv[1]

with open(manifest_path, "r", encoding="utf-8") as f:
    data = json.load(f)

sv = data.get("schema_version")
assert sv == "1.0", f"schema_version expected 1.0, got {sv}"

gate = data.get("gate")
assert gate == "SP-8C-7A", f"gate expected SP-8C-7A, got {gate}"

assert "members" in data, "members array key missing from manifest"
members = data["members"]
assert isinstance(members, list), "members must be an array"
assert len(members) == 4, f"Expected exactly four listed governed members, got {len(members)}"

expected_workload_members = {
    "sp8c7a_preflight.sh": {
        "bytes": 48336,
        "lines": 1166,
        "sha256": "225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54",
        "role": "unified_self_contained_strictly_read_only_host_preflight_script"
    },
    "sp8c7a_preflight.sh.sha256": {
        "bytes": 86,
        "lines": 1,
        "sha256": "06296f97a98738794cdcabc16d8c85bed732823b9e4b9cd5c03105f37f92e700",
        "role": "corroborating_script_checksum_sidecar"
    },
    "sp8c7a_preflight_runbook.md": {
        "bytes": 5000,
        "lines": 43,
        "sha256": "81011acca889267a77fce33e6461dade5f63f021fb6d12e024785ac0b7de1f1c",
        "role": "operational_preflight_runbook_and_invariants_revision_r7"
    }
}

required_fields = ["filename", "bytes", "lines", "sha256", "role"]

for m in members:
    for field in required_fields:
        assert field in m, f"Field {field} missing from member"
    fn = m["filename"]
    if fn in expected_workload_members:
        exp = expected_workload_members[fn]
        exp_b = exp["bytes"]
        act_b = m["bytes"]
        assert act_b == exp_b, f"{fn} bytes mismatch: expected {exp_b}, got {act_b}"
        exp_l = exp["lines"]
        act_l = m["lines"]
        assert act_l == exp_l, f"{fn} lines mismatch: expected {exp_l}, got {act_l}"
        exp_s = exp["sha256"]
        act_s = m["sha256"]
        assert act_s == exp_s, f"{fn} sha256 mismatch: expected {exp_s}, got {act_s}"
        exp_r = exp["role"]
        act_r = m["role"]
        assert act_r == exp_r, f"{fn} role mismatch: expected {exp_r}, got {act_r}"
    elif fn in ["run_sp8c7a_r7.sh", "run_sp8c7a_r8.sh"]:
        assert m["role"] == "governed_host_synchronization_and_preflight_execution_wrapper", "Wrapper role mismatch"
        assert "bytes" in m and "lines" in m and "sha256" in m
    else:
        raise AssertionError(f"Unexpected member filename: {fn}")
' "${STAGE_DIR}/sp8c7a_manifest.json" || PYTHON_MANIFEST_STATUS=$?

if [ "${PYTHON_MANIFEST_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Python manifest validation failed (status ${PYTHON_MANIFEST_STATUS})" >&2
    exit 1
fi
echo "Staged manifest verified: schema 1.0, SP-8C-7A, exactly 4 members with exact field values."

echo ""
echo "========================================================================"
echo ">>> [4/6] Destination Inspection, Collision Rejection & Transactional Installation"
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

check_and_install_artifact() {
    local fname="$1"
    local exp_bytes="$2"
    local exp_sha256="$3"
    local exp_mode="$4"

    local src_file="${STAGE_DIR}/${fname}"
    local dest_file="${DEST_DIR}/${fname}"

    if [ -L "${dest_file}" ]; then
        echo "CRITICAL ERROR: Destination ${dest_file} is a symlink. Symlinks rejected." >&2
        exit 1
    fi

    if [ -e "${dest_file}" ]; then
        if [ ! -f "${dest_file}" ]; then
            echo "CRITICAL ERROR: Destination collision at ${dest_file}: not a regular file." >&2
            exit 1
        fi

        local act_bytes act_sha256 act_owner act_mode
        act_bytes="$(stat -c '%s' "${dest_file}")"
        act_sha256="$(sha256sum "${dest_file}" | awk '{print $1}')"
        act_owner="$(stat -c '%u:%g' "${dest_file}")"
        act_mode="$(stat -c '%a' "${dest_file}")"

        if [ "${act_bytes}" -eq "${exp_bytes}" ] && \
           [ "${act_sha256}" = "${exp_sha256}" ] && \
           [ "${act_owner}" = "1001:1001" ] && \
           [ "${act_mode}" = "${exp_mode}" ]; then
            echo "Destination ${fname} already exists and matches the approved artifact exactly (preserving without re-installation)."
            return 0
        else
            echo "CRITICAL ERROR: Destination collision at ${dest_file}! Existing file does not match approved artifact." >&2
            echo "  Expected: bytes=${exp_bytes}, sha256=${exp_sha256}, owner=1001:1001, mode=${exp_mode}" >&2
            echo "  Actual:   bytes=${act_bytes}, sha256=${act_sha256}, owner=${act_owner}, mode=${act_mode}" >&2
            exit 1
        fi
    fi

    install -m "0${exp_mode}" -o 1001 -g 1001 "${src_file}" "${dest_file}"
    CREATED_BY_WRAPPER+=("${dest_file}")
    echo "Installed ${fname} (owner 1001:1001, mode 0${exp_mode})"
}

check_and_install_artifact "sp8c7a_preflight.sh" 48336 "225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54" "700"
check_and_install_artifact "sp8c7a_preflight.sh.sha256" 86 "06296f97a98738794cdcabc16d8c85bed732823b9e4b9cd5c03105f37f92e700" "600"
check_and_install_artifact "sp8c7a_preflight_runbook.md" 5000 "81011acca889267a77fce33e6461dade5f63f021fb6d12e024785ac0b7de1f1c" "600"
check_and_install_artifact "sp8c7a_manifest.json" 2995 "018d0e12fa34f1b1bbb0d9b38a200d3d4d35f7d77ab80ccc7a03f76e59af8ab8" "600"

echo ""
echo "========================================================================"
echo ">>> [5/6] Post-Publication Independent Destination Reverification"
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

    echo "Reverified destination: ${target##*/} (canonical=${canon_path}, bytes=${act_bytes}, mode=${act_mode}, owner=${act_owner}, sha256=${act_sha256})"
}

reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh" 48336 "225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54" "1001:1001" "700"
reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh.sha256" 86 "06296f97a98738794cdcabc16d8c85bed732823b9e4b9cd5c03105f37f92e700" "1001:1001" "600"
reverify_destination_file "${DEST_DIR}/sp8c7a_preflight_runbook.md" 5000 "81011acca889267a77fce33e6461dade5f63f021fb6d12e024785ac0b7de1f1c" "1001:1001" "600"
reverify_destination_file "${DEST_DIR}/sp8c7a_manifest.json" 2995 "018d0e12fa34f1b1bbb0d9b38a200d3d4d35f7d77ab80ccc7a03f76e59af8ab8" "1001:1001" "600"

PUBLICATION_COMMITTED=1
echo "Publication transaction committed successfully."

echo ""
echo "========================================================================"
echo ">>> [6/6] Invoking Approved SP-8C-7A Preflight with External Trust Anchor"
echo "========================================================================"

set +e
EXPECTED_SP8C7A_SHA256="225d634f96b23cc9fd1f777114344ce0935410e3590ed6877502f646c9ac7b54" \
EXPECTED_SP8C7A_BYTES="48336" \
/bin/bash "${DEST_DIR}/sp8c7a_preflight.sh" 2>&1 | tee "${EXEC_OUT_FILE}"
PIPE_STATUS=("${PIPESTATUS[@]}")
set -e

PREFLIGHT_STATUS="${PIPE_STATUS[0]}"
TEE_STATUS="${PIPE_STATUS[1]}"

echo ""
echo "========================================================================"
echo ">>> SP-8C-7A Preflight Execution Concluded"
echo ">>> Captured Preflight Script Exit Status : ${PREFLIGHT_STATUS}"
echo ">>> Captured Output Tee Exit Status        : ${TEE_STATUS}"
echo "========================================================================"

EXACT_LOG_PATH="$(sed -n 's/^>>> Canonical Log[[:space:]]*:[[:space:]]*\([^ ]*\).*/\1/p' "${EXEC_OUT_FILE}" | tr -d '\r\n')"

if [ -z "${EXACT_LOG_PATH}" ]; then
    echo "CRITICAL ERROR: Failed to extract Canonical Log path from preflight output!" >&2
    exit 1
fi

if [ ! -f "${EXACT_LOG_PATH}" ] || [ -L "${EXACT_LOG_PATH}" ]; then
    echo "CRITICAL ERROR: Extracted log path ${EXACT_LOG_PATH} is missing or not a regular file!" >&2
    exit 1
fi

LOG_BYTES="$(stat -c '%s' "${EXACT_LOG_PATH}")"
LOG_SHA256="$(sha256sum "${EXACT_LOG_PATH}" | awk '{print $1}')"
LOG_OWNER="$(stat -c '%U:%G (%u:%g)' "${EXACT_LOG_PATH}")"
LOG_PERM="$(stat -c '%a' "${EXACT_LOG_PATH}")"

echo "Canonical Root Log Telemetry (Directly Extracted from Preflight):"
echo "  Path:        ${EXACT_LOG_PATH}"
echo "  Bytes:       ${LOG_BYTES}"
echo "  SHA-256:     ${LOG_SHA256}"
echo "  Owner:       ${LOG_OWNER}"
echo "  Permissions: ${LOG_PERM}"
echo "  Preflight:   exit ${PREFLIGHT_STATUS}"
echo "  Tee:         exit ${TEE_STATUS}"

if [ "${PREFLIGHT_STATUS}" -ne 0 ]; then
    echo "Preflight completed with non-zero status: ${PREFLIGHT_STATUS}" >&2
    exit "${PREFLIGHT_STATUS}"
fi

if [ "${TEE_STATUS}" -ne 0 ]; then
    echo "Output tee completed with non-zero status: ${TEE_STATUS}" >&2
    exit "${TEE_STATUS}"
fi

exit 0
