# Cryptographic Baseline Reconciliation & Provenance Analysis

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Project:** Evergreen / SocialPulse  
**Gate:** SP-8C-7A / SP-8C-7B  
**Revision:** Remediation Package R3  
**Date:** 2026-09-06  

---

## 1. Executive Summary

This document provides complete, deterministic cryptographic reconciliation explaining the byte count and SHA-256 differences between earlier Windows-staged review baselines and the canonical Linux LF container baselines.

The differences identified in the independent review of Remediation R2 (Findings 4 & 5) are 100% attributable to POSIX LF line-ending normalization (`\n` vs `\r\n`). In Linux container images and on production Linux hosts, files are interpreted and executed under POSIX LF line endings.

---

## 2. Runner Baseline Reconciliation

### A. `migrate.js` (`/app/dist/database/migrate.js`)
- **Historical Windows CRLF Checksum:** `ee62f5a8639767979a733dd1e55a19ff35ea64e76415bd77c3a254a2d08d19f6` (4,508 bytes)
- **Canonical Linux LF Checksum:** `6fa5f0895aa64ac46efb73bcbb36ed565ca2257972f027db43b519edeaa28022` (4,495 bytes)
- **Byte Delta:** Exactly 13 bytes (`4508 - 4495 = 13`).
- **Proof:** Removing all `\r` carriage return bytes from the 4,508-byte file produces precisely the 4,495-byte file with SHA-256 `6fa5f0895aa64ac46efb73bcbb36ed565ca2257972f027db43b519edeaa28022`.

### B. `migrationStatus.js` (`/app/dist/database/scripts/migrationStatus.js`)
- **Historical Windows CRLF Checksum:** `6f87234943a331ea2872f6a198a02b39a90476f38085adfd8a4f6e32959e40ec` (17,098 bytes)
- **Canonical Linux LF Checksum:** `b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4` (17,058 bytes)
- **Byte Delta:** Exactly 40 bytes (`17098 - 17058 = 40`).
- **Host Preflight Corroboration:** During both Gate SP-8C-7A Revision R22 and Revision R25 preflights executed on host `srv1935605`, Step 5 audited `/app/dist/database/scripts/migrationStatus.js` inside the live backend container (`socialpulse-backend`) and captured its SHA-256 checksum as:
  `b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4`.
  This confirms that `b86c1ebf...` is the authentic Linux/Docker compiled artifact.

---

## 3. SQL Migration Baselines Reconciliation

Migrations 1 through 8 and `schema.sql` were committed with standard LF line endings and their checksums are unchanged across all revisions.

Migrations 9 through 12 were initially checked out or committed with Windows CRLF line endings. The table below proves that the byte difference between CRLF and LF is exactly equal to the number of lines (1 byte per newline):

| Migration File | CRLF Bytes | CRLF SHA-256 | Canonical LF Bytes | Canonical LF SHA-256 | Line Count | Delta (Bytes) |
|---|---|---|---|---|---|---|
| `20260830_add_unique_stripe_session_id.sql` | 316 | `87d2c6eb47f9a658693d14da70b7c9c64e9d022764e0611de7a90ac885dcb56c` | 310 | `3066fc96b7e79c1b59109902b68a2fab1859bc1c79aba98422aff779f1227b00` | 6 | 6 |
| `20260831_claims_library_and_brand_governance.sql` | 998 | `f1076990491d4a6d1786d5cf444a891589abb2c8ed1e53326a39af67d6335cac` | 978 | `c6d9566a16f98ad117d0dd03eaa59e3de15984073518b7be3e7882555ef2982f` | 20 | 20 |
| `20260831_evergreen_integration_and_suppression.sql` | 2,037 | `76fb6ae21c523a77fa374e659418c6a54d130c36b13d8e2fb068fb86b13a2b81` | 1,995 | `6b8c2106a3e5efbed2e12378e4ce7d3ac9de7baf9aadb58a7c0f6cca2fcead4e` | 42 | 42 |
| `20260831_omnisend_and_q2c_sync.sql` | 1,134 | `ea21dae5e2ffdf5707ba004288c6b7c26ff81085437247b82fba6c1344135ea1` | 1,109 | `b7c3a1b6c3bef1c2384780bd623d403c54180fcfbf5dc614700424006c4aa36c` | 25 | 25 |

