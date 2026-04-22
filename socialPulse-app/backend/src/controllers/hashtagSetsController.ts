// backend/src/controllers/hashtagSetsController.ts
import { Request, Response } from 'express';
import { db } from '../config/database';

export const listHashtagSets = async (req: Request, res: Response): Promise<void> => {
    const { rows } = await db.query(
        `SELECT id, name, hashtags, created_at
         FROM hashtag_sets WHERE user_id = $1 ORDER BY name`,
        [req.user!.userId]
    );
    res.json(rows);
};

export const createHashtagSet = async (req: Request, res: Response): Promise<void> => {
    const { name, hashtags } = req.body;
    if (!name || !Array.isArray(hashtags) || hashtags.length === 0) {
        res.status(400).json({ message: 'name and hashtags[] are required' });
        return;
    }
    const { rows } = await db.query(
        `INSERT INTO hashtag_sets (user_id, name, hashtags)
         VALUES ($1, $2, $3) RETURNING id, name, hashtags, created_at`,
        [req.user!.userId, name.trim(), hashtags]
    );
    res.status(201).json(rows[0]);
};

export const updateHashtagSet = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, hashtags } = req.body;
    const { rows } = await db.query(
        `UPDATE hashtag_sets
         SET name = COALESCE($1, name), hashtags = COALESCE($2, hashtags)
         WHERE id = $3 AND user_id = $4
         RETURNING id, name, hashtags, created_at`,
        [name ?? null, hashtags ?? null, id, req.user!.userId]
    );
    if (!rows[0]) { res.status(404).json({ message: 'Not found' }); return; }
    res.json(rows[0]);
};

export const deleteHashtagSet = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { rowCount } = await db.query(
        'DELETE FROM hashtag_sets WHERE id = $1 AND user_id = $2',
        [id, req.user!.userId]
    );
    if (!rowCount) { res.status(404).json({ message: 'Not found' }); return; }
    res.status(204).send();
};
