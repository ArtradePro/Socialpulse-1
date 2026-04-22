import { query } from '../config/database';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];  // stored as JSONB
  hashtags?: string[];
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at?: Date;
  published_at?: Date;
  ai_generated: boolean;
  campaign_id?: string;
  created_at: Date;
  updated_at: Date;
}

export const PostModel = {
  findById: (id: string) =>
    query('SELECT * FROM posts WHERE id = $1', [id])
      .then(r => r.rows[0] as Post | undefined),

  findByUser: (userId: string, limit = 20, offset = 0) =>
    query(
      'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    ).then(r => r.rows as Post[]),

  findByStatus: (userId: string, status: Post['status']) =>
    query(
      'SELECT * FROM posts WHERE user_id = $1 AND status = $2 ORDER BY scheduled_at ASC',
      [userId, status]
    ).then(r => r.rows as Post[]),

  create: (data: Omit<Post, 'id' | 'created_at' | 'updated_at'>) =>
    query(
      `INSERT INTO posts (user_id, content, media_urls, hashtags, platforms, status, scheduled_at, ai_generated, campaign_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.user_id,
        data.content,
        JSON.stringify(data.media_urls || []),
        data.hashtags || [],
        data.platforms,
        data.status || 'draft',
        data.scheduled_at || null,
        data.ai_generated || false,
        data.campaign_id || null,
      ]
    ).then(r => r.rows[0] as Post),

  update: (id: string, userId: string, data: Partial<Pick<Post, 'content' | 'media_urls' | 'hashtags' | 'platforms' | 'status' | 'scheduled_at' | 'published_at' | 'campaign_id'>>) =>
    query(
      `UPDATE posts SET
        content      = COALESCE($1, content),
        media_urls   = COALESCE($2, media_urls),
        hashtags     = COALESCE($3, hashtags),
        platforms    = COALESCE($4, platforms),
        status       = COALESCE($5, status),
        scheduled_at = COALESCE($6, scheduled_at),
        published_at = COALESCE($7, published_at),
        campaign_id  = COALESCE($8, campaign_id),
        updated_at   = NOW()
       WHERE id = $9 AND user_id = $10 RETURNING *`,
      [
        data.content,
        data.media_urls ? JSON.stringify(data.media_urls) : null,
        data.hashtags || null,
        data.platforms || null,
        data.status,
        data.scheduled_at,
        data.published_at,
        data.campaign_id,
        id,
        userId,
      ]
    ).then(r => r.rows[0] as Post),

  delete: (id: string, userId: string) =>
    query('DELETE FROM posts WHERE id = $1 AND user_id = $2', [id, userId]),
};
