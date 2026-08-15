import { Request, Response } from 'express';
import { db } from '../config/database';
import { StorageService } from '../services/storage.service';
import { generateStaticBanner } from '../services/banner.service';

// List ad campaigns
export const listAdCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        const { rows } = await db.query(
            `SELECT ac.*, p.title AS product_title
             FROM ad_campaigns ac
             LEFT JOIN products p ON p.id = ac.product_id
             WHERE ac.workspace_id = $1
             ORDER BY ac.created_at DESC`,
            [req.workspaceId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[AdCampaigns] listAdCampaigns error:', err);
        res.status(500).json({ message: 'Failed to load paid ad campaigns' });
    }
};

// Get single campaign
export const getAdCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        const { rows } = await db.query(
            `SELECT ac.*, p.title AS product_title
             FROM ad_campaigns ac
             LEFT JOIN products p ON p.id = ac.product_id
             WHERE ac.id = $1 AND ac.workspace_id = $2`,
            [id, req.workspaceId]
        );
        if (!rows[0]) {
            res.status(404).json({ message: 'Ad campaign not found' });
            return;
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[AdCampaigns] getAdCampaign error:', err);
        res.status(500).json({ message: 'Failed to load ad campaign details' });
    }
};

// Create ad campaign
export const createAdCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, objective, budget_type, budget_amount, platforms, target_url, ad_copy, media_url, product_id, start_date, end_date } = req.body;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        if (!name || !objective || !budget_type || !budget_amount || !target_url) {
            res.status(400).json({ message: 'Missing required campaign parameters' });
            return;
        }

        const { rows } = await db.query(
            `INSERT INTO ad_campaigns (workspace_id, name, objective, budget_type, budget_amount, platforms, target_url, ad_copy, media_url, product_id, start_date, end_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                req.workspaceId,
                name,
                objective,
                budget_type,
                budget_amount,
                platforms || ['facebook', 'instagram', 'tiktok'],
                target_url,
                ad_copy || null,
                media_url || null,
                product_id || null,
                start_date ? new Date(start_date) : null,
                end_date ? new Date(end_date) : null,
                'DRAFT' // Starts as draft
            ]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[AdCampaigns] createAdCampaign error:', err);
        res.status(500).json({ message: 'Failed to create ad campaign' });
    }
};

// Update ad campaign (status switch or config edit)
export const updateAdCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, status, budget_amount, ad_copy, target_url, media_url } = req.body;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }

        const { rows } = await db.query(
            `UPDATE ad_campaigns
             SET name = COALESCE($1, name),
                 status = COALESCE($2, status),
                 budget_amount = COALESCE($3, budget_amount),
                 ad_copy = COALESCE($4, ad_copy),
                 target_url = COALESCE($5, target_url),
                 media_url = COALESCE($6, media_url),
                 updated_at = NOW()
             WHERE id = $7 AND workspace_id = $8
             RETURNING *`,
            [
                name ?? null,
                status ?? null,
                budget_amount ?? null,
                ad_copy ?? null,
                target_url ?? null,
                media_url ?? null,
                id,
                req.workspaceId
            ]
        );

        if (!rows[0]) {
            res.status(404).json({ message: 'Ad campaign not found' });
            return;
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[AdCampaigns] updateAdCampaign error:', err);
        res.status(500).json({ message: 'Failed to update ad campaign' });
    }
};

// Delete campaign
export const deleteAdCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        const { rowCount } = await db.query(
            'DELETE FROM ad_campaigns WHERE id = $1 AND workspace_id = $2',
            [id, req.workspaceId]
        );
        if (!rowCount) {
            res.status(404).json({ message: 'Ad campaign not found' });
            return;
        }
        res.status(204).send();
    } catch (err) {
        console.error('[AdCampaigns] deleteAdCampaign error:', err);
        res.status(500).json({ message: 'Failed to delete ad campaign' });
    }
};

// Generate AI Talking Avatar Video (Zeely-Style mock engine)
export const generateAvatarVideo = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, script, avatar_style, voice_style } = req.body;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        if (!title || !script || !avatar_style || !voice_style) {
            res.status(400).json({ message: 'Title, script, avatar style, and voice style are required' });
            return;
        }

        // Mock different video URLs based on the avatar styles to simulate a high-fidelity output
        const videoStyleUrls: Record<string, string> = {
            professional: 'https://assets.mixkit.co/videos/preview/mixkit-man-in-suit-explaining-something-at-camera-40081-large.mp4',
            founder: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-giving-a-lecture-at-a-screen-40767-large.mp4',
            ugc: 'https://assets.mixkit.co/videos/preview/mixkit-smiling-woman-talking-to-camera-at-home-42436-large.mp4',
            cheerful: 'https://assets.mixkit.co/videos/preview/mixkit-happy-girl-talking-on-video-call-42861-large.mp4'
        };

        const finalVideoUrl = videoStyleUrls[avatar_style.toLowerCase()] || videoStyleUrls.ugc;

        const { rows } = await db.query(
            `INSERT INTO generated_videos (workspace_id, title, script, avatar_style, voice_style, video_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.workspaceId, title, script, avatar_style, voice_style, finalVideoUrl]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[AdCampaigns] generateAvatarVideo error:', err);
        res.status(500).json({ message: 'Failed to generate talking head video' });
    }
};

// List generated avatar videos
export const listGeneratedVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        const { rows } = await db.query(
            `SELECT * FROM generated_videos
             WHERE workspace_id = $1
             ORDER BY created_at DESC`,
            [req.workspaceId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[AdCampaigns] listGeneratedVideos error:', err);
        res.status(500).json({ message: 'Failed to fetch generated videos list' });
    }
};

// Generate and composite static ad creative banner
export const generateAdBanner = async (req: Request, res: Response): Promise<void> => {
    try {
        const { imageUrl, discountText, promoText, theme } = req.body;
        const userId = (req as any).user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const buffer = await generateStaticBanner({ imageUrl, discountText, promoText, theme });
        
        const result = await StorageService.upload({
            buffer,
            originalName: `ad_banner_${Date.now()}.png`,
            mimeType: 'image/png',
            userId,
            folder: 'ads'
        });

        const { rows } = await db.query(
            `INSERT INTO media_files
             (user_id, workspace_id, original_name, file_name, mime_type, size_bytes,
              width, height, duration_secs, provider, provider_id,
              url, thumbnail_url, folder)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             RETURNING *`,
            [
                userId,
                (req as any).workspaceId || null,
                `ad_banner_${Date.now()}.png`,
                result.fileName,
                result.mimeType,
                result.sizeByte,
                result.width,
                result.height,
                result.durationSecs || null,
                result.provider,
                result.providerId,
                result.url,
                result.thumbnailUrl || result.url,
                'ads'
            ]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[AdCampaigns] generateAdBanner error:', err);
        res.status(500).json({ message: 'Failed to generate ad creative banner' });
    }
};
