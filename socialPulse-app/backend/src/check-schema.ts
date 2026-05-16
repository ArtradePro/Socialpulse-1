import { db } from './config/database';

async function checkSchema() {
    try {
        const { rows } = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Users table columns:');
        rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        process.exit(0);
    }
}

checkSchema();
