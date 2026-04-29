import Bull from 'bull';
import cron from 'node-cron';
import axios from 'axios';
import { query } from '../config/database';
import { SocialAccountModel } from '../models/SocialAccount';
import { TwitterApi } from 'twitter-api-v2';

const redisOpts = process.env.REDIS_URL ?? {
    redis: {
        host:     process.env.REDIS_HOST || 'localhost',
        port:     parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
    },
};

export const analyticsQueue = new Bull('analytics-sync', redisOpts);

// ─── Per-platform metric fetchers ────────────────────────────────────────────

interface Metrics {
    likes:          number;
    comments:       number;
    shares:         number;
    impressions:    number;
    reach:          number;
    clicks:         number;
    engagementRate: number;
}

async function fetchTwitterMetrics(account: any, platformPostId: string): Promise<Metrics | null> {
    try {
        const client = new TwitterApi({
            appKey:      process.env.TWITTER_API_KEY!,
            appSecret:   process.env.TWITTER_API_SECRET!,
            accessToken: account.access_token,
            // Twitter v2 bearer for public metrics — fall back to user context for private
        });
        const tweet = await client.v2.singleTweet(platformPostId, {
            'tweet.fields': ['public_metrics', 'non_public_metrics', 'organic_metrics'],
        });
        const pub = tweet.data.public_metrics as {
            like_count?: number;
            reply_count?: number;
            retweet_count?: number;
            quote_count?: number;
            impression_count?: number;
            url_link_clicks?: number;
        } | undefined;
        return {
            likes:          pub?.like_count           ?? 0,
            comments:       pub?.reply_count          ?? 0,
            shares:         (pub?.retweet_count ?? 0) + (pub?.quote_count ?? 0),
            impressions:    pub?.impression_count      ?? 0,
            reach:          pub?.impression_count      ?? 0,
            clicks:         pub?.url_link_clicks       ?? 0,
            engagementRate: 0,
        };
    } catch (err) {
        console.error('[AnalyticsSync] Twitter metrics error:', err);
        return null;
    }
}

