#!/bin/bash
# ==============================================================================
# HIGIENE (PTY) LTD — PROJECT EVERGREEN / SOCIALPULSE
# GATE SP-8C-7A: REVISION R17 HOST SYNCHRONIZATION & PREFLIGHT EXECUTION WRAPPER
# Identity: root (EUID 0) on srv1935605 (2.24.130.251)
# Governed Path: /opt/socialpulse/scripts/ (owner 1001:1001, mode 0755)
# Scope: Controlled download, integrity validation, transactional installation
#        and read-only preflight execution.
# INVARIANT: Zero database mutations, zero snapshots, zero container executions.
# ==============================================================================
set -euo pipefail
umask 077

echo "========================================================================"
echo ">>> HIGIENE (PTY) LTD — GATE SP-8C-7A REVISION R17 HOST WRAPPER"
echo ">>> Execution Authority : Vernon la Cock, Chief Executive Officer"
echo ">>> Review Authority    : ChatGPT (Independent Reviewer)"
echo ">>> Target Host         : srv1935605 (2.24.130.251)"
echo ">>> Workload Identity   : github-runner (UID 1001:1001)"
echo ">>> Operating Mode      : STRICTLY READ-ONLY PREFLIGHT AUDIT"
echo "========================================================================"

# Pre-execution environment verification
if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: run_sp8c7a_r17.sh must be executed as root (EUID 0)!" >&2
    exit 1
fi

if ! id -u "github-runner" >/dev/null 2>&1; then
    echo "CRITICAL ERROR: Workload user github-runner (UID 1001) not found!" >&2
    exit 1
fi

# Hardcoded trust anchor for sp8c7a_preflight.sh (Revision R17)
EXPECTED_SCRIPT_SHA256="a61920379bdd5a37ffc3bc939341f313a05b70b795a4781dd813d50439d133ef"
EXPECTED_SCRIPT_BYTES=58213
EXPECTED_SCRIPT_LINES=1389

# Hardcoded trust anchor for sp8c7a_preflight.sh.sha256 (Revision R17)
EXPECTED_SIDECAR_SHA256="e3387681aab28d3da24b15bb7dd80d8b58954aa455ea8db4da84a9edccbb8f38"
EXPECTED_SIDECAR_BYTES=86
EXPECTED_SIDECAR_LINES=1

# Hardcoded trust anchor for sp8c7a_preflight_runbook.md (Revision R17)
EXPECTED_RUNBOOK_SHA256="e75503044b0934f71cbecd39b3ccdbc7b6ba036d7587e721b27f5263165fde05"
EXPECTED_RUNBOOK_BYTES=8995
EXPECTED_RUNBOOK_LINES=90

# Hardcoded trust anchor for sp8c7a_manifest.json (Revision R17)
EXPECTED_MANIFEST_SHA256="955f0562b798a7723fa02d3261c6607d283b89005c4a92ed780fea7e1721bdfc"
EXPECTED_MANIFEST_BYTES=4699
EXPECTED_MANIFEST_LINES=99

echo ""
echo "========================================================================"
echo ">>> [1/6] Creating Isolated Staging Directory"
echo "========================================================================"

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
                    return 1
                else
                    echo "Rolled back created file: ${f}" >&2
                fi
            fi
        done
    fi
}

on_exit() {
    local exit_code=$?
    trap - EXIT HUP INT QUIT TERM
    echo ""
    echo ">>> Executing wrapper exit handler (exit code: ${exit_code})..."
    rollback_created_files || exit_code=1
    cleanup_stage_dir || exit_code=1
    cleanup_exec_out || exit_code=1
    exit "${exit_code}"
}

on_signal() {
    local sig="$1"
    local sig_exit="$2"
    trap - EXIT HUP INT QUIT TERM
    echo "CRITICAL: Caught signal ${sig}! Cleaning up and exiting with code ${sig_exit}..." >&2
    local clean_failed=0
    rollback_created_files || clean_failed=1
    cleanup_stage_dir || clean_failed=1
    cleanup_exec_out || clean_failed=1
    if [ "${clean_failed}" -ne 0 ]; then
        echo "CRITICAL ERROR: Containment failure during signal cleanup!" >&2
        exit 1
    fi
    exit "${sig_exit}"
}

