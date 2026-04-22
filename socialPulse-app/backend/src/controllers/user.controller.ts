import { Response } from 'express';
import { query } from '../config/database';
import { redis, CACHE_TTL } from '../config/redis';
import { AuthRequest } from '../middleware/auth.middleware';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.params.id || req.user!.userId;
  const cacheKey = `user:${userId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const result = await query(
      `SELECT id, username, display_name, bio, avatar_url, created_at,
              (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count,
              (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following_count,
              (SELECT COUNT(*) FROM posts WHERE author_id = users.id) AS posts_count
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(result.rows[0]));
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { displayName, bio, avatarUrl } = req.body;
  const userId = req.user!.userId;

  try {
    const result = await query(
      `UPDATE users SET display_name = COALESCE($1, display_name),
              bio = COALESCE($2, bio),
              avatar_url = COALESCE($3, avatar_url),
              updated_at = NOW()
       WHERE id = $4
       RETURNING id, username, display_name, bio, avatar_url`,
      [displayName, bio, avatarUrl, userId]
    );

    await redis.del(`user:${userId}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const followUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const followerId = req.user!.userId;
  const { id: followingId } = req.params;

  if (followerId === followingId) {
    res.status(400).json({ message: 'Cannot follow yourself' });
    return;
  }

  try {
    await query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [followerId, followingId]
    );
    await redis.del(`user:${followingId}`);
    res.status(204).send();
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const unfollowUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const followerId = req.user!.userId;
  const { id: followingId } = req.params;

  try {
    await query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    await redis.del(`user:${followingId}`);
    res.status(204).send();
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
