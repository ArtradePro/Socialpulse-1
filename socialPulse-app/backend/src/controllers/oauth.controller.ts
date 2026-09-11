// backend/src/controllers/oauth.controller.ts
// Handles OAuth initiation and callbacks for all 4 social platforms.
// State parameter prevents CSRF. Tokens stored in social_accounts.

import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { db } from '../config/database';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const BACKEND_URL  = process.env.BACKEND_URL  ?? 'http://localhost:3000';

// ─── In-memory state store (use Redis in production) ─────────────────────────
// key: state → { userId, codeVerifier? }
const oauthStates = new Map<string, { userId: string; codeVerifier?: string }>();

function mkState(userId: string, codeVerifier?: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.set(state, { userId, codeVerifier });
    // Auto-expire after 10 minutes
    setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);
    return state;
}

function consumeState(state: string): { userId: string; codeVerifier?: string } | null {
    const data = oauthStates.get(state);
    oauthStates.delete(state);
    return data ?? null;
}

// ─── Save / update social account ────────────────────────────────────────────

async function upsertAccount(
    userId:         string,
    platform:       string,
    platformUserId: string,
    username:       string,
    accessToken:    string,
    refreshToken:   string | null,
    tokenExpiresAt: Date | null,
    profileImage:   string | null,
    followersCount: number,
    extra?:         Record<string, unknown>   // platform-specific extras (ig_user_id, etc.)
): Promise<void> {
    await db.query(
        `INSERT INTO social_accounts
             (user_id, platform, platform_user_id, username,
              access_token, refresh_token, token_expires_at,
              profile_image, followers_count, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
         ON CONFLICT (user_id, platform)
         DO UPDATE SET
             platform_user_id = EXCLUDED.platform_user_id,
             username         = EXCLUDED.username,
             access_token     = EXCLUDED.access_token,
             refresh_token    = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
             token_expires_at = EXCLUDED.token_expires_at,
             profile_image    = EXCLUDED.profile_image,
             followers_count  = EXCLUDED.followers_count,
             is_active        = true`,
        [userId, platform, platformUserId, username,
         accessToken, refreshToken, tokenExpiresAt,
         profileImage, followersCount]
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TWITTER (OAuth 2.0 with PKCE — v2 API)
// ─────────────────────────────────────────────────────────────────────────────

function twitterCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}
function twitterCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export const twitterConnect = (req: Request, res: Response): void => {
    const userId        = (req as any).user.userId;
    const codeVerifier  = twitterCodeVerifier();
    const codeChallenge = twitterCodeChallenge(codeVerifier);
    const state         = mkState(userId, codeVerifier);
    const redirect      = `${BACKEND_URL}/api/oauth/twitter/callback`;

    const params = new URLSearchParams({
        response_type:         'code',
        client_id:             process.env.TWITTER_CLIENT_ID!,
        redirect_uri:          redirect,
        scope:                 'tweet.read tweet.write users.read offline.access',
        state,
        code_challenge:        codeChallenge,
        code_challenge_method: 'S256',
    });

    res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
};

export const twitterCallback = async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query as { code?: string; state?: string };
    const stateData = state ? consumeState(state) : null;

    if (!code || !stateData) {
        res.redirect(`${FRONTEND_URL}/settings?error=twitter_auth_failed`);
        return;
    }

    try {
        const redirect = `${BACKEND_URL}/api/oauth/twitter/callback`;
        const tokenRes = await axios.post(
            'https://api.twitter.com/2/oauth2/token',
            new URLSearchParams({
                code,
                grant_type:    'authorization_code',
                client_id:     process.env.TWITTER_CLIENT_ID!,
                redirect_uri:  redirect,
                code_verifier: stateData.codeVerifier!,
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                auth: {
                    username: process.env.TWITTER_CLIENT_ID!,
                    password: process.env.TWITTER_CLIENT_SECRET!,
                },
            }
        );

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

        // Fetch user profile
        const userRes = await axios.get('https://api.twitter.com/2/users/me', {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { 'user.fields': 'profile_image_url,public_metrics' },
        });
        const tu = userRes.data.data;

        await upsertAccount(
            stateData.userId, 'twitter', tu.id, tu.username,
            access_token, refresh_token ?? null, expiresAt,
            tu.profile_image_url ?? null,
            tu.public_metrics?.followers_count ?? 0
        );

        res.redirect(`${FRONTEND_URL}/settings?connected=twitter`);
    } catch (err) {
        console.error('[OAuth] Twitter callback error:', err);
        res.redirect(`${FRONTEND_URL}/settings?error=twitter_auth_failed`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTAGRAM (via Facebook Login → Instagram Basic Display / Graph API)
// ─────────────────────────────────────────────────────────────────────────────

export const instagramConnect = (req: Request, res: Response): void => {
    const userId = (req as any).user.userId;
    const state  = mkState(userId);
    const redirect = `${BACKEND_URL}/api/oauth/instagram/callback`;

    const appId = process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID;
    if (!appId) {
        res.redirect(`${FRONTEND_URL}/settings?error=instagram_app_id_missing`);
        return;
    }

    const params = new URLSearchParams({
        client_id:     appId,
        redirect_uri:  redirect,
        scope:         'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management',
        response_type: 'code',
        state,
    });

    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
};

export const instagramCallback = async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query as { code?: string; state?: string };
    const stateData = state ? consumeState(state) : null;

    if (!code || !stateData) {
        res.redirect(`${FRONTEND_URL}/settings?error=instagram_auth_failed`);
        return;
    }

    const appId = process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;

    try {
        const redirect = `${BACKEND_URL}/api/oauth/instagram/callback`;

        // Exchange code for short-lived token
        const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                client_id:     appId,
                client_secret: appSecret,
                redirect_uri:  redirect,
                code,
            },
        });
        const shortToken = tokenRes.data.access_token;

        // Exchange for long-lived token (60 days)
        const longTokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                grant_type:        'fb_exchange_token',
                client_id:         appId,
                client_secret:     appSecret,
                fb_exchange_token: shortToken,
            },
        });
        const longToken = longTokenRes.data.access_token;
        const expiresIn = longTokenRes.data.expires_in;
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

        // Get Facebook Pages linked to this account
        const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
            params: { access_token: longToken, fields: 'id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}' },
        });

        let pages: any[] = pagesRes.data.data || [];

        // If /me/accounts is empty or no page has instagram_business_account, check business-owned pages
        if (!pages.some(p => p.instagram_business_account)) {
            try {
                const busRes = await axios.get('https://graph.facebook.com/v19.0/me/businesses', {
                    params: {
                        access_token: longToken,
                        fields: 'id,name,owned_pages{id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}},client_pages{id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}}'
                    },
                });
                for (const bus of (busRes.data?.data || [])) {
                    if (bus.owned_pages?.data) pages.push(...bus.owned_pages.data);
                    if (bus.client_pages?.data) pages.push(...bus.client_pages.data);
                }
            } catch (busErr) {
                console.warn('[OAuth] me/businesses lookup warning for Instagram:', busErr);
            }
        }

        console.log('[OAuth] Instagram candidate pages found:', pages.map(p => ({
            id: p.id,
            name: p.name,
            hasIg: !!p.instagram_business_account
        })));

        const pageWithIg = pages.find((p: any) => p.instagram_business_account?.id);
        if (!pageWithIg || !pageWithIg.instagram_business_account) {
            console.error('[OAuth] No linked Instagram business account found across pages');
            res.redirect(`${FRONTEND_URL}/settings?error=instagram_no_business_account`);
            return;
        }

        const igAccount = pageWithIg.instagram_business_account;
        const igUserId = igAccount.id;
        const tokenToStore = pageWithIg.access_token || longToken;

        let username = igAccount.username;
        let profilePic = igAccount.profile_picture_url;
        let followers = igAccount.followers_count;

        if (!username) {
            try {
                const igRes = await axios.get(`https://graph.facebook.com/v19.0/${igUserId}`, {
                    params: {
                        fields:       'id,username,profile_picture_url,followers_count',
                        access_token: tokenToStore,
                    },
                });
                username = igRes.data.username;
                profilePic = igRes.data.profile_picture_url ?? profilePic;
                followers = igRes.data.followers_count ?? followers;
            } catch (igFetchErr) {
                console.warn('[OAuth] Could not fetch extra IG profile details:', igFetchErr);
            }
        }

        await upsertAccount(
            stateData.userId, 'instagram', igUserId, username || 'Instagram Business',
            tokenToStore, null, expiresAt,
            profilePic ?? null, followers ?? 0
        );

        res.redirect(`${FRONTEND_URL}/settings?connected=instagram`);
    } catch (err: any) {
        console.error('[OAuth] Instagram callback error:', err?.response?.data || err.message);
        res.redirect(`${FRONTEND_URL}/settings?error=instagram_auth_failed`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LINKEDIN (OAuth 2.0 with openid connect)
// ─────────────────────────────────────────────────────────────────────────────

export const linkedinConnect = (req: Request, res: Response): void => {
    const userId = (req as any).user.userId;
    const state  = mkState(userId);
    const redirect = `${BACKEND_URL}/api/oauth/linkedin/callback`;

    const params = new URLSearchParams({
        response_type: 'code',
        client_id:     process.env.LINKEDIN_CLIENT_ID!,
        redirect_uri:  redirect,
        scope:         'openid profile email w_member_social r_liteprofile',
        state,
    });

    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
};

export const linkedinCallback = async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query as { code?: string; state?: string };
    const stateData = state ? consumeState(state) : null;

    if (!code || !stateData) {
        res.redirect(`${FRONTEND_URL}/settings?error=linkedin_auth_failed`);
        return;
    }

    try {
        const redirect = `${BACKEND_URL}/api/oauth/linkedin/callback`;

        const tokenRes = await axios.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            new URLSearchParams({
                grant_type:    'authorization_code',
                code,
                redirect_uri:  redirect,
                client_id:     process.env.LINKEDIN_CLIENT_ID!,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

        // Get profile using OpenID userinfo endpoint
        const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        const p = profileRes.data;
        const platformUserId = p.sub;
        const username = p.name ?? p.email ?? platformUserId;
        const avatar   = p.picture ?? null;

        // Get follower count via /networkSizes (may 403 without proper permissions — graceful fallback)
        let followers = 0;
        try {
            const nwRes = await axios.get(
                `https://api.linkedin.com/v2/networkSizes/${platformUserId}?edgeType=CompanyFollowedByMember`,
                { headers: { Authorization: `Bearer ${access_token}` } }
            );
            followers = nwRes.data.firstDegreeSize ?? 0;
        } catch { /* not critical */ }

        await upsertAccount(
            stateData.userId, 'linkedin', platformUserId, username,
            access_token, refresh_token ?? null, expiresAt,
            avatar, followers
        );

        res.redirect(`${FRONTEND_URL}/settings?connected=linkedin`);
    } catch (err) {
        console.error('[OAuth] LinkedIn callback error:', err);
        res.redirect(`${FRONTEND_URL}/settings?error=linkedin_auth_failed`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// FACEBOOK (OAuth 2.0 — Pages API)
// ─────────────────────────────────────────────────────────────────────────────

export const facebookConnect = (req: Request, res: Response): void => {
    const userId = (req as any).user.userId;
    const state  = mkState(userId);
    const redirect = `${BACKEND_URL}/api/oauth/facebook/callback`;

    const params = new URLSearchParams({
        client_id:     process.env.FACEBOOK_APP_ID!,
        redirect_uri:  redirect,
        scope:         'pages_show_list,pages_manage_posts,pages_read_engagement,business_management',
        state,
        response_type: 'code',
    });

    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
};

export const facebookCallback = async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query as { code?: string; state?: string };
    const stateData = state ? consumeState(state) : null;

    if (!code || !stateData) {
        res.redirect(`${FRONTEND_URL}/settings?error=facebook_auth_failed`);
        return;
    }

    try {
        const redirect = `${BACKEND_URL}/api/oauth/facebook/callback`;

        const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                client_id:     process.env.FACEBOOK_APP_ID,
                client_secret: process.env.FACEBOOK_APP_SECRET,
                redirect_uri:  redirect,
                code,
            },
        });
        const shortToken = tokenRes.data.access_token;

        // Exchange for long-lived token
        const longTokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
            params: {
                grant_type:        'fb_exchange_token',
                client_id:         process.env.FACEBOOK_APP_ID,
                client_secret:     process.env.FACEBOOK_APP_SECRET,
                fb_exchange_token: shortToken,
            },
        });
        const longToken = longTokenRes.data.access_token;
        const expiresIn = longTokenRes.data.expires_in;
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

        // Get user and pages
        const meRes = await axios.get('https://graph.facebook.com/v19.0/me', {
            params: { fields: 'id,name,picture', access_token: longToken },
        });
        const fbUser = meRes.data;

        const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
            params: { access_token: longToken, fields: 'id,name,fan_count,picture,access_token' },
        });

        let pages: any[] = pagesRes.data.data || [];

        // If /me/accounts is empty, check business-owned pages via me/businesses
        if (pages.length === 0) {
            try {
                const busRes = await axios.get('https://graph.facebook.com/v19.0/me/businesses', {
                    params: { access_token: longToken, fields: 'id,name,owned_pages{id,name,picture,access_token},client_pages{id,name,picture,access_token}' },
                });
                for (const bus of (busRes.data?.data || [])) {
                    if (bus.owned_pages?.data) pages.push(...bus.owned_pages.data);
                    if (bus.client_pages?.data) pages.push(...bus.client_pages.data);
                }
            } catch (busErr) {
                console.warn('[OAuth] me/businesses lookup warning:', busErr);
            }
        }

        console.log('[OAuth] Facebook pages found:', pages.map(p => ({ id: p.id, name: p.name })));

        // Use the first managed page; store the page token (not user token) for publishing
        const page = pages[0];
        if (!page) {
            res.redirect(`${FRONTEND_URL}/settings?error=facebook_no_page`);
            return;
        }

        // Fetch page token (permanent) if not already included in accounts/businesses response
        let pageToken = page.access_token;
        if (!pageToken) {
            try {
                const pageTokenRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
                    params: { fields: 'access_token', access_token: longToken },
                });
                pageToken = pageTokenRes.data.access_token ?? longToken;
            } catch {
                pageToken = longToken;
            }
        }

        await upsertAccount(
            stateData.userId, 'facebook', page.id, page.name,
            pageToken, null, expiresAt,
            page.picture?.data?.url ?? null, page.fan_count ?? 0
        );

        res.redirect(`${FRONTEND_URL}/settings?connected=facebook`);
    } catch (err) {
        console.error('[OAuth] Facebook callback error:', err);
        res.redirect(`${FRONTEND_URL}/settings?error=facebook_auth_failed`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TIKTOK (OAuth 2.0 with PKCE)
// ─────────────────────────────────────────────────────────────────────────────

export const tiktokConnect = (req: Request, res: Response): void => {
    const userId        = (req as any).user.userId;
    const codeVerifier  = twitterCodeVerifier(); // PKCE verifier
    const codeChallenge = twitterCodeChallenge(codeVerifier);
    const state         = mkState(userId, codeVerifier);
    const redirect      = process.env.TIKTOK_REDIRECT_URI || 'https://api.usesocialpulse.com/api/oauth/tiktok/callback';

    const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID || '';

    const params = new URLSearchParams({
        client_key:            clientKey,
        scope:                 'user.info.basic,video.publish,video.upload',
        response_type:         'code',
        redirect_uri:          redirect,
        state,
        code_challenge:        codeChallenge,
        code_challenge_method: 'S256',
    });

    res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params}`);
};

export const tiktokCallback = async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query as { code?: string; state?: string };
    const stateData = state ? consumeState(state) : null;

    if (!stateData || !code) {
        res.redirect(`${FRONTEND_URL}/settings?error=invalid_state`);
        return;
    }

    try {
        const clientKey    = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID || '';
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
        const redirect     = process.env.TIKTOK_REDIRECT_URI || 'https://api.usesocialpulse.com/api/oauth/tiktok/callback';

        // Exchange code for token
        const tokenRes = await axios.post(
            'https://open.tiktokapis.com/v2/oauth/token/',
            new URLSearchParams({
                client_key:     clientKey,
                client_secret:  clientSecret,
                code:           code,
                grant_type:     'authorization_code',
                redirect_uri:   redirect,
                code_verifier:  stateData.codeVerifier || '',
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const data = tokenRes.data?.data || tokenRes.data;
        const accessToken   = data.access_token;
        const refreshToken  = data.refresh_token ?? null;
        const expiresIn     = data.expires_in ?? 86400;
        const openId        = data.open_id;

        // Fetch user info from TikTok
        const userRes = await axios.get('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userInfo = userRes.data?.data?.user || {};
        const username = userInfo.display_name || openId || 'TikTok Creator';
        const profileImage = userInfo.avatar_url || null;

        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        await upsertAccount(
            stateData.userId,
            'tiktok',
            openId || userInfo.union_id || username,
            username,
            accessToken,
            refreshToken,
            expiresAt,
            profileImage,
            0
        );

        res.redirect(`${FRONTEND_URL}/settings?connected=tiktok`);
    } catch (err: any) {
        console.error('[TikTok OAuth Error]:', err.response?.data ?? err.message);
        res.redirect(`${FRONTEND_URL}/settings?error=tiktok_auth_failed`);
    }
};
