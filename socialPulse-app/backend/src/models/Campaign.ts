import { query } from '../config/database';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status: 'active' | 'paused' | 'completed';
  created_at: Date;
}

export const CampaignModel = {
  findByUser: (userId: string) =>
    query('SELECT * FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC', [userId])
      .then(r => r.rows as Campaign[]),

  findById: (id: string, userId: string) =>
    query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [id, userId])
      .then(r => r.rows[0] as Campaign | undefined),

  create: (data: Omit<Campaign, 'id' | 'created_at'>) =>
    query(
      `INSERT INTO campaigns (user_id, name, description, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.user_id, data.name, data.description || null, data.start_date || null,
       data.end_date || null, data.status || 'active']
    ).then(r => r.rows[0] as Campaign),

  update: (id: string, userId: string, data: Partial<Pick<Campaign, 'name' | 'description' | 'start_date' | 'end_date' | 'status'>>) =>
    query(
      `UPDATE campaigns SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        start_date  = COALESCE($3, start_date),
        end_date    = COALESCE($4, end_date),
        status      = COALESCE($5, status)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [data.name, data.description, data.start_date, data.end_date, data.status, id, userId]
    ).then(r => r.rows[0] as Campaign),

  delete: (id: string, userId: string) =>
    query('DELETE FROM campaigns WHERE id = $1 AND user_id = $2', [id, userId]),
};
