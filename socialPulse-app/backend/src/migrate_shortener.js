const { db } = require('./config/database');

async function migrate() {
    try {
        console.log('Creating short_links table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS short_links (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
                long_url     TEXT NOT NULL,
                short_code   VARCHAR(20) UNIQUE NOT NULL,
                clicks       INTEGER DEFAULT 0,
                created_at   TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('Success!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

migrate();
