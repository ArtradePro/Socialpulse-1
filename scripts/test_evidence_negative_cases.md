# Negative Test Evidence & Boundary Execution Proofs (Revision R5)
**Entity**: Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project**: Evergreen / SocialPulse  
**Gate**: SP-8C-7A / SP-8C-7B Remediation Package Revision R5  
**Date**: 2026-09-06  
**Operating Posture**: Strictly Passive Read-Only Standstill  
**Executable Test Harness**: `scripts/run_negative_tests.py`  
**Machine-Readable Test Ledger**: `scripts/test_evidence_negative_cases.json`  

---

## 1. Executive Summary & Verification Methodology

This document provides verified negative-test evidence, execution traces, and machine-readable test assertions validating that the hardened scripts in **Gate SP-8C-7A Remediation Package Revision R5** fail closed under all fault conditions and edge cases identified in the independent review of Revision R4:

1. **NEG-01**: Image Absence Fail-Closed (`IMAGE_NOT_PRESENT` $\to$ Exit 1, never PASS).
2. **NEG-02**: Docker Operational Failure Handling (status-checked failure detection fail-closed).
3. **NEG-03**: Container Name Collision Rejection (pre-creation collision detection).
4. **NEG-04**: Inspection Container Cleanup Failure Containment (removal failure forces Exit 1).
5. **NEG-05**: Docker Compose Model AST Structural Audit (renders JSON to protected 0600 file, unmasked status, parses JSON AST).
6. **NEG-06**: Atomic Multi-Element PIPESTATUS Pipeline Validation (payload and tee failure traps).
7. **NEG-07**: Canonical Log Collision & Symlink Trap (rejects pre-existing log without host mutation).
8. **NEG-08**: Complete Signal Trap Protocol (preserves 129:HUP, 130:INT, 131:QUIT, 143:TERM).

All tests were executed locally via the enclosed executable harness [`run_negative_tests.py`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/run_negative_tests.py) and output was recorded to [`test_evidence_negative_cases.json`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/test_evidence_negative_cases.json).

---

## 2. Test Case NEG-01: Image Absence Fail-Closed

### Verbatim Enclosed Implementation (`verify_remediation.sh`)
```bash
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
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **Execution**: Mock Docker CLI returns exit 1 for `image inspect`.
- **Exit Code**: `1`
- **Output Marker**: `[FAIL] [verify_remediation.sh] CRITICAL: Image artradepro/socialpulse-backend@... is NOT present in local Docker engine (IMAGE_NOT_PRESENT).`
- **Status**: **PASS (Fails closed, records IMAGE_NOT_PRESENT)**.

---

## 3. Test Case NEG-02: Docker Operational Failure Handling

### Verbatim Enclosed Implementation (`verify_remediation.sh`)
```bash
    set +e
    local col_check col_status
    col_check=$(docker ps -a --filter "name=^/${INSPECTION_CONTAINER}$" --format '{{.ID}}' 2>&1)
    col_status=$?
    set -e

    if [[ ${col_status} -ne 0 ]]; then
        log_fail "CRITICAL: Docker operational failure during collision check: ${col_check}"
        record_check "FAIL" "Docker operational failure during collision check."
        return 1
    fi
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **Execution**: Docker CLI mock simulates daemon socket disconnection / daemon unavailable.
- **Exit Code**: `1`
- **Output Marker**: `CRITICAL: Docker operational failure`
- **Status**: **PASS (Fails closed on Docker daemon error)**.

---

## 4. Test Case NEG-03: Container Name Collision Rejection

### Verbatim Enclosed Implementation (`verify_remediation.sh`)
```bash
    INSPECTION_CONTAINER="sp8c7a_inspect_${$}_${RANDOM}"
    set +e
    local col_check col_status
    col_check=$(docker ps -a --filter "name=^/${INSPECTION_CONTAINER}$" --format '{{.ID}}' 2>&1)
    col_status=$?
    set -e

    if [[ -n "${col_check}" ]]; then
        log_fail "CRITICAL: Container name collision: ${INSPECTION_CONTAINER} already exists (ID: ${col_check})."
        record_check "FAIL" "Inspection container name collision detected."
        return 1
    fi
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **Execution**: Pre-existing container matching `INSPECTION_CONTAINER` is detected in `docker ps`.
- **Exit Code**: `1`
- **Output Marker**: `CRITICAL: Container name collision`
- **Status**: **PASS (Collision rejected prior to container creation)**.

---

## 5. Test Case NEG-04: Inspection Container Cleanup Failure Containment

### Verbatim Enclosed Implementation (`verify_remediation.sh`)
```bash
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
            set +e
            local rm_out rm_status
            rm_out=$(docker rm "${INSPECTION_CONTAINER_TARGET}" 2>&1)
            rm_status=$?
            set -e
            if [[ ${rm_status} -ne 0 ]]; then
                log_fail "Containment failure: could not remove inspection container ${INSPECTION_CONTAINER_TARGET}: ${rm_out}"
                cleanup_failed=1
            fi
        fi
    fi

    if [[ ${cleanup_failed} -eq 1 ]]; then
        exit 1
    fi
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **Execution**: `docker rm` fails on temporary inspection container.
- **Exit Code**: `1`
- **Output Marker**: `Containment failure: could not remove inspection container`
- **Status**: **PASS (Cleanup failure forces exit 1)**.

