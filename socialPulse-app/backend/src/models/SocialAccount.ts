import { query } from '../config/database';

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: 'twitter' | 'instagram' | 'linkedin' | 'facebook';
  platform_user_id: string;
  username: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: Date;
  profile_image?: string;
  followers_count: number;
  is_active: boolean;
  created_at: Date;
}

export const SocialAccountModel = {
  findByUser: (userId: string) =>
    query(
      `SELECT id, user_id, platform, platform_user_id, username,
              profile_image, followers_count, is_active, created_at
       FROM social_accounts WHERE user_id = $1 ORDER BY platform`,
      [userId]
    ).then(r => r.rows as Omit<SocialAccount, 'access_token' | 'refresh_token'>[]),

  findByUserAndPlatform: (userId: string, platform: string) =>
    query(
      'SELECT * FROM social_accounts WHERE user_id = $1 AND platform = $2 AND is_active = true',
      [userId, platform]
    ).then(r => r.rows[0] as SocialAccount | undefined),

  upsert: (data: Omit<SocialAccount, 'id' | 'created_at'>) =>
    query(
      `INSERT INTO social_accounts
        (user_id, platform, platform_user_id, username, access_token, refresh_token,
         token_expires_at, profile_image, followers_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, platform) DO UPDATE SET
        username         = EXCLUDED.username,
        access_token     = EXCLUDED.access_token,
        refresh_token    = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        profile_image    = EXCLUDED.profile_image,
        followers_count  = EXCLUDED.followers_count,
        is_active        = true
       RETURNING *`,
      [
        data.user_id, data.platform, data.platform_user_id, data.username,
        data.access_token, data.refresh_token || null, data.token_expires_at || null,
        data.profile_image || null, data.followers_count || 0,
      ]
    ).then(r => r.rows[0] as SocialAccount),

  disconnect: (userId: string, platform: string) =>
    query(
      'UPDATE social_accounts SET is_active = false WHERE user_id = $1 AND platform = $2',
      [userId, platform]
    ),
};
