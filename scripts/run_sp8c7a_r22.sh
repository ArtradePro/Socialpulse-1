#!/bin/bash
# ==============================================================================
# HIGIENE (PTY) LTD — PROJECT EVERGREEN / SOCIALPULSE
# GATE SP-8C-7A: SYNCHRONIZATION AND EXECUTION WRAPPER (REVISION R22)
# Identity: root (EUID 0) outer wrapper -> unprivileged github-runner (UID 1001) workload
# Rootless Socket: unix:///run/user/1001/docker.sock
# Scope: PASSIVE READ-ONLY STANDSTILL — ZERO DATABASE MUTATIONS, ZERO SNAPSHOTS
# Fail-Closed: Strictly non-zero exit on any mismatch or pre-commit failure
# ==============================================================================
set -euo pipefail

echo "========================================================================"
echo ">>> HIGIENE (PTY) LTD — GATE SP-8C-7A WRAPPER (REVISION R22)"
echo ">>> IDENTITY: $(id -u -n) (EUID $(id -u))"
echo ">>> HOST: $(hostname)"
echo ">>> TIMESTAMP: $(date -u +'%Y-%m-%d %H:%M:%SZ')"
echo "========================================================================"

# Verify root identity
if [ "$(id -u)" -ne 0 ]; then
    echo "CRITICAL ERROR: Outer wrapper must be executed directly as root (EUID 0)." >&2
    exit 1
fi

# Verify workload user github-runner (UID 1001) exists
if ! id -u "github-runner" >/dev/null 2>&1; then
    echo "CRITICAL ERROR: Workload user github-runner (UID 1001) not found!" >&2
    exit 1
fi

# Hardcoded trust anchor for sp8c7a_preflight.sh (Revision R22)
EXPECTED_SCRIPT_SHA256="ddb462530c7b318c47f7de3d585ebdcf06b3218a7177019bfa5990b6466168d9"
EXPECTED_SCRIPT_BYTES=61362
EXPECTED_SCRIPT_LINES=1460

# Hardcoded trust anchor for sp8c7a_preflight.sh.sha256 (Revision R22)
EXPECTED_SIDECAR_SHA256="28d63058f330d8c6ac5e57a9d0718f5f3bbdcec1ad5b68d9d22bc9b3ecf3c6b3"
EXPECTED_SIDECAR_BYTES=86
EXPECTED_SIDECAR_LINES=1

# Hardcoded trust anchor for sp8c7a_preflight_runbook.md (Revision R22)
EXPECTED_RUNBOOK_SHA256="1279ca3453dad5b9179c3836ff9f55dcc34a0305141594a96e73907e7f0944af"
EXPECTED_RUNBOOK_BYTES=13057
EXPECTED_RUNBOOK_LINES=125

# Hardcoded trust anchor for sp8c7a_manifest.json (Revision R22)
EXPECTED_MANIFEST_SHA256="bf76fbb031e176e4e8cfeb317829eb286ecd936588230a7fe736c3b9fa0adbbe"
EXPECTED_MANIFEST_BYTES=5815
EXPECTED_MANIFEST_LINES=120

echo ""
echo "========================================================================"
echo ">>> [1/6] Creating Isolated Staging Directory"
echo "========================================================================"

STAGE_DIR=""
EXEC_OUT_FILE=""

# Separate tracking arrays & state for transactional publication and rollback
CREATED_BY_WRAPPER=()
REPLACED_DESTINATIONS=()
TRACKED_BACKUP_FILES=()
TRACKED_TEMP_FILES=()
FAILED_CLEANUP_PATHS=()

declare -A DEST_BACKUP_MAP=()
declare -A DEST_PUBLISHED=()
declare -A DEST_ORIG_BYTES=()
declare -A DEST_ORIG_SHA=()
declare -A DEST_ORIG_OWNER=()
declare -A DEST_ORIG_MODE=()

# Explicit two-state machine: UNCOMMITTED -> COMMITTED
PUBLICATION_STATE="UNCOMMITTED"

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

