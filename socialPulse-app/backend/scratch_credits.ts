import { db } from './src/config/database';

async function addCredits() {
  try {
    console.log('Connecting to database...');
    const result = await db.query('UPDATE users SET ai_credits = 10000');
    console.log(`Successfully added 10,000 credits to ${result.rowCount} users!`);
  } catch (error) {
    console.error('Failed to add credits:', error);
  } finally {
    process.exit(0);
  }
}

addCredits();
