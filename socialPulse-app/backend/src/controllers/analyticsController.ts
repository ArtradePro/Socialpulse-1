// server/src/controllers/analyticsController.ts
import { Request, Response } from 'express';
import { db } from '../config/database';
import { AIService } from '../services/ai.service';


// ─── Helpers ──────────────────────────────────────────────────────────────────

const rangeToInterval = (range: string): string => {
    const map: Record<string, string> = {
        '7d': '7 days', '14d': '14 days', '30d': '30 days', '90d': '90 days',
    };
    return map[range] ?? '30 days';
};

const deltaPercent = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat(((current - previous) / previous * 100).toFixed(1));
};

// ─── Dashboard (main endpoint) ────────────────────────────────────────────────

export const getDashboard = async (req: Request, res: Response) => {
    try {
        const userId   = req.user!.userId;

        // Whitelist range and platform to prevent injection via string interpolation
        const VALID_RANGES    = new Set(['7d', '14d', '30d', '90d']);
        const VALID_PLATFORMS = new Set(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube', 'pinterest']);
        const rawRange    = (req.query.range as string)    || '30d';
        const rawPlatform = (req.query.platform as string) || 'all';
        const range    = VALID_RANGES.has(rawRange)       ? rawRange    : '30d';
        const platform = VALID_PLATFORMS.has(rawPlatform) ? rawPlatform : 'all';
        const interval = rangeToInterval(range);

        // platformParam drives parameterized filtering. null = all platforms.
        const platformParam: string | null = platform !== 'all' ? platform : null;

        // ── Run independent queries in parallel ──────────────────────────────
        const [metricsNow, metricsPrev, followersNow, dailySeries, platformRows,
               topPosts, allPosts, heatmapRaw] = await Promise.all([

            // Current-period metrics
            db.query(`
                SELECT
                    COALESCE(SUM(pa.impressions), 0) AS impressions,
                    COALESCE(SUM(pa.reach),       0) AS reach,
                    COALESCE(SUM(pa.likes + pa.comments + pa.shares), 0) AS engagements,
                    COALESCE(SUM(pa.clicks),      0) AS clicks,
                    COALESCE(AVG(pa.engagement_rate), 0) AS avg_er,
                    COUNT(DISTINCT p.id) AS posts_count
                FROM posts p
                LEFT JOIN post_analytics pa ON p.id = pa.post_id
                WHERE p.user_id = $1
                  AND p.published_at >= NOW() - INTERVAL '${interval}'
                  AND ($2::text IS NULL OR pa.platform = $2)
            `, [userId, platformParam]),

            // Previous-period metrics (for deltas)
            db.query(`
                SELECT
                    COALESCE(SUM(pa.impressions), 0) AS impressions,
                    COALESCE(SUM(pa.reach),       0) AS reach,
                    COALESCE(SUM(pa.likes + pa.comments + pa.shares), 0) AS engagements,
                    COALESCE(SUM(pa.clicks),      0) AS clicks
                FROM posts p
                LEFT JOIN post_analytics pa ON p.id = pa.post_id
                WHERE p.user_id = $1
                  AND p.published_at >= NOW() - INTERVAL '${interval}' * 2
                  AND p.published_at <  NOW() - INTERVAL '${interval}'
                  AND ($2::text IS NULL OR pa.platform = $2)
            `, [userId, platformParam]),

            // Follower totals
            db.query(`
                SELECT COALESCE(SUM(followers_count), 0) AS total
                FROM social_accounts
                WHERE user_id = $1 AND is_active = true
                  AND ($2::text IS NULL OR platform = $2)
            `, [userId, platformParam]),

            // Daily engagement series
            db.query(`
                SELECT
                    DATE(p.published_at) AS date,
                    COALESCE(SUM(pa.likes),       0) AS likes,
                    COALESCE(SUM(pa.comments),    0) AS comments,
                    COALESCE(SUM(pa.shares),      0) AS shares,
                    COALESCE(SUM(pa.impressions), 0) AS impressions,
                    COALESCE(SUM(pa.reach),       0) AS reach,
                    COALESCE(SUM(pa.clicks),      0) AS clicks
                FROM posts p
                JOIN post_analytics pa ON p.id = pa.post_id
                WHERE p.user_id = $1
                  AND p.published_at >= NOW() - INTERVAL '${interval}'
                  AND ($2::text IS NULL OR pa.platform = $2)
                GROUP BY DATE(p.published_at)
                ORDER BY date ASC
            `, [userId, platformParam]),

            // Platform breakdown
            db.query(`
                SELECT
                    pa.platform,
                    COALESCE(SUM(pa.likes),          0) AS likes,
                    COALESCE(SUM(pa.comments),        0) AS comments,
                    COALESCE(SUM(pa.shares),          0) AS shares,
                    COALESCE(SUM(pa.impressions),     0) AS impressions,
                    COALESCE(AVG(pa.engagement_rate), 0) AS engagement_rate,
                    COUNT(DISTINCT p.id)                 AS posts_count,
                    sa.followers_count,
                    0                                    AS follower_delta
                FROM posts p
                JOIN post_analytics pa ON p.id = pa.post_id
                JOIN social_accounts sa
                     ON sa.user_id = p.user_id AND sa.platform = pa.platform
                WHERE p.user_id = $1
                  AND p.published_at >= NOW() - INTERVAL '${interval}'
                GROUP BY pa.platform, sa.followers_count
                ORDER BY impressions DESC
            `, [userId]),

            // Top posts
            db.query(`
                SELECT
                    p.id, p.content, p.platforms, p.published_at,
                    p.media_urls,
                    COALESCE(SUM(pa.likes),          0) AS likes,
                    COALESCE(SUM(pa.comments),        0) AS comments,
                    COALESCE(SUM(pa.shares),          0) AS shares,
                    COALESCE(SUM(pa.impressions),     0) AS impressions,
                    COALESCE(SUM(pa.reach),           0) AS reach,
                    COALESCE(SUM(pa.clicks),          0) AS clicks,
                    COALESCE(AVG(pa.engagement_rate), 0) AS engagement_rate
                FROM posts p
                JOIN post_analytics pa ON p.id = pa.post_id
                WHERE p.user_id = $1
                  AND p.status = 'published'
                  AND p.published_at >= NOW() - INTERVAL '${interval}'
                  AND ($2::text IS NULL OR pa.platform = $2)
                GROUP BY p.id, p.content, p.platforms, p.published_at, p.media_urls
                ORDER BY engagement_rate DESC
                LIMIT 5
            `, [userId, platformParam]),

            // All posts (for table) — capped at 200 rows to prevent memory issues
            db.query(`
                SELECT
                    p.id, p.content, p.platforms, p.published_at,
                    p.media_urls,
                    COALESCE(SUM(pa.likes),          0) AS likes,
                    COALESCE(SUM(pa.comments),        0) AS comments,
                    COALESCE(SUM(pa.shares),          0) AS shares,
                    COALESCE(SUM(pa.impressions),     0) AS impressions,
                    COALESCE(SUM(pa.reach),           0) AS reach,
                    COALESCE(SUM(pa.clicks),          0) AS clicks,
                    COALESCE(AVG(pa.engagement_rate), 0) AS engagement_rate
                FROM posts p
                JOIN post_analytics pa ON p.id = pa.post_id
                WHERE p.user_id = $1
                  AND p.status = 'published'
                  AND ($2::text IS NULL OR pa.platform = $2)
                GROUP BY p.id, p.content, p.platforms, p.published_at, p.media_urls
                ORDER BY p.published_at DESC
                LIMIT 200
            `, [userId, platformParam]),

            // Best-time heatmap
            db.query(`
                SELECT
                    EXTRACT(DOW  FROM p.published_at)::int AS day,
                    EXTRACT(HOUR FROM p.published_at)::int AS hour,
                    AVG(pa.engagement_rate) AS value
                FROM posts p
                JOIN post_analytics pa ON p.id = pa.post_id
                WHERE p.user_id = $1 AND p.status = 'published'
                  AND ($2::text IS NULL OR pa.platform = $2)
                GROUP BY day, hour
            `, [userId, platformParam]),
        ]);

        const now  = metricsNow.rows[0]  || { impressions: 0, reach: 0, engagements: 0, clicks: 0, avg_er: 0, posts_count: 0 };
        const prev = metricsPrev.rows[0] || { impressions: 0, reach: 0, engagements: 0, clicks: 0 };

        // ── Audience growth (note: synthesized from current follower total;
        //    replace with a follower_snapshots table for real historical data) ──
        const audienceGrowth = dailySeries.rows.map((row: any, i: number) => {
            const base = parseInt(followersNow.rows[0].total) || 0;
            const step = Math.floor(base * 0.02);
            return {
                date:      row.date,
                total:     Math.max(0, base - step * (dailySeries.rows.length - 1 - i)),
                twitter:   Math.floor((base * 0.28) - step * 0.28 * (dailySeries.rows.length - 1 - i)),
                instagram: Math.floor((base * 0.38) - step * 0.38 * (dailySeries.rows.length - 1 - i)),
                linkedin:  Math.floor((base * 0.20) - step * 0.20 * (dailySeries.rows.length - 1 - i)),
                facebook:  Math.floor((base * 0.14) - step * 0.14 * (dailySeries.rows.length - 1 - i)),
            };
        });

        // ── Build response ────────────────────────────────────────────────────
        res.json({
            overview: {
                totalImpressions:  parseInt(now.impressions),
                totalReach:        parseInt(now.reach),
                totalEngagements:  parseInt(now.engagements),
                totalClicks:       parseInt(now.clicks),
                avgEngagementRate: parseFloat(now.avg_er),
                totalFollowers:    parseInt(followersNow.rows[0].total),
                followerGrowth:    0,
                followerGrowthPct: 0,
                postsPublished:    parseInt(now.posts_count),
                impressionsDelta:  deltaPercent(parseInt(now.impressions), parseInt(prev.impressions)),
                reachDelta:        deltaPercent(parseInt(now.reach),        parseInt(prev.reach)),
                engagementsDelta:  deltaPercent(parseInt(now.engagements),  parseInt(prev.engagements)),
                clicksDelta:       deltaPercent(parseInt(now.clicks),       parseInt(prev.clicks)),
            },

            dailyEngagement: dailySeries.rows.map((r: any) => ({
                date:        r.date,
                likes:       parseInt(r.likes),
                comments:    parseInt(r.comments),
                shares:      parseInt(r.shares),
                impressions: parseInt(r.impressions),
                reach:       parseInt(r.reach),
                clicks:      parseInt(r.clicks),
            })),

            platformBreakdown: platformRows.rows.map((r: any) => ({
                platform:       r.platform,
                followers:      parseInt(r.followers_count),
                followerDelta:  parseInt(r.follower_delta),
                likes:          parseInt(r.likes),
                comments:       parseInt(r.comments),
                shares:         parseInt(r.shares),
                impressions:    parseInt(r.impressions),
                engagementRate: parseFloat(r.engagement_rate),
                postsCount:     parseInt(r.posts_count),
            })),

            topPosts: topPosts.rows.map((r: any) => ({
                id:             r.id,
                content:        r.content,
                platforms:      r.platforms,
                publishedAt:    r.published_at,
                mediaUrl:       r.media_urls?.[0] ?? null,
                likes:          parseInt(r.likes),
                comments:       parseInt(r.comments),
                shares:         parseInt(r.shares),
                impressions:    parseInt(r.impressions),
                reach:          parseInt(r.reach),
                clicks:         parseInt(r.clicks),
                engagementRate: parseFloat(r.engagement_rate),
            })),

            allPosts: allPosts.rows.map((r: any) => ({
                id:             r.id,
                content:        r.content,
                platforms:      r.platforms,
                publishedAt:    r.published_at,
                mediaUrl:       r.media_urls?.[0] ?? null,
                likes:          parseInt(r.likes),
                comments:       parseInt(r.comments),
                shares:         parseInt(r.shares),
                impressions:    parseInt(r.impressions),
                reach:          parseInt(r.reach),
                clicks:         parseInt(r.clicks),
                engagementRate: parseFloat(r.engagement_rate),
            })),

            audienceGrowth,

            heatmap: heatmapRaw.rows.map((r: any) => ({
                day:   parseInt(r.day),
                hour:  parseInt(r.hour),
                value: parseFloat(r.value),
            })),
        });
    } catch (error: any) {
        console.error('[Analytics] getDashboard error:', error);
        res.status(500).json({ message: 'Failed to load analytics' });
    }
};
export const getAiInsights = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id') as string | undefined;
        
        // Fetch last 30 days of data for analysis
        const { rows: metrics } = await db.query(`
            SELECT pa.platform, SUM(pa.impressions) as impressions, SUM(pa.likes + pa.comments + pa.shares) as engagements, AVG(pa.engagement_rate) as er
            FROM posts p JOIN post_analytics pa ON p.id = pa.post_id
            WHERE p.user_id = $1 AND p.published_at >= NOW() - INTERVAL '30 days'
            GROUP BY pa.platform
        `, [userId]);

        const insights = await AIService.generateAnalyticsInsights(metrics);
        res.json({ insights });
    } catch (err: any) {
        console.error('[AI Insights Error]', err);
        res.status(500).json({ message: 'Failed to generate AI insights' });
    }
};

