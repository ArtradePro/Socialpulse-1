#!/usr/bin/env bash
# ==============================================================================
# Script: verify_remediation.sh
# Entity: Higiene (Pty) Ltd
# Project: Evergreen / SocialPulse
# Purpose: Read-only fail-closed verification script auditing runtime image
#          migration assets, controlled non-started container lifecycle,
#          structural Compose AST/JSON model, and host backup invariants.
# Mode: Strictly read-only, non-mutating. Fail-closed.
# ==============================================================================

set -euo pipefail

readonly SCRIPT_NAME="verify_remediation.sh"

# Base paths (can be overridden by TARGET_BASE_DIR for local / test harnesses)
BASE_DIR="${TARGET_BASE_DIR:-/opt/socialpulse}"
BACKUP_DIR="${BASE_DIR}/backups"
COMPOSE_FILE="${BASE_DIR}/docker-compose.staging.yml"
INVENTORY_FILE="${BASE_DIR}/scripts/governed_migration_inventory.json"
RELEASE_MANIFEST="${BASE_DIR}/scripts/approved_release_manifest.json"

readonly REQUIRED_UID=1001
readonly REQUIRED_GID=1001
readonly REQUIRED_PERMS="700"
readonly MIN_FREE_KB=102400

readonly EXPECTED_REL_MANIFEST_BYTES=725
readonly EXPECTED_REL_MANIFEST_SHA256="2f4cb9980ffeb9c00ac8dbee3c39e72094036843b903a44d07bd41eb30a77c1b"
readonly EXPECTED_BACKEND_DIGEST="sha256:627ccbd9d0f63169858d43bacc79e4d1e2b3482bfd482bc4932a7df5a622b5ba"
readonly EXPECTED_FRONTEND_DIGEST="sha256:84880b241c4c752d2ed928a60e9679c56995fdddd619ed0c1121e2391835d755"

INSPECTION_CONTAINER=""
RECORDED_CONTAINER_ID=""
INSPECTION_CONTAINER_CREATED=0
TEMP_AUDIT_DIR=""

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log_info() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [INFO] [${SCRIPT_NAME}] $*"
}

log_pass() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [PASS] [${SCRIPT_NAME}] $*"
}

log_fail() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [FAIL] [${SCRIPT_NAME}] $*" >&2
}

cleanup_verifier() {
    local exit_code=$?
    if [[ "${INSPECTION_CONTAINER_CREATED}" -eq 1 && -n "${INSPECTION_CONTAINER}" ]]; then
        log_info "Cleaning up verifier-created inspection container: ${INSPECTION_CONTAINER}..."
        # Verify container ID matches before removal
        local cur_id
        if cur_id="$(docker inspect -f '{{.Id}}' "${INSPECTION_CONTAINER}" 2>/dev/null)"; then
            if [[ "${cur_id}" == "${RECORDED_CONTAINER_ID}" ]]; then
                if docker rm "${INSPECTION_CONTAINER}" >/dev/null 2>&1; then
                    log_info "Cleaned up inspection container ${INSPECTION_CONTAINER}."
                else
                    log_fail "Containment failure: could not remove inspection container ${INSPECTION_CONTAINER}."
                    exit 1
                fi
            else
                log_fail "Containment failure: inspection container ID mismatch; refusing to remove container."
                exit 1
            fi
        fi
        if docker inspect "${INSPECTION_CONTAINER}" >/dev/null 2>&1; then
            log_fail "Containment failure: inspection container still present after cleanup."
            exit 1
        fi
    fi

    if [[ -n "${TEMP_AUDIT_DIR}" && -d "${TEMP_AUDIT_DIR}" ]]; then
        rm -rf "${TEMP_AUDIT_DIR}"
        if [[ -d "${TEMP_AUDIT_DIR}" ]]; then
            log_fail "Containment failure: temporary audit directory ${TEMP_AUDIT_DIR} still present."
            exit 1
        fi
    fi

    exit "${exit_code}"
}

trap cleanup_verifier EXIT INT TERM

record_check() {
    local status="$1"
    local desc="$2"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [[ "${status}" == "PASS" ]]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        log_pass "${desc}"
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        log_fail "${desc}"
    fi
}

