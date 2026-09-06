# Staging Release 04 Build Provenance & OCI Registry Evidence

**Governing Entity:** Higiene (Pty) Ltd — Higienlabs Technology Division  
**Release Identifier:** `sp-8c-staging-release-04`  
**Target Environment:** `staging`  
**Workflow Run:** [GitHub Actions Run 33992192586](https://github.com/ArtradePro/Socialpulse-1/actions/runs/33992192586)  
**Workflow Path:** `.github/workflows/release-images.yml`  
**Source Commit:** `89e1cb37b4bac97711580c19616df716ea48b648`  
**Built At:** `2026-09-05T21:11:50Z`  

---

## 1. Cryptographic Digest Identifiers

| Component | Repository | Tag | Canonical Digest |
|---|---|---|---|
| **Backend Image Index** | `artradepro/socialpulse-backend` | `sha-89e1cb37b4bac97711580c19616df716ea48b648` | `sha256:627ccbd9d0f63169858d43bacc79e4d1e2b3482bfd482bc4932a7df5a622b5ba` |
| **Backend Linux/AMD64 Manifest** | `artradepro/socialpulse-backend` | (platform manifest) | `sha256:604dabc8c657f9ae97123178d7dc8e9850d96750afb9937b744ac944f127e9a8` |
| **Backend Image Config** | `artradepro/socialpulse-backend` | (OCI config blob) | `sha256:ec70c9d300e27ce96eb5f05514570539bfe53c9fcf517438bc2f140e504b5a5b` |
| **Backend Attestation** | `artradepro/socialpulse-backend` | (build attestation) | `sha256:00908677bdf7c3b2608acf03fcfdeab419bb30dbee83b3cc963154c8a18f4ce3` |
| **Frontend Image Index** | `artradepro/socialpulse-frontend` | `sha-89e1cb37b4bac97711580c19616df716ea48b648` | `sha256:84880b241c4c752d2ed928a60e9679c56995fdddd619ed0c1121e2391835d755` |
| **Release Manifest Trust Anchor** | `approved_release_manifest.json` | 725 bytes | `2f4cb9980ffeb9c00ac8dbee3c39e72094036843b903a44d07bd41eb30a77c1b` |

---

## 2. In-Image Build Layer Provenance (Docker Buildx / Buildkit)

Direct inspection of OCI configuration blob (`sha256:ec70c9d300e27ce96eb5f05514570539bfe53c9fcf517438bc2f140e504b5a5b`) verifies the production stage build history commands:

```dockerfile
COPY /app/dist ./dist # buildkit
COPY /app/src/database/migrations ./dist/database/migrations # buildkit
COPY /app/src/database/schema.sql ./dist/database/schema.sql # buildkit
CMD ["node" "dist/server.js"]
```

This confirms that the 12 SQL migration files and `schema.sql` are baked directly into the immutable image layer hierarchy.
