// server/src/services/storage.service.ts
import path from 'path';
import { Readable } from 'stream';
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import sharp from 'sharp';

// ─── Provider selection ────────────────────────────────────────────────────────

export type StorageProvider = 's3' | 'cloudinary';
const PROVIDER: StorageProvider =
    (process.env.STORAGE_PROVIDER as StorageProvider) ?? 'cloudinary';

// ─── Cloudinary init ──────────────────────────────────────────────────────────

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
});

// ─── S3 init ──────────────────────────────────────────────────────────────────

const s3 = new S3Client({
    region:      process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
});

const S3_BUCKET = process.env.AWS_BUCKET_NAME ?? 'social-pulse-media';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadInput {
    buffer:       Buffer;
    originalName: string;
    mimeType:     string;
    userId:       string;
    folder?:      string;   // e.g. 'posts', 'avatars'
}

export interface UploadResult {
    provider:     StorageProvider;
    providerId:   string;   // public_id (Cloudinary) or S3 key
    url:          string;
    thumbnailUrl: string | null;
    width:        number | null;
    height:       number | null;
    durationSecs: number | null;
    sizeByte:     number;
    mimeType:     string;
    fileName:     string;
}

// ─── Image optimisation ───────────────────────────────────────────────────────

/**
 * Resize oversized images client-before-upload to save storage.
 * Max 2048px on longest edge, JPEG quality 82.
 */
const optimiseImage = async (
    buffer: Buffer,
    mimeType: string
): Promise<{ buffer: Buffer; width: number; height: number }> => {
    if (!mimeType.startsWith('image/') || mimeType === 'image/gif') {
        const meta = await sharp(buffer).metadata();
        return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
    }

    const img = sharp(buffer);
    const meta = await img.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);

    const out = longest > 2048
        ? img.resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        : img;

    const optimised = await out
        .jpeg({ quality: 82, progressive: true })
        .toBuffer({ resolveWithObject: true });

    return {
        buffer: optimised.data,
        width:  optimised.info.width,
        height: optimised.info.height,
    };
};

/**
 * Generate a thumbnail Buffer (300×300 cover crop) for images.
 */
const makeThumbnail = async (buffer: Buffer, mimeType: string): Promise<Buffer | null> => {
    if (!mimeType.startsWith('image/') || mimeType === 'image/gif') return null;
    return sharp(buffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toBuffer();
};

// ─── Cloudinary helpers ───────────────────────────────────────────────────────

const cloudinaryUpload = (
    buffer: Buffer,
    opts: Record<string, unknown>
): Promise<UploadApiResponse> =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
            if (err || !result) return reject(err ?? new Error('Upload failed'));
            resolve(result);
        });
        Readable.from(buffer).pipe(stream);
    });

const uploadToCloudinary = async (input: UploadInput): Promise<UploadResult> => {
    const folder = `social-pulse/${input.userId}/${input.folder ?? 'uploads'}`;
    const isVideo = input.mimeType.startsWith('video/');
    const isImage = input.mimeType.startsWith('image/');

    let processedBuffer = input.buffer;
    let width: number | null = null;
    let height: number | null = null;
    let thumbnailUrl: string | null = null;

    if (isImage) {
        const opt = await optimiseImage(input.buffer, input.mimeType);
        processedBuffer = opt.buffer;
        width  = opt.width;
        height = opt.height;
    }

    const result = await cloudinaryUpload(processedBuffer, {
        folder,
        resource_type: isVideo ? 'video' : isImage ? 'image' : 'raw',
        use_filename:  true,
        unique_filename: true,
        overwrite:     false,
        // Auto-generate thumbnail for images via transformation
        eager: isImage
            ? [{ width: 300, height: 300, crop: 'fill', format: 'jpg', quality: 70 }]
            : undefined,
        eager_async: false,
    });

    if (isImage && result.eager?.[0]) {
        thumbnailUrl = result.eager[0].secure_url;
    } else if (isVideo) {
        // Cloudinary auto-generates video poster
        thumbnailUrl = cloudinary.url(result.public_id, {
            resource_type: 'video',
            format:        'jpg',
            transformation: [{ width: 300, height: 300, crop: 'fill' }],
        });
    }

    return {
        provider:     'cloudinary',
        providerId:   result.public_id,
        url:          result.secure_url,
        thumbnailUrl,
        width:        result.width  ?? width,
        height:       result.height ?? height,
        durationSecs: result.duration ?? null,
        sizeByte:     result.bytes,
        mimeType:     input.mimeType,
        fileName:     input.originalName,
    };
};