trap 'on_exit' EXIT
trap 'on_signal HUP 129' HUP
trap 'on_signal INT 130' INT
trap 'on_signal QUIT 131' QUIT
trap 'on_signal TERM 143' TERM

STAGE_DIR="$(mktemp -d /tmp/sp8c7a_stage.XXXXXX)"
chmod 0700 "${STAGE_DIR}"
chown root:root "${STAGE_DIR}"
echo "Created isolated staging directory: ${STAGE_DIR} (mode 0700, owner root:root)"

EXEC_OUT_FILE="$(mktemp /tmp/sp8c7a_exec_out.XXXXXX)"
chmod 0600 "${EXEC_OUT_FILE}"
chown root:root "${EXEC_OUT_FILE}"

echo ""
echo "========================================================================"
echo ">>> [2/6] Downloading Governed Artifacts with Explicit Status Capture"
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

verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh" 58213 "a61920379bdd5a37ffc3bc939341f313a05b70b795a4781dd813d50439d133ef"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh.sha256" 86 "e3387681aab28d3da24b15bb7dd80d8b58954aa455ea8db4da84a9edccbb8f38"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight_runbook.md" 8995 "e75503044b0934f71cbecd39b3ccdbc7b6ba036d7587e721b27f5263165fde05"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_manifest.json" 4699 "955f0562b798a7723fa02d3261c6607d283b89005c4a92ed780fea7e1721bdfc"