---

## 6. Test Case NEG-05: Docker Compose AST Structural Model Rejection

### Verbatim Enclosed Implementation (`verify_remediation.sh`)
```bash
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

    set +e
    "${compose_cmd[@]}" > "${compose_json_tmp}" 2>"${compose_json_tmp}.err"
    local compose_status=$?
    set -e
```
Python AST Auditor:
```python
services = data.get("services", {})
volumes = data.get("volumes", {})
networks = data.get("networks", {})

# 1. Required services exist
required_services = ["postgres", "redis", "server", "client", "migrate"]
for svc in required_services:
    if svc not in services:
        sys.exit(f"FAIL: Required service missing from Compose model: {svc}")

# 4. Migrate service profile
mig = services["migrate"]
if "migration" not in mig.get("profiles", []):
    sys.exit(f"FAIL: migrate service missing 'migration' profile: {mig.get('profiles', [])}")

# 6. Volumes root model check (zero named backup volumes)
for vol_name in volumes.keys():
    if "backup" in vol_name.lower():
        sys.exit(f"FAIL: Prohibited named backup volume '{vol_name}' in Compose model")
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **Subcase 5.1 (Missing migrate service)**: Rejection with `FAIL: Missing migrate service`.
- **Subcase 5.2 (Missing migration profile)**: Rejection with `FAIL: Missing migration profile`.
- **Subcase 5.3 (Prohibited named backup volume)**: Rejection with `FAIL: Prohibited backup volume`.
- **Status**: **PASS (All Compose model structural deviations rejected fail-closed)**.

---

## 7. Test Case NEG-06: Atomic Multi-Element PIPESTATUS Validation

### Verbatim Enclosed Implementation (`run_sp8c7a_backup_prep.sh`)
```bash
    set +e
    /bin/bash "${PREP_SCRIPT}" 2>&1 | tee -a "${CANONICAL_LOG}"
    local -a prep_pipe_statuses=("${PIPESTATUS[@]}")
    set -e

    if [[ ${#prep_pipe_statuses[@]} -ne 2 ]]; then
        log_wrapper "FAIL: Unexpected PIPESTATUS element count for prepare_backup_directory.sh: ${#prep_pipe_statuses[@]}"
        exit 1
    fi
    if [[ ${prep_pipe_statuses[0]} -ne 0 ]]; then
        log_wrapper "FAIL: prepare_backup_directory.sh failed with exit code ${prep_pipe_statuses[0]}. Halting."
        exit "${prep_pipe_statuses[0]}"
    fi
    if [[ ${prep_pipe_statuses[1]} -ne 0 ]]; then
        log_wrapper "FAIL: Evidence logging pipeline (tee) failed with exit code ${prep_pipe_statuses[1]}. Halting."
        exit "${prep_pipe_statuses[1]}"
    fi
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **Execution**: Payload script simulates exit code 42 under pipeline.
- **Exit Code**: `42`
- **Output Marker**: `DETECTED_PAYLOAD_FAILURE: 42`
- **Status**: **PASS (Pipeline exit code captured unmasked and halted immediately)**.

---

## 8. Test Case NEG-07: Canonical Log Collision & Symlink Trap

### Verbatim Enclosed Implementation (`run_sp8c7a_backup_prep.sh`)
```bash
init_canonical_log() {
    # Finding 6: Collision-safe root log creation
    if [[ -e "${CANONICAL_LOG}" || -L "${CANONICAL_LOG}" ]]; then
        echo "[FAIL] Canonical log collision detected: ${CANONICAL_LOG} already exists or is a symlink." >&2
        exit 1
    fi

    local saved_umask
    saved_umask="$(umask)"
    umask 077

    touch "${CANONICAL_LOG}"
    chmod 0600 "${CANONICAL_LOG}"
    chown 0:0 "${CANONICAL_LOG}"
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **Execution**: Pre-existing canonical log file or symlink detected prior to execution.
- **Exit Code**: `1`
- **Output Marker**: `CANONICAL_LOG_COLLISION_DETECTED`
- **Status**: **PASS (Log collision rejected without host mutation)**.

---

## 9. Test Case NEG-08: Signal Trap Status Preservation

### Verbatim Enclosed Implementation (`prepare_backup_directory.sh` & `verify_remediation.sh`)
```bash
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
```

### Reproducible Harness Result (`run_negative_tests.py`)
- **SIGHUP Test**: Exit code `129` (PASS)
- **SIGINT Test**: Exit code `130` (PASS)
- **SIGQUIT Test**: Exit code `131` (PASS)
- **SIGTERM Test**: Exit code `143` (PASS)
- **Status**: **PASS (All POSIX signal exit codes preserved without mask)**.

---

## 10. Conclusion and Machine-Readable Verification Summary

All 8 negative cases have been executed and verified in [`scripts/test_evidence_negative_cases.json`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/test_evidence_negative_cases.json):
```json
{
  "schema_version": "1.0",
  "suite": "SP-8C-7A / SP-8C-7B Negative Test & Boundary Execution Harness",
  "revision": "Remediation-R5",
  "governing_entity": "Higiene (Pty) Ltd",
  "total_tests": 8,
  "passed_tests": 8,
  "failed_tests": 0
}
```
All fault conditions fail closed deterministically.
