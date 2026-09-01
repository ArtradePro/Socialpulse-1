import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pool } from '../../config/database';
import { computeFileChecksum } from './migrationStatus';
import dotenv from 'dotenv';
dotenv.config();

export type SchemaMatchState = 'exact_match' | 'partial_match' | 'not_present' | 'conflict' | 'manual_review_required';

export interface MigrationAdoptionPlanItem {
    migrationId: string;
    filename: string;
    checksum: string;
    schemaState: SchemaMatchState;
    eligibleForAdoption: boolean;
    reason: string;
}

export interface AdoptionPlanReport {
    timestamp: string;
    dryRun: boolean;
    ledgerExists: boolean;
    wouldCreateLedger: boolean;
    totalDiscovered: number;
    eligibleCount: number;
    refusedCount: number;
    migrations: MigrationAdoptionPlanItem[];
    blockers: string[];
    wouldMutateDatabase: boolean;
    executedMutation?: {
        ledgerCreated: boolean;
        adoptedCount: number;
        finalLedgerCount: number;
    };
}

async function verifySchemaForMigration(client: any, filename: string): Promise<{ state: SchemaMatchState; reason: string }> {
    try {
        switch (filename) {
            case '20260515_ecommerce.sql': {
                const res = await client.query(`
                    SELECT count(*) FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name IN ('ecommerce_stores', 'orders', 'products');
                `);
                const count = parseInt(res.rows[0].count, 10);
                if (count === 3) return { state: 'exact_match', reason: 'All 3 ecommerce tables present' };
                if (count > 0) return { state: 'partial_match', reason: `Only ${count}/3 ecommerce tables present` };
                return { state: 'not_present', reason: 'Ecommerce tables not found' };
            }
            case '20260515_ecommerce_add_seller_id.sql': {
                const res = await client.query(`
                    SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'seller_id';
                `);
                const present = parseInt(res.rows[0].count, 10) > 0;
                return present
                    ? { state: 'exact_match', reason: 'Column orders.seller_id present' }
                    : { state: 'not_present', reason: 'Column orders.seller_id not found' };
            }
            case '20260522_add_workspace_id_to_missing_tables.sql': {
                const res = await client.query(`
                    SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name IN ('api_keys', 'media_files') AND column_name = 'workspace_id';
                `);
                const count = parseInt(res.rows[0].count, 10);
                if (count === 2) return { state: 'exact_match', reason: 'workspace_id present on target tables' };
                if (count > 0) return { state: 'partial_match', reason: 'workspace_id partially present' };
                return { state: 'not_present', reason: 'workspace_id columns not found' };
            }
            case '20260613_paid_ads.sql': {
                const res = await client.query(`
                    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ad_campaigns');
                `);
                return res.rows[0].exists
                    ? { state: 'exact_match', reason: 'Table ad_campaigns present' }
                    : { state: 'not_present', reason: 'Table ad_campaigns not found' };
            }
            case '20260613_sales_pages.sql': {
                const res = await client.query(`
                    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_pages');
                `);
                return res.rows[0].exists
                    ? { state: 'exact_match', reason: 'Table sales_pages present' }
                    : { state: 'not_present', reason: 'Table sales_pages not found' };
            }
            case '20260613_zeely_expansion.sql': {
                const res = await client.query(`
                    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'generated_videos');
                `);
                return res.rows[0].exists
                    ? { state: 'exact_match', reason: 'Table generated_videos present' }
                    : { state: 'not_present', reason: 'Table generated_videos not found' };
            }
            case '20260614_add_product_info_to_workspaces.sql': {
                const res = await client.query(`
                    SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name IN ('brand_type', 'product_name');
                `);
                const count = parseInt(res.rows[0].count, 10);
                if (count >= 1) return { state: 'exact_match', reason: 'Workspace brand/product columns present' };
                return { state: 'not_present', reason: 'Workspace product columns not found' };
            }
            case '20260717_omnichannel_marketing.sql': {
                const res = await client.query(`
                    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_campaigns');
                `);
                return res.rows[0].exists
                    ? { state: 'exact_match', reason: 'Table marketing_campaigns present' }
                    : { state: 'not_present', reason: 'Table marketing_campaigns not found' };
            }
            case '20260830_add_unique_stripe_session_id.sql': {
                const res = await client.query(`
                    SELECT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = 'public' AND tablename = 'orders' AND indexname LIKE '%stripe_session%'
                    );
                `);
                return res.rows[0].exists
                    ? { state: 'exact_match', reason: 'Unique Stripe session index present on orders' }
                    : { state: 'not_present', reason: 'Stripe unique index not present on orders' };
            }
            case '20260831_claims_library_and_brand_governance.sql': {
                const res = await client.query(`
                    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'claims_library');
                `);
                return res.rows[0].exists
                    ? { state: 'exact_match', reason: 'Table claims_library present' }
                    : { state: 'not_present', reason: 'Table claims_library not found' };
            }
            case '20260831_evergreen_integration_and_suppression.sql': {
                const res = await client.query(`
                    SELECT count(*) FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name IN ('evergreen_inbound_events', 'marketing_suppression_list');
                `);
                const count = parseInt(res.rows[0].count, 10);
                if (count === 2) return { state: 'exact_match', reason: 'Evergreen and suppression tables present' };
                if (count > 0) return { state: 'partial_match', reason: `Only ${count}/2 tables present` };
                return { state: 'not_present', reason: 'Evergreen tables not found' };
            }
            case '20260831_omnisend_and_q2c_sync.sql': {
                const res = await client.query(`
                    SELECT count(*) FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name IN ('omnisend_settings', 'q2c_sync_logs');
                `);
                const count = parseInt(res.rows[0].count, 10);
                if (count === 2) return { state: 'exact_match', reason: 'Omnisend and Q2C sync tables present' };
                if (count > 0) return { state: 'partial_match', reason: `Only ${count}/2 tables present` };
                return { state: 'not_present', reason: 'Omnisend/Q2C tables not found' };
            }
            default:
                return { state: 'manual_review_required', reason: 'No automated verification rule for migration' };
        }
    } catch (err: any) {
        return { state: 'conflict', reason: `Verification query error: ${err.message}` };
    }
}

