import cron from 'node-cron';
import { db } from '../config/database';
import { fetchMentionsForUser } from '../controllers/inboxController';

export const initInboxJob = (): void => {
    // Sync mentions every 15 minutes for all users with connected accounts
    cron.schedule('*/15 * * * *', async () => {
        try {
            const { rows } = await db.query(
                `SELECT DISTINCT user_id FROM social_accounts WHERE is_active = true`
            );
            for (const row of rows) {
                fetchMentionsForUser(row.user_id).catch((err) =>
                    console.error(`[Inbox] sync error for ${row.user_id}:`, err)
                );
            }
        } catch (err) {
            console.error('[Inbox] cron error:', err);
        }
    });

    console.log('Unified inbox job initialized');
};
