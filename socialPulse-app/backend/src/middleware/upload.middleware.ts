// server/src/middleware/upload.middleware.ts
import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { PLANS, getPlan, PlanId } from '../config/plans';
import { AuthRequest } from './auth.middleware';

// ─── Allowed types ─────────────────────────────────────────────────────────────

const ALLOWED_MIME: Record<string, string> = {
    'image/jpeg':      'jpg',
    'image/png':       'png',
    'image/gif':       'gif',
    'image/webp':      'webp',
    'image/svg+xml':   'svg',
    'video/mp4':       'mp4',
    'video/quicktime': 'mov',
    'video/webm':      'webm',
};

// ─── Multer — memory storage (buffer handed to StorageService) ─────────────────

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error(`File type "${file.mimetype}" is not supported.`));
    }
};

/**
 * Base multer instance.  File-size limit is enforced here at the maximum
 * enterprise cap (500 MB); plan-level enforcement happens in the
 * validateUpload middleware below, where we have the user's plan.
 */
const multerInstance = multer({
    storage:  multer.memoryStorage(),
    limits:   { fileSize: 500 * 1024 * 1024 },   // 500 MB absolute roof
    fileFilter,
});

// ─── Exported middleware ───────────────────────────────────────────────────────

/** Accept up to 10 files under the field name "files" */
export const uploadMultiple = multerInstance.array('files', 10);

/** Accept a single file under the field name "file" */
export const uploadSingle = multerInstance.single('file');

/**
 * Run after multer.  Enforces per-plan file-size cap and
 * checks the user has storage headroom.
 */
export const validateUpload = async (
    req:  Request,
    res:  Response,
    next: NextFunction
): Promise<void> => {
    try {
        const plan = getPlan((req.user?.plan ?? 'free') as PlanId);
        const maxBytes = plan.limits.mediaFileSizeMB * 1024 * 1024;

        const files: Express.Multer.File[] =
            req.files
                ? Array.isArray(req.files) ? req.files : Object.values(req.files).flat()
                : req.file ? [req.file] : [];

        if (files.length === 0) {
            res.status(400).json({ message: 'No file(s) provided.' });
            return;
        }

        // Per-file size check
        for (const f of files) {
            if (f.size > maxBytes) {
                res.status(413).json({
                    message: `"${f.originalname}" exceeds your plan's ${plan.limits.mediaFileSizeMB} MB limit.`,
                    code:    'FILE_TOO_LARGE',
                    upgrade: true,
                });
                return;
            }
        }

        // Storage quota check (skip for 'unlimited')
        if (plan.limits.mediaStorageMB !== 'unlimited') {
            const { db } = await import('../config/database');
            const usage = await db.query(
                `SELECT COALESCE(SUM(size_bytes), 0) AS used
                 FROM media_files
                 WHERE user_id = $1 AND is_deleted = false`,
                [req.user!.userId]
            );
            const usedMB       = parseInt(usage.rows[0].used) / (1024 * 1024);
            const incomingMB   = files.reduce((s, f) => s + f.size, 0) / (1024 * 1024);
            const cappedMB     = plan.limits.mediaStorageMB as number;

            if (usedMB + incomingMB > cappedMB) {
                res.status(413).json({
                    message: `Upload would exceed your ${cappedMB} MB storage quota.`,
                    code:    'STORAGE_QUOTA_EXCEEDED',
                    upgrade: true,
                    usedMB:  Math.round(usedMB),
                    limitMB: cappedMB,
                });
                return;
            }
        }

        next();
    } catch (err) {
        next(err);
    }
};

/** Multer error handler — converts MulterError to a readable JSON response */
export const handleUploadError = (
    err:  any,
    _req: Request,
    res:  Response,
    next: NextFunction
): void => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ message: 'File is too large.', code: 'FILE_TOO_LARGE' });
        return;
    }
    if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({ message: 'Unexpected file field.', code: 'UNEXPECTED_FIELD' });
        return;
    }
    next(err);
};

// ── MIME allowlist ─────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

// ── Factory: create multer instance with per-plan file-size cap ───────────────

const makeUpload = (maxMb: number) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF, MP4, MOV, WebM`));
      }
    },
  });

// ── Default upload (50 MB — safe fallback) ───────────────────────────────────

export const upload = makeUpload(50);

// ── Plan-aware upload middleware ──────────────────────────────────────────────
// Usage: router.post('/upload', planUpload('media'), ...)

export const planUpload = (fieldName: string) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const planKey  = (req as any).planKey ?? 'free';
    const plan     = getPlan(planKey);
    const maxMb    = plan.limits.mediaFileSizeMB;
    const instance = makeUpload(maxMb);
    instance.single(fieldName)(req as Request, res, next);
  };

// ── Re-export for convenience ─────────────────────────────────────────────────

export { ALLOWED_MIME_TYPES };
