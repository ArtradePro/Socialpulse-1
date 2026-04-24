import { Request, Response } from 'express';
import { db } from '../config/database';
import { TwitterService } from '../services/twitterService';

// ─── Rules CRUD ──────────────────────────────────────────────────────────────

export const listRules = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            `SELECT r.*,
                    COUNT(lr.id) AS result_count
             FROM listening_rules r
             LEFT JOIN listening_results lr ON lr.rule_id = r.id
             WHERE r.user_id = $1
             GROUP BY r.id
             ORDER BY r.created_at DESC`,
            [req.user!.userId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Listening] listRules error:', err);
        res.status(500).json({ message: 'Failed to load rules' });
    }
};

export const createRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { keyword, platforms } = req.body;
        if (!keyword) { res.status(400).json({ message: 'keyword is required' }); return; }
        const { rows } = await db.query(
            `INSERT INTO listening_rules (user_id, keyword, platforms)
             VALUES ($1, $2, $3) RETURNING *`,
            [req.user!.userId, keyword.trim(), platforms ?? ['twitter']]
        );
        res.status(201).json({ ...rows[0], result_count: 0 });
    } catch (err) {
        console.error('[Listening] createRule error:', err);
        res.status(500).json({ message: 'Failed to create rule' });
    }
};

export const deleteRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query(
            'DELETE FROM listening_rules WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        if (!rowCount) { res.status(404).json({ message: 'Rule not found' }); return; }
        res.status(204).send();
    } catch (err) {
        console.error('[Listening] deleteRule error:', err);
        res.status(500).json({ message: 'Failed to delete rule' });
    }
};

export const toggleRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(
            `UPDATE listening_rules SET is_active = NOT is_active
             WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, req.user!.userId]
        );
        if (!rows[0]) { res.status(404).json({ message: 'Rule not found' }); return; }
        res.json(rows[0]);
    } catch (err) {
        console.error('[Listening] toggleRule error:', err);
        res.status(500).json({ message: 'Failed to toggle rule' });
    }
};

// ─── Results ────────────────────────────────────────────────────────────────

export const getResults = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
        const offset = parseInt(req.query.offset as string) || 0;
        const ruleId = req.query.rule_id as string | undefined;

        let where = 'WHERE r.user_id = $1';
        const params: unknown[] = [req.user!.userId];
        if (ruleId) { where += ' AND lr.rule_id = $2'; params.push(ruleId); }

        const { rows } = await db.query(
            `SELECT lr.*, ru.keyword
             FROM listening_results lr
             JOIN listening_rules ru ON ru.id = lr.rule_id
             ${where}
             ORDER BY lr.fetched_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Listening] getResults error:', err);
        res.status(500).json({ message: 'Failed to load results' });
    }
};

// ─── Manual fetch for a single rule ─────────────────────────────────────────

export const fetchRuleNow = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rows: ruleRows } = await db.query(
            'SELECT * FROM listening_rules WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        if (!ruleRows[0]) { res.status(404).json({ message: 'Rule not found' }); return; }

        const count = await fetchRuleResults(ruleRows[0], req.user!.userId);
        res.json({ message: `Found ${count} new mentions`, newResults: count });
    } catch (err) {
        console.error('[Listening] fetchRuleNow error:', err);
        res.status(500).json({ message: 'Failed to fetch results' });
    }
};

// ─── Shared fetch logic ──────────────────────────────────────────────────────

export interface ListeningRuleRow {
    id: string;
    user_id: string;
    keyword: string;
    platforms: string[];
    is_active: boolean;
}

export async function fetchRuleResults(rule: ListeningRuleRow, userId: string): Promise<number> {
    let count = 0;

    if (rule.platforms.includes('twitter')) {
        const account = await db.query(
            `SELECT access_token, platform_user_id FROM social_accounts
             WHERE user_id = $1 AND platform = 'twitter' AND is_active = true`,
            [userId]
        );
        if (!account.rows[0]) return 0;

        const tweets = await TwitterService.searchRecent(
            account.rows[0].access_token,
            `${rule.keyword} -is:retweet lang:en`,
            20
        );

        for (const t of tweets) {
            const { rowCount } = await db.query(
                `INSERT INTO listening_results
                    (rule_id, platform, external_id, content, published_at)
                 VALUES ($1, 'twitter', $2, $3, $4)
                 ON CONFLICT (rule_id, external_id) DO NOTHING`,
                [rule.id, t.id, t.text, t.created_at ? new Date(t.created_at) : new Date()]
            );
            if ((rowCount ?? 0) > 0) count++;
        }
    }

    return count;
}
