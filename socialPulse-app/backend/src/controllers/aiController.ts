import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AIService } from '../services/ai.service';

const handleAiError = (err: any, res: Response, defaultMessage: string) => {
    if (err.message === 'Insufficient AI credits. Please upgrade your plan.') {
        res.status(402).json({ message: err.message });
        return;
    }
    
    // Handle OpenAI specific errors (like 429 Quota Exceeded)
    if (err.status === 429 || (err.message && err.message.includes('quota'))) {
        res.status(429).json({ message: 'The AI service is currently unavailable due to capacity limits. Please try again later or contact support.' });
        return;
    }
    
    console.error(`[AI Error] ${defaultMessage}:`, err.message || err);
    res.status(500).json({ message: defaultMessage });
};

export const generateContent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id');
        const result = await AIService.generateContent(userId, workspaceId, req.body);
        res.json(result);
    } catch (err: any) {
        handleAiError(err, res, 'AI generation failed');
    }
};

export const generateHashtags = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { topic, platform, count } = req.body;
        const hashtags = await AIService.generateHashtags(req.user!.userId, topic, platform, count);
        res.json({ hashtags });
    } catch (err: any) {
        handleAiError(err, res, 'Hashtag generation failed');
    }
};

export const improveContent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, platform, improvement } = req.body;
        const improved = await AIService.improveContent(req.user!.userId, content, platform, improvement);
        res.json({ content: improved });
    } catch (err: any) {
        handleAiError(err, res, 'Content improvement failed');
    }
};

export const generateImageCaption = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { imageDescription, platform, tone } = req.body;
        const caption = await AIService.generateImageCaption(req.user!.userId, imageDescription, platform, tone);
        res.json({ caption });
    } catch (err: any) {
        handleAiError(err, res, 'Caption generation failed');
    }
};

export const generateImage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { prompt, size } = req.body;
        if (!prompt) { res.status(400).json({ message: 'prompt is required' }); return; }
        const url = await AIService.generateImage(req.user!.userId, prompt, size);
        res.json({ url });
    } catch (err: any) {
        handleAiError(err, res, 'Image generation failed');
    }
};