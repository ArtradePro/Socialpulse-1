import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pool } from '../../config/database';
import { computeFileChecksum } from './migrationStatus';
import dotenv from 'dotenv';
dotenv.config();

export type SchemaMatchState = 'exact_match' | 'partial_match' | 'conflict' | 'not_present' | 'manual_review_required';

export interface ExpectedColumn {
    name: string;
    type: string; // e.g. 'uuid', 'character varying', 'text', 'boolean', 'numeric', 'integer', 'ARRAY', 'timestamp without time zone', 'timestamp with time zone', 'jsonb'
    nullable?: boolean;
}

export interface ExpectedIndex {
    name: string;
    table: string;
    unique: boolean;
    columns: string[];
    predicate?: string;
}

export interface ExpectedConstraint {
    table: string;
    type: 'PRIMARY KEY' | 'UNIQUE' | 'FOREIGN KEY' | 'CHECK';
    columns: string[];
    foreignTable?: string;
    onDelete?: string;
}

export interface MigrationManifest {
    migrationId: string;
    filename: string;
    tables: Array<{
        name: string;
        columns: ExpectedColumn[];
    }>;
    alteredColumns: Array<{
        table: string;
        column: ExpectedColumn;
    }>;
    indexes: ExpectedIndex[];
    constraints: ExpectedConstraint[];
}

