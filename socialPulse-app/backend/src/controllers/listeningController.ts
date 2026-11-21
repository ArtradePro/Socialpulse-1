import { Request, Response } from 'express';
import { db } from '../config/database';
import { TwitterService } from '../services/twitterService';
import { analyzeSentiment, compileSocialQuery, detectCrisisStatus, matchesBooleanFilter } from '../utils/sentiment';
import { AIService } from '../services/ai.service';

// ─── Rules CRUD ──────────────────────────────────────────────────────────────

export const listRules = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            `SELECT r.*,
                    COUNT(lr.id) AS result_count,
                    COUNT(CASE WHEN lr.sentiment = 'negative' THEN 1 END) AS negative_count,
                    COUNT(CASE WHEN lr.sentiment = 'positive' THEN 1 END) AS positive_count
             FROM listening_rules r
             LEFT JOIN listening_results lr ON lr.rule_id = r.id
             WHERE r.user_id = $1 AND (r.workspace_id = $2 OR ($2 IS NULL AND r.workspace_id IS NULL))
             GROUP BY r.id
             ORDER BY r.created_at DESC`,
            [req.user!.userId, (req as any).workspaceId || null]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Listening] listRules error:', err);
        res.status(500).json({ message: 'Failed to load rules' });
    }
};

export const createRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { keyword, platforms, query_type, exclude_keywords } = req.body;
        if (!keyword) { res.status(400).json({ message: 'keyword is required' }); return; }

        const qType = query_type === 'boolean' ? 'boolean' : 'keyword';
        const excludes = Array.isArray(exclude_keywords) ? exclude_keywords : [];

        const { rows } = await db.query(
            `INSERT INTO listening_rules (user_id, workspace_id, keyword, platforms, query_type, exclude_keywords)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                req.user!.userId,
                (req as any).workspaceId || null,
                keyword.trim(),
                platforms ?? ['twitter'],
                qType,
                excludes
            ]
        );
        res.status(201).json({ ...rows[0], result_count: 0, negative_count: 0, positive_count: 0 });
    } catch (err) {
        console.error('[Listening] createRule error:', err);
        res.status(500).json({ message: 'Failed to create rule' });
    }
};

export const deleteRule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query(
            `DELETE FROM listening_rules WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR ($3 IS NULL AND workspace_id IS NULL))`,
            [id, req.user!.userId, (req as any).workspaceId || null]
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
        const limit     = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const offset    = parseInt(req.query.offset as string) || 0;
        const ruleId    = req.query.rule_id as string | undefined;
        const sentiment = req.query.sentiment as string | undefined;

        let where = `WHERE ru.user_id = $1 AND (ru.workspace_id = $2 OR ($2 IS NULL AND ru.workspace_id IS NULL))`;
        const params: unknown[] = [req.user!.userId, (req as any).workspaceId || null];

        if (ruleId) {
            where += ` AND lr.rule_id = $${params.length + 1}`;
            params.push(ruleId);
        }

        if (sentiment && ['positive', 'neutral', 'negative'].includes(sentiment)) {
            where += ` AND lr.sentiment = $${params.length + 1}`;
            params.push(sentiment);
        }

        const { rows } = await db.query(
            `SELECT lr.*, ru.keyword, ru.query_type
             FROM listening_results lr
             JOIN listening_rules ru ON ru.id = lr.rule_id
             ${where}
             ORDER BY lr.fetched_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        // Ensure sentiment is analyzed for legacy results
        const enriched = rows.map((r: any) => {
            if (!r.sentiment || r.sentiment === 'neutral' && (!r.sentiment_score || r.sentiment_score === 0)) {
                const s = analyzeSentiment(r.content || '');
                return { ...r, sentiment: s.sentiment, sentiment_score: s.score };
            }
            return r;
        });

        res.json(enriched);
    } catch (err) {
        console.error('[Listening] getResults error:', err);
        res.status(500).json({ message: 'Failed to load results' });
    }
};

// ─── Crisis Detection & Intelligence (Brandwatch Iris AI) ───────────────────