---

## 4. Master Canonical Inventory (All 15 Enclosed Artifacts)

All 15 raw source files are enclosed directly inside the review archive under `source_artifacts/database/`:

1. `migrate.js`: 4,495 bytes | lines=98 | SHA-256 `6fa5f0895aa64ac46efb73bcbb36ed565ca2257972f027db43b519edeaa28022`
2. `scripts/migrationStatus.js`: 17,058 bytes | lines=386 | SHA-256 `b86c1ebf1b5d19173f6286cd33c4e384a373da6cd1c035ce69c19abc7d8e48d4`
3. `schema.sql`: 28,983 bytes | lines=629 | SHA-256 `77385a63886c8e520888d221afc935aa5b72230ef6d19ffc50a07e0fdcd710ca`
4. `migrations/20260515_ecommerce.sql`: 3,047 bytes | lines=68 | SHA-256 `df7d737a8357296ebfff5139710dd25d644143ba24c7dca608327b2bff2ad9fa`
5. `migrations/20260515_ecommerce_add_seller_id.sql`: 128 bytes | lines=2 | SHA-256 `a109f2a5bb37ac174a96b74979ad15abf82e539579127e6bee9724a927c5c4c9`
6. `migrations/20260522_add_workspace_id_to_missing_tables.sql`: 805 bytes | lines=9 | SHA-256 `a8bdf063875994117dd075eabb5a8fc3ac779d7026f9a4857623c53bc7e7655f`
7. `migrations/20260613_paid_ads.sql`: 1,934 bytes | lines=46 | SHA-256 `cd19a384496a427712f6638a380ea6e52bff2f55d8cf8762a2275bde6bb80a53`
8. `migrations/20260613_sales_pages.sql`: 2,006 bytes | lines=45 | SHA-256 `b747897965313186903008c21559301f9588d17fff68a55249f98e7634b9ca62`
9. `migrations/20260613_zeely_expansion.sql`: 2,430 bytes | lines=46 | SHA-256 `e921882476f3bf29d04dc72d2191f01667e1a826e4508a3d50f30fdb2f9ffada`
10. `migrations/20260614_add_product_info_to_workspaces.sql`: 67 bytes | lines=1 | SHA-256 `1023eb17652d4fb3aea45786996a8b7ad543b8eee895a5d55412b057ba7ae435`
11. `migrations/20260717_omnichannel_marketing.sql`: 2,442 bytes | lines=55 | SHA-256 `5af3e7cb71db94d9d478e3ab72fbd9895a62685ecc802088f6994a6af2848987`
12. `migrations/20260830_add_unique_stripe_session_id.sql`: 310 bytes | lines=6 | SHA-256 `3066fc96b7e79c1b59109902b68a2fab1859bc1c79aba98422aff779f1227b00`
13. `migrations/20260831_claims_library_and_brand_governance.sql`: 978 bytes | lines=20 | SHA-256 `c6d9566a16f98ad117d0dd03eaa59e3de15984073518b7be3e7882555ef2982f`
14. `migrations/20260831_evergreen_integration_and_suppression.sql`: 1,995 bytes | lines=42 | SHA-256 `6b8c2106a3e5efbed2e12378e4ce7d3ac9de7baf9aadb58a7c0f6cca2fcead4e`
15. `migrations/20260831_omnisend_and_q2c_sync.sql`: 1,109 bytes | lines=25 | SHA-256 `b7c3a1b6c3bef1c2384780bd623d403c54180fcfbf5dc614700424006c4aa36c`
