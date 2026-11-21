import { Request, Response } from 'express';
import { db } from '../config/database';
import { TwitterService } from '../services/twitterService';
import { analyzeSentiment } from '../utils/sentiment';

export const listMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit      = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const offset     = parseInt(req.query.offset as string) || 0;
        const unreadOnly = req.query.unread === 'true';
        const vipOnly    = req.query.vipOnly === 'true';
        const urgentOnly = req.query.urgentOnly === 'true';
        const platform   = req.query.platform as string | undefined;
        const sentiment  = req.query.sentiment as string | undefined;

        let where = `WHERE user_id = $1 AND (workspace_id = $2 OR ($2 IS NULL AND workspace_id IS NULL))`;
        const params: unknown[] = [req.user!.userId, (req as any).workspaceId || null];

        if (unreadOnly) where += ' AND is_read = false';
        if (vipOnly)    where += ' AND is_vip = true';
        if (urgentOnly) where += ' AND is_urgent = true';
        if (sentiment)  { where += ` AND sentiment = $${params.length + 1}`; params.push(sentiment); }
        if (platform)   { where += ` AND platform = $${params.length + 1}`; params.push(platform); }

        const { rows } = await db.query(
            `SELECT * FROM inbox_messages ${where}
             ORDER BY is_urgent DESC, published_at DESC NULLS LAST
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        // Ensure sentiment & VIP tagging on legacy rows in response
        const enriched = rows.map((m: any) => {
            if (!m.sentiment || m.sentiment === 'neutral') {
                const s = analyzeSentiment(m.content || '');
                m.sentiment = s.sentiment;
                if (s.sentiment === 'negative' && !m.is_urgent) m.is_urgent = true;
            }
            return m;
        });

        const { rows: counts } = await db.query(
            `SELECT 
                COUNT(*) FILTER (WHERE is_read = false) AS unread_count,
                COUNT(*) FILTER (WHERE is_vip = true) AS vip_count,
                COUNT(*) FILTER (WHERE is_urgent = true) AS urgent_count
             FROM inbox_messages 
             WHERE user_id = $1 AND (workspace_id = $2 OR ($2 IS NULL AND workspace_id IS NULL))`,
            [req.user!.userId, (req as any).workspaceId || null]
        );

        res.json({
            messages: enriched,
            unreadCount: parseInt(counts[0]?.unread_count || '0'),
            vipCount: parseInt(counts[0]?.vip_count || '0'),
            urgentCount: parseInt(counts[0]?.urgent_count || '0'),
        });
    } catch (err) {
        console.error('[Inbox] listMessages error:', err);
        res.status(500).json({ message: 'Failed to load inbox' });
    }
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await db.query(
            `UPDATE inbox_messages SET is_read = true WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR ($3 IS NULL AND workspace_id IS NULL))`,
            [id, req.user!.userId, (req as any).workspaceId || null]
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
            `UPDATE inbox_messages SET is_read = true WHERE user_id = $1 AND (workspace_id = $2 OR ($2 IS NULL AND workspace_id IS NULL))`,
            [req.user!.userId, (req as any).workspaceId || null]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Inbox] markAllRead error:', err);
        res.status(500).json({ message: 'Failed to mark all as read' });
    }
};

export const convertMessageToLead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const workspaceId = (req as any).workspaceId || null;

        if (!workspaceId) {
            res.status(400).json({ message: 'Active workspace required to save contact' });
            return;
        }

        const { rows } = await db.query(
            `SELECT * FROM inbox_messages WHERE id = $1 AND user_id = $2`,
            [id, req.user!.userId]
        );
        if (!rows[0]) {
            res.status(404).json({ message: 'Message not found' });
            return;
        }

        const msg = rows[0];
        const leadName = msg.author_name || (msg.author_handle ? `@${msg.author_handle}` : 'Social Lead');
        const tag = msg.is_vip ? 'VIP_CREATOR' : 'INBOX_LEAD';

        const { rows: leadRows } = await db.query(
            `INSERT INTO scraped_leads (workspace_id, business_name, website, category, status, tag_applied)
             VALUES ($1, $2, $3, $4, 'NEW', $5)
             RETURNING *`,
            [
                workspaceId,
                leadName,
                msg.url || null,
                `${msg.platform.toUpperCase()} Inquiry`,
                tag
            ]
        );

        res.status(201).json({ message: 'Contact saved to Leads successfully', lead: leadRows[0] });
    } catch (err) {
        console.error('[Inbox] convertMessageToLead error:', err);
        res.status(500).json({ message: 'Failed to save lead' });
    }
};

export const syncInbox = async (req: Request, res: Response): Promise<void> => {
    try {
        const count = await fetchMentionsForUser(req.user!.userId, (req as any).workspaceId);
        res.json({ message: `Synced ${count} new messages`, newMessages: count });
    } catch (err) {
        console.error('[Inbox] syncInbox error:', err);
        res.status(500).json({ message: 'Failed to sync inbox' });
    }
};

// ─── Shared fetch logic ──────────────────────────────────────────────────────

export async function fetchMentionsForUser(userId: string, workspaceId?: string): Promise<number> {
    let count = 0;
 
    const { rows: accounts } = await db.query(
        `SELECT * FROM social_accounts 
         WHERE user_id = $1 AND (workspace_id = $2 OR ($2 IS NULL AND workspace_id IS NULL)) AND is_active = true`,
        [userId, workspaceId || null]
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
                    const sentimentData = analyzeSentiment(m.text || '');
                    const followers = m.author_followers || 0;
                    const isVip = followers >= 5000 || (m.author_handle && ['verified', 'official'].some(k => m.author_handle.toLowerCase().includes(k)));
                    const isUrgent = sentimentData.sentiment === 'negative' || ['help', 'refund', 'scam', 'problem', 'fail', 'broken'].some(k => (m.text || '').toLowerCase().includes(k));

                    const { rowCount } = await db.query(
                        `INSERT INTO inbox_messages
                            (user_id, workspace_id, platform, type, external_id, content, url, published_at,
                             author_name, author_handle, author_avatar, sentiment, author_followers, is_vip, is_urgent)
                         VALUES ($1, $2, $3, 'mention', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                         ON CONFLICT (user_id, platform, external_id) DO UPDATE SET
                             sentiment = EXCLUDED.sentiment,
                             is_vip = EXCLUDED.is_vip,
                             is_urgent = EXCLUDED.is_urgent`,
                        [
                            userId, 
                            workspaceId || null, 
                            account.platform, 
                            m.id, 
                            m.text, 
                            url, 
                            m.created_at ? new Date(m.created_at) : new Date(),
                            m.author_name || null,
                            m.author_handle || null,
                            m.author_avatar || null,
                            sentimentData.sentiment,
                            followers,
                            isVip,
                            isUrgent
                        ]
                    );
                    if ((rowCount ?? 0) > 0) count++;
                }
            } catch (err) {
                console.error(`[Inbox] Twitter mentions error for user ${userId}:`, err);
            }
        }
    }

    return count;
}