# Validate staged script syntax
BASH_N_STATUS=0
/bin/bash -n "${STAGE_DIR}/sp8c7a_preflight.sh" || BASH_N_STATUS=$?
if [ "${BASH_N_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: bash -n syntax validation failed for staged script (status ${BASH_N_STATUS})" >&2
    exit 1
fi
echo "Staged script syntax valid: bash -n exit 0"

# Validate staged manifest using Python (Python 3.10 compatible, exactly 3 payload members)
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

rev = data.get("revision")
assert rev == "R17", f"revision expected R17, got {rev}"

assert "members" in data, "members array key missing from manifest"
members = data["members"]
assert isinstance(members, list), "members must be an array"
assert len(members) == 3, f"Expected exactly three listed payload members, got {len(members)}"

expected_workload_members = {
    "sp8c7a_preflight.sh": {
        "bytes": 58213,
        "lines": 1389,
        "sha256": "a61920379bdd5a37ffc3bc939341f313a05b70b795a4781dd813d50439d133ef",
        "role": "unified_self_contained_strictly_read_only_host_preflight_script"
    },
    "sp8c7a_preflight.sh.sha256": {
        "bytes": 86,
        "lines": 1,
        "sha256": "e3387681aab28d3da24b15bb7dd80d8b58954aa455ea8db4da84a9edccbb8f38",
        "role": "corroborating_script_checksum_sidecar"
    },
    "sp8c7a_preflight_runbook.md": {
        "bytes": 8995,
        "lines": 90,
        "sha256": "e75503044b0934f71cbecd39b3ccdbc7b6ba036d7587e721b27f5263165fde05",
        "role": "operational_preflight_runbook_and_invariants_revision_r17"
    }
}

required_fields = ["filename", "bytes", "lines", "sha256", "role"]

for m in members:
    for field in required_fields:
        assert field in m, f"Field {field} missing from member"
    fn = m["filename"]
    assert fn in expected_workload_members, f"Unexpected member in manifest: {fn}"
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

' "${STAGE_DIR}/sp8c7a_manifest.json" || PYTHON_MANIFEST_STATUS=$?

if [ "${PYTHON_MANIFEST_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Python manifest validation failed (status ${PYTHON_MANIFEST_STATUS})" >&2
    exit 1
fi
echo "Staged manifest verified: schema 1.0, gate SP-8C-7A, revision R17, exactly 3 payload members with exact field values."

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

check_and_install_artifact "sp8c7a_preflight.sh" 58213 "a61920379bdd5a37ffc3bc939341f313a05b70b795a4781dd813d50439d133ef" "700"
check_and_install_artifact "sp8c7a_preflight.sh.sha256" 86 "e3387681aab28d3da24b15bb7dd80d8b58954aa455ea8db4da84a9edccbb8f38" "600"
check_and_install_artifact "sp8c7a_preflight_runbook.md" 8995 "e75503044b0934f71cbecd39b3ccdbc7b6ba036d7587e721b27f5263165fde05" "600"
check_and_install_artifact "sp8c7a_manifest.json" 4699 "955f0562b798a7723fa02d3261c6607d283b89005c4a92ed780fea7e1721bdfc" "600"

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

reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh" 58213 "a61920379bdd5a37ffc3bc939341f313a05b70b795a4781dd813d50439d133ef" "1001:1001" "700"
reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh.sha256" 86 "e3387681aab28d3da24b15bb7dd80d8b58954aa455ea8db4da84a9edccbb8f38" "1001:1001" "600"
reverify_destination_file "${DEST_DIR}/sp8c7a_preflight_runbook.md" 8995 "e75503044b0934f71cbecd39b3ccdbc7b6ba036d7587e721b27f5263165fde05" "1001:1001" "600"
reverify_destination_file "${DEST_DIR}/sp8c7a_manifest.json" 4699 "955f0562b798a7723fa02d3261c6607d283b89005c4a92ed780fea7e1721bdfc" "1001:1001" "600"

PUBLICATION_COMMITTED=1
echo "Publication transaction committed successfully."

echo ""
echo "========================================================================"
echo ">>> [6/6] Invoking Approved SP-8C-7A Preflight with External Trust Anchor"
echo "========================================================================"

set +e
EXPECTED_SP8C7A_SHA256="a61920379bdd5a37ffc3bc939341f313a05b70b795a4781dd813d50439d133ef" \
EXPECTED_SP8C7A_BYTES="58213" \
/bin/bash "${DEST_DIR}/sp8c7a_preflight.sh" 2>&1 | tee "${EXEC_OUT_FILE}"
PIPE_STATUS=("${PIPESTATUS[@]}")
set -e

PREFLIGHT_STATUS="${PIPE_STATUS[0]}"
TEE_STATUS="${PIPE_STATUS[1]}"

echo ""
echo "========================================================================"
echo ">>> SP-8C-7A Preflight Execution Concluded"
echo ">>> Preflight Script Status : ${PREFLIGHT_STATUS}"
echo ">>> Tee Status              : ${TEE_STATUS}"
echo "========================================================================"

# Require outer TEE_STATUS == 0
if [ "${TEE_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: Tee returned non-zero exit code ${TEE_STATUS}!" >&2
    exit 1
fi

# Require preflight status to be either 0 (no findings) or 2 (findings documented)
if [ "${PREFLIGHT_STATUS}" -ne 0 ] && [ "${PREFLIGHT_STATUS}" -ne 2 ]; then
    echo "CRITICAL ERROR: Preflight script returned unexpected failure status ${PREFLIGHT_STATUS}!" >&2
    exit 1
fi

# Extract exactly one canonical-log declaration from execution output with explicit status capture and zero || true
set +e
LOG_DECL_LINES="$(grep "^>>> Canonical Log" "${EXEC_OUT_FILE}")"
GREP_LOG_STATUS=$?
set -e

if [ "${GREP_LOG_STATUS}" -ne 0 ] || [ -z "${LOG_DECL_LINES}" ]; then
    echo "CRITICAL ERROR: Failed to find canonical-log declaration in execution output (grep exit: ${GREP_LOG_STATUS})!" >&2
    exit 1
fi

LOG_DECL_COUNT="$(printf "%s\n" "${LOG_DECL_LINES}" | wc -l)"
if [ "${LOG_DECL_COUNT}" -ne 1 ]; then
    echo "CRITICAL ERROR: Expected exactly one canonical-log declaration in execution output, found ${LOG_DECL_COUNT}!" >&2
    exit 1
fi

CANON_LOG="$(echo "${LOG_DECL_LINES}" | cut -d: -f2 | awk '{print $1}')"

if [ -z "${CANON_LOG}" ]; then
    echo "CRITICAL ERROR: Failed to parse canonical log path from declaration line!" >&2
    exit 1
fi

case "${CANON_LOG}" in
    /root/sp8c7a_preflight_*.log) ;;
    *)
        echo "CRITICAL ERROR: Canonical log path has invalid prefix/format: ${CANON_LOG}" >&2
        exit 1
    ;;
esac

# Explicit status capture on readlink with zero || true
set +e
canon_resolved_log="$(readlink -f "${CANON_LOG}" 2>/dev/null)"
READLINK_LOG_STATUS=$?
set -e

if [ "${READLINK_LOG_STATUS}" -ne 0 ] || [ -z "${canon_resolved_log}" ]; then
    echo "CRITICAL ERROR: readlink failed to resolve canonical log path ${CANON_LOG} (status: ${READLINK_LOG_STATUS})!" >&2
    exit 1
fi

if [ "${canon_resolved_log}" != "${CANON_LOG}" ]; then
    echo "CRITICAL ERROR: Canonical log path does not match resolved path: ${canon_resolved_log}" >&2
    exit 1
fi

if [ ! -f "${CANON_LOG}" ]; then
    echo "CRITICAL ERROR: Canonical log ${CANON_LOG} does not exist or is not a regular file!" >&2
    exit 1
fi

if [ -L "${CANON_LOG}" ]; then
    echo "CRITICAL ERROR: Canonical log ${CANON_LOG} is a symlink! Symlinks strictly rejected." >&2
    exit 1
fi

LOG_BYTES="$(stat -c '%s' "${CANON_LOG}")"
LOG_SHA256="$(sha256sum "${CANON_LOG}" | awk '{print $1}')"
LOG_OWNER="$(stat -c '%u:%g' "${CANON_LOG}")"
LOG_MODE="$(stat -c '%a' "${CANON_LOG}")"

if [ "${LOG_OWNER}" != "0:0" ]; then
    echo "CRITICAL ERROR: Canonical log owner mismatch: expected 0:0 (root:root), got ${LOG_OWNER}!" >&2
    exit 1
fi

if [ "${LOG_MODE}" != "600" ]; then
    echo "CRITICAL ERROR: Canonical log mode mismatch: expected 600 (0600), got ${LOG_MODE}!" >&2
    exit 1
fi

if [ "${LOG_BYTES}" -le 0 ]; then
    echo "CRITICAL ERROR: Canonical log is empty (0 bytes)!" >&2
    exit 1
fi

echo ""
echo "========================================================================"
echo ">>> Final Preflight Evidence Summary"
echo "========================================================================"
echo "Canonical Log Path   : ${CANON_LOG}"
echo "Log Size             : ${LOG_BYTES} bytes"
echo "Log SHA-256          : ${LOG_SHA256}"
echo "Log Owner            : ${LOG_OWNER} (expected 0:0)"
echo "Log Mode             : 0${LOG_MODE} (expected 0600)"
echo "Preflight Exit Code  : ${PREFLIGHT_STATUS}"
echo "Tee Exit Code        : ${TEE_STATUS}"
echo "========================================================================"

if [ "${PREFLIGHT_STATUS}" -eq 0 ]; then
    if grep -q "  - Finding:" "${CANON_LOG}"; then
        echo "CRITICAL ERROR: Preflight returned 0 but canonical log contains recorded findings!" >&2
        exit 1
    fi
    echo "Gate SP-8C-7A Revision R17 host synchronization and preflight execution PASSED with PREFLIGHT_COMPLETE_NO_FINDINGS (exit code 0)."
    exit 0
elif [ "${PREFLIGHT_STATUS}" -eq 2 ]; then
    if ! grep -q "  - Finding:" "${CANON_LOG}"; then
        echo "CRITICAL ERROR: Preflight returned status 2 but canonical log has no recorded findings!" >&2
        exit 1
    fi
    echo "Gate SP-8C-7A Revision R17 host synchronization and preflight execution CONCLUDED with PREFLIGHT_COMPLETE_WITH_FINDINGS (exit code 2)."
    echo "Discrepancies documented in canonical log. Zero mutations permitted. Migration execution is not authorized."
    exit 2
fi