export const getCrisisSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            `SELECT lr.sentiment, lr.sentiment_score, lr.fetched_at
             FROM listening_results lr
             JOIN listening_rules ru ON ru.id = lr.rule_id
             WHERE ru.user_id = $1 AND (ru.workspace_id = $2 OR ($2 IS NULL AND ru.workspace_id IS NULL))
             ORDER BY lr.fetched_at DESC
             LIMIT 100`,
            [req.user!.userId, (req as any).workspaceId || null]
        );

        const crisisInfo = detectCrisisStatus(rows);
        const positiveCount = rows.filter(r => r.sentiment === 'positive').length;
        const neutralCount  = rows.filter(r => r.sentiment === 'neutral').length;
        const negativeCount = rows.filter(r => r.sentiment === 'negative').length;

        res.json({
            ...crisisInfo,
            positiveCount,
            neutralCount,
            negativeCount,
            healthyRatio: rows.length ? Math.round(((positiveCount + neutralCount) / rows.length) * 100) : 100,
        });
    } catch (err) {
        console.error('[Listening] getCrisisSummary error:', err);
        res.status(500).json({ message: 'Failed to evaluate crisis summary' });
    }
};

export const generateCrisisResponse = async (req: Request, res: Response): Promise<void> => {
    try {
        const { content, authorName, platform } = req.body;
        if (!content) {
            res.status(400).json({ message: 'content is required' });
            return;
        }

        const prompt = `Draft an empathetic, brand-safe, professional, and de-escalating customer-care reply to this public ${platform || 'social'} mention by @${authorName || 'user'}:
"${content}"
Keep it concise, supportive, accountable without admitting legal liability, and invite them to DM for immediate resolution.`;

        const responseText = await AIService.improveContent(
            req.user!.userId,
            content,
            platform || 'twitter',
            prompt
        );

        res.json({ suggestedReply: responseText });
    } catch (err) {
        console.error('[Listening] generateCrisisResponse error:', err);
        res.status(500).json({ message: 'Failed to generate crisis response' });
    }
};

// ─── Manual fetch for a single rule ─────────────────────────────────────────

export const fetchRuleNow = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rows: ruleRows } = await db.query(
            `SELECT * FROM listening_rules WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR ($3 IS NULL AND workspace_id IS NULL))`,
            [id, req.user!.userId, (req as any).workspaceId || null]
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
    query_type?: string;
    exclude_keywords?: string[];
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

        // Compile boolean query or keyword search
        const compiledQuery = compileSocialQuery(rule.keyword, rule.exclude_keywords || []);
        const finalQuery = `${compiledQuery} -is:retweet lang:en`;

        const tweets = await TwitterService.searchRecent(
            account.rows[0].access_token,
            finalQuery,
            25
        );

        for (const t of tweets) {
            // Apply in-memory boolean matching as secondary filter
            if (rule.query_type === 'boolean' && !matchesBooleanFilter(t.text, rule.keyword, rule.exclude_keywords || [])) {
                continue;
            }

            const sentimentData = analyzeSentiment(t.text || '');
            const followers = t.author_followers || t.public_metrics?.like_count ? Math.max(0, (t.public_metrics?.retweet_count || 0) * 50) : 0;

            const { rowCount } = await db.query(
                `INSERT INTO listening_results
                    (rule_id, platform, external_id, content, published_at, 
                     author_name, author_handle, author_avatar, likes, reposts, url,
                     sentiment, sentiment_score, author_followers)
                 VALUES ($1, 'twitter', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (rule_id, external_id) DO UPDATE SET
                     likes = EXCLUDED.likes,
                     reposts = EXCLUDED.reposts,
                     sentiment = EXCLUDED.sentiment,
                     sentiment_score = EXCLUDED.sentiment_score`,
                [
                    rule.id, 
                    t.id, 
                    t.text, 
                    t.created_at ? new Date(t.created_at) : new Date(),
                    t.author_name || null,
                    t.author_handle || null,
                    t.author_avatar || null,
                    t.public_metrics?.like_count || 0,
                    t.public_metrics?.retweet_count || 0,
                    `https://twitter.com/any/status/${t.id}`,
                    sentimentData.sentiment,
                    sentimentData.score,
                    followers
                ]
            );
            if ((rowCount ?? 0) > 0) count++;
        }
    }

    return count;
}
