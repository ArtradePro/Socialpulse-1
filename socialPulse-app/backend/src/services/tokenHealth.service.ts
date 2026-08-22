import { db } from '../config/database';
import axios from 'axios';

export interface TokenHealthStatus {
    id: string;
    platform: string;
    username: string;
    status: 'healthy' | 'expiring_soon' | 'expired' | 'no_expiration';
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    requiresReconnect: boolean;
}

export class TokenHealthService {
    /**
     * Checks token health for all social accounts belonging to a user.
     */
    static async checkUserTokens(userId: string): Promise<TokenHealthStatus[]> {
        const { rows } = await db.query(
            `SELECT id, platform, username, token_expires_at, refresh_token, access_token, is_active
             FROM social_accounts
             WHERE user_id = $1 AND is_active = true`,
            [userId]
        );

        const now = Date.now();
        const results: TokenHealthStatus[] = [];

        for (const row of rows) {
            let status: 'healthy' | 'expiring_soon' | 'expired' | 'no_expiration' = 'healthy';
            let daysUntilExpiry: number | null = null;
            let requiresReconnect = false;

            if (!row.token_expires_at) {
                status = 'no_expiration';
            } else {
                const expiresTime = new Date(row.token_expires_at).getTime();
                const diffMs = expiresTime - now;
                daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                if (diffMs <= 0) {
                    status = 'expired';
                    requiresReconnect = true;
                } else if (daysUntilExpiry <= 7) {
                    status = 'expiring_soon';
                    // Try proactive silent token refresh if refresh token exists
                    const refreshed = await this.tryRefreshToken(row);
                    if (refreshed) {
                        status = 'healthy';
                        requiresReconnect = false;
                    } else {
                        requiresReconnect = true;
                    }
                }
            }

            results.push({
                id: row.id,
                platform: row.platform,
                username: row.username,
                status,
                expiresAt: row.token_expires_at ? new Date(row.token_expires_at).toISOString() : null,
                daysUntilExpiry,
                requiresReconnect,
            });
        }

        return results;
    }

    /**
     * Attempts to refresh an expiring token for supported platforms (Meta, TikTok).
     */
    private static async tryRefreshToken(account: any): Promise<boolean> {
        try {
            if (account.platform === 'tiktok' && account.refresh_token) {
                const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID || '';
                const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';

                const res = await axios.post(
                    'https://open.tiktokapis.com/v2/oauth/token/',
                    new URLSearchParams({
                        client_key: clientKey,
                        client_secret: clientSecret,
                        grant_type: 'refresh_token',
                        refresh_token: account.refresh_token,
                    }).toString(),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );

                const data = res.data?.data || res.data;
                if (data.access_token) {
                    const newExpiresAt = new Date(Date.now() + (data.expires_in || 86400) * 1000);
                    await db.query(
                        `UPDATE social_accounts
                         SET access_token = $1,
                             refresh_token = COALESCE($2, refresh_token),
                             token_expires_at = $3,
                             updated_at = NOW()
                         WHERE id = $4`,
                        [data.access_token, data.refresh_token, newExpiresAt, account.id]
                    );
                    console.log(`[TokenHealth] Successfully refreshed TikTok token for ${account.username}`);
                    return true;
                }
            }
            return false;
        } catch (err: any) {
            console.warn(`[TokenHealth] Failed auto-refresh for ${account.platform} (${account.username}):`, err.message);
            return false;
        }
    }
}
