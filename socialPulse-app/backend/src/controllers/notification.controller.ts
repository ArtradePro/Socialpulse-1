import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const result = await query(
      `SELECT n.*, u.username, u.display_name, u.avatar_url
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    await query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    await query('UPDATE notifications SET read = true WHERE user_id = $1', [userId]);
    res.status(204).send();
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
