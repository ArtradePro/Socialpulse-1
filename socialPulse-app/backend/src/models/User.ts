import { query } from '../config/database';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  avatar_url?: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  ai_credits: number;
  created_at: Date;
  updated_at: Date;
}

export const UserModel = {
  findById: (id: string) =>
    query('SELECT * FROM users WHERE id = $1', [id]).then(r => r.rows[0] as User | undefined),

  findByEmail: (email: string) =>
    query('SELECT * FROM users WHERE email = $1', [email]).then(r => r.rows[0] as User | undefined),

  create: (data: Pick<User, 'email' | 'full_name'> & { password_hash?: string }) =>
    query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.email, data.password_hash, data.full_name]
    ).then(r => r.rows[0] as User),

  update: (id: string, data: Partial<Pick<User, 'full_name' | 'avatar_url' | 'plan'>>) =>
    query(
      `UPDATE users SET
        full_name  = COALESCE($1, full_name),
        avatar_url = COALESCE($2, avatar_url),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [data.full_name, data.avatar_url, id]
    ).then(r => r.rows[0] as User),

  decrementCredits: (id: string, amount = 1) =>
    query(
      `UPDATE users SET ai_credits = GREATEST(0, ai_credits - $1), updated_at = NOW()
       WHERE id = $2 RETURNING ai_credits`,
      [amount, id]
    ).then(r => r.rows[0] as { ai_credits: number }),
};
