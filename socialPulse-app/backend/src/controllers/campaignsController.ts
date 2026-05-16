import { Request, Response } from 'express';
import { db } from '../config/database';
import { AIService } from '../services/ai.service';

export const listCampaigns = async (req: Request, res: Response): Promise<void> => {
// ... (rest of the file remains similar but with Request)
    try {
        const { rows } = await db.query(
            `SELECT c.*,
                    COUNT(p.id) FILTER (WHERE p.campaign_id = c.id)             AS post_count,
                    COUNT(p.id) FILTER (WHERE p.campaign_id = c.id
                                          AND p.status = 'published')           AS published_count
              FROM campaigns c
             LEFT JOIN posts p ON p.campaign_id = c.id
             WHERE c.user_id = $1 AND (c.workspace_id = $2 OR $2 IS NULL)
             GROUP BY c.id
             ORDER BY c.created_at DESC`,
            [req.user!.userId, req.workspaceId || null]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Campaigns] listCampaigns error:', err);
        res.status(500).json({ message: 'Failed to load campaigns' });
    }
};

export const getCampaign = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const { rows: campaign } = await db.query(
        'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR $3 IS NULL)',
        [id, req.user!.userId, req.workspaceId || null]
    );
    if (!campaign[0]) { res.status(404).json({ message: 'Not found' }); return; }

    // Campaign posts + basic analytics
    const { rows: posts } = await db.query(
        `SELECT p.id, p.content, p.platforms, p.status, p.scheduled_at, p.published_at,
                COALESCE(SUM(pa.impressions), 0) AS total_impressions,
                COALESCE(SUM(pa.likes), 0)       AS total_likes,
                COALESCE(SUM(pa.comments), 0)    AS total_comments,
                COALESCE(SUM(pa.shares), 0)      AS total_shares
         FROM posts p
         LEFT JOIN post_analytics pa ON pa.post_id = p.id
         WHERE p.campaign_id = $1
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [id]
    );

    res.json({ ...campaign[0], posts });
};

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
    const { name, description, startDate, endDate } = req.body;
    if (!name) { res.status(400).json({ message: 'name is required' }); return; }

    const { rows } = await db.query(
        `INSERT INTO campaigns (user_id, workspace_id, name, description, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.user!.userId, req.workspaceId || null, name, description ?? null,
         startDate ?? null, endDate ?? null]
    );
    res.status(201).json(rows[0]);
};

export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, description, startDate, endDate, status } = req.body;

    const { rows } = await db.query(
        `UPDATE campaigns
         SET name        = COALESCE($1, name),
             description = COALESCE($2, description),
             start_date  = COALESCE($3, start_date),
             end_date    = COALESCE($4, end_date),
             status      = COALESCE($5, status)
         WHERE id = $6 AND user_id = $7 AND (workspace_id = $8 OR $8 IS NULL) RETURNING *`,
        [name ?? null, description ?? null, startDate ?? null,
         endDate ?? null, status ?? null, id, req.user!.userId, req.workspaceId || null]
    );
    if (!rows[0]) { res.status(404).json({ message: 'Not found' }); return; }
    res.json(rows[0]);
};

export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    // Unlink posts from this campaign first
    await db.query('UPDATE posts SET campaign_id = NULL WHERE campaign_id = $1 AND user_id = $2 AND (workspace_id = $3 OR $3 IS NULL)',
        [id, req.user!.userId, req.workspaceId || null]);
    const { rowCount } = await db.query(
        'DELETE FROM campaigns WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR $3 IS NULL)', 
        [id, req.user!.userId, req.workspaceId || null]
    );
    if (!rowCount) { res.status(404).json({ message: 'Not found' }); return; }
    res.status(204).send();
};

export const generateMagicPlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const { rows: campaign } = await db.query(
            'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR $3 IS NULL)',
            [id, userId, req.workspaceId || null]
        );
        if (!campaign[0]) { res.status(404).json({ message: 'Campaign not found' }); return; }

        const plan = await AIService.generateMagicPlan(
            userId, 
            campaign[0].workspace_id || undefined,
            campaign[0].name, 
            campaign[0].description || ''
        );

        // Create drafts
        for (const post of plan.posts) {
            const scheduledAt = new Date();
            scheduledAt.setDate(scheduledAt.getDate() + post.scheduled_offset_days);

            await db.query(
                `INSERT INTO posts (user_id, campaign_id, workspace_id, content, platforms, status, scheduled_at, ai_generated)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [userId, id, campaign[0].workspace_id || null, post.content, [post.platform], 'draft', scheduledAt, true]
            );
        }

        res.json({ message: 'Magic plan generated successfully', count: plan.posts.length });
    } catch (err: any) {
        console.error('[Magic Plan Error]', err);
        res.status(500).json({ message: 'Failed to generate magic plan' });
    }
};
