// server/src/controllers/media.controller.ts
import { Request, Response } from 'express';
import { db }              from '../config/database';
import { StorageService }  from '../services/storage.service';
import { recordUsage }     from '../middleware/planEnforcement.middleware';

// ─── Upload ───────────────────────────────────────────────────────────────────

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const folder = (req.body.folder as string) ?? 'uploads';

        const files: Express.Multer.File[] =
            req.files
                ? Array.isArray(req.files) ? req.files : Object.values(req.files).flat()
                : req.file ? [req.file] : [];

        const uploaded = await Promise.all(
            files.map(async (file) => {
                // Upload to cloud storage
                const result = await StorageService.upload({
                    buffer:       file.buffer,
                    originalName: file.originalname,
                    mimeType:     file.mimetype,
                    userId,
                    folder,
                });

                // Persist to DB
                const { rows } = await db.query(
                    `INSERT INTO media_files
                     (user_id, original_name, file_name, mime_type, size_bytes,
                      width, height, duration_secs, provider, provider_id,
                      url, thumbnail_url, folder)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                     RETURNING *`,
                    [
                        userId,
                        file.originalname,
                        result.fileName,
                        result.mimeType,
                        result.sizeByte,
                        result.width,
                        result.height,
                        result.durationSecs,
                        result.provider,
                        result.providerId,
                        result.url,
                        result.thumbnailUrl,
                        folder,
                    ]
                );

                await recordUsage(userId, 'media_uploaded');
                return rows[0];
            })
        );

        res.status(201).json({ files: uploaded });
    } catch (err: any) {
        res.status(500).json({ message: err.message ?? 'Upload failed' });
    }
};

// ─── List ─────────────────────────────────────────────────────────────────────

export const listMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const {
            folder, type, search,
            page  = '1',
            limit = '24',
            sort  = 'newest',
        } = req.query as Record<string, string>;

        const conditions: string[] = ['user_id = $1', 'is_deleted = false'];
        const params: any[]        = [userId];

        if (folder) {
            params.push(folder);
            conditions.push(`folder = $${params.length}`);
        }
        if (type === 'image') {
            conditions.push(`mime_type LIKE 'image/%'`);
        } else if (type === 'video') {
            conditions.push(`mime_type LIKE 'video/%'`);
        }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`original_name ILIKE $${params.length}`);
        }

        const orderMap: Record<string, string> = {
            newest: 'created_at DESC',
            oldest: 'created_at ASC',
            name:   'original_name ASC',
            size:   'size_bytes DESC',
        };
        const orderBy = orderMap[sort] ?? 'created_at DESC';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const where  = conditions.join(' AND ');

        const [rows, countRes] = await Promise.all([
            db.query(
                `SELECT * FROM media_files WHERE ${where}
                 ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            ),
            db.query(`SELECT COUNT(*) FROM media_files WHERE ${where}`, params),
        ]);

        const total = parseInt(countRes.rows[0].count);

        res.json({
            files:      rows.rows,
            total,
            page:       parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message ?? 'Failed to list media' });
    }
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const { rows } = await db.query(
            `SELECT * FROM media_files WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (!rows[0]) {
            res.status(404).json({ message: 'File not found' });
            return;
        }

        const file = rows[0];

        // Delete from cloud
        await StorageService.delete(file.provider_id, file.mime_type);

        // Soft-delete in DB
        await db.query(
            `UPDATE media_files SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
            [id]
        );

        res.json({ message: 'File deleted' });
    } catch (err: any) {
        res.status(500).json({ message: err.message ?? 'Delete failed' });
    }
};

// ─── Bulk delete ──────────────────────────────────────────────────────────────

export const bulkDeleteMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const { ids } = req.body as { ids: string[] };
        const userId  = req.user!.userId;

        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ message: 'Provide an array of file IDs' });
            return;
        }

        const { rows } = await db.query(
            `SELECT * FROM media_files WHERE id = ANY($1) AND user_id = $2 AND is_deleted = false`,
            [ids, userId]
        );

        await Promise.allSettled(
            rows.map(f => StorageService.delete(f.provider_id, f.mime_type))
        );

        await db.query(
            `UPDATE media_files SET is_deleted = true, updated_at = NOW()
             WHERE id = ANY($1) AND user_id = $2`,
            [ids, userId]
        );

        res.json({ deleted: rows.length });
    } catch (err: any) {
        res.status(500).json({ message: err.message ?? 'Bulk delete failed' });
    }
};

// ─── Storage usage ────────────────────────────────────────────────────────────

export const getStorageUsage = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { rows } = await db.query(
            `SELECT
                COALESCE(SUM(size_bytes), 0)                                      AS total_bytes,
                COALESCE(SUM(CASE WHEN mime_type LIKE 'image/%' THEN size_bytes ELSE 0 END), 0) AS image_bytes,
                COALESCE(SUM(CASE WHEN mime_type LIKE 'video/%' THEN size_bytes ELSE 0 END), 0) AS video_bytes,
                COUNT(*)                                                           AS total_files,
                COUNT(CASE WHEN mime_type LIKE 'image/%' THEN 1 END)               AS image_count,
                COUNT(CASE WHEN mime_type LIKE 'video/%' THEN 1 END)               AS video_count
             FROM media_files
             WHERE user_id = $1 AND is_deleted = false`,
            [userId]
        );

        const r          = rows[0];
        const plan       = req.user!.plan ?? 'free';
        const { PLANS }  = await import('../config/plans');
        const limitMB    = PLANS[plan as keyof typeof PLANS]?.limits.mediaStorageMB ?? 100;
        const totalBytes = parseInt(r.total_bytes);
        const limitBytes = limitMB === 'unlimited' ? Infinity : (limitMB as number) * 1024 * 1024;

        res.json({
            totalBytes,
            imageBytes:  parseInt(r.image_bytes),
            videoBytes:  parseInt(r.video_bytes),
            totalFiles:  parseInt(r.total_files),
            imageCount:  parseInt(r.image_count),
            videoCount:  parseInt(r.video_count),
            limitBytes:  limitMB === 'unlimited' ? null : limitBytes,
            usedPercent: limitMB === 'unlimited' ? 0 : Math.min(totalBytes / limitBytes * 100, 100),
        });
    } catch (err: any) {
        res.status(500).json({ message: 'Failed to fetch usage' });
    }
};

// ─── Update tags / folder ─────────────────────────────────────────────────────

export const updateMedia = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id }             = req.params;
        const { tags, folder }   = req.body;
        const userId             = req.user!.userId;

        const { rows } = await db.query(
            `UPDATE media_files
             SET tags       = COALESCE($1, tags),
                 folder     = COALESCE($2, folder),
                 updated_at = NOW()
             WHERE id = $3 AND user_id = $4 AND is_deleted = false
             RETURNING *`,
            [tags, folder, id, userId]
        );

        if (!rows[0]) { res.status(404).json({ message: 'File not found' }); return; }
        res.json({ file: rows[0] });
    } catch (err: any) {
        res.status(500).json({ message: 'Update failed' });
    }
};

