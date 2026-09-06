#!/usr/bin/env bash
# ==============================================================================
# Script: run_sp8c7a_backup_prep.sh
# Entity: Higiene (Pty) Ltd
# Project: Evergreen / SocialPulse
# Purpose: Governed root execution wrapper for host backup directory preparation
#          and read-only remediation verification with external trust anchors,
#          canonical root-owned 0600 evidence logging, and PIPESTATUS capture.
# ==============================================================================

set -euo pipefail

readonly SCRIPT_NAME="run_sp8c7a_backup_prep.sh"
readonly TIMESTAMP="$(date -u +'%Y%m%d_%H%M%SZ')"
readonly CANONICAL_LOG="/root/sp8c7a_backup_prep_${TIMESTAMP}.log"

readonly BASE_DIR="/opt/socialpulse"
readonly SCRIPTS_DIR="${BASE_DIR}/scripts"

readonly PREP_SCRIPT="${SCRIPTS_DIR}/prepare_backup_directory.sh"
readonly EXPECTED_PREP_SHA256="432954e16b746067a18e3274e59d68f3080f60c638702aa1a22491b66322db70"

readonly VERIFY_SCRIPT="${SCRIPTS_DIR}/verify_remediation.sh"
readonly EXPECTED_VERIFY_SHA256="84acc3639ac3fc6671a173f7acbe3bae51cced851303d5e3ef9622ecc04c83df"

readonly RELEASE_MANIFEST="${SCRIPTS_DIR}/approved_release_manifest.json"
readonly EXPECTED_MANIFEST_SHA256="2f4cb9980ffeb9c00ac8dbee3c39e72094036843b903a44d07bd41eb30a77c1b"
readonly EXPECTED_MANIFEST_BYTES=725

log_wrapper() {
    local msg="[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [WRAPPER] $*"
    echo "${msg}"
    if [[ -f "${CANONICAL_LOG}" ]]; then
        echo "${msg}" >> "${CANONICAL_LOG}"
    fi
}

assert_root() {
    if [[ "$(id -u)" -ne 0 ]]; then
        echo "[FAIL] ${SCRIPT_NAME} must be run as root (EUID 0). Current UID: $(id -u)" >&2
        exit 1
    fi
}

init_canonical_log() {
    touch "${CANONICAL_LOG}"
    chmod 0600 "${CANONICAL_LOG}"
    chown 0:0 "${CANONICAL_LOG}"
    log_wrapper "Initialized canonical evidence log: ${CANONICAL_LOG} (mode 0600, owner 0:0)"
}

verify_script_trust_anchor() {
    local file_path="$1"
    local expected_hash="$2"
    local file_label="$3"

    if [[ ! -f "${file_path}" ]]; then
        log_wrapper "FAIL: ${file_label} does not exist at ${file_path}"
        exit 1
    fi

    if [[ -L "${file_path}" ]]; then
        log_wrapper "FAIL: ${file_label} is a symlink: ${file_path}"
        exit 1
    fi

    local actual_hash
    actual_hash="$(sha256sum "${file_path}" | awk '{print $1}')"
    if [[ "${actual_hash}" != "${expected_hash}" ]]; then
        log_wrapper "FAIL: ${file_label} SHA-256 trust anchor mismatch!"
        log_wrapper "Expected: ${expected_hash}"
        log_wrapper "Observed: ${actual_hash}"
        exit 1
    fi
    log_wrapper "PASS: ${file_label} verified against cryptographic trust anchor: ${actual_hash}"
}

