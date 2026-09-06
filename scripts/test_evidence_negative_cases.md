# Negative Test Evidence & Boundary Execution Proofs (Revision R6)
**Entity**: Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project**: Evergreen / SocialPulse  
**Gate**: SP-8C-7A / SP-8C-7B Remediation Package Revision R6  
**Date**: 2026-09-06  
**Operating Posture**: Strictly Passive Read-Only Standstill  
**Executable Test Harness**: `scripts/run_negative_tests.py`  
**Machine-Readable Test Ledger**: `scripts/test_evidence_negative_cases.json`  

---

## 1. Executive Summary & Verification Methodology

This document provides verified negative-test evidence, execution traces, and machine-readable test assertions validating that the hardened scripts in **Gate SP-8C-7A Remediation Package Revision R6** fail closed under all fault conditions and edge cases identified across reviews:

1. **NEG-01**: Image Absence Fail-Closed (`IMAGE_NOT_PRESENT` -> Exit 1, never PASS).
2. **NEG-02**: Docker Operational Failure Handling (status-checked failure detection fail-closed).
3. **NEG-03**: Container Name Collision Rejection (pre-creation collision detection).
4. **NEG-04**: Inspection Container Cleanup Failure Containment (removal failure strictly forces Exit 1).
5. **NEG-05**: Docker Compose Model AST Structural Audit (renders JSON to protected 0600 file, unmasked status, parses JSON AST for exact images, profile, command, restart, zero ports, zero devices, zero sockets).
6. **NEG-06**: Atomic Multi-Element PIPESTATUS Pipeline Validation (payload and tee failure traps).
7. **NEG-07**: Canonical Log Collision & Symlink Trap (rejects pre-existing log without host mutation).
8. **NEG-08**: Complete Signal Trap Protocol (preserves 129:HUP, 130:INT, 131:QUIT, 143:TERM).

All tests were executed locally via the enclosed executable harness [`run_negative_tests.py`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/run_negative_tests.py) and output was recorded to [`test_evidence_negative_cases.json`](file:///C:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/scripts/test_evidence_negative_cases.json).

---

## 2. Test Cases & Execution Proofs

### NEG-01: Image Absence Fail-Closed
- **Objective**: Prove that if `docker image inspect` fails (image not present in local Docker store), the verifier immediately halts with exit code 1 and outputs `IMAGE_NOT_PRESENT`.
- **Governed Script Under Test**: `scripts/verify_remediation.sh` (`check_runtime_image_artifacts`).
- **Assertion**: Verifier must exit 1 and record `IMAGE_NOT_PRESENT` when docker image inspect fails.
- **Observed Exit Code**: `1`
- **Result**: **PASS**

### NEG-02: Docker Daemon Operational Failure Handling
- **Objective**: Prove that if Docker daemon fails during presence/absence check (socket timeout, daemon down), the verifier does NOT treat it as "confirmed absent" or proceed.
- **Governed Script Under Test**: `scripts/verify_remediation.sh` (`check_runtime_image_artifacts`).
- **Assertion**: Verifier must fail closed with exit 1 if Docker daemon communication fails.
- **Observed Exit Code**: `1`
- **Result**: **PASS**

### NEG-03: Container Name Collision Rejection
- **Objective**: Prove that if an inspection container with the target name already exists prior to invocation, the verifier halts without attempting creation or mutating state.
- **Governed Script Under Test**: `scripts/verify_remediation.sh` (`check_runtime_image_artifacts`).
- **Assertion**: Verifier must reject execution if inspection container name already exists.
- **Observed Exit Code**: `1`
- **Result**: **PASS**

### NEG-04: Inspection Container Cleanup Failure Containment
- **Objective**: Prove that if `docker rm -f` fails during cleanup, the verifier strictly traps the error, logs a containment failure, and forces exit code 1.
- **Governed Script Under Test**: `scripts/verify_remediation.sh` (`cleanup_verifier`).
- **Assertion**: Verifier cleanup failure must strictly force exit code 1.
- **Observed Exit Code**: `1`
- **Result**: **PASS**

### NEG-05: Docker Compose Model AST Structural Audit
- **Objective**: Prove that the AST auditor in `verify_remediation.sh` parses rendered Compose JSON AST model and fails closed if services have invalid profiles, unapproved images, rogue named volumes, or host namespace bindings.
- **Governed Script Under Test**: `scripts/verify_remediation.sh` (`audit_compose_ast`).
- **Assertion**: AST auditor must reject invalid service profiles, unapproved images, missing services, or rogue named backup volumes.
- **Observed Exit Code**: `1`
- **Result**: **PASS**

### NEG-06: Atomic Multi-Element PIPESTATUS Pipeline Validation
- **Objective**: Prove that the wrapper script detects pipeline failures when the payload script exits non-zero, ensuring tee does not mask the error code.
- **Governed Script Under Test**: `scripts/run_sp8c7a_backup_prep.sh`.
- **Assertion**: Wrapper must atomically detect and trap non-zero payload status from pipeline.
- **Observed Exit Code**: `42`
- **Result**: **PASS**

### NEG-07: Canonical Log Collision & Symlink Trap
- **Objective**: Prove that if the designated log file already exists as a file or symlink, the wrapper halts immediately with exit code 1 without writing to or truncating the target.
- **Governed Script Under Test**: `scripts/run_sp8c7a_backup_prep.sh`.
- **Assertion**: Wrapper must reject pre-existing log files or symlinks without mutating host state.
- **Observed Exit Code**: `1`
- **Result**: **PASS**

### NEG-08: Signal Trap Status Preservation
- **Objective**: Prove that all scripts properly trap `SIGHUP` (129), `SIGINT` (130), `SIGQUIT` (131), and `SIGTERM` (143) and exit with exact POSIX signal codes.
- **Governed Script Under Test**: `scripts/prepare_backup_directory.sh`, `scripts/verify_remediation.sh`.
- **Assertion**: Handlers must preserve exact POSIX signal termination exit codes.
- **Observed Exit Codes**: `129`, `130`, `131`, `143`
- **Result**: **PASS**

---

## 3. Machine-Readable Test Ledger

The corresponding machine-readable ledger is stored in `test_evidence_negative_cases.json`:
```json
{
  "schema_version": "1.0",
  "suite": "SP-8C-7A / SP-8C-7B Negative Test & Boundary Execution Harness",
  "revision": "Remediation-R6",
  "governing_entity": "Higiene (Pty) Ltd",
  "total_tests": 8,
  "passed_tests": 8,
  "failed_tests": 0
}
```
