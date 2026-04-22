import { query } from '../config/database';

export interface Template {
  id: string;
  user_id?: string;
  name: string;
  content: string;
  category?: string;
  platforms?: string[];
  is_public: boolean;
  created_at: Date;
}

export const TemplateModel = {
  findByUser: (userId: string) =>
    query(
      'SELECT * FROM templates WHERE user_id = $1 OR is_public = true ORDER BY created_at DESC',
      [userId]
    ).then(r => r.rows as Template[]),

  findById: (id: string) =>
    query('SELECT * FROM templates WHERE id = $1', [id])
      .then(r => r.rows[0] as Template | undefined),

  create: (data: Omit<Template, 'id' | 'created_at'>) =>
    query(
      `INSERT INTO templates (user_id, name, content, category, platforms, is_public)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.user_id || null, data.name, data.content, data.category || null,
       data.platforms || null, data.is_public || false]
    ).then(r => r.rows[0] as Template),

  update: (id: string, userId: string, data: Partial<Pick<Template, 'name' | 'content' | 'category' | 'platforms' | 'is_public'>>) =>
    query(
      `UPDATE templates SET
        name      = COALESCE($1, name),
        content   = COALESCE($2, content),
        category  = COALESCE($3, category),
        platforms = COALESCE($4, platforms),
        is_public = COALESCE($5, is_public)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [data.name, data.content, data.category, data.platforms, data.is_public, id, userId]
    ).then(r => r.rows[0] as Template),

  delete: (id: string, userId: string) =>
    query('DELETE FROM templates WHERE id = $1 AND user_id = $2', [id, userId]),
};
