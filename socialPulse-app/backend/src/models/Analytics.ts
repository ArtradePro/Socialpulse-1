import { query } from '../config/database';

export interface PostAnalytics {
  id: string;
  post_id: string;
  platform: string;
  platform_post_id?: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  clicks: number;
  engagement_rate: number;
  synced_at: Date;
}

export const PostAnalyticsModel = {
  upsert: (data: Omit<PostAnalytics, 'id' | 'synced_at'>) =>
    query(
      `INSERT INTO post_analytics
        (post_id, platform, platform_post_id, likes, comments, shares,
         impressions, reach, clicks, engagement_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (post_id, platform) DO UPDATE SET
        likes            = EXCLUDED.likes,
        comments         = EXCLUDED.comments,
        shares           = EXCLUDED.shares,
        impressions      = EXCLUDED.impressions,
        reach            = EXCLUDED.reach,
        clicks           = EXCLUDED.clicks,
        engagement_rate  = EXCLUDED.engagement_rate,
        synced_at        = NOW()
       RETURNING *`,
      [
        data.post_id, data.platform, data.platform_post_id || null,
        data.likes, data.comments, data.shares,
        data.impressions, data.reach, data.clicks, data.engagement_rate,
      ]
    ).then(r => r.rows[0] as PostAnalytics),

  findByPost: (postId: string) =>
    query('SELECT * FROM post_analytics WHERE post_id = $1', [postId])
      .then(r => r.rows as PostAnalytics[]),

  getTopPosts: (userId: string, limit = 10) =>
    query(
      `SELECT p.id, p.content, p.platforms, p.published_at,
              SUM(pa.likes + pa.comments + pa.shares) AS total_engagement,
              SUM(pa.impressions) AS total_impressions
       FROM posts p
       JOIN post_analytics pa ON pa.post_id = p.id
       WHERE p.user_id = $1 AND p.status = 'published'
       GROUP BY p.id
       ORDER BY total_engagement DESC NULLS LAST
       LIMIT $2`,
      [userId, limit]
    ).then(r => r.rows),

  getDashboardSummary: (userId: string) =>
    query(
      `SELECT
        pa.platform,
        SUM(pa.impressions)  AS total_impressions,
        SUM(pa.likes)        AS total_likes,
        SUM(pa.comments)     AS total_comments,
        SUM(pa.shares)       AS total_shares,
        AVG(pa.engagement_rate) AS avg_engagement_rate
       FROM post_analytics pa
       JOIN posts p ON p.id = pa.post_id
       WHERE p.user_id = $1
       GROUP BY pa.platform`,
      [userId]
    ).then(r => r.rows),
};
