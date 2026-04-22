import { query } from '../config/database';

export interface Schedule {
  id: string;
  post_id: string;
  user_id: string;
  platform: 'twitter' | 'instagram' | 'linkedin' | 'facebook';
  scheduled_at: Date;
  status: 'pending' | 'processing' | 'published' | 'failed';
  error_message?: string;
  job_id?: string;
  created_at: Date;
  updated_at: Date;
}

export const ScheduleModel = {
  findById: (id: string) =>
    query('SELECT * FROM schedules WHERE id = $1', [id]).then(r => r.rows[0] as Schedule | undefined),

  findPending: (before: Date) =>
    query(
      `SELECT s.*, p.content, p.media_url, p.platforms
       FROM schedules s JOIN posts p ON s.post_id = p.id
       WHERE s.status = 'pending' AND s.scheduled_at <= $1`,
      [before]
    ).then(r => r.rows),

  findByUser: (userId: string) =>
    query(
      `SELECT s.*, p.content, p.media_url FROM schedules s
       JOIN posts p ON s.post_id = p.id
       WHERE s.user_id = $1 ORDER BY s.scheduled_at ASC`,
      [userId]
    ).then(r => r.rows as Schedule[]),

  create: (data: Partial<Schedule>) =>
    query(
      `INSERT INTO schedules (id, post_id, user_id, platform, scheduled_at, status)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, 'pending') RETURNING *`,
      [data.post_id, data.user_id, data.platform, data.scheduled_at]
    ).then(r => r.rows[0] as Schedule),

  updateStatus: (id: string, status: Schedule['status'], errorMessage?: string) =>
    query(
      'UPDATE schedules SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
      [status, errorMessage, id]
    ),

  cancel: (id: string, userId: string) =>
    query('DELETE FROM schedules WHERE id = $1 AND user_id = $2', [id, userId]),
};
