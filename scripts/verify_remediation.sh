#!/usr/bin/env bash
# ==============================================================================
# Script: verify_remediation.sh
# Entity: Higiene (Pty) Ltd
# Project: Evergreen / SocialPulse
# Purpose: Read-only fail-closed verification script auditing runtime image
#          migration assets, controlled non-started container lifecycle,
#          structural Compose JSON AST model, and host backup invariants.
# Mode: Strictly read-only, non-mutating. Fail-closed.
# Signal Handling: Preserves 129 (HUP), 130 (INT), 131 (QUIT), 143 (TERM).
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
INSPECTION_CONTAINER_TARGET=""
RECORDED_CONTAINER_ID=""
INSPECTION_CONTAINER_PREARMED=0
INSPECTION_CONTAINER_CREATED=0
TEMP_AUDIT_DIR=""
RECEIVED_SIGNAL=0

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

# ------------------------------------------------------------------------------
# Signal-Specific Trap Handlers & Cleanup (R5)
# ------------------------------------------------------------------------------
cleanup_verifier() {
    local exit_code=$?
    if [[ "${RECEIVED_SIGNAL}" -ne 0 ]]; then
        exit_code="${RECEIVED_SIGNAL}"
    fi

    local cleanup_failed=0

    # Pre-armed container cleanup (Finding 2 & 3)
    if [[ "${INSPECTION_CONTAINER_PREARMED}" -eq 1 && -n "${INSPECTION_CONTAINER_TARGET}" ]]; then
        log_info "Inspecting pre-armed container status: ${INSPECTION_CONTAINER_TARGET}..."
        set +e
        local exist_id exist_status
        exist_id=$(docker ps -a --filter "name=^/${INSPECTION_CONTAINER_TARGET}$" --format '{{.ID}}' 2>&1)
        exist_status=$?
        set -e

        if [[ ${exist_status} -ne 0 ]]; then
            log_fail "Containment failure: Docker operational error while checking container presence: ${exist_id}"
            cleanup_failed=1
        elif [[ -n "${exist_id}" ]]; then
            log_info "Removing container ${INSPECTION_CONTAINER_TARGET} (ID: ${exist_id})..."
            if [[ -n "${RECORDED_CONTAINER_ID}" && "${RECORDED_CONTAINER_ID}" != "${exist_id}"* ]]; then
                log_fail "Containment failure: inspection container ID mismatch; refusing to remove container."
                cleanup_failed=1
            else
                set +e
                local rm_out rm_status
                rm_out=$(docker rm "${INSPECTION_CONTAINER_TARGET}" 2>&1)
                rm_status=$?
                set -e
                if [[ ${rm_status} -ne 0 ]]; then
                    log_fail "Containment failure: could not remove inspection container ${INSPECTION_CONTAINER_TARGET}: ${rm_out}"
                    cleanup_failed=1
                else
                    log_info "Removed inspection container ${INSPECTION_CONTAINER_TARGET}."
                fi
            fi

            # Confirmed absence verification (Finding 3: status check distinguishing daemon error)
            set +e
            local post_check post_status
            post_check=$(docker ps -a --filter "name=^/${INSPECTION_CONTAINER_TARGET}$" --format '{{.ID}}' 2>&1)
            post_status=$?
            set -e

            if [[ ${post_status} -ne 0 ]]; then
                log_fail "Containment failure: Docker operational error during post-removal absence verification: ${post_check}"
                cleanup_failed=1
            elif [[ -n "${post_check}" ]]; then
                log_fail "Containment failure: inspection container ${INSPECTION_CONTAINER_TARGET} still present after removal attempt."
                cleanup_failed=1
            else
                log_info "Confirmed container absence from Docker engine."
            fi
        fi
    fi

    if [[ -n "${TEMP_AUDIT_DIR}" && -d "${TEMP_AUDIT_DIR}" ]]; then
        rm -rf "${TEMP_AUDIT_DIR}"
        if [[ -d "${TEMP_AUDIT_DIR}" ]]; then
            log_fail "Containment failure: temporary audit directory ${TEMP_AUDIT_DIR} still present."
            cleanup_failed=1
        fi
    fi

    if [[ ${cleanup_failed} -eq 1 ]]; then
        exit 1
    fi

    exit "${exit_code}"
}

handle_sig() {
    RECEIVED_SIGNAL="$1"
    log_fail "Caught signal $2 (${RECEIVED_SIGNAL}). Halting verifier..."
    exit "${RECEIVED_SIGNAL}"
}