export async function adoptLedger(options: { dryRun?: boolean; confirm?: boolean } = { dryRun: true }, customPool?: any): Promise<AdoptionPlanReport> {
    const isDryRun = options.confirm !== true;
    const migrationsDir = join(__dirname, '../migrations');
    const files = existsSync(migrationsDir)
        ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
        : [];

    const blockers: string[] = [];

    if (!isDryRun && process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_LEDGER_ADOPTION !== 'true') {
        blockers.push('PRODUCTION_ADOPTION_PROHIBITED: Ledger adoption in production requires ALLOW_PRODUCTION_LEDGER_ADOPTION=true');
    }

    const activePool = customPool || pool;
    const client = await activePool.connect();
    let ledgerExists = false;
    const planItems: MigrationAdoptionPlanItem[] = [];

    try {
        // Check if ledger table already exists
        const ledgerCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'schema_migrations'
            );
        `);
        ledgerExists = Boolean(ledgerCheck.rows[0]?.exists);

        for (const file of files) {
            const content = readFileSync(join(migrationsDir, file), 'utf-8');
            const checksum = computeFileChecksum(content);
            const migrationId = file.replace(/\.sql$/, '');

            const schemaCheck = await verifySchemaForMigration(client, file);
            const isEligible = schemaCheck.state === 'exact_match';

            planItems.push({
                migrationId,
                filename: file,
                checksum,
                schemaState: schemaCheck.state,
                eligibleForAdoption: isEligible,
                reason: schemaCheck.reason
            });
        }

        const eligibleItems = planItems.filter((i) => i.eligibleForAdoption);
        const refusedItems = planItems.filter((i) => !i.eligibleForAdoption);

        let executedMutation: { ledgerCreated: boolean; adoptedCount: number; finalLedgerCount: number } | undefined;

        if (!isDryRun && blockers.length === 0) {
            // Transactional execution of metadata schema creation & adoption insertion
            await client.query('BEGIN');
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        id SERIAL PRIMARY KEY,
                        migration_id VARCHAR(255) UNIQUE NOT NULL,
                        filename VARCHAR(255) NOT NULL,
                        checksum VARCHAR(64) NOT NULL,
                        applied_at TIMESTAMPTZ DEFAULT NOW(),
                        execution_time_ms INTEGER,
                        application_mode VARCHAR(32) NOT NULL DEFAULT 'executed'
                    );
                `);

                let adoptedCount = 0;
                for (const item of eligibleItems) {
                    await client.query(`
                        INSERT INTO schema_migrations (migration_id, filename, checksum, application_mode)
                        VALUES ($1, $2, $3, 'adopted')
                        ON CONFLICT (migration_id) DO NOTHING;
                    `, [item.migrationId, item.filename, item.checksum]);
                    adoptedCount++;
                }

                const countRes = await client.query(`SELECT count(*) FROM schema_migrations;`);
                const finalCount = parseInt(countRes.rows[0].count, 10);

                await client.query('COMMIT');

                executedMutation = {
                    ledgerCreated: !ledgerExists,
                    adoptedCount,
                    finalLedgerCount: finalCount
                };
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }

        return {
            timestamp: new Date().toISOString(),
            dryRun: isDryRun,
            ledgerExists,
            wouldCreateLedger: !ledgerExists,
            totalDiscovered: files.length,
            eligibleCount: eligibleItems.length,
            refusedCount: refusedItems.length,
            migrations: planItems,
            blockers,
            wouldMutateDatabase: !isDryRun && blockers.length === 0,
            executedMutation
        };
    } finally {
        client.release();
    }
}

if (require.main === module) {
    const confirm = process.argv.includes('--confirm');
    adoptLedger({ confirm })
        .then((res) => {
            console.log('\n--- MIGRATION LEDGER ADOPTION PLAN REPORT ---');
            console.log(JSON.stringify(res, null, 2));
            pool.end();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Adoption plan failed:', err);
            pool.end();
            process.exit(1);
        });
}
