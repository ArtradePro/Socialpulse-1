const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL,
});

const tablesToFix = [
    'media_files',
    'hashtag_sets',
    'templates',
    'rss_feeds',
    'automation_rules',
    'ecommerce_products',
    'referrals',
    'campaigns',
    'posts',
    'inbox_messages'
];

async function repairSchema() {
    console.log('Starting Global Schema Repair...');
    
    for (const table of tablesToFix) {
        try {
            console.log(`Checking table: ${table}...`);
            
            // 1. Add workspace_id if missing
            await pool.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'workspace_id') THEN
                        ALTER TABLE "${table}" ADD COLUMN workspace_id UUID;
                    END IF;
                END $$;
            `);

            // 2. Add user_id if missing (safety check)
            await pool.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'user_id') THEN
                        ALTER TABLE "${table}" ADD COLUMN user_id UUID;
                    END IF;
                END $$;
            `);

            console.log(`Table ${table} is now compliant.`);
        } catch (err) {
            console.error(`Failed to repair table ${table}:`, err.message);
        }
    }
    
    console.log('Schema repair complete.');
    await pool.end();
}

repairSchema();
