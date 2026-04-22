// backend/src/controllers/campaignsController.ts
import { Request, Response } from 'express';
import { db } from '../config/database';

export const listCampaigns = async (req: Request, res: Response): Promise<void> => {
    const { rows } = await db.query(
        `SELECT c.*,
                COUNT(p.id) FILTER (WHERE p.campaign_id = c.id)             AS post_count,
                COUNT(p.id) FILTER (WHERE p.campaign_id = c.id
                                      AND p.status = 'published')           AS published_count
         FROM campaigns c
         LEFT JOIN posts p ON p.campaign_id = c.id
         WHERE c.user_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [req.user!.userId]
    );
    res.json(rows);
};

export const getCampaign = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const { rows: campaign } = await db.query(
        'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
        [id, req.user!.userId]
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
        `INSERT INTO campaigns (user_id, name, description, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user!.userId, name, description ?? null,
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
         WHERE id = $6 AND user_id = $7 RETURNING *`,
        [name ?? null, description ?? null, startDate ?? null,
         endDate ?? null, status ?? null, id, req.user!.userId]
    );
    if (!rows[0]) { res.status(404).json({ message: 'Not found' }); return; }
    res.json(rows[0]);
};

export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    // Unlink posts from this campaign first
    await db.query('UPDATE posts SET campaign_id = NULL WHERE campaign_id = $1 AND user_id = $2',
        [id, req.user!.userId]);
    const { rowCount } = await db.query(
        'DELETE FROM campaigns WHERE id = $1 AND user_id = $2', [id, req.user!.userId]
    );
    if (!rowCount) { res.status(404).json({ message: 'Not found' }); return; }
    res.status(204).send();
};
