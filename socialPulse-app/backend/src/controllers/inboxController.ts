import { Request, Response } from 'express';
import { db } from '../config/database';
import { TwitterService } from '../services/twitterService';

export const listMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit      = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const offset     = parseInt(req.query.offset as string) || 0;
        const unreadOnly = req.query.unread === 'true';
        const platform   = req.query.platform as string | undefined;

        let where = 'WHERE user_id = $1';
        const params: unknown[] = [req.user!.userId];
        if (unreadOnly) where += ' AND is_read = false';
        if (platform)   { where += ` AND platform = $${params.length + 1}`; params.push(platform); }

        const { rows } = await db.query(
            `SELECT * FROM inbox_messages ${where}
             ORDER BY published_at DESC NULLS LAST
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        const { rows: counts } = await db.query(
            'SELECT COUNT(*) FROM inbox_messages WHERE user_id = $1 AND is_read = false',
            [req.user!.userId]
        );

        res.json({ messages: rows, unreadCount: parseInt(counts[0].count) });
    } catch (err) {
        console.error('[Inbox] listMessages error:', err);
        res.status(500).json({ message: 'Failed to load inbox' });
    }
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await db.query(
            'UPDATE inbox_messages SET is_read = true WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Inbox] markRead error:', err);
        res.status(500).json({ message: 'Failed to mark as read' });
    }
};

export const markAllRead = async (req: Request, res: Response): Promise<void> => {
    try {
        await db.query(
            'UPDATE inbox_messages SET is_read = true WHERE user_id = $1',
            [req.user!.userId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Inbox] markAllRead error:', err);
        res.status(500).json({ message: 'Failed to mark all as read' });
    }
};

export const syncInbox = async (req: Request, res: Response): Promise<void> => {
    try {
        const count = await fetchMentionsForUser(req.user!.userId);
        res.json({ message: `Synced ${count} new messages`, newMessages: count });
    } catch (err) {
        console.error('[Inbox] syncInbox error:', err);
        res.status(500).json({ message: 'Failed to sync inbox' });
    }
};

// ─── Shared fetch logic ──────────────────────────────────────────────────────

export async function fetchMentionsForUser(userId: string): Promise<number> {
    let count = 0;

    const { rows: accounts } = await db.query(
        `SELECT * FROM social_accounts WHERE user_id = $1 AND is_active = true`,
        [userId]
    );

    for (const account of accounts) {
        if (account.platform === 'twitter') {
            try {
                const mentions = await TwitterService.getMentions(
                    account.access_token,
                    account.platform_user_id
                );

                for (const m of mentions) {
                    const url = `https://twitter.com/i/web/status/${m.id}`;
                    const { rowCount } = await db.query(
                        `INSERT INTO inbox_messages
                            (user_id, platform, type, external_id, content, url, published_at)
                         VALUES ($1, 'twitter', 'mention', $2, $3, $4, $5)
                         ON CONFLICT (user_id, platform, external_id) DO NOTHING`,
                        [userId, m.id, m.text, url, m.created_at ? new Date(m.created_at) : new Date()]
                    );
                    if ((rowCount ?? 0) > 0) count++;
                }
            } catch (err) {
                console.error(`[Inbox] Twitter mentions error for user ${userId}:`, err);
            }
        }
        // Instagram, LinkedIn, Facebook comment/DM fetching would go here
        // when their respective APIs are configured with the right permissions
    }

    return count;
}
