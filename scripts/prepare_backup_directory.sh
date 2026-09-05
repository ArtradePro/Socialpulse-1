#!/usr/bin/env bash
# ==============================================================================
# Script: prepare_backup_directory.sh
# Entity: Higiene (Pty) Ltd
# Project: Evergreen / SocialPulse
# Purpose: Narrowly scoped host preparation script to create and govern
#          the host backup directory /opt/socialpulse/backups with exact
#          invariants: owner 1001:1001, mode 0700, non-symlink, zero ACLs.
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
    fi
    exit "${exit_code}"
}

trap cleanup_on_exit EXIT INT TERM

# ------------------------------------------------------------------------------
# Preflight Validation
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

assert_collision_safety() {
    if [[ -L "${TARGET_DIR}" ]]; then
        log_fail "Collision rejection: ${TARGET_DIR} is a symlink. Symlinks are prohibited."
        exit 1
    fi

    if [[ -e "${TARGET_DIR}" && ! -d "${TARGET_DIR}" ]]; then
        log_fail "Collision rejection: ${TARGET_DIR} exists but is not a directory."
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

verify_and_enforce_acls() {
    local check_path="$1"
    # Ensure setfacl/getfacl are available or check with getfacl
    if command -v getfacl >/dev/null 2>&1; then
        local acl_output
        acl_output=$(getfacl -p "${check_path}" 2>/dev/null || true)
        local named_acls
        named_acls=$(echo "${acl_output}" | grep -E '^(user:|group:|default:)' | grep -v -E '^(user::|group::|default:user::|default:group::|default:other::)' || true)
        if [[ -n "${named_acls}" ]]; then
            log_warn "Named or default extended ACLs detected on ${check_path}:"
            echo "${named_acls}" >&2
            if command -v setfacl >/dev/null 2>&1; then
                log_info "Stripping extended ACLs with setfacl -b -k..."
                setfacl -b -k "${check_path}"
            else
                log_fail "Extended ACLs present and setfacl not available to strip them."
                exit 1
            fi
        else
            log_info "Zero extended or default ACLs verified on ${check_path}."
        fi
    fi
}

# ------------------------------------------------------------------------------
# Main Execution
# ------------------------------------------------------------------------------
main() {
    log_info "Starting host backup directory preparation for Higiene (Pty) Ltd..."
    assert_root
    assert_parent_directory
    assert_collision_safety

    if [[ ! -e "${TARGET_DIR}" ]]; then
        log_info "Target directory ${TARGET_DIR} does not exist. Checking space on parent directory..."
        check_disk_space "${PARENT_DIR}"

        log_info "Creating ${TARGET_DIR} with mode 0700..."
        CREATED_BY_SCRIPT=1
        mkdir -m 0700 "${TARGET_DIR}"

        log_info "Configuring ownership 1001:1001 on ${TARGET_DIR}..."
        chown "${REQUIRED_UID}:${REQUIRED_GID}" "${TARGET_DIR}"
        chmod "${REQUIRED_PERMS}" "${TARGET_DIR}"
    else
        log_info "Target directory ${TARGET_DIR} already exists. Enforcing governance invariants..."
        CREATED_BY_SCRIPT=0

        log_info "Enforcing ownership 1001:1001 on ${TARGET_DIR}..."
        chown "${REQUIRED_UID}:${REQUIRED_GID}" "${TARGET_DIR}"

        log_info "Enforcing mode 0700 on ${TARGET_DIR}..."
        chmod "${REQUIRED_PERMS}" "${TARGET_DIR}"
    fi

    # Post-creation / post-enforcement verification
    log_info "Performing post-configuration invariant verification..."

    # 1. Canonical non-symlink verification
    if [[ -L "${TARGET_DIR}" ]]; then
        log_fail "Verification failure: ${TARGET_DIR} is a symlink."
        exit 1
    fi
    if [[ ! -d "${TARGET_DIR}" ]]; then
        log_fail "Verification failure: ${TARGET_DIR} is not a directory."
        exit 1
    fi
    verify_canonical_path "${TARGET_DIR}"

    # 2. Ownership verification
    local current_owner
    current_owner=$(stat -c "%u:%g" "${TARGET_DIR}")
    if [[ "${current_owner}" != "${REQUIRED_UID}:${REQUIRED_GID}" ]]; then
        log_fail "Verification failure: owner is ${current_owner}, expected ${REQUIRED_UID}:${REQUIRED_GID}"
        exit 1
    fi
    log_info "Ownership verified: ${current_owner}"

    # 3. Permissions verification
    local current_perms
    current_perms=$(stat -c "%a" "${TARGET_DIR}")
    if [[ "${current_perms}" != "${REQUIRED_PERMS}" ]]; then
        log_fail "Verification failure: mode is ${current_perms}, expected ${REQUIRED_PERMS}"
        exit 1
    fi
    log_info "Permissions verified: ${current_perms}"

    # 4. Extended ACL verification
    verify_and_enforce_acls "${TARGET_DIR}"

    # 5. Free disk space verification
    check_disk_space "${TARGET_DIR}"

    # Commit transaction
    SUCCESS_COMMITTED=1
    log_info "Host backup directory preparation COMMITTED successfully."
    log_info "Directory: ${TARGET_DIR}"
    log_info "Owner: ${current_owner} (${REQUIRED_UID}:${REQUIRED_GID})"
    log_info "Permissions: ${current_perms}"
    log_info "Canonical Path: $(readlink -f "${TARGET_DIR}")"
    log_info "Status: READY_FOR_PREFLIGHT_SNAPSHOTS"
}

main "$@"
