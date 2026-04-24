import { Request, Response } from 'express';
import { db } from '../config/database';

export const listTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, search } = req.query as Record<string, string>;

        let sql = `
            SELECT id, user_id, name, content, category, platforms, is_public, created_at,
                   (user_id = $1) AS is_mine
            FROM templates
            WHERE (user_id = $1 OR is_public = true)`;
        const params: unknown[] = [req.user!.userId];

        if (category) {
            params.push(category);
            sql += ` AND category = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (name ILIKE $${params.length} OR content ILIKE $${params.length})`;
        }
        sql += ' ORDER BY is_mine DESC, name';

        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('[Templates] list error:', err);
        res.status(500).json({ message: 'Failed to fetch templates' });
    }
};

export const createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, content, category, platforms, isPublic } = req.body;
        if (!name || !content) {
            res.status(400).json({ message: 'name and content are required' });
            return;
        }
        const { rows } = await db.query(
            `INSERT INTO templates (user_id, name, content, category, platforms, is_public)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, user_id, name, content, category, platforms, is_public, created_at`,
            [req.user!.userId, name, content, category ?? null,
             platforms ?? null, isPublic ?? false]
        );
        res.status(201).json({ ...rows[0], is_mine: true });
    } catch (err) {
        console.error('[Templates] create error:', err);
        res.status(500).json({ message: 'Failed to create template' });
    }
};

export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, content, category, platforms, isPublic } = req.body;
        const { rows } = await db.query(
            `UPDATE templates
             SET name      = COALESCE($1, name),
                 content   = COALESCE($2, content),
                 category  = COALESCE($3, category),
                 platforms = COALESCE($4, platforms),
                 is_public = COALESCE($5, is_public)
             WHERE id = $6 AND user_id = $7
             RETURNING id, user_id, name, content, category, platforms, is_public, created_at`,
            [name ?? null, content ?? null, category ?? null,
             platforms ?? null, isPublic ?? null, id, req.user!.userId]
        );
        if (!rows[0]) { res.status(404).json({ message: 'Not found' }); return; }
        res.json({ ...rows[0], is_mine: true });
    } catch (err) {
        console.error('[Templates] update error:', err);
        res.status(500).json({ message: 'Failed to update template' });
    }
};

export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query(
            'DELETE FROM templates WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        if (!rowCount) { res.status(404).json({ message: 'Not found' }); return; }
        res.status(204).send();
    } catch (err) {
        console.error('[Templates] delete error:', err);
        res.status(500).json({ message: 'Failed to delete template' });
    }
};
