#!/usr/bin/env bash
# ==============================================================================
# Script: prepare_backup_directory.sh
# Entity: Higiene (Pty) Ltd
# Project: Evergreen / SocialPulse
# Purpose: Narrowly scoped host preparation script to create and govern
#          the host backup directory /opt/socialpulse/backups with exact
#          invariants: owner 1001:1001, mode 0700, non-symlink, zero ACLs.
# Safety: Strictly non-destructive. Enforces collision rejection. Never
#         alters, chowns, or strips ACLs on pre-existing host directories.
#         Rollback removes directory via rmdir ONLY if created by this run.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Constants and Invariants
# ------------------------------------------------------------------------------
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

# ------------------------------------------------------------------------------
# Logging Functions
# ------------------------------------------------------------------------------
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
# Rollback / Exit Trap Handler
# ------------------------------------------------------------------------------
cleanup_on_exit() {
    local exit_code=$?
    if [[ "${CREATED_BY_SCRIPT}" -eq 1 && "${SUCCESS_COMMITTED}" -ne 1 ]]; then
        log_warn "Execution interrupted or failed before commit. Executing safe rollback..."
        if [[ -d "${TARGET_DIR}" && ! -L "${TARGET_DIR}" ]]; then
            # Safe non-destructive removal: only remove if empty
            if rmdir "${TARGET_DIR}" 2>/dev/null; then
                log_info "Rollback: successfully removed empty directory ${TARGET_DIR}"
            else
                log_warn "Rollback: ${TARGET_DIR} could not be removed via rmdir (not empty or permissions error)"
            fi
        fi
    elif [[ "${CREATED_BY_SCRIPT}" -eq 0 ]]; then
        log_info "Directory was pre-existing; rollback will not touch or delete pre-existing state."
    fi
    exit "${exit_code}"
}

trap cleanup_on_exit EXIT INT TERM

# ------------------------------------------------------------------------------
# Validation Functions
# ------------------------------------------------------------------------------
assert_root() {
    if [[ "$(id -u)" -ne 0 ]]; then
        log_fail "Must be run as root (EUID 0). Current UID: $(id -u)"
        exit 1
    fi
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
    canonical_path=$(readlink -f "${check_path}" 2>/dev/null || true)
    if [[ "${canonical_path}" != "${TARGET_DIR}" ]]; then
        log_fail "Path canonicalization check failed: expected '${TARGET_DIR}', resolved '${canonical_path}'"
        exit 1
    fi
}

assert_zero_acls() {
    local check_path="$1"
    if command -v getfacl >/dev/null 2>&1; then
        local acl_output
        acl_output=$(getfacl -p "${check_path}" 2>/dev/null || true)
        local named_acls
        named_acls=$(echo "${acl_output}" | grep -E '^(user:|group:|default:)' | grep -v -E '^(user::|group::|default:user::|default:group::|default:other::)' || true)
        if [[ -n "${named_acls}" ]]; then
            log_fail "Extended ACLs detected on ${check_path}. Non-destructive policy prohibits mutating ACLs."
            exit 1
        fi
        log_info "Zero extended or default ACLs verified on ${check_path}."
    fi
}

# ------------------------------------------------------------------------------
# Main Execution
# ------------------------------------------------------------------------------
main() {
    log_info "Starting host backup directory preparation for Higiene (Pty) Ltd..."
    assert_root
    assert_parent_directory

    if [[ -e "${TARGET_DIR}" || -L "${TARGET_DIR}" ]]; then
        log_info "Target ${TARGET_DIR} already exists. Enforcing strict collision rejection and non-destructive inspection..."

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

        # 4. Reject non-empty directories to avoid interfering with pre-existing backups
        local existing_entries
        existing_entries=$(ls -A "${TARGET_DIR}" 2>/dev/null || true)
        if [[ -n "${existing_entries}" ]]; then
            log_fail "Collision rejection: ${TARGET_DIR} exists and is not empty. Pre-existing files must not be altered."
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

        assert_zero_acls "${TARGET_DIR}"
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

        assert_zero_acls "${TARGET_DIR}"
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