const deleteFromCloudinary = async (
    publicId: string,
    mimeType: string
): Promise<void> => {
    const resourceType = mimeType.startsWith('video/')  ? 'video'
                       : mimeType.startsWith('image/')  ? 'image'
                       : 'raw';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

// ─── S3 helpers ───────────────────────────────────────────────────────────────

const uploadToS3 = async (input: UploadInput): Promise<UploadResult> => {
    const isImage = input.mimeType.startsWith('image/');
    const isVideo = input.mimeType.startsWith('video/');
    const ext     = path.extname(input.originalName) || '.bin';
    const key     = `${input.userId}/${input.folder ?? 'uploads'}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    let processedBuffer = input.buffer;
    let width:  number | null = null;
    let height: number | null = null;

    if (isImage) {
        const opt = await optimiseImage(input.buffer, input.mimeType);
        processedBuffer = opt.buffer;
        width  = opt.width;
        height = opt.height;
    }

    // Main file
    await s3.send(new PutObjectCommand({
        Bucket:      S3_BUCKET,
        Key:         key,
        Body:        processedBuffer,
        ContentType: input.mimeType,
        Metadata:    { userId: input.userId, originalName: input.originalName },
    }));

    // Thumbnail for images
    let thumbnailUrl: string | null = null;
    if (isImage) {
        const thumbBuf = await makeThumbnail(input.buffer, input.mimeType);
        if (thumbBuf) {
            const thumbKey = `${key}.thumb.jpg`;
            await s3.send(new PutObjectCommand({
                Bucket:      S3_BUCKET,
                Key:         thumbKey,
                Body:        thumbBuf,
                ContentType: 'image/jpeg',
            }));
            thumbnailUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${thumbKey}`;
        }
    }

    const url = `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;

    return {
        provider:     's3',
        providerId:   key,
        url,
        thumbnailUrl,
        width,
        height,
        durationSecs: null,
        sizeByte:     processedBuffer.length,
        mimeType:     input.mimeType,
        fileName:     input.originalName,
    };
};

const deleteFromS3 = async (key: string): Promise<void> => {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    // Try removing thumbnail too (best-effort)
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: `${key}.thumb.jpg` }));
    } catch (_) { /* ignore */ }
};

/** Generate a time-limited signed S3 URL (for private buckets) */
export const getSignedS3Url = async (key: string, expiresIn = 3600): Promise<string> => {
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    return getSignedUrl(s3, cmd, { expiresIn });
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const StorageService = {
    /**
     * Upload a file buffer.  Provider chosen via STORAGE_PROVIDER env var.
     */
    async upload(input: UploadInput): Promise<UploadResult> {
        if (PROVIDER === 's3') return uploadToS3(input);
        return uploadToCloudinary(input);
    },

    /**
     * Delete a previously uploaded file.
     */
    async delete(providerId: string, mimeType: string): Promise<void> {
        if (PROVIDER === 's3') return deleteFromS3(providerId);
        return deleteFromCloudinary(providerId, mimeType);
    },

    /**
     * Get a provider-agnostic signed/public URL.
     * For public Cloudinary/S3 buckets the stored URL is already public.
     */
    async getUrl(providerId: string, provider: StorageProvider): Promise<string> {
        if (provider === 's3') return getSignedS3Url(providerId);
        // Cloudinary public URLs are already in the DB
        return cloudinary.url(providerId, { secure: true });
    },
};