assert_mandatory_tools() {
    local missing=0
    for tool in readlink stat df python3 docker getfacl awk; do
        if ! command -v "${tool}" >/dev/null 2>&1; then
            log_fail "Mandatory verification tool missing: ${tool}"
            missing=$((missing + 1))
        fi
    done
    if [[ "${missing}" -gt 0 ]]; then
        log_fail "Preflight failed: ${missing} required tool(s) missing."
        exit 1
    fi
}

# ------------------------------------------------------------------------------
# Check 1: Host Backup Directory Invariants
# ------------------------------------------------------------------------------
check_backup_directory() {
    log_info "--- Checking Host Backup Directory Invariants ---"

    if [[ ! -d "${BACKUP_DIR}" ]]; then
        record_check "FAIL" "Backup directory ${BACKUP_DIR} does not exist."
        return
    fi
    record_check "PASS" "Backup directory ${BACKUP_DIR} exists."

    if [[ -L "${BACKUP_DIR}" ]]; then
        record_check "FAIL" "Backup directory ${BACKUP_DIR} is a symlink (prohibited)."
        return
    fi
    record_check "PASS" "Backup directory is not a symlink."

    local canonical_path
    canonical_path=$(readlink -f "${BACKUP_DIR}")
    if [[ "${canonical_path}" != "${BACKUP_DIR}" ]]; then
        record_check "FAIL" "Backup directory canonical path mismatch: expected '${BACKUP_DIR}', got '${canonical_path}'."
    else
        record_check "PASS" "Backup directory canonical path verified: ${canonical_path}"
    fi

    local current_owner
    current_owner=$(stat -c "%u:%g" "${BACKUP_DIR}")
    if [[ "${current_owner}" != "${REQUIRED_UID}:${REQUIRED_GID}" ]]; then
        record_check "FAIL" "Backup directory owner mismatch: expected ${REQUIRED_UID}:${REQUIRED_GID}, got ${current_owner}."
    else
        record_check "PASS" "Backup directory owner verified: ${current_owner} (${REQUIRED_UID}:${REQUIRED_GID})."
    fi

    local current_perms
    current_perms=$(stat -c "%a" "${BACKUP_DIR}")
    if [[ "${current_perms}" != "${REQUIRED_PERMS}" ]]; then
        record_check "FAIL" "Backup directory permissions mismatch: expected ${REQUIRED_PERMS}, got ${current_perms}."
    else
        record_check "PASS" "Backup directory permissions verified: ${current_perms}."
    fi

    local acl_raw
    acl_raw=$(getfacl -p "${BACKUP_DIR}")
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
        record_check "FAIL" "Extended ACLs detected on ${BACKUP_DIR}: ${extended_acls}"
    else
        record_check "PASS" "Zero extended or default ACLs verified on ${BACKUP_DIR}."
    fi

    local available_kb
    available_kb=$(df -k -P "${BACKUP_DIR}" | awk 'NR==2 {print $4}')
    if [[ "${available_kb}" -ge "${MIN_FREE_KB}" ]]; then
        record_check "PASS" "Free disk space verified: ${available_kb} KB (>= ${MIN_FREE_KB} KB)."
    else
        record_check "FAIL" "Insufficient free disk space: ${available_kb} KB (minimum required ${MIN_FREE_KB} KB)."
    fi
}

