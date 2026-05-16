import { Request, Response } from 'express';
import { db } from '../config/database';

export const listHashtagSets = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, hashtags, created_at
             FROM hashtag_sets 
             WHERE user_id = $1 AND (workspace_id = $2 OR $2 IS NULL) 
             ORDER BY name`,
            [req.user!.userId, (req as any).workspaceId || null]
        );
        res.json(rows);
    } catch (err) {
        console.error('[HashtagSets] list error:', err);
        res.status(500).json({ message: 'Failed to fetch hashtag sets' });
    }
};

export const createHashtagSet = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, hashtags } = req.body;
        if (!name || !Array.isArray(hashtags) || hashtags.length === 0) {
            res.status(400).json({ message: 'name and hashtags[] are required' });
            return;
        }
        const { rows } = await db.query(
            `INSERT INTO hashtag_sets (user_id, workspace_id, name, hashtags)
             VALUES ($1, $2, $3, $4) RETURNING id, name, hashtags, created_at`,
            [req.user!.userId, (req as any).workspaceId || null, name.trim(), hashtags]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[HashtagSets] create error:', err);
        res.status(500).json({ message: 'Failed to create hashtag set' });
    }
};

export const updateHashtagSet = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, hashtags } = req.body;
        const { rows } = await db.query(
            `UPDATE hashtag_sets
             SET name = COALESCE($1, name), hashtags = COALESCE($2, hashtags)
             WHERE id = $3 AND user_id = $4 AND (workspace_id = $5 OR $5 IS NULL)
             RETURNING id, name, hashtags, created_at`,
            [name ?? null, hashtags ?? null, id, req.user!.userId, (req as any).workspaceId || null]
        );
        if (!rows[0]) { res.status(404).json({ message: 'Not found' }); return; }
        res.json(rows[0]);
    } catch (err) {
        console.error('[HashtagSets] update error:', err);
        res.status(500).json({ message: 'Failed to update hashtag set' });
    }
};

export const deleteHashtagSet = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query(
            'DELETE FROM hashtag_sets WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR $3 IS NULL)',
            [id, req.user!.userId, (req as any).workspaceId || null]
        );
        if (!rowCount) { res.status(404).json({ message: 'Not found' }); return; }
        res.status(204).send();
    } catch (err) {
        console.error('[HashtagSets] delete error:', err);
        res.status(500).json({ message: 'Failed to delete hashtag set' });
    }
};
