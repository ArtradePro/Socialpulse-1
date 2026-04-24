// backend/src/controllers/notificationsController.ts
import { Request, Response } from 'express';
import { db } from '../config/database';

export const listNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit      = Math.min(parseInt(req.query.limit  as string) || 20, 100);
        const offset     = parseInt(req.query.offset as string) || 0;
        const unreadOnly = req.query.unread === 'true';

        let where = 'WHERE user_id = $1';
        const params: unknown[] = [req.user!.userId];
        if (unreadOnly) where += ' AND read = false';

        const { rows } = await db.query(
            `SELECT id, type, title, message, link, read, metadata, created_at
             FROM notifications ${where}
             ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [...params, limit, offset]
        );

        const { rows: count } = await db.query(
            `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`,
            [req.user!.userId]
        );

        res.json({ notifications: rows, unreadCount: parseInt(count[0].count) });
    } catch (err) {
        console.error('[Notifications] list error:', err);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await db.query(
            'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Notifications] markRead error:', err);
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
};

export const markAllRead = async (req: Request, res: Response): Promise<void> => {
    try {
        await db.query(
            'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
            [req.user!.userId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Notifications] markAllRead error:', err);
        res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
};

export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await db.query(
            'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Notifications] delete error:', err);
        res.status(500).json({ message: 'Failed to delete notification' });
    }
};