verify_release_manifest_anchor() {
    if [[ ! -f "${RELEASE_MANIFEST}" || -L "${RELEASE_MANIFEST}" ]]; then
        log_wrapper "FAIL: Release manifest missing or symlink: ${RELEASE_MANIFEST}"
        exit 1
    fi

    local actual_bytes
    actual_bytes="$(stat -c '%s' "${RELEASE_MANIFEST}")"
    if [[ "${actual_bytes}" -ne "${EXPECTED_MANIFEST_BYTES}" ]]; then
        log_wrapper "FAIL: Release manifest size mismatch: expected ${EXPECTED_MANIFEST_BYTES}, got ${actual_bytes}"
        exit 1
    fi

    local actual_hash
    actual_hash="$(sha256sum "${RELEASE_MANIFEST}" | awk '{print $1}')"
    if [[ "${actual_hash}" != "${EXPECTED_MANIFEST_SHA256}" ]]; then
        log_wrapper "FAIL: Release manifest trust anchor mismatch: expected ${EXPECTED_MANIFEST_SHA256}, got ${actual_hash}"
        exit 1
    fi
    log_wrapper "PASS: Release manifest verified against trust anchor (725 bytes, ${actual_hash})"
}

main() {
    assert_root
    init_canonical_log

    log_wrapper "======================================================================"
    log_wrapper "Higiene (Pty) Ltd — Gate SP-8C-7A Governed Host Backup Preparation"
    log_wrapper "======================================================================"

    log_wrapper "Verifying cryptographic trust anchors..."
    verify_script_trust_anchor "${PREP_SCRIPT}" "${EXPECTED_PREP_SHA256}" "Host Backup Prep Script"
    verify_script_trust_anchor "${VERIFY_SCRIPT}" "${EXPECTED_VERIFY_SHA256}" "Remediation Verifier Script"
    verify_release_manifest_anchor

    chmod +x "${PREP_SCRIPT}" "${VERIFY_SCRIPT}"

    log_wrapper "Executing prepare_backup_directory.sh under governed tee pipeline..."
    set +e
    "${PREP_SCRIPT}" 2>&1 | tee -a "${CANONICAL_LOG}"
    local prep_status="${PIPESTATUS[0]}"
    set -e

    log_wrapper "prepare_backup_directory.sh exited with status: ${prep_status}"
    if [[ "${prep_status}" -ne 0 ]]; then
        log_wrapper "FAIL: prepare_backup_directory.sh failed (exit ${prep_status}). Halting."
        exit "${prep_status}"
    fi

    log_wrapper "Executing read-only verify_remediation.sh under governed tee pipeline..."
    set +e
    "${VERIFY_SCRIPT}" 2>&1 | tee -a "${CANONICAL_LOG}"
    local verify_status="${PIPESTATUS[0]}"
    set -e

    log_wrapper "verify_remediation.sh exited with status: ${verify_status}"
    if [[ "${verify_status}" -ne 0 ]]; then
        log_wrapper "FAIL: verify_remediation.sh failed (exit ${verify_status})."
        exit "${verify_status}"
    fi

    # Canonical log verification
    if [[ ! -s "${CANONICAL_LOG}" ]]; then
        log_wrapper "FAIL: Canonical log is empty or missing: ${CANONICAL_LOG}"
        exit 1
    fi

    local log_owner log_mode log_bytes log_sha256
    log_owner="$(stat -c '%u:%g' "${CANONICAL_LOG}")"
    log_mode="$(stat -c '%a' "${CANONICAL_LOG}")"
    log_bytes="$(stat -c '%s' "${CANONICAL_LOG}")"
    log_sha256="$(sha256sum "${CANONICAL_LOG}" | awk '{print $1}')"

    log_wrapper "======================================================================"
    log_wrapper "Host Preparation & Verification Completed Successfully"
    log_wrapper "Canonical Log: ${CANONICAL_LOG}"
    log_wrapper "Log Owner:     ${log_owner}"
    log_wrapper "Log Mode:      0${log_mode}"
    log_wrapper "Log Bytes:     ${log_bytes}"
    log_wrapper "Log SHA-256:   ${log_sha256}"
    log_wrapper "Operating Posture: Standstill Preserved"
    log_wrapper "======================================================================"

    exit 0
}

main "$@"
