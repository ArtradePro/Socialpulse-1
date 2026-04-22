import { query } from '../config/database';

export interface HashtagSet {
  id: string;
  user_id: string;
  name: string;
  hashtags: string[];
  created_at: Date;
}

export const HashtagSetModel = {
  findByUser: (userId: string) =>
    query('SELECT * FROM hashtag_sets WHERE user_id = $1 ORDER BY name', [userId])
      .then(r => r.rows as HashtagSet[]),

  findById: (id: string, userId: string) =>
    query('SELECT * FROM hashtag_sets WHERE id = $1 AND user_id = $2', [id, userId])
      .then(r => r.rows[0] as HashtagSet | undefined),

  create: (userId: string, name: string, hashtags: string[]) =>
    query(
      'INSERT INTO hashtag_sets (user_id, name, hashtags) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, hashtags]
    ).then(r => r.rows[0] as HashtagSet),

  update: (id: string, userId: string, name: string, hashtags: string[]) =>
    query(
      'UPDATE hashtag_sets SET name = $1, hashtags = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, hashtags, id, userId]
    ).then(r => r.rows[0] as HashtagSet),

  delete: (id: string, userId: string) =>
    query('DELETE FROM hashtag_sets WHERE id = $1 AND user_id = $2', [id, userId]),
};
