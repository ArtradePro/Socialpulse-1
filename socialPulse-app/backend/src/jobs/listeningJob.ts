import cron from 'node-cron';
import { db } from '../config/database';
import { fetchRuleResults, ListeningRuleRow } from '../controllers/listeningController';

export const initListeningJob = (): void => {
    // Poll active rules every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        try {
            const { rows } = await db.query(
                'SELECT * FROM listening_rules WHERE is_active = true'
            );
            const typedRows = rows as ListeningRuleRow[];
            for (const rule of typedRows) {
                fetchRuleResults(rule, rule.user_id).catch((err) =>
                    console.error(`[Listening] rule ${rule.id} error:`, err)
                );
            }
        } catch (err) {
            console.error('[Listening] cron error:', err);
        }
    });

    console.log('Social listening job initialized');
};