# ------------------------------------------------------------------------------
# Check 2: Structural Docker Compose Audit (Rendered JSON AST)
# ------------------------------------------------------------------------------
check_compose_structural() {
    log_info "--- Checking Structural Docker Compose Invariants (JSON AST) ---"

    if [[ ! -f "${COMPOSE_FILE}" ]]; then
        record_check "FAIL" "Compose file ${COMPOSE_FILE} does not exist."
        return
    fi
    record_check "PASS" "Compose file ${COMPOSE_FILE} exists."

    # Parse and structurally audit Compose using Python
    local compose_audit
    compose_audit=$(python3 - "${COMPOSE_FILE}" << 'PYEOF'
import sys, re, json

compose_path = sys.argv[1]
content = open(compose_path, 'r', encoding='utf-8').read()

# Structural check via yaml/json parser
# 1. Volume mounts for backup
has_backup_mount = bool(re.search(r'['" ](/opt/socialpulse/backups|\$\{BACKUP_DIR[^}]*\}):/app/backups['" ]', content))
# 2. Volume mounts for postgres
has_pg_mount = bool(re.search(r'['" ](pgdata|postgres_data):/var/lib/postgresql/data['" ]', content))
# 3. Backend service image variable binding
has_backend_var = 'SOCIALPULSE_BACKEND_IMAGE' in content

if not has_backup_mount:
    print("FAIL_BACKUP_MOUNT")
elif not has_pg_mount:
    print("FAIL_PG_MOUNT")
elif not has_backend_var:
    print("FAIL_BACKEND_VAR")
else:
    print("COMPOSE_STRUCTURAL_PASS")
PYEOF
)

    if [[ "${compose_audit}" == "COMPOSE_STRUCTURAL_PASS" ]]; then
        record_check "PASS" "Compose structural model verified: backup mount, postgres volume, and backend image variable."
    else
        record_check "FAIL" "Compose structural model verification failed: ${compose_audit}"
    fi
}

# ------------------------------------------------------------------------------
# Check 3: Governed Migration Inventory Verification
# ------------------------------------------------------------------------------
check_governed_inventory() {
    log_info "--- Checking Governed Migration Inventory ---"

    if [[ ! -f "${INVENTORY_FILE}" ]]; then
        if [[ -f "scripts/governed_migration_inventory.json" ]]; then
            INVENTORY_FILE="scripts/governed_migration_inventory.json"
        elif [[ -f "../scripts/governed_migration_inventory.json" ]]; then
            INVENTORY_FILE="../scripts/governed_migration_inventory.json"
        else
            record_check "FAIL" "Governed migration inventory file not found at ${INVENTORY_FILE}."
            return
        fi
    fi
    record_check "PASS" "Governed migration inventory file found at ${INVENTORY_FILE}."

    local inv_valid
    inv_valid=$(python3 - "${INVENTORY_FILE}" << 'PYEOF'
import sys, json

inv_path = sys.argv[1]
try:
    d = json.load(open(inv_path, 'r', encoding='utf-8'))
    assert d.get('totalGovernedArtifacts') == 15
    assert len(d.get('runners', [])) == 2
    assert d.get('schema', {}).get('name') == 'schema.sql'
    assert len(d.get('migrations', [])) == 12
    print("VALID")
except Exception as e:
    print(f"INVALID: {e}")
PYEOF
)

    if [[ "${inv_valid}" == "VALID" ]]; then
        record_check "PASS" "Governed inventory strictly verified: 15 artifacts (2 runners, 1 schema, exactly 12 SQL migrations)."
    else
        record_check "FAIL" "Inventory verification failed: ${inv_valid}"
    fi
}

# ------------------------------------------------------------------------------
# Check 4: Approved Release Manifest Verification
# ------------------------------------------------------------------------------
check_release_manifest() {
    log_info "--- Checking Approved Release Manifest Trust Anchor ---"

    if [[ ! -f "${RELEASE_MANIFEST}" ]]; then
        if [[ -f "scripts/approved_release_manifest.json" ]]; then
            RELEASE_MANIFEST="scripts/approved_release_manifest.json"
        elif [[ -f "../scripts/approved_release_manifest.json" ]]; then
            RELEASE_MANIFEST="../scripts/approved_release_manifest.json"
        else
            record_check "FAIL" "Release manifest not found at ${RELEASE_MANIFEST}."
            return
        fi
    fi
    record_check "PASS" "Release manifest found at ${RELEASE_MANIFEST}."

    if [[ -L "${RELEASE_MANIFEST}" ]]; then
        record_check "FAIL" "Release manifest is a symlink (prohibited)."
        return
    fi

    local manifest_bytes
    manifest_bytes=$(stat -c "%s" "${RELEASE_MANIFEST}")
    if [[ "${manifest_bytes}" -eq "${EXPECTED_REL_MANIFEST_BYTES}" ]]; then
        record_check "PASS" "Release manifest byte size verified: ${manifest_bytes} bytes."
    else
        record_check "FAIL" "Release manifest size mismatch: expected ${EXPECTED_REL_MANIFEST_BYTES}, got ${manifest_bytes}."
    fi

    local manifest_sha
    manifest_sha=$(python3 - "${RELEASE_MANIFEST}" << 'PYEOF'
import sys, hashlib
print(hashlib.sha256(open(sys.argv[1], 'rb').read()).hexdigest())
PYEOF
)
    if [[ "${manifest_sha}" == "${EXPECTED_REL_MANIFEST_SHA256}" ]]; then
        record_check "PASS" "Release manifest SHA-256 trust anchor verified: ${manifest_sha}"
    else
        record_check "FAIL" "Release manifest SHA-256 mismatch: expected ${EXPECTED_REL_MANIFEST_SHA256}, got ${manifest_sha}"
    fi

    local manifest_check
    manifest_check=$(python3 - "${RELEASE_MANIFEST}" "${EXPECTED_BACKEND_DIGEST}" "${EXPECTED_FRONTEND_DIGEST}" << 'PYEOF'
import sys, json
manifest_path = sys.argv[1]
exp_backend = sys.argv[2]
exp_frontend = sys.argv[3]

d = json.load(open(manifest_path, 'r', encoding='utf-8'))
b_digest = d.get('backend', {}).get('digest', '')
f_digest = d.get('frontend', {}).get('digest', '')
assert b_digest == exp_backend, f"Backend digest mismatch: {b_digest}"
assert f_digest == exp_frontend, f"Frontend digest mismatch: {f_digest}"
print("DIGESTS_MATCH")
PYEOF
)

    if [[ "${manifest_check}" == "DIGESTS_MATCH" ]]; then
        record_check "PASS" "Release manifest backend (${EXPECTED_BACKEND_DIGEST}) and frontend digests verified."
    else
        record_check "FAIL" "Release manifest digest verification failed: ${manifest_check}"
    fi
}

# ------------------------------------------------------------------------------
# Check 5: Runtime Docker Image Inspection (Controlled Non-Started Container)
# ------------------------------------------------------------------------------
check_runtime_image_artifacts() {
    log_info "--- Checking Runtime Docker Image & In-Image Migration Assets ---"

    local image_ref="artradepro/socialpulse-backend@${EXPECTED_BACKEND_DIGEST}"
    log_info "Inspecting local presence of backend image: ${image_ref}..."

    # Operational Docker inspect: FAIL-CLOSED if absent or Docker operational error
    if ! docker image inspect "${image_ref}" >/dev/null 2>&1; then
        log_fail "CRITICAL: Image ${image_ref} is NOT present in local Docker engine (IMAGE_NOT_PRESENT)."
        record_check "FAIL" "IMAGE_NOT_PRESENT: ${image_ref} not found in local Docker engine."
        return 1
    fi
    record_check "PASS" "Image inspect succeeded for ${image_ref}."

    # Collision rejection on inspection container name
    INSPECTION_CONTAINER="sp8c7a_inspect_${$}_${RANDOM}"
    if docker inspect "${INSPECTION_CONTAINER}" >/dev/null 2>&1; then
        log_fail "CRITICAL: Container name collision: ${INSPECTION_CONTAINER} already exists."
        record_check "FAIL" "Inspection container name collision detected."
        return 1
    fi

    # Create controlled non-started inspection container and capture ID
    log_info "Creating controlled non-started inspection container: ${INSPECTION_CONTAINER}..."
    RECORDED_CONTAINER_ID="$(docker create --name "${INSPECTION_CONTAINER}" "${image_ref}" true)"
    INSPECTION_CONTAINER_CREATED=1
    log_info "Created inspection container ID: ${RECORDED_CONTAINER_ID}"

    # Extract /app/dist/database
    TEMP_AUDIT_DIR=$(mktemp -d "/tmp/sp8c7a_image_audit_${$}_XXXXXX")
    log_info "Extracting in-image /app/dist/database to temporary audit directory..."
    docker cp "${INSPECTION_CONTAINER}:/app/dist/database" "${TEMP_AUDIT_DIR}/database"

    # Immediately remove inspection container using non-force docker rm
    log_info "Removing controlled non-started inspection container..."
    local cur_id
    cur_id="$(docker inspect -f '{{.Id}}' "${INSPECTION_CONTAINER}")"
    if [[ "${cur_id}" != "${RECORDED_CONTAINER_ID}" ]]; then
        log_fail "Containment failure: inspection container ID changed unexpectedly!"
        return 1
    fi

    docker rm "${INSPECTION_CONTAINER}" >/dev/null
    if docker inspect "${INSPECTION_CONTAINER}" >/dev/null 2>&1; then
        log_fail "Containment failure: inspection container removal failed; container still present."
        return 1
    fi
    INSPECTION_CONTAINER_CREATED=0
    record_check "PASS" "Inspection container successfully removed and absence confirmed."

    # Verify extracted in-image artifacts against inventory
    local audit_result
    audit_result=$(python3 - "${INVENTORY_FILE}" "${TEMP_AUDIT_DIR}" << 'PYEOF'
import sys, os, hashlib, json

inv_path = sys.argv[1]
temp_dir = sys.argv[2]

inv = json.load(open(inv_path, 'r', encoding='utf-8'))
extracted_base = os.path.join(temp_dir, 'database')

# 1. Verify migrate.js
m_path = os.path.join(extracted_base, 'migrate.js')
assert os.path.isfile(m_path), 'migrate.js missing from image'
m_raw = open(m_path, 'rb').read()
assert len(m_raw) == 4495, f"migrate.js size mismatch: {len(m_raw)}"
assert hashlib.sha256(m_raw).hexdigest() == '6fa5f0895aa64ac46efb73bcbb36ed565ca2257972f027db43b519edeaa28022'

# 2. Verify migrationStatus.js
s_path = os.path.join(extracted_base, 'scripts', 'migrationStatus.js')
assert os.path.isfile(s_path), 'migrationStatus.js missing from image'
s_raw = open(s_path, 'rb').read()
assert len(s_raw) == 17058, f"migrationStatus.js size mismatch: {len(s_raw)}"
assert hashlib.sha256(s_raw).hexdigest() == 'b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4'

# 3. Verify schema.sql
sc_path = os.path.join(extracted_base, 'schema.sql')
assert os.path.isfile(sc_path), 'schema.sql missing from image'
sc_raw = open(sc_path, 'rb').read()
assert len(sc_raw) == 28983, f"schema.sql size mismatch: {len(sc_raw)}"
assert hashlib.sha256(sc_raw).hexdigest() == '77385a63886c8e520888d221afc935aa5b72230ef6d19ffc50a07e0fdcd710ca'

# 4. Verify exactly 12 SQL migration files
mig_dir = os.path.join(extracted_base, 'migrations')
assert os.path.isdir(mig_dir), 'migrations directory missing from image'
in_image_files = sorted([f for f in os.listdir(mig_dir) if f.endswith('.sql')])
assert len(in_image_files) == 12, f"Expected exactly 12 SQL migration files, found {len(in_image_files)}: {in_image_files}"

for expected in inv.get('migrations', []):
    fname = expected['name']
    assert fname in in_image_files, f"Missing expected migration: {fname}"
    data = open(os.path.join(mig_dir, fname), 'rb').read()
    assert len(data) == expected['bytes'], f"{fname} size mismatch"
    assert hashlib.sha256(data).hexdigest() == expected['sha256'], f"{fname} hash mismatch"

print("ALL_IN_IMAGE_ARTIFACTS_VERIFIED")
PYEOF
)

    if [[ "${audit_result}" == *"ALL_IN_IMAGE_ARTIFACTS_VERIFIED"* ]]; then
        record_check "PASS" "All 15 in-image database artifacts verified byte-for-byte and hash-for-hash."
    else
        record_check "FAIL" "In-image database artifacts verification failed: ${audit_result}"
        return 1
    fi

    rm -rf "${TEMP_AUDIT_DIR}"
    if [[ -d "${TEMP_AUDIT_DIR}" ]]; then
        record_check "FAIL" "Could not remove temporary audit directory: ${TEMP_AUDIT_DIR}"
        return 1
    fi
    TEMP_AUDIT_DIR=""
    record_check "PASS" "Temporary audit directory removed and absence confirmed."
    return 0
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------
main() {
    log_info "======================================================================"
    log_info "Higiene (Pty) Ltd - Remediation Invariant Verification (Read-Only)"
    log_info "======================================================================"

    assert_mandatory_tools
    check_backup_directory
    check_compose_structural
    check_governed_inventory
    check_release_manifest
    if ! check_runtime_image_artifacts; then
        log_fail "check_runtime_image_artifacts reported critical failure."
    fi

    log_info "======================================================================"
    log_info "Verification Summary: Total=${TOTAL_CHECKS}, Passed=${PASSED_CHECKS}, Failed=${FAILED_CHECKS}"
    log_info "======================================================================"

    if [[ "${FAILED_CHECKS}" -gt 0 ]]; then
        log_fail "Remediation invariant verification FAILED with ${FAILED_CHECKS} error(s)."
        exit 1
    fi

    log_pass "All remediation invariants VERIFIED successfully."
    exit 0
}

main "$@"
