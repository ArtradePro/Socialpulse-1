import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AIService } from '../services/ai.service';

export const generateContent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const result = await AIService.generateContent(userId, req.body);
        res.json(result);
    } catch (err: any) {
        const status = err.message?.includes('credits') ? 402 : 500;
        res.status(status).json({ message: err.message || 'AI generation failed' });
    }
};

export const generateHashtags = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { topic, platform, count } = req.body;
        const hashtags = await AIService.generateHashtags(req.user!.userId, topic, platform, count);
        res.json({ hashtags });
    } catch (err: any) {
        res.status(500).json({ message: err.message || 'Hashtag generation failed' });
    }
};

export const improveContent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, platform, improvement } = req.body;
        const improved = await AIService.improveContent(req.user!.userId, content, platform, improvement);
        res.json({ content: improved });
    } catch (err: any) {
        res.status(500).json({ message: err.message || 'Content improvement failed' });
    }
};

export const generateImageCaption = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { imageDescription, platform, tone } = req.body;
        const caption = await AIService.generateImageCaption(req.user!.userId, imageDescription, platform, tone);
        res.json({ caption });
    } catch (err: any) {
        res.status(500).json({ message: err.message || 'Caption generation failed' });
    }
};

export const generateImage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { prompt, size } = req.body;
        if (!prompt) { res.status(400).json({ message: 'prompt is required' }); return; }
        const url = await AIService.generateImage(req.user!.userId, prompt, size);
        res.json({ url });
    } catch (err: any) {
        const status = err.message?.includes('credits') ? 402 : 500;
        res.status(status).json({ message: err.message || 'Image generation failed' });
    }
};