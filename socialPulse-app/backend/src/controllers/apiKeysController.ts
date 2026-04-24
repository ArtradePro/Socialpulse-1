import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database';

export const listApiKeys = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, key_prefix, is_active, last_used_at, created_at
             FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.user!.userId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[ApiKeys] list error:', err);
        res.status(500).json({ message: 'Failed to load API keys' });
    }
};

export const generateApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name } = req.body;
        if (!name) { res.status(400).json({ message: 'name is required' }); return; }

        const rawKey   = `sp_${crypto.randomBytes(24).toString('hex')}`;
        const keyHash  = crypto.createHash('sha256').update(rawKey).digest('hex');
        const prefix   = rawKey.slice(0, 10);

        const { rows } = await db.query(
            `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, key_prefix, is_active, created_at`,
            [req.user!.userId, name, keyHash, prefix]
        );

        // Return the raw key only once — it cannot be retrieved again
        res.status(201).json({ ...rows[0], key: rawKey });
    } catch (err) {
        console.error('[ApiKeys] generate error:', err);
        res.status(500).json({ message: 'Failed to generate API key' });
    }
};

export const revokeApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query(
            'UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        if (!rowCount) { res.status(404).json({ message: 'Key not found' }); return; }
        res.status(204).send();
    } catch (err) {
        console.error('[ApiKeys] revoke error:', err);
        res.status(500).json({ message: 'Failed to revoke key' });
    }
};

export const deleteApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query(
            'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        if (!rowCount) { res.status(404).json({ message: 'Key not found' }); return; }
        res.status(204).send();
    } catch (err) {
        console.error('[ApiKeys] delete error:', err);
        res.status(500).json({ message: 'Failed to delete key' });
    }
};