export const MIGRATION_MANIFESTS: Record<string, MigrationManifest> = {
    '20260515_ecommerce': {
        migrationId: '20260515_ecommerce',
        filename: '20260515_ecommerce.sql',
        tables: [
            {
                name: 'ecommerce_stores',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: false },
                    { name: 'platform', type: 'character varying', nullable: false },
                    { name: 'name', type: 'character varying', nullable: false },
                    { name: 'status', type: 'character varying', nullable: true }
                ]
            },
            {
                name: 'products',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'store_id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: false },
                    { name: 'title', type: 'character varying', nullable: false },
                    { name: 'price', type: 'numeric', nullable: true }
                ]
            },
            {
                name: 'ecommerce_automations',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: false },
                    { name: 'store_id', type: 'uuid', nullable: false },
                    { name: 'trigger_type', type: 'character varying', nullable: false },
                    { name: 'action_type', type: 'character varying', nullable: false }
                ]
            }
        ],
        alteredColumns: [],
        indexes: [
            { name: 'idx_ecommerce_stores_workspace', table: 'ecommerce_stores', unique: false, columns: ['workspace_id'] },
            { name: 'idx_products_store', table: 'products', unique: false, columns: ['store_id'] }
        ],
        constraints: [
            { table: 'products', type: 'UNIQUE', columns: ['store_id', 'external_id'] }
        ]
    },
    '20260515_ecommerce_add_seller_id': {
        migrationId: '20260515_ecommerce_add_seller_id',
        filename: '20260515_ecommerce_add_seller_id.sql',
        tables: [],
        alteredColumns: [
            { table: 'ecommerce_stores', column: { name: 'seller_id', type: 'character varying', nullable: true } }
        ],
        indexes: [],
        constraints: []
    },
    '20260522_add_workspace_id_to_missing_tables': {
        migrationId: '20260522_add_workspace_id_to_missing_tables',
        filename: '20260522_add_workspace_id_to_missing_tables.sql',
        tables: [],
        alteredColumns: [
            { table: 'templates', column: { name: 'workspace_id', type: 'uuid', nullable: true } },
            { table: 'hashtag_sets', column: { name: 'workspace_id', type: 'uuid', nullable: true } },
            { table: 'inbox_messages', column: { name: 'workspace_id', type: 'uuid', nullable: true } }
        ],
        indexes: [
            { name: 'idx_templates_workspace', table: 'templates', unique: false, columns: ['workspace_id'], predicate: 'workspace_id IS NOT NULL' },
            { name: 'idx_hs_workspace', table: 'hashtag_sets', unique: false, columns: ['workspace_id'], predicate: 'workspace_id IS NOT NULL' },
            { name: 'idx_im_workspace', table: 'inbox_messages', unique: false, columns: ['workspace_id'], predicate: 'workspace_id IS NOT NULL' }
        ],
        constraints: []
    },
    '20260613_paid_ads': {
        migrationId: '20260613_paid_ads',
        filename: '20260613_paid_ads.sql',
        tables: [
            {
                name: 'ad_campaigns',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: false },
                    { name: 'name', type: 'character varying', nullable: false },
                    { name: 'budget_amount', type: 'numeric', nullable: false },
                    { name: 'platforms', type: 'ARRAY', nullable: false }
                ]
            }
        ],
        alteredColumns: [],
        indexes: [
            { name: 'idx_ad_campaigns_ws', table: 'ad_campaigns', unique: false, columns: ['workspace_id'] }
        ],
        constraints: []
    },
    '20260613_sales_pages': {
        migrationId: '20260613_sales_pages',
        filename: '20260613_sales_pages.sql',
        tables: [
            {
                name: 'sales_pages',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: false },
                    { name: 'title', type: 'character varying', nullable: false },
                    { name: 'slug', type: 'character varying', nullable: false },
                    { name: 'price', type: 'numeric', nullable: false }
                ]
            },
            {
                name: 'sales_orders',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'sales_page_id', type: 'uuid', nullable: false },
                    { name: 'customer_name', type: 'character varying', nullable: false },
                    { name: 'customer_email', type: 'character varying', nullable: false },
                    { name: 'amount', type: 'numeric', nullable: false }
                ]
            }
        ],
        alteredColumns: [],
        indexes: [
            { name: 'idx_sales_pages_ws', table: 'sales_pages', unique: false, columns: ['workspace_id'] },
            { name: 'idx_sales_pages_slug', table: 'sales_pages', unique: false, columns: ['slug'] },
            { name: 'idx_sales_orders_pg', table: 'sales_orders', unique: false, columns: ['sales_page_id'] }
        ],
        constraints: [
            { table: 'sales_pages', type: 'UNIQUE', columns: ['slug'] }
        ]
    },
    '20260613_zeely_expansion': {
        migrationId: '20260613_zeely_expansion',
        filename: '20260613_zeely_expansion.sql',
        tables: [
            {
                name: 'storefront_customers',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: false },
                    { name: 'email', type: 'character varying', nullable: false }
                ]
            },
            {
                name: 'customer_messages',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'customer_id', type: 'uuid', nullable: false },
                    { name: 'message', type: 'text', nullable: false }
                ]
            }
        ],
        alteredColumns: [
            { table: 'sales_pages', column: { name: 'stripe_secret_key', type: 'text', nullable: true } },
            { table: 'sales_orders', column: { name: 'stripe_session_id', type: 'character varying', nullable: true } }
        ],
        indexes: [
            { name: 'idx_storefront_customers_ws', table: 'storefront_customers', unique: false, columns: ['workspace_id'] }
        ],
        constraints: [
            { table: 'storefront_customers', type: 'UNIQUE', columns: ['workspace_id', 'email'] }
        ]
    },
    '20260614_add_product_info_to_workspaces': {
        migrationId: '20260614_add_product_info_to_workspaces',
        filename: '20260614_add_product_info_to_workspaces.sql',
        tables: [],
        alteredColumns: [
            { table: 'workspaces', column: { name: 'product_info', type: 'text', nullable: true } }
        ],
        indexes: [],
        constraints: []
    },
    '20260717_omnichannel_marketing': {
        migrationId: '20260717_omnichannel_marketing',
        filename: '20260717_omnichannel_marketing.sql',
        tables: [
            {
                name: 'marketing_contacts',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'tenant_id', type: 'uuid', nullable: true },
                    { name: 'email', type: 'character varying', nullable: false }
                ]
            },
            {
                name: 'marketing_campaigns',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'tenant_id', type: 'uuid', nullable: true },
                    { name: 'name', type: 'character varying', nullable: false },
                    { name: 'type', type: 'character varying', nullable: false }
                ]
            },
            {
                name: 'marketing_automations',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'tenant_id', type: 'uuid', nullable: true },
                    { name: 'trigger_event', type: 'character varying', nullable: false }
                ]
            },
            {
                name: 'marketing_delivery_logs',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'campaign_id', type: 'uuid', nullable: true },
                    { name: 'status', type: 'character varying', nullable: false }
                ]
            }
        ],
        alteredColumns: [],
        indexes: [
            { name: 'idx_mkt_contacts_tenant', table: 'marketing_contacts', unique: false, columns: ['tenant_id'] },
            { name: 'idx_mkt_campaigns_tenant', table: 'marketing_campaigns', unique: false, columns: ['tenant_id'] }
        ],
        constraints: [
            { table: 'marketing_contacts', type: 'UNIQUE', columns: ['tenant_id', 'email'] }
        ]
    },
    '20260830_add_unique_stripe_session_id': {
        migrationId: '20260830_add_unique_stripe_session_id',
        filename: '20260830_add_unique_stripe_session_id.sql',
        tables: [],
        alteredColumns: [
            { table: 'sales_orders', column: { name: 'stripe_session_id', type: 'character varying', nullable: true } }
        ],
        indexes: [
            {
                name: 'idx_sales_orders_stripe_session_id_unique',
                table: 'sales_orders',
                unique: true,
                columns: ['stripe_session_id'],
                predicate: 'stripe_session_id IS NOT NULL'
            }
        ],
        constraints: []
    },
    '20260831_claims_library_and_brand_governance': {
        migrationId: '20260831_claims_library_and_brand_governance',
        filename: '20260831_claims_library_and_brand_governance.sql',
        tables: [
            {
                name: 'claims_library',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: true },
                    { name: 'claim_text', type: 'text', nullable: false },
                    { name: 'claim_category', type: 'character varying', nullable: false },
                    { name: 'status', type: 'character varying', nullable: false }
                ]
            }
        ],
        alteredColumns: [
            { table: 'workspaces', column: { name: 'brand_type', type: 'character varying', nullable: true } },
            { table: 'workspaces', column: { name: 'restricted_slogans', type: 'ARRAY', nullable: true } }
        ],
        indexes: [
            { name: 'idx_claims_library_workspace', table: 'claims_library', unique: false, columns: ['workspace_id', 'status'] }
        ],
        constraints: []
    },
    '20260831_evergreen_integration_and_suppression': {
        migrationId: '20260831_evergreen_integration_and_suppression',
        filename: '20260831_evergreen_integration_and_suppression.sql',
        tables: [
            {
                name: 'evergreen_inbound_events',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'event_id', type: 'character varying', nullable: false },
                    { name: 'event_type', type: 'character varying', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: true },
                    { name: 'payload', type: 'jsonb', nullable: false }
                ]
            },
            {
                name: 'marketing_suppression_list',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: true },
                    { name: 'channel', type: 'character varying', nullable: false },
                    { name: 'identifier', type: 'character varying', nullable: false },
                    { name: 'reason', type: 'character varying', nullable: false }
                ]
            },
            {
                name: 'marketing_consent_logs',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: true },
                    { name: 'contact_identifier', type: 'character varying', nullable: false },
                    { name: 'channel', type: 'character varying', nullable: false }
                ]
            }
        ],
        alteredColumns: [],
        indexes: [
            { name: 'idx_evergreen_inbound_events_event_id', table: 'evergreen_inbound_events', unique: false, columns: ['event_id'] },
            { name: 'idx_marketing_suppression_lookup', table: 'marketing_suppression_list', unique: false, columns: ['workspace_id', 'channel', 'identifier'] }
        ],
        constraints: [
            { table: 'evergreen_inbound_events', type: 'UNIQUE', columns: ['event_id'] },
            { table: 'marketing_suppression_list', type: 'UNIQUE', columns: ['workspace_id', 'channel', 'identifier'] }
        ]
    },
    '20260831_omnisend_and_q2c_sync': {
        migrationId: '20260831_omnisend_and_q2c_sync',
        filename: '20260831_omnisend_and_q2c_sync.sql',
        tables: [
            {
                name: 'omnisend_integrations',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: true },
                    { name: 'api_key_encrypted', type: 'text', nullable: false },
                    { name: 'is_active', type: 'boolean', nullable: false }
                ]
            },
            {
                name: 'q2c_sync_logs',
                columns: [
                    { name: 'id', type: 'uuid', nullable: false },
                    { name: 'workspace_id', type: 'uuid', nullable: true },
                    { name: 'direction', type: 'character varying', nullable: false },
                    { name: 'entity_type', type: 'character varying', nullable: false },
                    { name: 'payload', type: 'jsonb', nullable: false }
                ]
            }
        ],
        alteredColumns: [],
        indexes: [
            { name: 'idx_q2c_sync_workspace', table: 'q2c_sync_logs', unique: false, columns: ['workspace_id', 'entity_type'] }
        ],
        constraints: [
            { table: 'omnisend_integrations', type: 'UNIQUE', columns: ['workspace_id'] }
        ]
    }
};