async function fetchInstagramMetrics(account: any, platformPostId: string): Promise<Metrics | null> {
    try {
        const res = await axios.get(`https://graph.facebook.com/v19.0/${platformPostId}/insights`, {
            params: {
                metric:       'impressions,reach,engagement,saved',
                access_token: account.access_token,
            },
        });

        const data: Record<string, number> = {};
        for (const item of res.data.data ?? []) {
            data[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
        }

        // Also fetch like/comment counts from the media object
        const mediaRes = await axios.get(`https://graph.facebook.com/v19.0/${platformPostId}`, {
            params: {
                fields:       'like_count,comments_count',
                access_token: account.access_token,
            },
        });

        const likes    = mediaRes.data.like_count ?? 0;
        const comments = mediaRes.data.comments_count ?? 0;
        const imp      = data['impressions'] ?? 0;
        const eng      = data['engagement']  ?? 0;

        return {
            likes,
            comments,
            shares:         data['saved']  ?? 0,
            impressions:    imp,
            reach:          data['reach']  ?? 0,
            clicks:         0,
            engagementRate: imp > 0 ? parseFloat(((eng / imp) * 100).toFixed(2)) : 0,
        };
    } catch (err) {
        console.error('[AnalyticsSync] Instagram metrics error:', err);
        return null;
    }
}

async function fetchLinkedInMetrics(account: any, platformPostId: string): Promise<Metrics | null> {
    try {
        const encoded = encodeURIComponent(platformPostId);
        const res = await axios.get(
            `https://api.linkedin.com/v2/socialMetadata/${encoded}`,
            { headers: { Authorization: `Bearer ${account.access_token}` } }
        );
        const sm = res.data;
        const likes    = sm.likesSummary?.totalLikes    ?? 0;
        const comments = sm.commentsSummary?.totalFirstLevelComments ?? 0;
        const shares   = sm.shareStatistics?.shareCount ?? 0;
        const imp      = sm.impressionCount              ?? 0;
        const eng      = likes + comments + shares;

        return {
            likes, comments, shares,
            impressions:    imp,
            reach:          imp,
            clicks:         sm.clickCount ?? 0,
            engagementRate: imp > 0 ? parseFloat(((eng / imp) * 100).toFixed(2)) : 0,
        };
    } catch (err) {
        console.error('[AnalyticsSync] LinkedIn metrics error:', err);
        return null;
    }
}

async function fetchFacebookMetrics(account: any, platformPostId: string): Promise<Metrics | null> {
    try {
        const res = await axios.get(`https://graph.facebook.com/v19.0/${platformPostId}/insights`, {
            params: {
                metric:       'post_impressions,post_engagements,post_clicks,post_reactions_by_type_total',
                access_token: account.access_token,
            },
        });

        const data: Record<string, number> = {};
        for (const item of res.data.data ?? []) {
            data[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
        }

        const imp = data['post_impressions']  ?? 0;
        const eng = data['post_engagements']  ?? 0;

        return {
            likes:          data['post_reactions_by_type_total'] ?? 0,
            comments:       0,
            shares:         0,
            impressions:    imp,
            reach:          imp,
            clicks:         data['post_clicks'] ?? 0,
            engagementRate: imp > 0 ? parseFloat(((eng / imp) * 100).toFixed(2)) : 0,
        };
    } catch (err) {
        console.error('[AnalyticsSync] Facebook metrics error:', err);
        return null;
    }
}

// ─── Queue processor ─────────────────────────────────────────────────────────

analyticsQueue.process('sync-user', async (job) => {
    const { userId } = job.data;

    const accounts = await SocialAccountModel.findByUser(userId);
    const accountByPlatform: Record<string, any> = {};
    for (const acc of accounts) accountByPlatform[acc.platform] = acc;

    // Fetch published post analytics rows that need refreshing (synced_at older than 1h)
    const posts = await query(
        `SELECT pa.id, pa.post_id, pa.platform, pa.platform_post_id
         FROM post_analytics pa
         JOIN posts p ON p.id = pa.post_id
         WHERE p.user_id = $1
           AND pa.platform_post_id IS NOT NULL
           AND (pa.synced_at IS NULL OR pa.synced_at < NOW() - INTERVAL '1 hour')
           AND p.published_at > NOW() - INTERVAL '30 days'
         ORDER BY p.published_at DESC`,
        [userId]
    );

    for (const row of posts.rows) {
        const account = accountByPlatform[row.platform];
        if (!account) continue;

        let metrics: Metrics | null = null;

        switch (row.platform) {
            case 'twitter':
                metrics = await fetchTwitterMetrics(account, row.platform_post_id); break;
            case 'instagram':
                metrics = await fetchInstagramMetrics(account, row.platform_post_id); break;
            case 'linkedin':
                metrics = await fetchLinkedInMetrics(account, row.platform_post_id); break;
            case 'facebook':
                metrics = await fetchFacebookMetrics(account, row.platform_post_id); break;
        }

        if (!metrics) continue;

        await query(
            `UPDATE post_analytics
             SET likes           = $1,
                 comments        = $2,
                 shares          = $3,
                 impressions     = $4,
                 reach           = $5,
                 clicks          = $6,
                 engagement_rate = $7,
                 synced_at       = NOW()
             WHERE id = $8`,
            [
                metrics.likes, metrics.comments, metrics.shares,
                metrics.impressions, metrics.reach, metrics.clicks,
                metrics.engagementRate, row.id,
            ]
        );
    }
});

// ─── Daily cron + on-demand trigger ──────────────────────────────────────────

export const initAnalyticsSync = (): void => {
    // 02:00 UTC daily — fan out a sync job for every user with active social accounts
    cron.schedule('0 2 * * *', async () => {
        try {
            const result = await query(
                'SELECT DISTINCT user_id FROM social_accounts WHERE is_active = true'
            );
            for (const { user_id } of result.rows) {
                await analyticsQueue.add('sync-user', { userId: user_id }, {
                    removeOnComplete: 10,
                    removeOnFail:     100,
                });
            }
            console.log(`[AnalyticsSync] Queued daily sync for ${result.rows.length} users`);
        } catch (err) {
            console.error('[AnalyticsSync] Daily cron error:', err);
        }
    });
    console.log('[AnalyticsSync] Daily sync cron initialized (02:00 UTC)');
};

/** Queue a sync 30 min after a post is published so metrics have time to populate */
export const triggerUserSync = async (userId: string): Promise<void> => {
    await analyticsQueue.add('sync-user', { userId }, {
        delay:            30 * 60 * 1000,
        removeOnComplete: 10,
        removeOnFail:     100,
    });
};

