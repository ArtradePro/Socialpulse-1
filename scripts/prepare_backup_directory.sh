#!/usr/bin/env bash
# ==============================================================================
# Script: prepare_backup_directory.sh
# Entity: Higiene (Pty) Ltd
# Project: Evergreen / SocialPulse
# Purpose: Narrowly scoped host preparation script to create and govern
#          the host backup directory /opt/socialpulse/backups with exact
#          invariants: owner 1001:1001, mode 0700, non-symlink, zero ACLs.
# Safety: Strictly non-destructive. Fail-closed collision rejection.
#         Mandatory getfacl/setfacl preflight. Zero failure-masking operators.
#         Signal-specific exit traps (130 for INT, 143 for TERM).
#         Rollback failure forces exit 1.
# ==============================================================================

set -euo pipefail

readonly SCRIPT_NAME="prepare_backup_directory.sh"
readonly TARGET_DIR="/opt/socialpulse/backups"
readonly PARENT_DIR="/opt/socialpulse"
readonly REQUIRED_UID=1001
readonly REQUIRED_GID=1001
readonly REQUIRED_PERMS="700"
readonly MIN_FREE_KB=102400  # 100 MB in KB

# Transaction state flags
CREATED_BY_SCRIPT=0
SUCCESS_COMMITTED=0

log_info() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [INFO] [${SCRIPT_NAME}] $*"
}

log_warn() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [WARN] [${SCRIPT_NAME}] $*" >&2
}

log_fail() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [FAIL] [${SCRIPT_NAME}] $*" >&2
}

# ------------------------------------------------------------------------------
# Signal-Specific Trap Handlers & Rollback
# ------------------------------------------------------------------------------
execute_rollback() {
    if [[ "${CREATED_BY_SCRIPT}" -eq 1 && "${SUCCESS_COMMITTED}" -ne 1 ]]; then
        log_warn "Execution interrupted or failed before commit. Executing safe rollback..."
        if [[ -d "${TARGET_DIR}" && ! -L "${TARGET_DIR}" ]]; then
            if rmdir "${TARGET_DIR}"; then
                log_info "Rollback: successfully removed empty directory ${TARGET_DIR}"
            else
                log_fail "CRITICAL: Rollback failed to remove empty directory ${TARGET_DIR}."
                return 1
            fi
        fi
    elif [[ "${CREATED_BY_SCRIPT}" -eq 0 ]]; then
        log_info "Directory was pre-existing; rollback will not touch pre-existing state."
    fi
    return 0
}

handle_signal() {
    local sig_code="$1"
    local sig_name="$2"
    log_warn "Caught signal ${sig_name} (${sig_code}). Triggering rollback..."
    if ! execute_rollback; then
        log_fail "Rollback failure overrides signal ${sig_name}; forcing exit 1."
        exit 1
    fi
    exit "${sig_code}"
}

handle_exit() {
    local exit_code=$?
    if [[ "${exit_code}" -ne 0 ]]; then
        if ! execute_rollback; then
            log_fail "Rollback failure on exit; forcing exit 1."
            exit 1
        fi
    fi
    exit "${exit_code}"
}

trap 'handle_signal 130 SIGINT' INT
trap 'handle_signal 143 SIGTERM' TERM
trap handle_exit EXIT

# ------------------------------------------------------------------------------
# Preflight Validations
# ------------------------------------------------------------------------------
assert_root() {
    if [[ "$(id -u)" -ne 0 ]]; then
        log_fail "Must be run as root (EUID 0). Current UID: $(id -u)"
        exit 1
    fi
}

assert_mandatory_tools() {
    local missing_tools=0
    for tool in getfacl setfacl readlink stat df rmdir mkdir chown chmod awk; do
        if ! command -v "${tool}" >/dev/null 2>&1; then
            log_fail "Mandatory tool missing from PATH: ${tool}"
            missing_tools=$((missing_tools + 1))
        fi
    done
    if [[ "${missing_tools}" -gt 0 ]]; then
        log_fail "Tool preflight failed: ${missing_tools} required tool(s) missing."
        exit 1
    fi
    log_info "Tool preflight passed: all mandatory tools present."
}

assert_parent_directory() {
    if [[ ! -d "${PARENT_DIR}" ]]; then
        log_fail "Parent directory ${PARENT_DIR} does not exist or is not a directory."
        exit 1
    fi

    if [[ -L "${PARENT_DIR}" ]]; then
        log_fail "Parent directory ${PARENT_DIR} is a symlink. Symlinks are prohibited."
        exit 1
    fi
}

check_disk_space() {
    local check_path="$1"
    local available_kb
    available_kb=$(df -k -P "${check_path}" | awk 'NR==2 {print $4}')
    if [[ -z "${available_kb}" || "${available_kb}" -lt "${MIN_FREE_KB}" ]]; then
        log_fail "Insufficient disk space on ${check_path}: available ${available_kb:-0} KB, minimum required ${MIN_FREE_KB} KB."
        exit 1
    fi
    log_info "Disk space verified: ${available_kb} KB available (>= ${MIN_FREE_KB} KB required)"
}

verify_canonical_path() {
    local check_path="$1"
    local canonical_path
    canonical_path=$(readlink -f "${check_path}")
    if [[ "${canonical_path}" != "${TARGET_DIR}" ]]; then
        log_fail "Path canonicalization check failed: expected '${TARGET_DIR}', resolved '${canonical_path}'"
        exit 1
    fi
}

