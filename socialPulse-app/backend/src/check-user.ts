import { db } from './config/database';

async function checkUser() {
    try {
        const email = 'info@lcsh.co.za';
        const { rows } = await db.query('SELECT id, email, full_name FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            console.log(`User ${email} NOT found.`);
        } else {
            console.log('User found:', rows[0]);
        }
    } catch (err) {
        console.error('Error checking user:', err);
    } finally {
        process.exit(0);
    }
}

checkUser();
