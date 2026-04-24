import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../config/database';

/**
 * Validates X-API-Key header as an alternative to JWT auth.
 * Sets req.user the same shape as the JWT middleware on success.
 */
export const authenticateApiKey = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const raw = req.headers['x-api-key'];
    if (!raw || typeof raw !== 'string') {
        res.status(401).json({ message: 'API key required' });
        return;
    }

    const keyHash = crypto.createHash('sha256').update(raw).digest('hex');

    try {
        const { rows } = await db.query(
            `SELECT ak.id, u.id AS user_id, u.email, u.plan
             FROM api_keys ak
             JOIN users u ON u.id = ak.user_id
             WHERE ak.key_hash = $1 AND ak.is_active = true`,
            [keyHash]
        );

        if (!rows[0]) {
            res.status(401).json({ message: 'Invalid or revoked API key' });
            return;
        }

        req.user = { userId: rows[0].user_id, email: rows[0].email, plan: rows[0].plan ?? 'free' };

        // Fire-and-forget last_used_at update
        db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [rows[0].id])
            .catch(console.error);

        next();
    } catch (err) {
        console.error('[ApiKey middleware]', err);
        res.status(500).json({ message: 'Authorization check failed' });
    }
};