rollback_or_cleanup() {
    local handler_failed=0

    if [ "${PUBLICATION_STATE}" = "UNCOMMITTED" ]; then
        echo ">>> Transaction UNCOMMITTED: Initiating full rollback of destination modifications..." >&2

        # 1. Reverse-order restoration of replaced destinations
        local num_replaced=${#REPLACED_DESTINATIONS[@]}
        local idx
        for (( idx=num_replaced-1; idx>=0; idx-- )); do
            local dest="${REPLACED_DESTINATIONS[idx]}"
            local bak="${DEST_BACKUP_MAP[${dest}]:-}"
            local published="${DEST_PUBLISHED[${dest}]:-0}"

            if [ "${published}" -eq 1 ]; then
                # Destination was pre-armed / replaced; must restore from verified backup
                if [ -z "${bak}" ] || [ ! -f "${bak}" ]; then
                    echo "CRITICAL ERROR: Backup file missing for replaced destination ${dest} during rollback!" >&2
                    handler_failed=1
                    FAILED_CLEANUP_PATHS+=("${dest} (missing backup: ${bak})")
                    continue
                fi

                # Atomically restore
                mv -f "${bak}" "${dest}"
                local orig_mode="${DEST_ORIG_MODE[${dest}]}"
                local orig_owner="${DEST_ORIG_OWNER[${dest}]}"
                chmod "0${orig_mode}" "${dest}"
                chown "${orig_owner}" "${dest}"

                # Verify restored destination
                local r_bytes r_sha r_owner r_mode
                r_bytes="$(stat -c '%s' "${dest}")"
                r_sha="$(sha256sum "${dest}" | awk '{print $1}')"
                r_owner="$(stat -c '%u:%g' "${dest}")"
                r_mode="$(stat -c '%a' "${dest}")"

                local exp_b="${DEST_ORIG_BYTES[${dest}]}"
                local exp_s="${DEST_ORIG_SHA[${dest}]}"
                local exp_o="${DEST_ORIG_OWNER[${dest}]}"
                local exp_m="${DEST_ORIG_MODE[${dest}]}"

                if [ "${r_bytes}" -ne "${exp_b}" ] || \
                   [ "${r_sha}" != "${exp_s}" ] || \
                   [ "${r_owner}" != "${exp_o}" ] || \
                   [ "${r_mode}" != "${exp_m}" ] || \
                   [ -L "${dest}" ]; then
                    echo "CRITICAL ERROR: Restored destination ${dest} failed verification! (expected sha: ${exp_s}, got: ${r_sha})" >&2
                    handler_failed=1
                    FAILED_CLEANUP_PATHS+=("${dest} (restoration verification failed)")
                else
                    echo "Successfully restored original destination in reverse order: ${dest##*/} (bytes: ${r_bytes}, sha: ${r_sha}, owner: ${r_owner}, mode: 0${r_mode})" >&2
                fi
            else
                # Destination was never pre-armed / replaced; remove unused backup if present
                if [ -n "${bak}" ] && { [ -e "${bak}" ] || [ -L "${bak}" ]; }; then
                    rm -f "${bak}"
                    if [ -e "${bak}" ] || [ -L "${bak}" ]; then
                        echo "CRITICAL ERROR: Failed to remove unneeded backup file: ${bak}!" >&2
                        handler_failed=1
                        FAILED_CLEANUP_PATHS+=("${bak}")
                    else
                        echo "Removed unneeded backup: ${bak##*/}" >&2
                    fi
                fi
            fi
        done

        # 2. Delete newly created destinations
        for f in "${CREATED_BY_WRAPPER[@]}"; do
            if [ -e "${f}" ] || [ -L "${f}" ]; then
                rm -f "${f}"
                if [ -e "${f}" ] || [ -L "${f}" ]; then
                    echo "CRITICAL ERROR: Rollback deletion failed for newly created destination: ${f}!" >&2
                    handler_failed=1
                    FAILED_CLEANUP_PATHS+=("${f}")
                else
                    echo "Rolled back newly created destination: ${f}" >&2
                fi
            fi
        done

        # 3. Clean any tracked backup files that might still exist and verify absence
        for b in "${TRACKED_BACKUP_FILES[@]}"; do
            if [ -e "${b}" ] || [ -L "${b}" ]; then
                rm -f "${b}"
                if [ -e "${b}" ] || [ -L "${b}" ]; then
                    echo "CRITICAL ERROR: Failed to remove tracked backup file during rollback: ${b}!" >&2
                    handler_failed=1
                    FAILED_CLEANUP_PATHS+=("${b}")
                fi
            fi
        done

        # 4. Clean all positively identified temporary files and verify absence
        for tmp in "${TRACKED_TEMP_FILES[@]}"; do
            if [ -e "${tmp}" ] || [ -L "${tmp}" ]; then
                rm -f "${tmp}"
                if [ -e "${tmp}" ] || [ -L "${tmp}" ]; then
                    echo "CRITICAL ERROR: Failed to remove temporary staging file during rollback: ${tmp}!" >&2
                    handler_failed=1
                    FAILED_CLEANUP_PATHS+=("${tmp}")
                else
                    echo "Cleaned temporary staging file and verified absence: ${tmp##*/}" >&2
                fi
            fi
        done

    elif [ "${PUBLICATION_STATE}" = "COMMITTED" ]; then
        echo ">>> Transaction COMMITTED: Preserving published destinations intact; cleaning auxiliary files only..." >&2

        # In COMMITTED state, NEVER touch published destinations! Clean remaining backups and staging files only.
        for bak in "${TRACKED_BACKUP_FILES[@]}"; do
            if [ -e "${bak}" ] || [ -L "${bak}" ]; then
                rm -f "${bak}"
                if [ -e "${bak}" ] || [ -L "${bak}" ]; then
                    echo "CRITICAL ERROR: Post-commit cleanup failed to remove backup: ${bak}!" >&2
                    handler_failed=1
                    FAILED_CLEANUP_PATHS+=("${bak}")
                else
                    echo "Cleaned auxiliary backup: ${bak##*/}" >&2
                fi
            fi
        done

        for tmp in "${TRACKED_TEMP_FILES[@]}"; do
            if [ -e "${tmp}" ] || [ -L "${tmp}" ]; then
                rm -f "${tmp}"
                if [ -e "${tmp}" ] || [ -L "${tmp}" ]; then
                    echo "CRITICAL ERROR: Post-commit cleanup failed to remove temporary file: ${tmp}!" >&2
                    handler_failed=1
                    FAILED_CLEANUP_PATHS+=("${tmp}")
                else
                    echo "Cleaned auxiliary temporary file: ${tmp##*/}" >&2
                fi
            fi
        done
    else
        echo "CRITICAL ERROR: Unrecognized PUBLICATION_STATE '${PUBLICATION_STATE}'!" >&2
        handler_failed=1
    fi

    if [ "${handler_failed}" -ne 0 ]; then
        echo "CRITICAL ERROR: Containment residue detected during cleanup! Failed paths:" >&2
        for p in "${FAILED_CLEANUP_PATHS[@]}"; do
            echo "  - ${p}" >&2
        done
        return 1
    fi
    return 0
}

on_exit() {
    local exit_code=$?
    trap - EXIT HUP INT QUIT TERM
    echo ""
    echo ">>> Executing wrapper exit handler (exit code: ${exit_code}, publication state: ${PUBLICATION_STATE})..."
    rollback_or_cleanup || exit_code=1
    cleanup_stage_dir || exit_code=1
    cleanup_exec_out || exit_code=1
    exit "${exit_code}"
}

on_signal() {
    local sig="$1"
    local sig_exit="$2"
    trap - EXIT HUP INT QUIT TERM
    echo "CRITICAL: Caught signal ${sig}! Cleaning up (publication state: ${PUBLICATION_STATE}) and exiting with code ${sig_exit}..." >&2
    local clean_failed=0
    rollback_or_cleanup || clean_failed=1
    cleanup_stage_dir || clean_failed=1
    cleanup_exec_out || clean_failed=1
    if [ "${clean_failed}" -ne 0 ]; then
        echo "CRITICAL ERROR: Containment failure during signal cleanup!" >&2
        exit 1
    fi
    exit "${sig_exit}"
}

trap on_exit EXIT
trap 'on_signal HUP 129' HUP
trap 'on_signal INT 130' INT
trap 'on_signal QUIT 131' QUIT
trap 'on_signal TERM 143' TERM

# Create isolated staging directory with strict permissions
STAGE_DIR="$(mktemp -d /tmp/sp8c7a_stage.XXXXXX)"
chmod 0700 "${STAGE_DIR}"
chown 1001:1001 "${STAGE_DIR}"
echo "Isolated staging directory created: ${STAGE_DIR}"

# Create execution output file with strict permissions
EXEC_OUT_FILE="$(mktemp /tmp/sp8c7a_exec_out.XXXXXX)"
chmod 0600 "${EXEC_OUT_FILE}"
chown 1001:1001 "${EXEC_OUT_FILE}"
echo "Execution output file created: ${EXEC_OUT_FILE}"

echo ""
echo "========================================================================"
echo ">>> [2/6] Staging Gate SP-8C-7A Revision R22 Approved Artifacts"
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

verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh" 61362 "ddb462530c7b318c47f7de3d585ebdcf06b3218a7177019bfa5990b6466168d9"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight.sh.sha256" 86 "28d63058f330d8c6ac5e57a9d0718f5f3bbdcec1ad5b68d9d22bc9b3ecf3c6b3"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_preflight_runbook.md" 13057 "1279ca3453dad5b9179c3836ff9f55dcc34a0305141594a96e73907e7f0944af"
verify_staged_artifact "${STAGE_DIR}/sp8c7a_manifest.json" 5815 "bf76fbb031e176e4e8cfeb317829eb286ecd936588230a7fe736c3b9fa0adbbe"

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
assert rev == "R22", f"revision expected R22, got {rev}"

assert "members" in data, "members array key missing from manifest"
members = data["members"]
assert isinstance(members, list), "members must be an array"
assert len(members) == 3, f"Expected exactly three listed payload members, got {len(members)}"

expected_workload_members = {
    "sp8c7a_preflight.sh": {
        "bytes": 61362,
        "lines": 1460,
        "sha256": "ddb462530c7b318c47f7de3d585ebdcf06b3218a7177019bfa5990b6466168d9",
        "role": "unified_self_contained_strictly_read_only_host_preflight_script"
    },
    "sp8c7a_preflight.sh.sha256": {
        "bytes": 86,
        "lines": 1,
        "sha256": "28d63058f330d8c6ac5e57a9d0718f5f3bbdcec1ad5b68d9d22bc9b3ecf3c6b3",
        "role": "corroborating_script_checksum_sidecar"
    },
    "sp8c7a_preflight_runbook.md": {
        "bytes": 13057,
        "lines": 125,
        "sha256": "1279ca3453dad5b9179c3836ff9f55dcc34a0305141594a96e73907e7f0944af",
        "role": "operational_preflight_runbook_and_invariants_revision_r22"
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
echo "Staged manifest verified: schema 1.0, gate SP-8C-7A, revision R22, exactly 3 payload members with exact field values."

echo ""
echo "========================================================================"
echo ">>> [4/6] Destination Inspection, Verified Backup & Atomic Same-Filesystem Rename"
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
            echo "Destination ${fname} already exists and matches approved artifact exactly (preserving without replacement)."
            return 0
        fi

        echo "Destination ${fname} exists with differing contents; preparing verified backup before replacement..."
        DEST_ORIG_BYTES["${dest_file}"]="${act_bytes}"
        DEST_ORIG_SHA["${dest_file}"]="${act_sha256}"
        DEST_ORIG_OWNER["${dest_file}"]="${act_owner}"
        DEST_ORIG_MODE["${dest_file}"]="${act_mode}"

        local backup_file="${dest_file}.bak.${$}_$(date +%s%N)"

        # Immediate path registration prior to creation
        TRACKED_BACKUP_FILES+=("${backup_file}")
        DEST_BACKUP_MAP["${dest_file}"]="${backup_file}"
        REPLACED_DESTINATIONS+=("${dest_file}")
        DEST_PUBLISHED["${dest_file}"]=0

        cp -p "${dest_file}" "${backup_file}"
        chmod 0600 "${backup_file}"
        chown 1001:1001 "${backup_file}"

        local bak_bytes bak_sha256 bak_owner bak_mode
        bak_bytes="$(stat -c '%s' "${backup_file}")"
        bak_sha256="$(sha256sum "${backup_file}" | awk '{print $1}')"
        bak_owner="$(stat -c '%u:%g' "${backup_file}")"
        bak_mode="$(stat -c '%a' "${backup_file}")"

        if [ "${bak_bytes}" -ne "${act_bytes}" ] || \
           [ "${bak_sha256}" != "${act_sha256}" ] || \
           [ "${bak_owner}" != "1001:1001" ] || \
           [ "${bak_mode}" != "600" ] || \
           [ -L "${backup_file}" ]; then
            echo "CRITICAL ERROR: Failed to verify pre-replacement backup ${backup_file}!" >&2
            rm -f "${backup_file}"
            exit 1
        fi

        echo "Created verified pre-replacement backup: ${backup_file##*/} (bytes: ${bak_bytes}, sha256: ${bak_sha256})"
    else
        CREATED_BY_WRAPPER+=("${dest_file}")
        DEST_PUBLISHED["${dest_file}"]=0
    fi

    # Create replacement temporary file inside /opt/socialpulse/scripts/ (same filesystem)
    local tmp_dest
    tmp_dest="$(mktemp "${DEST_DIR}/.tmp_${fname}.XXXXXX")"

    # Immediate path registration upon creation
    TRACKED_TEMP_FILES+=("${tmp_dest}")

    chmod "0${exp_mode}" "${tmp_dest}"
    chown 1001:1001 "${tmp_dest}"
    cp "${src_file}" "${tmp_dest}"

    local tmp_bytes tmp_sha256 tmp_owner tmp_mode
    tmp_bytes="$(stat -c '%s' "${tmp_dest}")"
    tmp_sha256="$(sha256sum "${tmp_dest}" | awk '{print $1}')"
    tmp_owner="$(stat -c '%u:%g' "${tmp_dest}")"
    tmp_mode="$(stat -c '%a' "${tmp_dest}")"

    if [ "${tmp_bytes}" -ne "${exp_bytes}" ] || \
       [ "${tmp_sha256}" != "${exp_sha256}" ] || \
       [ "${tmp_owner}" != "1001:1001" ] || \
       [ "${tmp_mode}" != "${exp_mode}" ] || \
       [ -L "${tmp_dest}" ]; then
        echo "CRITICAL ERROR: Replacement temporary file ${tmp_dest} failed pre-rename verification!" >&2
        rm -f "${tmp_dest}"
        exit 1
    fi

    # Pre-arm publication state prior to atomic rename to eliminate post-rename race condition
    DEST_PUBLISHED["${dest_file}"]=1

    if ! mv -f "${tmp_dest}" "${dest_file}"; then
        echo "CRITICAL ERROR: Atomic rename failed for ${dest_file}!" >&2
        exit 1
    fi
    echo "Atomically published ${fname} (owner 1001:1001, mode 0${exp_mode}, bytes ${exp_bytes})"
}

check_and_install_artifact "sp8c7a_preflight.sh" 61362 "ddb462530c7b318c47f7de3d585ebdcf06b3218a7177019bfa5990b6466168d9" "700"
check_and_install_artifact "sp8c7a_preflight.sh.sha256" 86 "28d63058f330d8c6ac5e57a9d0718f5f3bbdcec1ad5b68d9d22bc9b3ecf3c6b3" "600"
check_and_install_artifact "sp8c7a_preflight_runbook.md" 13057 "1279ca3453dad5b9179c3836ff9f55dcc34a0305141594a96e73907e7f0944af" "600"
check_and_install_artifact "sp8c7a_manifest.json" 5815 "bf76fbb031e176e4e8cfeb317829eb286ecd936588230a7fe736c3b9fa0adbbe" "600"

echo ""
echo "========================================================================"
echo ">>> [5/6] Post-Publication Reverification, Commit Boundary & Auxiliary Cleanup"
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

commit_and_cleanup_publication() {
    echo ">>> Reverifying all 4 published destinations before commit..."

    reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh" 61362 "ddb462530c7b318c47f7de3d585ebdcf06b3218a7177019bfa5990b6466168d9" "1001:1001" "700"
    reverify_destination_file "${DEST_DIR}/sp8c7a_preflight.sh.sha256" 86 "28d63058f330d8c6ac5e57a9d0718f5f3bbdcec1ad5b68d9d22bc9b3ecf3c6b3" "1001:1001" "600"
    reverify_destination_file "${DEST_DIR}/sp8c7a_preflight_runbook.md" 13057 "1279ca3453dad5b9179c3836ff9f55dcc34a0305141594a96e73907e7f0944af" "1001:1001" "600"
    reverify_destination_file "${DEST_DIR}/sp8c7a_manifest.json" 5815 "bf76fbb031e176e4e8cfeb317829eb286ecd936588230a7fe736c3b9fa0adbbe" "1001:1001" "600"

    # All destinations verified bit-for-bit against trust anchors: COMMIT TRANSACTION
    PUBLICATION_STATE="COMMITTED"
    echo ">>> All 4 destination files verified against trust anchors."
    echo ">>> PUBLICATION TRANSACTION COMMITTED SUCCESSFULLY."

    # Post-commit auxiliary cleanup of replacement backups and temporary staging files
    echo ">>> Removing replacement backups & auxiliary temporary files..."

    local cleanup_error=0
    for bak in "${TRACKED_BACKUP_FILES[@]}"; do
        if [ -e "${bak}" ] || [ -L "${bak}" ]; then
            rm -f "${bak}"
            if [ -e "${bak}" ] || [ -L "${bak}" ]; then
                echo "CRITICAL ERROR: Failed to remove replacement backup: ${bak}!" >&2
                cleanup_error=1
                FAILED_CLEANUP_PATHS+=("${bak}")
            else
                echo "Cleaned up replacement backup and verified absence: ${bak##*/}"
            fi
        fi
    done

    for tmp in "${TRACKED_TEMP_FILES[@]}"; do
        if [ -e "${tmp}" ] || [ -L "${tmp}" ]; then
            rm -f "${tmp}"
            if [ -e "${tmp}" ] || [ -L "${tmp}" ]; then
                echo "CRITICAL ERROR: Failed to remove temporary staging file: ${tmp}!" >&2
                cleanup_error=1
                FAILED_CLEANUP_PATHS+=("${tmp}")
            else
                echo "Cleaned up temporary staging file and verified absence: ${tmp##*/}"
            fi
        fi
    done

    if [ "${cleanup_error}" -ne 0 ]; then
        echo "CRITICAL ERROR: Post-commit cleanup failed! Containment residue remains:" >&2
        for p in "${FAILED_CLEANUP_PATHS[@]}"; do
            echo "  - ${p}" >&2
        done
        exit 1
    fi
    echo ">>> Post-commit auxiliary cleanup completed with verified absence of all backup and staging files."
}

# Execute the publication commit and auxiliary cleanup
commit_and_cleanup_publication

echo ""
echo "========================================================================"
echo ">>> [6/6] Invoking Approved SP-8C-7A Preflight with External Trust Anchor"
echo "========================================================================"

set +e
EXPECTED_SP8C7A_SHA256="ddb462530c7b318c47f7de3d585ebdcf06b3218a7177019bfa5990b6466168d9" \
EXPECTED_SP8C7A_BYTES="61362" \
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

LOG_COUNT="$(echo "${LOG_DECL_LINES}" | wc -l)"
if [ "${LOG_COUNT}" -ne 1 ]; then
    echo "CRITICAL ERROR: Expected exactly one canonical-log declaration, found ${LOG_COUNT}!" >&2
    exit 1
fi

# Parse canonical log path
LOG_PATH="$(echo "${LOG_DECL_LINES}" | sed -E 's/^>>> Canonical Log: //')"

if [ -z "${LOG_PATH}" ]; then
    echo "CRITICAL ERROR: Parsed canonical log path is empty!" >&2
    exit 1
fi

# Log path prefix validation
case "${LOG_PATH}" in
    /root/sp8c7a_preflight_*.log) ;;
    *)
        echo "CRITICAL ERROR: Log path ${LOG_PATH} violates prefix /root/sp8c7a_preflight_*.log!" >&2
        exit 1
        ;;
