const { db } = require('./config/database');

async function migrate() {
    try {
        console.log('Adding purchase_url to workspaces...');
        await db.query('ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS purchase_url TEXT');
        console.log('Success!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

migrate();