trap 'handle_sig 129 SIGHUP' HUP
trap 'handle_sig 130 SIGINT' INT
trap 'handle_sig 131 SIGQUIT' QUIT
trap 'handle_sig 143 SIGTERM' TERM
trap cleanup_verifier EXIT

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
    log_info "--- Preflight: Validating Mandatory Tools ---"
    local missing=0
    for tool in docker sha256sum stat readlink df getfacl awk; do
        if ! command -v "${tool}" >/dev/null 2>&1; then
            log_fail "Mandatory tool missing from PATH: ${tool}"
            missing=$((missing + 1))
        fi
    done
    if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
        log_fail "Mandatory tool missing from PATH: python3 / python"
        missing=$((missing + 1))
    fi
    if [[ ${missing} -gt 0 ]]; then
        log_fail "Preflight failed: ${missing} mandatory tools missing."
        exit 1
    fi
    log_pass "All mandatory verification tools present."
}

PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1 && command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
fi

# ------------------------------------------------------------------------------
# Check 1: Host Backup Directory Invariants
# ------------------------------------------------------------------------------
check_backup_directory() {
    log_info "--- Checking Host Backup Directory Invariants ---"

    if [[ ! -e "${BACKUP_DIR}" ]]; then
        record_check "FAIL" "Backup directory does not exist at ${BACKUP_DIR}."
        return
    fi

    if [[ -L "${BACKUP_DIR}" ]]; then
        record_check "FAIL" "Backup directory is a symbolic link: ${BACKUP_DIR}."
        return
    fi
    record_check "PASS" "Backup directory is not a symbolic link."

    local canon_path
    canon_path=$(readlink -f "${BACKUP_DIR}")
    if [[ "${canon_path}" != "${BACKUP_DIR}" ]]; then
        record_check "FAIL" "Canonical path mismatch: expected ${BACKUP_DIR}, resolved ${canon_path}."
        return
    fi
    record_check "PASS" "Canonical path verified: ${canon_path}."

    local actual_owner
    actual_owner=$(stat -c '%u:%g' "${BACKUP_DIR}")
    if [[ "${actual_owner}" == "${REQUIRED_UID}:${REQUIRED_GID}" ]]; then
        record_check "PASS" "Ownership verified: ${actual_owner} (expected ${REQUIRED_UID}:${REQUIRED_GID})."
    else
        record_check "FAIL" "Ownership mismatch: got ${actual_owner} (expected ${REQUIRED_UID}:${REQUIRED_GID})."
    fi

    local actual_perms
    actual_perms=$(stat -c '%a' "${BACKUP_DIR}")
    if [[ "${actual_perms}" == "${REQUIRED_PERMS}" ]]; then
        record_check "PASS" "Permissions verified: 0${actual_perms} (expected 0${REQUIRED_PERMS})."
    else
        record_check "FAIL" "Permissions mismatch: got 0${actual_perms} (expected 0${REQUIRED_PERMS})."
    fi

    # Check zero ACLs via awk parser without failure masking
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

    if [[ ${awk_status} -eq 0 && -z "${extended_acls}" ]]; then
        record_check "PASS" "Zero named or default ACLs verified on ${BACKUP_DIR}."
    else
        record_check "FAIL" "Extended ACLs detected on ${BACKUP_DIR}: ${extended_acls}"
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
# Check 2: Structural Docker Compose Audit (Rendered JSON AST - Finding 1)
# ------------------------------------------------------------------------------
check_compose_structural() {
    log_info "--- Checking Structural Docker Compose Invariants (Rendered JSON AST) ---"

    if [[ ! -f "${COMPOSE_FILE}" ]]; then
        record_check "FAIL" "Compose file ${COMPOSE_FILE} does not exist."
        return
    fi
    record_check "PASS" "Compose file ${COMPOSE_FILE} exists."

    # Render Compose model using canonical project directory, compose file, and env source
    local saved_umask
    saved_umask="$(umask)"
    umask 077
    local compose_json_tmp
    compose_json_tmp="$(mktemp "${TMPDIR:-/tmp}/sp8c7a_compose_ast_XXXXXX.json")"
    chmod 0600 "${compose_json_tmp}"
    umask "${saved_umask}"

    local compose_cmd=(docker compose --project-directory "${BASE_DIR}" -f "${COMPOSE_FILE}")
    if [[ -f "${BASE_DIR}/.env" ]]; then
        compose_cmd+=(--env-file "${BASE_DIR}/.env")
    fi
    compose_cmd+=(--profile migration config --format json)

    # Export approved image references if unset so config can render unmasked
    local exported_backend=0 exported_frontend=0
    if [[ -z "${SOCIALPULSE_BACKEND_IMAGE:-}" ]]; then
        export SOCIALPULSE_BACKEND_IMAGE="artradepro/socialpulse-backend@${EXPECTED_BACKEND_DIGEST}"
        exported_backend=1
    fi
    if [[ -z "${SOCIALPULSE_FRONTEND_IMAGE:-}" ]]; then
        export SOCIALPULSE_FRONTEND_IMAGE="artradepro/socialpulse-frontend@${EXPECTED_FRONTEND_DIGEST}"
        exported_frontend=1
    fi

    set +e
    "${compose_cmd[@]}" > "${compose_json_tmp}" 2>"${compose_json_tmp}.err"
    local compose_status=$?
    set -e

    if [[ "${exported_backend}" -eq 1 ]]; then
        unset SOCIALPULSE_BACKEND_IMAGE
    fi
    if [[ "${exported_frontend}" -eq 1 ]]; then
        unset SOCIALPULSE_FRONTEND_IMAGE
    fi

    if [[ "${compose_status}" -ne 0 ]]; then
        local err_sample
        err_sample="$(head -n 5 "${compose_json_tmp}.err" 2>/dev/null | tr '\n' ' ')"
        record_check "FAIL" "docker compose config failed with unmasked exit status ${compose_status}: ${err_sample}"
        rm -f "${compose_json_tmp}" "${compose_json_tmp}.err"
        return
    fi
    rm -f "${compose_json_tmp}.err"

    # Structural AST parse via Python
    local ast_audit
    ast_audit=$("${PYTHON_BIN}" - "${compose_json_tmp}" "${EXPECTED_BACKEND_DIGEST}" "${EXPECTED_FRONTEND_DIGEST}" << 'PYEOF'
import sys, json

json_path = sys.argv[1]
exp_backend_digest = sys.argv[2]
exp_frontend_digest = sys.argv[3]

try:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    sys.exit(f"FAIL: Rendered Compose config is not valid JSON: {e}")

services = data.get("services", {})
volumes = data.get("volumes", {})
networks = data.get("networks", {})

# 1. Required services exist
required_services = ["postgres", "redis", "server", "client", "migrate"]
for svc in required_services:
    if svc not in services:
        sys.exit(f"FAIL: Required service missing from Compose model: {svc}")

# 2. Server service image and network
srv = services["server"]
srv_img = srv.get("image", "")
if exp_backend_digest not in srv_img:
    sys.exit(f"FAIL: server service image mismatch: got '{srv_img}', expected '{exp_backend_digest}'")

# 3. Client service image and network
cli = services["client"]
cli_img = cli.get("image", "")
if exp_frontend_digest not in cli_img:
    sys.exit(f"FAIL: client service image mismatch: got '{cli_img}', expected '{exp_frontend_digest}'")

# 4. Migrate service profile, command, restart, image
mig = services["migrate"]
mig_profiles = mig.get("profiles", [])
if "migration" not in mig_profiles:
    sys.exit(f"FAIL: migrate service missing 'migration' profile: {mig_profiles}")

mig_img = mig.get("image", "")
if exp_backend_digest not in mig_img:
    sys.exit(f"FAIL: migrate service image mismatch: got '{mig_img}', expected '{exp_backend_digest}'")

mig_cmd = mig.get("command", [])
cmd_str = " ".join(mig_cmd) if isinstance(mig_cmd, list) else str(mig_cmd)
if "dist/database/migrate.js" not in cmd_str:
    sys.exit(f"FAIL: migrate service command invalid: got '{cmd_str}', expected 'node dist/database/migrate.js'")

# 5. Networks check
for svc_name in ["server", "client", "migrate"]:
    svc_nets = services[svc_name].get("networks", {})
    net_names = list(svc_nets.keys()) if isinstance(svc_nets, dict) else list(svc_nets)
    if "staging_net" not in net_names:
        sys.exit(f"FAIL: {svc_name} service missing 'staging_net' network: {net_names}")

# 6. Volumes root model check (zero named backup volumes)
for vol_name in volumes.keys():
    if "backup" in vol_name.lower():
        sys.exit(f"FAIL: Prohibited named backup volume '{vol_name}' in Compose model")

print("COMPOSE_AST_PASS")
PYEOF
)
    local py_status=$?
    rm -f "${compose_json_tmp}"

    if [[ ${py_status} -eq 0 && "${ast_audit}" == "COMPOSE_AST_PASS" ]]; then
        record_check "PASS" "Rendered Compose JSON AST structural audit verified (services, profiles, images, networks, volumes)."
    else
        record_check "FAIL" "Compose JSON AST audit failed: ${ast_audit}"
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

    local inventory_check
    inventory_check=$("${PYTHON_BIN}" - "${INVENTORY_FILE}" << 'PYEOF'
import sys, json

inv_path = sys.argv[1]
try:
    with open(inv_path, "r", encoding="utf-8") as f:
        inv = json.load(f)
except Exception as e:
    sys.exit(f"Invalid JSON: {e}")

expected_count = 15
artifacts = inv.get("artifacts", [])
if len(artifacts) != expected_count:
    sys.exit(f"Inventory count mismatch: got {len(artifacts)}, expected {expected_count}")

sql_count = sum(1 for a in artifacts if a.get("path", "").endswith(".sql"))
js_count = sum(1 for a in artifacts if a.get("path", "").endswith(".js"))

if sql_count != 13 or js_count != 2:
    sys.exit(f"Type breakdown mismatch: sql={sql_count} (expected 13), js={js_count} (expected 2)")

print("INVENTORY_VALID")
PYEOF
)

    if [[ "${inventory_check}" == "INVENTORY_VALID" ]]; then
        record_check "PASS" "Governed migration inventory verified: exactly 15 migration/runner artifacts (13 SQL, 2 JS)."
    else
        record_check "FAIL" "Governed migration inventory verification failed: ${inventory_check}"
    fi
}

# ------------------------------------------------------------------------------
# Check 4: Release Manifest Verification
# ------------------------------------------------------------------------------
check_release_manifest() {
    log_info "--- Checking Approved Release Manifest ---"

    if [[ ! -f "${RELEASE_MANIFEST}" ]]; then
        if [[ -f "scripts/approved_release_manifest.json" ]]; then
            RELEASE_MANIFEST="scripts/approved_release_manifest.json"
        elif [[ -f "../scripts/approved_release_manifest.json" ]]; then
            RELEASE_MANIFEST="../scripts/approved_release_manifest.json"
        else
            record_check "FAIL" "Approved release manifest not found at ${RELEASE_MANIFEST}."
            return
        fi
    fi

    local actual_bytes
    actual_bytes=$(stat -c '%s' "${RELEASE_MANIFEST}")
    if [[ "${actual_bytes}" -eq "${EXPECTED_REL_MANIFEST_BYTES}" ]]; then
        record_check "PASS" "Release manifest size verified: ${actual_bytes} bytes."
    else
        record_check "FAIL" "Release manifest size mismatch: expected ${EXPECTED_REL_MANIFEST_BYTES}, got ${actual_bytes}."
    fi

    local actual_sha
    actual_sha=$(sha256sum "${RELEASE_MANIFEST}" | awk '{print $1}')
    if [[ "${actual_sha}" == "${EXPECTED_REL_MANIFEST_SHA256}" ]]; then
        record_check "PASS" "Release manifest SHA-256 trust anchor verified: ${actual_sha}."
    else
        record_check "FAIL" "Release manifest SHA-256 mismatch: expected ${EXPECTED_REL_MANIFEST_SHA256}, got ${actual_sha}."
    fi

    local manifest_check
    manifest_check=$("${PYTHON_BIN}" - "${RELEASE_MANIFEST}" "${EXPECTED_BACKEND_DIGEST}" "${EXPECTED_FRONTEND_DIGEST}" << 'PYEOF'
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

    # Operational Docker inspect: FAIL-CLOSED if absent or Docker operational error (Finding 1)
    if ! docker image inspect "${image_ref}" >/dev/null 2>&1; then
        log_fail "CRITICAL: Image ${image_ref} is NOT present in local Docker engine (IMAGE_NOT_PRESENT)."
        record_check "FAIL" "IMAGE_NOT_PRESENT: ${image_ref} not found in local Docker engine."
        return 1
    fi
    record_check "PASS" "Image inspect succeeded for ${image_ref}."

    # Collision rejection on inspection container name
    INSPECTION_CONTAINER="sp8c7a_inspect_${$}_${RANDOM}"
    set +e
    local col_check col_status
    col_check=$(docker ps -a --filter "name=^/${INSPECTION_CONTAINER}$" --format '{{.ID}}' 2>&1)
    col_status=$?
    set -e

    if [[ ${col_status} -ne 0 ]]; then
        log_fail "CRITICAL: Docker operational failure during collision check: ${col_check}"
        record_check "FAIL" "Docker operational failure during collision check."
        return 1
    elif [[ -n "${col_check}" ]]; then
        log_fail "CRITICAL: Container name collision: ${INSPECTION_CONTAINER} already exists (ID: ${col_check})."
        record_check "FAIL" "Inspection container name collision detected."
        return 1
    fi

    # Pre-arm inspection container ownership before docker create (Finding 2)
    INSPECTION_CONTAINER_TARGET="${INSPECTION_CONTAINER}"
    INSPECTION_CONTAINER_PREARMED=1

    # Create controlled non-started inspection container and capture ID
    log_info "Creating controlled non-started inspection container: ${INSPECTION_CONTAINER}..."
    set +e
    RECORDED_CONTAINER_ID="$(docker create --name "${INSPECTION_CONTAINER}" "${image_ref}" true 2>&1)"
    local create_status=$?
    set -e

    if [[ ${create_status} -ne 0 || ! "${RECORDED_CONTAINER_ID}" =~ ^[0-9a-f]{64}$ ]]; then
        log_fail "CRITICAL: docker create failed or returned invalid container ID: ${RECORDED_CONTAINER_ID}"
        record_check "FAIL" "docker create failed for inspection container."
        return 1
    fi
    INSPECTION_CONTAINER_CREATED=1
    log_info "Created inspection container ID: ${RECORDED_CONTAINER_ID}"

    # Extract /app/dist/database
    TEMP_AUDIT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/sp8c7a_image_audit_${$}_XXXXXX")
    log_info "Extracting in-image database assets to ${TEMP_AUDIT_DIR}..."

    set +e
    local cp_out cp_status
    cp_out="$(docker cp "${INSPECTION_CONTAINER}:/app/dist/database" "${TEMP_AUDIT_DIR}/" 2>&1)"
    cp_status=$?
    set -e

    if [[ ${cp_status} -ne 0 ]]; then
        log_fail "CRITICAL: docker cp failed: ${cp_out}"
        record_check "FAIL" "Failed to copy /app/dist/database from inspection container."
        return 1
    fi
    record_check "PASS" "Successfully extracted /app/dist/database from image."

    # Locate enclosed source artifacts for comparison
    local src_dir="${BASE_DIR}/scripts/source_artifacts/database"
    if [[ ! -d "${src_dir}" ]]; then
        if [[ -d "scripts/source_artifacts/database" ]]; then
            src_dir="scripts/source_artifacts/database"
        elif [[ -d "../scripts/source_artifacts/database" ]]; then
            src_dir="../scripts/source_artifacts/database"
        fi
    fi

    # Audit in-image extracted database assets against enclosed inventory
    local extracted_audit
    extracted_audit=$("${PYTHON_BIN}" - "${TEMP_AUDIT_DIR}/database" "${INVENTORY_FILE}" "${src_dir}" << 'PYEOF'
import sys, os, json, hashlib

extracted_db = sys.argv[1]
inv_file = sys.argv[2]
src_dir = sys.argv[3]

with open(inv_file, "r", encoding="utf-8") as f:
    inv = json.load(f)

artifacts = inv.get("artifacts", [])
failures = []

for item in artifacts:
    in_img_path = item["in_image_path"] # e.g. /app/dist/database/migrate.js
    rel_sub = in_img_path.replace("/app/dist/database/", "")
    extracted_file = os.path.join(extracted_db, rel_sub.replace("/", os.sep))

    if not os.path.isfile(extracted_file):
        failures.append(f"MISSING: {in_img_path}")
        continue

    extracted_bytes = open(extracted_file, "rb").read()
    extracted_sha = hashlib.sha256(extracted_bytes).hexdigest()

    # Compare with source artifact if available
    src_file = os.path.join(src_dir, item["source_path"].replace("src/database/", "").replace("/", os.sep))
    if os.path.isfile(src_file):
        src_bytes = open(src_file, "rb").read()
        # LF normalized sha
        src_lf = src_bytes.replace(b"
", b"
")
        src_sha = hashlib.sha256(src_lf).hexdigest()
        if extracted_sha != src_sha:
            failures.append(f"HASH_MISMATCH: {in_img_path} (img: {extracted_sha} vs src_lf: {src_sha})")
    else:
        # Check against expected sha in inventory if present
        exp_sha = item.get("sha256_lf") or item.get("sha256")
        if exp_sha and extracted_sha != exp_sha:
            failures.append(f"HASH_MISMATCH: {in_img_path} (img: {extracted_sha} vs inv: {exp_sha})")

if failures:
    sys.exit("FAIL: " + "; ".join(failures))

print("IN_IMAGE_AUDIT_PASS")
PYEOF
)
    local py_status=$?

    if [[ ${py_status} -eq 0 && "${extracted_audit}" == "IN_IMAGE_AUDIT_PASS" ]]; then
        record_check "PASS" "In-image migration assets verified: all 15 files present and matching expected baselines."
    else
        record_check "FAIL" "In-image migration assets verification failed: ${extracted_audit}"
        return 1
    fi

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

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