esac

# Canonical path check (readlink -f) with explicit status capture
set +e
CANONICAL_LOG_PATH="$(readlink -f "${LOG_PATH}")"
READLINK_LOG_STATUS=$?
set -e

if [ "${READLINK_LOG_STATUS}" -ne 0 ]; then
    echo "CRITICAL ERROR: readlink failed on ${LOG_PATH} (status: ${READLINK_LOG_STATUS})!" >&2
    exit 1
fi

if [ "${CANONICAL_LOG_PATH}" != "${LOG_PATH}" ]; then
    echo "CRITICAL ERROR: Log path is not canonical! Specified: ${LOG_PATH}, Resolved: ${CANONICAL_LOG_PATH}" >&2
    exit 1
fi

# Require regular file and non-symlink
if [ ! -f "${LOG_PATH}" ]; then
    echo "CRITICAL ERROR: Canonical log file does not exist or is not a regular file: ${LOG_PATH}" >&2
    exit 1
fi

if [ -L "${LOG_PATH}" ]; then
    echo "CRITICAL ERROR: Canonical log file is a symlink: ${LOG_PATH}" >&2
    exit 1
fi

# Compute audit attributes
LOG_BYTES="$(stat -c '%s' "${LOG_PATH}")"
LOG_OWNER="$(stat -c '%u:%g' "${LOG_PATH}")"
LOG_MODE="$(stat -c '%a' "${LOG_PATH}")"
LOG_SHA256="$(sha256sum "${LOG_PATH}" | awk '{print $1}')"