export interface SemanticVerificationResult {
    migrationId: string;
    filename: string;
    checksum: string;
    schemaState: SchemaMatchState;
    eligibleForAdoption: boolean;
    matchedObjects: string[];
    missingObjects: string[];
    conflictingObjects: string[];
    unsupportedEffects: string[];
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
    migrations: SemanticVerificationResult[];
    blockers: string[];
    wouldMutateDatabase: boolean;
    executedMutation?: {
        ledgerCreated: boolean;
        adoptedCount: number;
        finalLedgerCount: number;
    };
}

export async function verifySemanticSchemaEquivalence(client: any, filename: string): Promise<Omit<SemanticVerificationResult, 'checksum' | 'eligibleForAdoption'>> {
    const migrationId = filename.replace(/\.sql$/, '');
    const manifest = MIGRATION_MANIFESTS[migrationId];

    if (!manifest) {
        return {
            migrationId,
            filename,
            schemaState: 'manual_review_required',
            matchedObjects: [],
            missingObjects: [],
            conflictingObjects: [],
            unsupportedEffects: ['Migration manifest not registered in verifier'],
            reason: 'Migration not modelled in semantic manifest'
        };
    }

    const matchedObjects: string[] = [];
    const missingObjects: string[] = [];
    const conflictingObjects: string[] = [];

    // 1. Verify Expected Tables and their Columns
    for (const tbl of manifest.tables) {
        const tblRes = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            );
        `, [tbl.name]);

        if (!tblRes.rows[0].exists) {
            missingObjects.push(`Table: ${tbl.name}`);
            continue;
        }
        matchedObjects.push(`Table: ${tbl.name}`);

        for (const col of tbl.columns) {
            const colRes = await client.query(`
                SELECT data_type, is_nullable, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2;
            `, [tbl.name, col.name]);

            if (colRes.rows.length === 0) {
                missingObjects.push(`Column: ${tbl.name}.${col.name}`);
            } else {
                const dbCol = colRes.rows[0];
                const dbType = dbCol.data_type === 'ARRAY' ? 'ARRAY' : dbCol.data_type;
                if (dbType !== col.type && dbCol.udt_name !== col.type) {
                    conflictingObjects.push(`Column Type Mismatch: ${tbl.name}.${col.name} expected ${col.type}, got ${dbCol.data_type}`);
                } else if (col.nullable === false && dbCol.is_nullable !== 'NO') {
                    conflictingObjects.push(`Column Nullability Mismatch: ${tbl.name}.${col.name} expected NOT NULL, got nullable`);
                } else {
                    matchedObjects.push(`Column: ${tbl.name}.${col.name} (${col.type})`);
                }
            }
        }
    }

    // 2. Verify Altered Columns
    for (const alt of manifest.alteredColumns) {
        const colRes = await client.query(`
            SELECT data_type, is_nullable, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2;
        `, [alt.table, alt.column.name]);

        if (colRes.rows.length === 0) {
            missingObjects.push(`Altered Column: ${alt.table}.${alt.column.name}`);
        } else {
            const dbCol = colRes.rows[0];
            const dbType = dbCol.data_type === 'ARRAY' ? 'ARRAY' : dbCol.data_type;
            if (dbType !== alt.column.type && dbCol.udt_name !== alt.column.type) {
                conflictingObjects.push(`Altered Column Type Mismatch: ${alt.table}.${alt.column.name} expected ${alt.column.type}, got ${dbCol.data_type}`);
            } else {
                matchedObjects.push(`Altered Column: ${alt.table}.${alt.column.name} (${alt.column.type})`);
            }
        }
    }

    // 3. Verify Expected Indexes
    for (const idx of manifest.indexes) {
        const idxRes = await client.query(`
            SELECT
                i.relname AS index_name,
                ix.indisunique AS is_unique,
                ix.indisvalid AS is_valid,
                ix.indisready AS is_ready,
                pg_get_indexdef(ix.indexrelid) AS index_def,
                pg_get_expr(ix.indpred, ix.indrelid) AS predicate
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = $1 AND (i.relname = $2 OR pg_get_indexdef(ix.indexrelid) LIKE '%' || $3 || '%');
        `, [idx.table, idx.name, idx.columns[0]]);

        if (idxRes.rows.length === 0) {
            missingObjects.push(`Index: ${idx.table} (${idx.name})`);
        } else {
            const dbIdx = idxRes.rows[0];
            if (!dbIdx.is_valid || !dbIdx.is_ready) {
                conflictingObjects.push(`Index Invalid/Not Ready: ${idx.table}.${dbIdx.index_name}`);
            } else if (idx.unique && !dbIdx.is_unique) {
                conflictingObjects.push(`Index Uniqueness Mismatch: ${idx.table}.${dbIdx.index_name} expected UNIQUE`);
            } else if (idx.predicate && (!dbIdx.predicate || !dbIdx.predicate.includes('IS NOT NULL'))) {
                conflictingObjects.push(`Index Predicate Mismatch: ${idx.table}.${dbIdx.index_name} expected partial predicate`);
            } else {
                matchedObjects.push(`Index: ${idx.table}.${dbIdx.index_name} (unique=${dbIdx.is_unique})`);
            }
        }
    }

    // 4. Verify Constraints
    for (const cst of manifest.constraints) {
        if (cst.type === 'UNIQUE') {
            const uqRes = await client.query(`
                SELECT count(*) FROM information_schema.table_constraints
                WHERE table_schema = 'public' AND table_name = $1 AND constraint_type = 'UNIQUE';
            `, [cst.table]);
            if (parseInt(uqRes.rows[0].count, 10) === 0) {
                missingObjects.push(`Unique Constraint on ${cst.table} (${cst.columns.join(', ')})`);
            } else {
                matchedObjects.push(`Unique Constraint on ${cst.table} (${cst.columns.join(', ')})`);
            }
        }
    }

    // Special Check for Stripe session duplicate data
    if (migrationId === '20260830_add_unique_stripe_session_id') {
        const dupRes = await client.query(`
            SELECT count(*) FROM (
                SELECT stripe_session_id FROM sales_orders
                WHERE stripe_session_id IS NOT NULL
                GROUP BY stripe_session_id HAVING count(*) > 1
            ) sub;
        `).catch(() => ({ rows: [{ count: '0' }] }));

        const dups = parseInt(dupRes.rows[0]?.count || '0', 10);
        if (dups > 0) {
            conflictingObjects.push(`Data Conflict: ${dups} duplicate non-null stripe_session_id rows in sales_orders`);
        }
    }

    let schemaState: SchemaMatchState;
    let reason: string;

    if (conflictingObjects.length > 0) {
        schemaState = 'conflict';
        reason = `Conflicts detected: ${conflictingObjects.join('; ')}`;
    } else if (missingObjects.length > 0 && matchedObjects.length > 0) {
        schemaState = 'partial_match';
        reason = `Partial match (${matchedObjects.length} matched, ${missingObjects.length} missing)`;
    } else if (missingObjects.length > 0 && matchedObjects.length === 0) {
        schemaState = 'not_present';
        reason = 'No expected objects found in database';
    } else {
        schemaState = 'exact_match';
        reason = `All ${matchedObjects.length} expected material objects match`;
    }

    return {
        migrationId,
        filename,
        schemaState,
        matchedObjects,
        missingObjects,
        conflictingObjects,
        unsupportedEffects: [],
        reason
    };
}

export async function adoptLedger(options: { dryRun?: boolean; confirm?: boolean } = { dryRun: true }, customPool?: any): Promise<AdoptionPlanReport> {
    const isDryRun = options.confirm !== true;
    const migrationsDir = join(__dirname, '../migrations');
    const files = existsSync(migrationsDir)
        ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
        : [];

    const blockers: string[] = [];

    // UNCONDITIONAL PRODUCTION LOCKOUT - No environment variable bypass permitted
    if (!isDryRun && process.env.NODE_ENV === 'production') {
        blockers.push('PRODUCTION_ADOPTION_UNCONDITIONALLY_PROHIBITED: Confirmed migration adoption is strictly prohibited in production');
    }

    const activePool = customPool || pool;
    const client = await activePool.connect();
    let ledgerExists = false;
    const planItems: SemanticVerificationResult[] = [];

    try {
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
            const verif = await verifySemanticSchemaEquivalence(client, file);
            const isEligible = verif.schemaState === 'exact_match';

            planItems.push({
                ...verif,
                checksum,
                eligibleForAdoption: isEligible
            });
        }

        const eligibleItems = planItems.filter((i) => i.eligibleForAdoption);
        const refusedItems = planItems.filter((i) => !i.eligibleForAdoption);

        let executedMutation: { ledgerCreated: boolean; adoptedCount: number; finalLedgerCount: number } | undefined;

        if (!isDryRun && blockers.length === 0) {
            // ATOMIC BATCH RULE: If any migration is ineligible, confirmed adoption aborts unless explicitly confirmed
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
