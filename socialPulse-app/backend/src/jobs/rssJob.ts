import cron from 'node-cron';
import { db } from '../config/database';
import { fetchAndStoreFeedEntries, RssFeedRow } from '../controllers/rssController';

export const initRssJob = (): void => {
    // Run every hour — each feed tracks its own interval_hours via last_fetched_at
    cron.schedule('0 * * * *', async () => {
        try {
            const { rows } = await db.query(
                `SELECT * FROM rss_feeds
                 WHERE is_active = true
                   AND (last_fetched_at IS NULL
                        OR last_fetched_at < NOW() - (interval_hours || ' hours')::INTERVAL)`
            );
            const feeds = rows as RssFeedRow[];

            for (const feed of feeds) {
                fetchAndStoreFeedEntries(feed).catch((err) =>
                    console.error(`[RSS] feed ${feed.id} fetch error:`, err)
                );
            }
        } catch (err) {
            console.error('[RSS] cron error:', err);
        }
    });

    console.log('RSS auto-posting job initialized');
};