# Strict log attribute assertions
if [ "${LOG_BYTES}" -le 0 ]; then
    echo "CRITICAL ERROR: Canonical log file is empty (${LOG_BYTES} bytes)!" >&2
    exit 1
fi

if [ "${LOG_OWNER}" != "0:0" ]; then
    echo "CRITICAL ERROR: Canonical log ownership mismatch! Expected 0:0, got ${LOG_OWNER}" >&2
    exit 1
fi

if [ "${LOG_MODE}" != "600" ]; then
    echo "CRITICAL ERROR: Canonical log mode mismatch! Expected 600, got ${LOG_MODE}" >&2
    exit 1
fi

# Extract and audit synthesized preflight outcome from execution output
set +e
SYNTHESIS_LINES="$(grep "^>>> Preflight Audit Outcome:" "${EXEC_OUT_FILE}")"
GREP_SYNTH_STATUS=$?
set -e

if [ "${GREP_SYNTH_STATUS}" -ne 0 ] || [ -z "${SYNTHESIS_LINES}" ]; then
    echo "CRITICAL ERROR: Failed to find preflight outcome synthesis in execution output (grep exit: ${GREP_SYNTH_STATUS})!" >&2
    exit 1
fi

FINAL_OUTCOME="$(echo "${SYNTHESIS_LINES}" | sed -E 's/^>>> Preflight Audit Outcome: //')"

