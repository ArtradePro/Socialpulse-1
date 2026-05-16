import { db } from './config/database';

async function checkWorkspaces() {
    try {
        const { rows } = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'workspaces'
        `);
        console.log('Workspaces table columns:');
        rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        process.exit(0);
    }
}

checkWorkspaces();
