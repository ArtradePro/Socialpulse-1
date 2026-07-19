const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('\n❌ Error: Missing arguments.');
  console.log('Usage: node reset-password.js <email> <new-password>');
  console.log('Example: node reset-password.js admin@example.com MySecretPassword123\n');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'socialpulse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function main() {
  console.log(`🔄 Attempting to reset password for user: ${email}...`);

  try {
    // 1. Check if user exists
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.log(`❌ Error: User with email "${email}" not found.`);
      process.exit(1);
    }

    // 2. Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 3. Update in database
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [passwordHash, email]
    );

    console.log(`✅ Success! Password for ${email} has been updated.`);
  } catch (err) {
    console.error('❌ Error updating password:', err.message);
  } finally {
    await pool.end();
  }
}

main();
