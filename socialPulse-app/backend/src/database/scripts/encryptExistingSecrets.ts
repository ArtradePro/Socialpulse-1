import { db, pool } from '../../config/database';
import {
    encryptSecret,
    isEncryptedEnvelope,
    getSalesPageStripeKeyAAD,
    decryptSecretEnvelope
} from '../../utils/crypto';

export interface MigrationSummary {
    totalRecords: number;
    nullOrEmptyCount: number;
    alreadyEncryptedCount: number;
    legacyPlaintextCount: number;
    malformedEncryptedCount: number;
    migratedCount: number;
    failedCount: number;
    isDryRun: boolean;
    errorCode?: string;
}

export interface MigrationOptions {
    apply?: boolean;
    batchSize?: number;
}

/**
 * Offline migration utility for sales_pages.stripe_secret_key.
 * Defaults to dry-run (zero writes).
 * Enforces strict keyset batching and optimistic concurrency control (compare-and-swap).
 * Strictly prohibited in production in SP-1D-R1 under all circumstances.
 * Never logs or returns plaintext secrets or encryption keys.
 */
export async function migrateSalesPageSecrets(options: MigrationOptions = {}): Promise<MigrationSummary> {
    const isApply = Boolean(options.apply || process.argv.includes('--apply'));
    const isDryRun = !isApply;
    const batchSize = Math.max(1, Math.min(options.batchSize || 50, 500));

    const summary: MigrationSummary = {
        totalRecords: 0,
        nullOrEmptyCount: 0,
        alreadyEncryptedCount: 0,
        legacyPlaintextCount: 0,
        malformedEncryptedCount: 0,
        migratedCount: 0,
        failedCount: 0,
        isDryRun,
    };

    // Strict Production Prohibition: Zero environment-variable bypasses permitted in SP-1D-R1
    if (process.env.NODE_ENV === 'production') {
        summary.errorCode = 'PRODUCTION_MIGRATION_PROHIBITED';
        return summary;
    }

    if (isApply) {
        if (process.env.ALLOW_SECRET_MIGRATION !== 'true') {
            summary.errorCode = 'MIGRATION_NOT_AUTHORIZED';
            return summary;
        }
    }

    try {
        let lastId: string | null = null;
        let hasMore = true;

        while (hasMore) {
            let rows: Array<{ id: string; workspace_id: string; stripe_secret_key: string | null }>;

            if (lastId === null) {
                const queryRes = await db.query(
                    `SELECT id, workspace_id, stripe_secret_key
                     FROM sales_pages
                     ORDER BY id ASC
                     LIMIT $1`,
                    [batchSize]
                );
                rows = queryRes.rows;
            } else {
                const queryRes = await db.query(
                    `SELECT id, workspace_id, stripe_secret_key
                     FROM sales_pages
                     WHERE id > $1
                     ORDER BY id ASC
                     LIMIT $2`,
                    [lastId, batchSize]
                );
                rows = queryRes.rows;
            }

            if (rows.length === 0) {
                hasMore = false;
                break;
            }

            summary.totalRecords += rows.length;
            lastId = rows[rows.length - 1].id;

            const recordsToMigrateInBatch: Array<{
                id: string;
                workspaceId: string;
                originalPlaintext: string;
            }> = [];

            for (const row of rows) {
                const rawVal = row.stripe_secret_key;
                if (!rawVal || (typeof rawVal === 'string' && rawVal.trim().length === 0)) {
                    summary.nullOrEmptyCount++;
                    continue;
                }

                if (typeof rawVal === 'string' && rawVal.startsWith('enc:')) {
                    if (isEncryptedEnvelope(rawVal)) {
                        // Validate envelope integrity against canonical AAD
                        try {
                            const aad = getSalesPageStripeKeyAAD(row.workspace_id);
                            decryptSecretEnvelope(rawVal, aad);
                            summary.alreadyEncryptedCount++;
                        } catch {
                            summary.malformedEncryptedCount++;
                            summary.failedCount++;
                        }
                    } else {
                        summary.malformedEncryptedCount++;
                        summary.failedCount++;
                    }
                    continue;
                }

                // Legacy plaintext record
                summary.legacyPlaintextCount++;
                recordsToMigrateInBatch.push({
                    id: row.id,
                    workspaceId: row.workspace_id,
                    originalPlaintext: rawVal,
                });
            }

            // Stop immediately on malformed envelope detection
            if (summary.malformedEncryptedCount > 0) {
                summary.errorCode = 'MALFORMED_ENVELOPE_DETECTED';
                return summary;
            }

            // In apply mode, execute batch transactional compare-and-swap
            if (isApply && recordsToMigrateInBatch.length > 0) {
                const client = await pool.connect();
                let batchMigrated = 0;

                try {
                    await client.query('BEGIN');

                    for (const item of recordsToMigrateInBatch) {
                        const aad = getSalesPageStripeKeyAAD(item.workspaceId);
                        const ciphertext = encryptSecret(item.originalPlaintext.trim(), aad);

                        // Compare-and-swap: strictly match original stored value to prevent stale overwrites
                        const updateRes = await client.query(
                            `UPDATE sales_pages
                             SET stripe_secret_key = $1, updated_at = NOW()
                             WHERE id = $2 AND workspace_id = $3 AND stripe_secret_key = $4`,
                            [ciphertext, item.id, item.workspaceId, item.originalPlaintext]
                        );

                        if (updateRes.rowCount !== 1) {
                            throw new Error('CONCURRENT_UPDATE_DETECTED');
                        }

                        batchMigrated++;
                    }

                    await client.query('COMMIT');
                    // Increment migrated count only after successful commit
                    summary.migratedCount += batchMigrated;
                } catch (batchErr: any) {
                    await client.query('ROLLBACK');
                    summary.failedCount += recordsToMigrateInBatch.length;
                    summary.errorCode = batchErr.message === 'CONCURRENT_UPDATE_DETECTED'
                        ? 'CONCURRENT_UPDATE_DETECTED'
                        : 'BATCH_UPDATE_FAILED';
                    return summary;
                } finally {
                    client.release();
                }
            }

            if (rows.length < batchSize) {
                hasMore = false;
            }
        }

        return summary;
    } catch (err: any) {
        summary.errorCode = 'MIGRATION_EXECUTION_FAILED';
        return summary;
    }
}

// CLI runner
if (require.main === module) {
    migrateSalesPageSecrets()
        .then((result) => {
            console.log(JSON.stringify({
                status: result.errorCode ? 'FAILED' : 'SUCCESS',
                isDryRun: result.isDryRun,
                totalRecords: result.totalRecords,
                nullOrEmptyCount: result.nullOrEmptyCount,
                alreadyEncryptedCount: result.alreadyEncryptedCount,
                legacyPlaintextCount: result.legacyPlaintextCount,
                malformedEncryptedCount: result.malformedEncryptedCount,
                migratedCount: result.migratedCount,
                failedCount: result.failedCount,
                errorCode: result.errorCode || null,
            }, null, 2));
            process.exit(result.errorCode ? 1 : 0);
        })
        .catch(() => {
            console.error(JSON.stringify({ status: 'FATAL_ERROR', code: 'MIGRATION_FATAL' }));
            process.exit(1);
        });
}
