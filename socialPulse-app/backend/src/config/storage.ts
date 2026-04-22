import { v2 as cloudinary } from 'cloudinary';
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

// AWS S3 configuration
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_BUCKET = process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';

export type StorageProvider = 'cloudinary' | 's3';
export const STORAGE_PROVIDER: StorageProvider =
  (process.env.STORAGE_PROVIDER as StorageProvider) || 'cloudinary';
