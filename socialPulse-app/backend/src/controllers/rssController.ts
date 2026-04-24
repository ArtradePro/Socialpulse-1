import { Request, Response } from 'express';
import Parser from 'rss-parser';
import { db } from '../config/database';

const parser = new Parser({ timeout: 10000 });

export const listFeeds = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            `SELECT f.*,
                    COUNT(e.id) FILTER (WHERE e.posted = true) AS posted_count,
                    COUNT(e.id) AS total_entries
             FROM rss_feeds f
             LEFT JOIN rss_entries e ON e.feed_id = f.id
             WHERE f.user_id = $1
             GROUP BY f.id
             ORDER BY f.created_at DESC`,
            [req.user!.userId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[RSS] listFeeds error:', err);
        res.status(500).json({ message: 'Failed to load RSS feeds' });
    }
};

export const createFeed = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, url, platforms, autoPost, intervalHours } = req.body;
        if (!url) { res.status(400).json({ message: 'url is required' }); return; }

        // Validate the feed is reachable
        let feedTitle = name;
        try {
            const feed = await parser.parseURL(url);
            if (!feedTitle) feedTitle = feed.title ?? url;
        } catch {
            res.status(400).json({ message: 'Could not fetch or parse the RSS feed URL' });
            return;
        }

        const { rows } = await db.query(
            `INSERT INTO rss_feeds (user_id, name, url, platforms, auto_post, interval_hours)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                req.user!.userId,
                feedTitle,
                url,
                platforms ?? [],
                autoPost ?? false,
                intervalHours ?? 24,
            ]
        );
        res.status(201).json({ ...rows[0], posted_count: 0, total_entries: 0 });
    } catch (err) {
        console.error('[RSS] createFeed error:', err);
        res.status(500).json({ message: 'Failed to create RSS feed' });
    }
};

export const updateFeed = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, platforms, autoPost, intervalHours, isActive } = req.body;
        const { rows } = await db.query(
            `UPDATE rss_feeds
             SET name           = COALESCE($1, name),
                 platforms      = COALESCE($2, platforms),
                 auto_post      = COALESCE($3, auto_post),
                 interval_hours = COALESCE($4, interval_hours),
                 is_active      = COALESCE($5, is_active)
             WHERE id = $6 AND user_id = $7 RETURNING *`,
            [name ?? null, platforms ?? null, autoPost ?? null,
             intervalHours ?? null, isActive ?? null, id, req.user!.userId]
        );
        if (!rows[0]) { res.status(404).json({ message: 'Feed not found' }); return; }
        res.json(rows[0]);
    } catch (err) {
        console.error('[RSS] updateFeed error:', err);
        res.status(500).json({ message: 'Failed to update feed' });
    }
};

export const deleteFeed = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query(
            'DELETE FROM rss_feeds WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        if (!rowCount) { res.status(404).json({ message: 'Feed not found' }); return; }
        res.status(204).send();
    } catch (err) {
        console.error('[RSS] deleteFeed error:', err);
        res.status(500).json({ message: 'Failed to delete feed' });
    }
};

export const fetchFeedNow = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rows: feedRows } = await db.query(
            'SELECT * FROM rss_feeds WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        if (!feedRows[0]) { res.status(404).json({ message: 'Feed not found' }); return; }

        const newCount = await fetchAndStoreFeedEntries(feedRows[0]);
        res.json({ message: `Fetched ${newCount} new entries`, newEntries: newCount });
    } catch (err) {
        console.error('[RSS] fetchFeedNow error:', err);
        res.status(500).json({ message: 'Failed to fetch feed' });
    }
};

// ─── Shared fetch logic (used by controller + cron job) ──────────────────────

export interface RssFeedRow {
    id: string;
    user_id: string;
    url: string;
    platforms: string[];
    auto_post: boolean;
}

export async function fetchAndStoreFeedEntries(feed: RssFeedRow): Promise<number> {
    const parsed = await parser.parseURL(feed.url);
    let newCount = 0;

    for (const item of parsed.items ?? []) {
        const guid  = item.guid ?? item.link ?? item.title ?? '';
        const title = item.title ?? '';
        const url   = item.link  ?? '';
        if (!guid) continue;

        const { rowCount } = await db.query(
            `INSERT INTO rss_entries (feed_id, guid, title, url)
             VALUES ($1, $2, $3, $4) ON CONFLICT (feed_id, guid) DO NOTHING`,
            [feed.id, guid, title, url]
        );
        if ((rowCount ?? 0) > 0) newCount++;
    }

    // If auto_post is enabled and platforms are configured, create draft posts
    if (feed.auto_post && feed.platforms.length > 0) {
        const { rows: unposted } = await db.query(
            `SELECT * FROM rss_entries
             WHERE feed_id = $1 AND posted = false
             ORDER BY created_at ASC LIMIT 10`,
            [feed.id]
        );

        for (const entry of unposted) {
            const content = `${entry.title}${entry.url ? `\n\n${entry.url}` : ''}`;
            await db.query(
                `INSERT INTO posts (user_id, content, platforms, status)
                 VALUES ($1, $2, $3, 'draft')`,
                [feed.user_id, content, feed.platforms]
            );
            await db.query(
                'UPDATE rss_entries SET posted = true WHERE id = $1',
                [entry.id]
            );
        }
    }

    await db.query(
        'UPDATE rss_feeds SET last_fetched_at = NOW() WHERE id = $1',
        [feed.id]
    );
    return newCount;
}
