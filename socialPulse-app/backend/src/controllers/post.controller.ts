import { Request, Response } from 'express';
import { db } from '../config/database';
import { schedulePost } from '../jobs/postPublisher';
import { StorageService } from '../services/storage.service';
import { NotificationService } from '../services/notification.service';
import { getPlan, PlanId } from '../config/plans';

export const createPost = async (req: Request, res: Response) => {
    try {
        const {
            content,
            platforms,
            scheduledAt,
            hashtags,
            aiGenerated,
            campaignId,
        } = req.body;

        const userId = req.user!.userId;
        const status = scheduledAt ? 'scheduled' : 'draft';

        if (!content || !String(content).trim()) {
            res.status(400).json({ message: 'Content is required' });
            return;
        }

        // Upload any attached files to cloud storage; fall back to URLs sent in body
        let mediaUrls: string[] = [];
        if (req.body.mediaUrls) {
            try {
                const parsed = JSON.parse(req.body.mediaUrls);
                if (Array.isArray(parsed)) mediaUrls = parsed;
            } catch {
                // ignore malformed mediaUrls, fall back to empty array
            }
        }
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            const uploads = await Promise.all(
                (req.files as Express.Multer.File[]).map(f =>
                    StorageService.upload({
                        buffer: f.buffer,
                        originalName: f.originalname,
                        mimeType: f.mimetype,
                        userId,
                        folder: 'posts',
                    }).then(r => r.url)
                )
            );
            mediaUrls = uploads;
        }

        const result = await db.query(
            `INSERT INTO posts
             (user_id, workspace_id, content, platforms, scheduled_at, hashtags, status, ai_generated, campaign_id, media_urls)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [userId, req.workspaceId || null, content, platforms, scheduledAt, hashtags, status, aiGenerated, campaignId, JSON.stringify(mediaUrls)]
        );

        const post = result.rows[0];

        if (scheduledAt) {
            await schedulePost(post.id, new Date(scheduledAt));
        }

        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create post' });
    }
};

export const getPosts = async (req: Request, res: Response) => {
    try {
        const { status, platform, page = 1, limit = 20 } = req.query;
        const userId = req.user!.userId;
        const offset = (Number(page) - 1) * Number(limit);

        let queryStr = `
            SELECT p.*,
                   COALESCE(json_agg(pa.*) FILTER (WHERE pa.id IS NOT NULL), '[]') as analytics
            FROM posts p
            LEFT JOIN post_analytics pa ON p.id = pa.post_id
            WHERE p.user_id = $1 AND (p.workspace_id = $2 OR $2 IS NULL)
        `;
        const params: any[] = [userId, req.workspaceId || null];
        let paramIndex = 3;

        if (status) {
            queryStr += ` AND p.status = $${paramIndex++}`;
            params.push(status);
        }

        if (platform) {
            queryStr += ` AND $${paramIndex++} = ANY(p.platforms)`;
            params.push(platform);
        }

        queryStr += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await db.query(queryStr, params);

        const countResult = await db.query(
            'SELECT COUNT(*) FROM posts WHERE user_id = $1 AND (workspace_id = $2 OR $2 IS NULL)',
            [userId, req.workspaceId || null]
        );

        res.json({
            posts: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: Number(page),
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / Number(limit)),
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch posts' });
    }
};

export const getPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const result = await db.query(
            `SELECT p.*, COALESCE(json_agg(pa.*) FILTER (WHERE pa.id IS NOT NULL), '[]') as analytics
             FROM posts p
             LEFT JOIN post_analytics pa ON p.id = pa.post_id
             WHERE p.id = $1
             GROUP BY p.id`,
            [id]
        );

        const post = result.rows[0];
        if (!post) { res.status(404).json({ message: 'Post not found' }); return; }
        if (post.user_id !== userId) { res.status(403).json({ message: 'Forbidden' }); return; }

        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch post' });
    }
};

export const updatePost = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { content, platforms, scheduledAt, hashtags, mediaUrls } = req.body;

        const post = await db.query(
            'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
            [id, req.user!.userId]
        );

        if (!post.rows[0]) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        if (post.rows[0].status === 'published') {
            res.status(400).json({ message: 'Cannot edit published posts' });
            return;
        }

        const mediaUrlsJson = mediaUrls !== undefined ? JSON.stringify(mediaUrls) : undefined;

        const result = await db.query(
            `UPDATE posts
             SET content = COALESCE($1, content),
                 platforms = COALESCE($2, platforms),
                 scheduled_at = COALESCE($3, scheduled_at),
                 hashtags = COALESCE($4, hashtags),
                 media_urls = COALESCE($5, media_urls),
                 updated_at = NOW()
             WHERE id = $6 AND user_id = $7 AND (workspace_id = $8 OR $8 IS NULL)
             RETURNING *`,
            [content ?? null, platforms ?? null, scheduledAt ?? null, hashtags ?? null,
             mediaUrlsJson ?? null, id, req.user!.userId, req.workspaceId || null]
        );

        if (!result.rows[0]) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update post' });
    }
};

export const deletePost = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const check = await db.query('SELECT user_id FROM posts WHERE id = $1', [id]);
        if (!check.rows[0]) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }
        if (check.rows[0].user_id !== req.user!.userId) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        await db.query('DELETE FROM posts WHERE id = $1', [id]);

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete post' });
    }
};

export const publishNow = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `UPDATE posts SET status = 'scheduled', scheduled_at = NOW() 
             WHERE id = $1 AND user_id = $2 AND (workspace_id = $3 OR $3 IS NULL)
             RETURNING id`,
            [id, req.user!.userId, req.workspaceId || null]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Post not found in this workspace' });
            return;
        }

        await schedulePost(id, new Date());

        res.json({ message: 'Post queued for immediate publishing' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to publish post' });
    }
};

// ─── Bulk schedule ────────────────────────────────────────────────────────────
// POST /posts/bulk
// Body: { posts: Array<{ content, platforms, scheduledAt, hashtags?, campaignId?, mediaUrls? }> }

export const bulkCreatePosts = async (req: Request, res: Response): Promise<void> => {
    const { posts } = req.body as {
        posts?: Array<{
            content:    string;
            platforms:  string[];
            scheduledAt: string;
            hashtags?:  string[];
            campaignId?: string;
            mediaUrls?: string[];
        }>;
    };

    if (!Array.isArray(posts) || posts.length === 0) {
        res.status(400).json({ message: 'posts[] array is required' });
        return;
    }
    if (posts.length > 100) {
        res.status(400).json({ message: 'Maximum 100 posts per bulk request' });
        return;
    }

    const userId = req.user!.userId;

    // Check bulk scheduling feature gate
    const plan = getPlan((req.user!.plan ?? 'free') as PlanId);
    if (!plan.limits.bulkScheduling) {
        res.status(403).json({
            message: 'Bulk scheduling is not available on your current plan.',
            code: 'FEATURE_NOT_AVAILABLE',
            upgrade: true,
        });
        return;
    }

    const created: { id: string; scheduledAt: string }[] = [];
    const errors:  { index: number; error: string }[]   = [];

    for (let i = 0; i < posts.length; i++) {
        const p = posts[i];
        if (!p.content || !p.platforms?.length || !p.scheduledAt) {
            errors.push({ index: i, error: 'content, platforms, and scheduledAt are required' });
            continue;
        }
        try {
            const { rows } = await db.query(
                `INSERT INTO posts
                 (user_id, workspace_id, content, platforms, scheduled_at, hashtags, status, campaign_id, media_urls)
                 VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8) RETURNING id, scheduled_at`,
                [
                    userId, req.workspaceId || null, p.content, p.platforms, p.scheduledAt,
                    p.hashtags ?? [], p.campaignId ?? null,
                    JSON.stringify(p.mediaUrls ?? []),
                ]
            );
            const post = rows[0];
            await schedulePost(post.id, new Date(p.scheduledAt));
            created.push({ id: post.id, scheduledAt: post.scheduled_at });
        } catch (err: any) {
            errors.push({ index: i, error: err.message ?? 'Failed to create post' });
        }
    }

    res.status(207).json({
        created,
        errors,
        message: `${created.length} post(s) scheduled, ${errors.length} failed`,
    });
};