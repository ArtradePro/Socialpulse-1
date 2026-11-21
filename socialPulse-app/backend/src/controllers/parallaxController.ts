import { Request, Response } from 'express';
import { db } from '../config/database';
import { ParallaxKind, ParallaxService } from '../services/parallax.service';
import { StorageService } from '../services/storage.service';
import { recordUsage } from '../middleware/planEnforcement.middleware';

function formatParallaxError(err: any): { status: number; message: string } {
    if (err.response?.data?.error?.message) {
        return {
            status: err.response.status || 502,
            message: err.response.data.error.message,
        };
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return {
            status: 503,
            message: 'Parallax media engine is unreachable. Make sure it is running.',
        };
    }
    return { status: 500, message: err.message || 'Parallax request failed' };
}

export const listParallaxModels = async (req: Request, res: Response): Promise<void> => {
    if (!ParallaxService.isConfigured()) {
        res.json({
            configured: false,
            models: [],
            message: 'Parallax is not configured yet. Set PARALLAX_URL and PARALLAX_API_KEY in backend/.env.',
        });
        return;
    }

    try {
        const kind = req.query.kind as ParallaxKind | undefined;
        const models = await ParallaxService.listModels(kind);
        res.json({ configured: true, models });
    } catch (err: any) {
        const { status, message } = formatParallaxError(err);
        res.status(status).json({ configured: true, models: [], message });
    }
};

export const getParallaxModel = async (req: Request, res: Response): Promise<void> => {
    try {
        const model = await ParallaxService.getModel(String(req.params.id));
        res.json(model);
    } catch (err: any) {
        const { status, message } = formatParallaxError(err);
        res.status(status).json({ message });
    }
};

export const quoteParallaxMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const { modelId, prompt, values, count } = req.body;
        if (!modelId) {
            res.status(400).json({ message: 'modelId is required' });
            return;
        }
        const quote = await ParallaxService.quote({ modelId, prompt, values, count });
        res.json({
            ...quote,
            socialPulseCredits: ParallaxService.toSocialPulseCredits(quote.credits),
        });
    } catch (err: any) {
        const { status, message } = formatParallaxError(err);
        res.status(status).json({ message });
    }
};

export const generateParallaxMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { modelId, prompt, values, count } = req.body;
        if (!modelId) {
            res.status(400).json({ message: 'modelId is required' });
            return;
        }

        const result = await ParallaxService.generate({ modelId, prompt, values, count });
        const totalMillicredits = (result.generations || []).reduce((sum, g) => sum + (g.cost || 0), 0);
        const socialPulseCredits = ParallaxService.toSocialPulseCredits(totalMillicredits);

        await recordUsage(userId, 'ai_credit_used', socialPulseCredits);

        res.status(201).json({
            generations: result.generations,
            socialPulseCredits,
        });
    } catch (err: any) {
        const { status, message } = formatParallaxError(err);
        res.status(status).json({ message });
    }
};

export const getParallaxGenerationStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = (req as any).workspaceId || null;
        const generation = await ParallaxService.getGeneration(String(req.params.id));

        const savedFiles: any[] = [];

        if (generation.status === 'succeeded' && generation.files?.length > 0) {
            for (const file of generation.files) {
                const ext = file.mime.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
                const markerName = `parallax_${file.id}.${ext}`;

                // Avoid duplicate uploads when the frontend polls after completion
                const existing = await db.query(
                    `SELECT * FROM media_files WHERE user_id = $1 AND original_name = $2 AND is_deleted = false LIMIT 1`,
                    [userId, markerName],
                );
                if (existing.rows[0]) {
                    savedFiles.push(existing.rows[0]);
                    continue;
                }

                const { buffer, mimeType } = await ParallaxService.downloadFile(file.id);
                const uploaded = await StorageService.upload({
                    buffer,
                    originalName: markerName,
                    mimeType: file.mime || mimeType,
                    userId,
                    folder: 'ai-studio',
                });

                const { rows } = await db.query(
                    `INSERT INTO media_files
                     (user_id, workspace_id, original_name, file_name, mime_type, size_bytes,
                      width, height, duration_secs, provider, provider_id,
                      url, thumbnail_url, folder, tags)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                     RETURNING *`,
                    [
                        userId,
                        workspaceId,
                        markerName,
                        uploaded.fileName,
                        uploaded.mimeType,
                        uploaded.sizeByte,
                        uploaded.width ?? file.width,
                        uploaded.height ?? file.height,
                        uploaded.durationSecs ?? file.duration,
                        uploaded.provider,
                        uploaded.providerId,
                        uploaded.url,
                        uploaded.thumbnailUrl,
                        'ai-studio',
                        ['parallax', generation.modelId],
                    ],
                );
                savedFiles.push(rows[0]);
            }
        }

        res.json({ generation, mediaFiles: savedFiles });
    } catch (err: any) {
        const { status, message } = formatParallaxError(err);
        res.status(status).json({ message });
    }
};
