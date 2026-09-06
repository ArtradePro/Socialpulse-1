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
#         Signal-specific exit traps (129:HUP, 130:INT, 131:QUIT, 143:TERM).
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
RECEIVED_SIGNAL=0

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
# Signal-Specific Trap Handlers & Rollback (R5)
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
    RECEIVED_SIGNAL="${sig_code}"
    log_warn "Caught signal ${sig_name} (${sig_code}). Triggering rollback..."
    if ! execute_rollback; then
        log_fail "Rollback failure overrides signal ${sig_name}; forcing exit 1."
        exit 1
    fi
    exit "${sig_code}"
}

handle_exit() {
    local exit_code=$?
    if [[ "${RECEIVED_SIGNAL}" -ne 0 ]]; then
        exit_code="${RECEIVED_SIGNAL}"
    fi
    if [[ "${exit_code}" -ne 0 ]]; then
        if ! execute_rollback; then
            log_fail "Rollback failure on exit; forcing exit 1."
            exit 1
        fi
    fi
    exit "${exit_code}"
}

trap 'handle_signal 129 SIGHUP' HUP
trap 'handle_signal 130 SIGINT' INT
trap 'handle_signal 131 SIGQUIT' QUIT
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

assert_non_symlink_path() {
    local check_path="$1"
    if [[ -L "${check_path}" ]]; then
        log_fail "Symlink detected: ${check_path} must not be a symbolic link."
        exit 1
    fi

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

    if [[ ${awk_status} -ne 0 || -n "${extended_acls}" ]]; then
        log_fail "Extended ACLs detected on ${check_path}:"
        echo "${extended_acls}" >&2
        return 1
    fi
    return 0
}

assert_sufficient_space() {
    local parent_dir="$1"
    local available_kb
    available_kb=$(df -k -P "${parent_dir}" | awk 'NR==2 {print $4}')
    if [[ -z "${available_kb}" || "${available_kb}" -lt "${MIN_FREE_KB}" ]]; then
        log_fail "Insufficient free space on ${parent_dir}: ${available_kb:-0} KB available (required: ${MIN_FREE_KB} KB)."
        exit 1
    fi
    log_info "Free space check passed: ${available_kb} KB available on ${parent_dir}."
}

# ------------------------------------------------------------------------------
# Main Logic
# ------------------------------------------------------------------------------
main() {
    log_info "======================================================================"
    log_info "Higiene (Pty) Ltd - Host Backup Directory Preparation"
    log_info "======================================================================"

    assert_root
    assert_mandatory_tools

    # Validate parent directory
    if [[ ! -d "${PARENT_DIR}" ]]; then
        log_fail "Parent directory does not exist: ${PARENT_DIR}"
        exit 1
    fi
    if [[ -L "${PARENT_DIR}" ]]; then
        log_fail "Parent directory is a symbolic link: ${PARENT_DIR}"
        exit 1
    fi

    # Check if TARGET_DIR already exists
    if [[ -e "${TARGET_DIR}" || -L "${TARGET_DIR}" ]]; then
        log_info "Target path ${TARGET_DIR} already exists. Validating pre-existing invariants..."

        # 1. Non-symlink check
        assert_non_symlink_path "${TARGET_DIR}"

        # 2. Must be a directory
        if [[ ! -d "${TARGET_DIR}" ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} exists but is not a directory."
            exit 1
        fi

        # 3. Must be empty
        local file_count
        file_count=$(find "${TARGET_DIR}" -mindepth 1 | wc -l)
        if [[ "${file_count}" -ne 0 ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} exists but is not empty (${file_count} items found)."
            exit 1
        fi

        # 4. Invariant: Ownership must be 1001:1001
        local actual_owner
        actual_owner=$(stat -c '%u:%g' "${TARGET_DIR}")
        if [[ "${actual_owner}" != "${REQUIRED_UID}:${REQUIRED_GID}" ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} ownership is ${actual_owner} (expected ${REQUIRED_UID}:${REQUIRED_GID}). Refusing to mutate."
            exit 1
        fi

        # 5. Invariant: Mode must be 0700
        local actual_perms
        actual_perms=$(stat -c '%a' "${TARGET_DIR}")
        if [[ "${actual_perms}" != "${REQUIRED_PERMS}" ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} permissions are ${actual_perms} (expected ${REQUIRED_PERMS}). Refusing to mutate."
            exit 1
        fi

        # 6. Invariant: Zero named or default ACLs
        if ! assert_zero_acls "${TARGET_DIR}"; then
            log_fail "Collision rejection: ${TARGET_DIR} has extended ACLs. Refusing to mutate."
            exit 1
        fi

        # 7. Check free disk space
        assert_sufficient_space "${TARGET_DIR}"

        log_info "Pre-existing directory ${TARGET_DIR} strictly matches all invariants without mutation."
        SUCCESS_COMMITTED=1
        exit 0
    fi

    # Target directory does not exist: Proceed with creation
    log_info "Target directory ${TARGET_DIR} does not exist. Creating..."
    assert_sufficient_space "${PARENT_DIR}"

    # Create directory
    mkdir "${TARGET_DIR}"
    CREATED_BY_SCRIPT=1
    log_info "Created directory: ${TARGET_DIR}"

    # Set ownership strictly to 1001:1001
    chown "${REQUIRED_UID}:${REQUIRED_GID}" "${TARGET_DIR}"
    log_info "Set ownership ${REQUIRED_UID}:${REQUIRED_GID} on ${TARGET_DIR}"

    # Set permissions strictly to 0700
    chmod "${REQUIRED_PERMS}" "${TARGET_DIR}"
    log_info "Set mode ${REQUIRED_PERMS} on ${TARGET_DIR}"

    # Strip any inherited or default ACLs
    setfacl -b "${TARGET_DIR}"
    log_info "Stripped base/extended ACLs via setfacl -b on ${TARGET_DIR}"

    # Post-creation verification
    assert_non_symlink_path "${TARGET_DIR}"

    local final_owner final_perms
    final_owner=$(stat -c '%u:%g' "${TARGET_DIR}")
    final_perms=$(stat -c '%a' "${TARGET_DIR}")

    if [[ "${final_owner}" != "${REQUIRED_UID}:${REQUIRED_GID}" ]]; then
        log_fail "Post-creation verification failed: ownership is ${final_owner} (expected ${REQUIRED_UID}:${REQUIRED_GID})."
        exit 1
    fi

    if [[ "${final_perms}" != "${REQUIRED_PERMS}" ]]; then
        log_fail "Post-creation verification failed: permissions are ${final_perms} (expected ${REQUIRED_PERMS})."
        exit 1
    fi

    if ! assert_zero_acls "${TARGET_DIR}"; then
        log_fail "Post-creation verification failed: extended ACLs remain on ${TARGET_DIR}."
        exit 1
    fi

    # Mark transaction as successfully committed
    SUCCESS_COMMITTED=1
    log_info "Successfully created and verified ${TARGET_DIR} (owner ${final_owner}, mode ${final_perms}, zero ACLs)."
    log_info "Execution completed successfully."
    exit 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