# Correlation assertion between preflight exit status and declared outcome
if [ "${PREFLIGHT_STATUS}" -eq 0 ]; then
    if [ "${FINAL_OUTCOME}" != "PREFLIGHT_SUCCESS_ZERO_FINDINGS" ]; then
        echo "CRITICAL ERROR: Preflight exited 0 but outcome declared: '${FINAL_OUTCOME}' (expected PREFLIGHT_SUCCESS_ZERO_FINDINGS)!" >&2
        exit 1
    fi
elif [ "${PREFLIGHT_STATUS}" -eq 2 ]; then
    if [ "${FINAL_OUTCOME}" != "PREFLIGHT_COMPLETE_WITH_FINDINGS" ]; then
        echo "CRITICAL ERROR: Preflight exited 2 but outcome declared: '${FINAL_OUTCOME}' (expected PREFLIGHT_COMPLETE_WITH_FINDINGS)!" >&2
        exit 1
    fi
fi

echo ""
echo "========================================================================"
echo ">>> HIGIENE (PTY) LTD — GATE SP-8C-7A PREFLIGHT WRAPPER SUMMARY"
echo "========================================================================"
echo "Preflight Script Exit Status : ${PREFLIGHT_STATUS}"
echo "Outer Tee Exit Status        : ${TEE_STATUS}"
echo "Synthesized Outcome          : ${FINAL_OUTCOME}"
echo "Canonical Log Path           : ${LOG_PATH}"
echo "Canonical Log Bytes          : ${LOG_BYTES}"
echo "Canonical Log Owner          : ${LOG_OWNER}"
echo "Canonical Log Mode           : 0${LOG_MODE}"
echo "Canonical Log SHA-256        : ${LOG_SHA256}"
echo "Publication State            : ${PUBLICATION_STATE} (Auxiliary cleanup completed)"
echo "Standstill Invariants        : ZERO SNAPSHOTS, ZERO MIGRATIONS, ZERO MUTATIONS"
echo "========================================================================"

# Propagate exit status: 0 for clean pass, 2 for findings documented
exit "${PREFLIGHT_STATUS}"