export const exportReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const interval = '30 days';

        // 1. Fetch current-period metrics
        const metricsNow = await db.query(`
            SELECT
                COALESCE(SUM(pa.impressions), 0) AS impressions,
                COALESCE(SUM(pa.reach),       0) AS reach,
                COALESCE(SUM(pa.likes + pa.comments + pa.shares), 0) AS engagements,
                COALESCE(SUM(pa.clicks),      0) AS clicks,
                COALESCE(AVG(pa.engagement_rate), 0) AS avg_er,
                COUNT(DISTINCT p.id) AS posts_count
            FROM posts p
            LEFT JOIN post_analytics pa ON p.id = pa.post_id
            WHERE p.user_id = $1
              AND p.published_at >= NOW() - INTERVAL '${interval}'
        `, [userId]);

        // 2. Fetch follower totals
        const followersNow = await db.query(`
            SELECT COALESCE(SUM(followers_count), 0) AS total
            FROM social_accounts
            WHERE user_id = $1 AND is_active = true
        `, [userId]);

        // 3. Fetch top posts
        const topPosts = await db.query(`
            SELECT
                p.id, p.content, p.platforms, p.published_at,
                COALESCE(SUM(pa.likes),          0) AS likes,
                COALESCE(SUM(pa.comments),        0) AS comments,
                COALESCE(SUM(pa.shares),          0) AS shares,
                COALESCE(SUM(pa.impressions),     0) AS impressions,
                COALESCE(AVG(pa.engagement_rate), 0) AS engagement_rate
            FROM posts p
            JOIN post_analytics pa ON p.id = pa.post_id
            WHERE p.user_id = $1
              AND p.status = 'published'
              AND p.published_at >= NOW() - INTERVAL '${interval}'
            GROUP BY p.id, p.content, p.platforms, p.published_at
            ORDER BY engagement_rate DESC
            LIMIT 5
        `, [userId]);

        const stats = metricsNow.rows[0] || { impressions: 0, reach: 0, engagements: 0, clicks: 0, avg_er: 0, posts_count: 0 };
        const totalFollowers = followersNow.rows[0]?.total || 0;

        // 4. Generate beautiful printable HTML
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SocialPulse Executive Analytics Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            color: #1e293b;
            background-color: #f8fafc;
            margin: 0;
            padding: 40px;
            -webkit-print-color-adjust: exact;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border-radius: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 25px;
            margin-bottom: 35px;
        }

        .logo {
            font-size: 24px;
            font-weight: 800;
            background: linear-gradient(135deg, #7c3aed, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .report-title {
            text-align: right;
        }

        .report-title h1 {
            margin: 0;
            font-size: 20px;
            color: #0f172a;
        }

        .report-title p {
            margin: 5px 0 0 0;
            font-size: 12px;
            color: #64748b;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 35px;
        }

        .card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 16px;
            border: 1px solid #f1f5f9;
        }

        .card-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.05em;
        }

        .card-value {
            font-size: 28px;
            font-weight: 800;
            color: #0f172a;
            margin: 10px 0 5px 0;
        }

        .card-desc {
            font-size: 11px;
            color: #94a3b8;
        }

        .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 40px;
            margin-bottom: 20px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 10px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            padding: 12px 15px;
            border-bottom: 2px solid #e2e8f0;
            background: #f8fafc;
        }

        td {
            font-size: 13px;
            padding: 15px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
        }

        .platform-tag {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            background: #ede9fe;
            color: #6d28d9;
            padding: 3px 8px;
            border-radius: 6px;
            display: inline-block;
            margin-right: 5px;
        }

        .action-bar {
            max-width: 900px;
            margin: 20px auto;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .btn {
            background: #7c3aed;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 700;
            border-radius: 10px;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .btn:hover {
            opacity: 0.9;
        }

        .btn-secondary {
            background: white;
            color: #64748b;
            border: 1px solid #e2e8f0;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }
            .container {
                box-shadow: none;
                border: none;
                padding: 0;
            }
            .action-bar {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn btn-secondary" onclick="window.close()">Close</button>
        <button class="btn" onclick="window.print()">Print to PDF</button>
    </div>

    <div class="container">
        <div class="header">
            <div class="logo">SocialPulse</div>
            <div class="report-title">
                <h1>Executive Analytics Report</h1>
                <p>30-Day Channel Overview &bull; Generated on ${new Date().toLocaleDateString()}</p>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-label">Total Impressions</div>
                <div class="card-value">${parseInt(stats.impressions).toLocaleString()}</div>
                <div class="card-desc">Times your content was seen</div>
            </div>
            <div class="card">
                <div class="card-label">Total Reach</div>
                <div class="card-value">${parseInt(stats.reach).toLocaleString()}</div>
                <div class="card-desc">Unique user accounts reached</div>
            </div>
            <div class="card">
                <div class="card-label">Avg Engagement Rate</div>
                <div class="card-value">${parseFloat(stats.avg_er).toFixed(2)}%</div>
                <div class="card-desc">Overall interaction quality</div>
            </div>
            <div class="card">
                <div class="card-label">Total Follower Base</div>
                <div class="card-value">${parseInt(totalFollowers).toLocaleString()}</div>
                <div class="card-desc">Synced community audience</div>
            </div>
            <div class="card">
                <div class="card-label">Engagements</div>
                <div class="card-value">${parseInt(stats.engagements).toLocaleString()}</div>
                <div class="card-desc">Likes, comments & shares</div>
            </div>
            <div class="card">
                <div class="card-label">Link Clicks</div>
                <div class="card-value">${parseInt(stats.clicks).toLocaleString()}</div>
                <div class="card-desc">Total referral site traffic</div>
            </div>
        </div>

        <div class="section-title">🏆 Top Performing Content</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 55%;">Post Draft</th>
                    <th>Platforms</th>
                    <th>Impressions</th>
                    <th>Eng Rate</th>
                </tr>
            </thead>
            <tbody>
                ${topPosts.rows.map((p: any) => `
                    <tr>
                        <td>
                            <div style="font-weight: 600; line-clamp: 2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                                ${p.content}
                            </div>
                            <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 5px;">
                                Published on ${new Date(p.published_at).toLocaleDateString()}
                            </span>
                        </td>
                        <td>
                            ${p.platforms.map((plat: string) => `<span class="platform-tag">${plat}</span>`).join('')}
                        </td>
                        <td style="font-weight: 700;">${parseInt(p.impressions).toLocaleString()}</td>
                        <td style="font-weight: 700; color: #10b981;">${parseFloat(p.engagement_rate).toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            This executive report was automatically generated by SocialPulse. All calculations are real-time synced.
        </div>
    </div>
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err: any) {
        console.error('[Analytics Report Export Error]:', err);
        res.status(500).json({ message: 'Failed to export report' });
    }
};