assert_zero_acls() {
    local check_path="$1"
    local acl_raw
    acl_raw=$(getfacl -p "${check_path}")

    # Use awk parser without failure masking; returns 0 if strictly basic POSIX, 1 if extended ACLs found
    local extended_acls
    extended_acls=$(echo "${acl_raw}" | awk '
        /^#/ { next }
        /^user::/ { next }
        /^group::/ { next }
        /^other::/ { next }
        /^[a-z]+:/ { print; has_ext=1 }
        END { exit (has_ext ? 1 : 0) }
    ')
    local awk_status=$?

    if [[ "${awk_status}" -ne 0 || -n "${extended_acls}" ]]; then
        log_fail "Extended ACLs detected on ${check_path}:"
        echo "${extended_acls}" >&2
        return 1
    fi
    log_info "Zero extended or default ACLs verified on ${check_path}."
    return 0
}

# ------------------------------------------------------------------------------
# Main Execution
# ------------------------------------------------------------------------------
main() {
    log_info "Starting host backup directory preparation for Higiene (Pty) Ltd..."
    assert_root
    assert_mandatory_tools
    assert_parent_directory

    if [[ -e "${TARGET_DIR}" || -L "${TARGET_DIR}" ]]; then
        log_info "Target ${TARGET_DIR} already exists. Enforcing strict fail-closed collision rejection..."

        # 1. Reject symlinks
        if [[ -L "${TARGET_DIR}" ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} exists as a symlink. Symlinks are prohibited."
            exit 1
        fi

        # 2. Reject non-directories
        if [[ ! -d "${TARGET_DIR}" ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} exists but is not a directory."
            exit 1
        fi

        # 3. Verify canonical path
        verify_canonical_path "${TARGET_DIR}"

        # 4. Reject non-empty directories
        local existing_entries
        existing_entries=$(ls -A "${TARGET_DIR}")
        if [[ -n "${existing_entries}" ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} exists and is not empty. Cannot use pre-existing non-empty directory."
            exit 1
        fi

        # 5. Passive invariant validation (zero mutation of pre-existing state)
        local current_owner
        current_owner=$(stat -c "%u:%g" "${TARGET_DIR}")
        if [[ "${current_owner}" != "${REQUIRED_UID}:${REQUIRED_GID}" ]]; then
            log_fail "Collision rejection: pre-existing directory owner is ${current_owner} (expected strictly ${REQUIRED_UID}:${REQUIRED_GID}). Non-destructive policy prohibits altering owner."
            exit 1
        fi

        local current_perms
        current_perms=$(stat -c "%a" "${TARGET_DIR}")
        if [[ "${current_perms}" != "${REQUIRED_PERMS}" ]]; then
            log_fail "Collision rejection: pre-existing directory mode is ${current_perms} (expected strictly ${REQUIRED_PERMS}). Non-destructive policy prohibits altering mode."
            exit 1
        fi

        if ! assert_zero_acls "${TARGET_DIR}"; then
            log_fail "Collision rejection: pre-existing directory contains extended ACLs. Non-destructive policy prohibits modifying ACLs."
            exit 1
        fi

        check_disk_space "${TARGET_DIR}"

        CREATED_BY_SCRIPT=0
        log_info "Pre-existing directory ${TARGET_DIR} strictly satisfies all governance invariants without mutation."
    else
        log_info "Target directory ${TARGET_DIR} does not exist. Checking free space on parent directory..."
        check_disk_space "${PARENT_DIR}"

        log_info "Creating ${TARGET_DIR} with mode 0700..."
        CREATED_BY_SCRIPT=1
        mkdir -m 0700 "${TARGET_DIR}"

        log_info "Configuring ownership 1001:1001 on newly created ${TARGET_DIR}..."
        chown "${REQUIRED_UID}:${REQUIRED_GID}" "${TARGET_DIR}"
        chmod "${REQUIRED_PERMS}" "${TARGET_DIR}"

        # Post-creation verification
        log_info "Verifying newly created directory invariants..."
        if [[ -L "${TARGET_DIR}" || ! -d "${TARGET_DIR}" ]]; then
            log_fail "Post-creation failure: ${TARGET_DIR} is invalid."
            exit 1
        fi
        verify_canonical_path "${TARGET_DIR}"

        local new_owner
        new_owner=$(stat -c "%u:%g" "${TARGET_DIR}")
        if [[ "${new_owner}" != "${REQUIRED_UID}:${REQUIRED_GID}" ]]; then
            log_fail "Post-creation failure: owner is ${new_owner}, expected ${REQUIRED_UID}:${REQUIRED_GID}"
            exit 1
        fi

        local new_perms
        new_perms=$(stat -c "%a" "${TARGET_DIR}")
        if [[ "${new_perms}" != "${REQUIRED_PERMS}" ]]; then
            log_fail "Post-creation failure: mode is ${new_perms}, expected ${REQUIRED_PERMS}"
            exit 1
        fi

        if ! assert_zero_acls "${TARGET_DIR}"; then
            log_info "Stripping inherited default ACLs on newly created directory with setfacl -b -k..."
            setfacl -b -k "${TARGET_DIR}"
            if ! assert_zero_acls "${TARGET_DIR}"; then
                log_fail "Post-creation failure: could not clear extended ACLs on ${TARGET_DIR}."
                exit 1
            fi
        fi

        check_disk_space "${TARGET_DIR}"
    fi

    # Commit transaction
    SUCCESS_COMMITTED=1
    log_info "Host backup directory preparation COMMITTED successfully."
    log_info "Directory: ${TARGET_DIR}"
    log_info "Canonical Path: $(readlink -f "${TARGET_DIR}")"
    log_info "Owner: $(stat -c '%u:%g' "${TARGET_DIR}") (${REQUIRED_UID}:${REQUIRED_GID})"
    log_info "Permissions: $(stat -c '%a' "${TARGET_DIR}")"
    log_info "Created By This Script: ${CREATED_BY_SCRIPT}"
    log_info "Status: READY_FOR_PREFLIGHT_SNAPSHOTS"
}

main "$@"
