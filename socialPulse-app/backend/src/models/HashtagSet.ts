import { query } from '../config/database';

export interface HashtagSet {
  id: string;
  user_id: string;
  name: string;
  hashtags: string[];
  workspace_id?: string | null;
  created_at: Date;
}

export const HashtagSetModel = {
  findByUser: (userId: string, workspaceId?: string) =>
    query(
      'SELECT * FROM hashtag_sets WHERE user_id = $1 AND (workspace_id = $2 OR $2 IS NULL) ORDER BY name',
      [userId, workspaceId || null]
    ).then(r => r.rows as HashtagSet[]),

  findById: (id: string, userId: string, workspaceId?: string) =>
    query(
      'SELECT * FROM hashtag_sets WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR $3 IS NULL)',
      [id, userId, workspaceId || null]
    ).then(r => r.rows[0] as HashtagSet | undefined),

  create: (userId: string, name: string, hashtags: string[], workspaceId?: string) =>
    query(
      'INSERT INTO hashtag_sets (user_id, workspace_id, name, hashtags) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, workspaceId || null, name, hashtags]
    ).then(r => r.rows[0] as HashtagSet),

  update: (id: string, userId: string, name: string, hashtags: string[], workspaceId?: string) =>
    query(
      `UPDATE hashtag_sets SET name = $1, hashtags = $2 
       WHERE id = $3 AND user_id = $4 AND (workspace_id = $5 OR $5 IS NULL) RETURNING *`,
      [name, hashtags, id, userId, workspaceId || null]
    ).then(r => r.rows[0] as HashtagSet),

  delete: (id: string, userId: string) =>
    query('DELETE FROM hashtag_sets WHERE id = $1 AND user_id = $2', [id, userId]),
};
