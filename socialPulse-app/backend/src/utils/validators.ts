import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1).max(255),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createPostSchema = z.object({
  content: z.string().min(1).max(2000),
  platforms: z.array(z.enum(['twitter', 'instagram', 'linkedin', 'facebook'])).min(1),
  mediaUrls: z.array(z.string().url()).optional(),
  hashtags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  aiGenerated: z.boolean().optional(),
  campaignId: z.string().uuid().optional(),
});

export const scheduleSchema = z.object({
  postId: z.string().uuid(),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook']),
  scheduledAt: z.string().datetime(),
});

export const aiGenerateSchema = z.object({
  topic: z.string().min(1).max(500),
  tone: z.enum(['professional', 'casual', 'humorous', 'inspirational']).optional(),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook']).optional(),
  wordCount: z.number().int().min(10).max(500).optional(),
});

/** Middleware factory to validate request body against a Zod schema */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: 'Validation error',
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
