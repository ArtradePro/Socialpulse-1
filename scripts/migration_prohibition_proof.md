# SOURCE-BOUND MIGRATION PROHIBITION EVIDENCE REPORT

**Governing Context:** Higiene (Pty) Ltd — Project Evergreen — Higienlabs Technology Division  
**Authorized Owner & Sole Reviewer:** Vernon la Cock, CEO (`@ArtradePro`)  
**Executive Oversight:** Ziona la Cock, Vice President  
**Independent Reviewer:** ChatGPT  
**Execution Agent:** Antigravity (Google DeepMind)  
**Approved Source Commit SHA:** `721e731a2e4af9c9903af92a788ab52a3c21b47e` (Git `main` branch tip)  
**Phase:** SP-8C-6R (Staging Compose Configuration & Model Auditor)

---

## 1. Cryptographic File Integrity at Source Commit

Every referenced backend file is byte-for-byte identical between git commit `721e731a2e4af9c9903af92a788ab52a3c21b47e` and the current working copy:

| File Path | Git Blob Hash (`git ls-tree`) | SHA-256 Digest | Bytes |
| :--- | :--- | :--- | :--- |
| `socialPulse-app/backend/Dockerfile` | `00b0884e97d6b5c4fd5462d6b3067d89486238f8` | `c21441b9c952b807ff9a157383be916099af8238ed02e90101d46103678bcf08` | 449 |
| `socialPulse-app/backend/src/server.ts` | `3e94b672b90028b9c2254223905d0db38f6bb7d4` | `3b6a045fd22e0f47b19c8c50480266124f792e09c893a1298b8f5085162331ee` | 3,629 |
| `socialPulse-app/backend/src/database/migrate.ts` | `c3902180f3f690f93af30dd0d2a8adcaaf32955c` | `644035d970349eb8e9bfa27e6a03d1851b033c2e2eb7b1b7011e1143bffd6518` | 4,182 |

---

## 2. Verifiable Code Excerpts Proving Startup Migration Immunity

### A. Backend Container Entrypoint & Cmd (`socialPulse-app/backend/Dockerfile`)
```dockerfile
# Production stage
FROM node:22-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
```
* **Finding:** The default entrypoint is `node` and the command is `dist/server.js`.
* **Finding:** Zero `HEALTHCHECK` instruction exists in the Dockerfile.
* **Finding:** No shell script, migration runner, or bootstrap wrapper is invoked by `CMD`.
* **Finding:** The production base image is `node:22-slim`. To ensure 100% executable reliability without external tool assumptions, the Compose healthcheck uses a Node-native HTTP probe (`node -e "require('http').get(...)"`) rather than relying on unproven system utilities like `wget` or `curl`.

---

### B. Server Initialization (`socialPulse-app/backend/src/server.ts`)
```typescript
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { app, allowedOrigins } from './app';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
...
const PORT = process.env.PORT || 5000;

const start = async (): Promise<void> => {
    // 1. Startup environment validation
    const envCheck = EnvironmentConfig.validateStartup();
    if (!envCheck.valid) {
        process.exit(1);
    }

    await connectDB();
...
    const server = createServer(app);
...
    server.listen(PORT, () => console.log(`SocialPulse API running on http://localhost:${PORT}`));
};

start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
```
* **Finding:** `src/server.ts` does **not** import `runMigrations` or any file from `src/database/migrate`.
* **Finding:** Line 46 calls `await connectDB()`. In `src/config/database.ts`:
  ```typescript
  export const connectDB = async (): Promise<void> => {
    const client = await pool.connect();
    client.release();
    console.log('PostgreSQL connected');
  };
  ```
  `connectDB()` merely tests client acquisition from the pool and immediately releases it. It performs zero schema DDL and queries zero migration tables.
* **Finding:** Server listens on `process.env.PORT || 5000`. When `PORT: "3000"` is provided in `docker-compose.staging.yml`, it listens on port 3000.

---

### C. Migration Runner Isolation (`socialPulse-app/backend/src/database/migrate.ts`)
```typescript
export async function runMigrations() {
    console.log('Connecting to PostgreSQL for migration runner...');
    const client = await pool.connect();
...
}

if (require.main === module) {
    runMigrations()
        .then(() => {
            pool.end();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Migration process fatal error:', err);
            pool.end();
            process.exit(1);
        });
}
```
* **Finding:** `runMigrations()` is strictly guarded by `if (require.main === module)`.
* **Finding:** It executes **only** when `node dist/database/migrate.js` is explicitly executed as the main process.

---

### D. Compose Profile Isolation & Deployment Enforcement
1. In `docker-compose.staging.yml`:
   ```yaml
   migrate:
     image: ${SOCIALPULSE_BACKEND_IMAGE:?...}
     profiles:
       - migration
     restart: "no"
     command: ["node", "dist/database/migrate.js"]
   ```
   Service `migrate` is assigned exclusively to profile `migration`.
2. In `scripts/deploy_staging.sh`:
   ```bash
   unset COMPOSE_PROFILES
   [ -z "${COMPOSE_PROFILES:-}" ] || exit 1
   docker compose up -d --no-build --pull never
   ```
   Zero `--profile` arguments are supplied, and `COMPOSE_PROFILES` is unset and verified absent.
3. **Conclusion:** During `docker compose up`, Docker Compose strictly creates and starts `postgres`, `redis`, `server`, and `client`. Service `migrate` is completely excluded, and no database migrations can occur.
