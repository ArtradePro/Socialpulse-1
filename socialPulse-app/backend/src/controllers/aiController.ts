import { Request, Response } from 'express';
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
    res.status(500).json({ message: err.message || defaultMessage });
};

export const generateContent = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id') as string | undefined;
        const result = await AIService.generateContent(userId, workspaceId, req.body);
        res.json(result);
    } catch (err: any) {
        handleAiError(err, res, 'AI generation failed');
    }
};

export const generateHashtags = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topic, platform, count } = req.body;
        const hashtags = await AIService.generateHashtags(req.user!.userId, topic, platform, count);
        res.json({ hashtags });
    } catch (err: any) {
        handleAiError(err, res, 'Hashtag generation failed');
    }
};

export const generateMagicPlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id') as string | undefined;
        const { topic, description, days = 7 } = req.body;
        
        if (!topic) { res.status(400).json({ message: 'topic is required' }); return; }
        
        const result = await AIService.generateMagicPlan(userId, workspaceId, topic, description || '', days);
        res.json(result);
    } catch (err: any) {
        handleAiError(err, res, 'Magic Plan generation failed');
    }
};

export const generateReply = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id') as string | undefined;
        const { messageContent, platform } = req.body;
        if (!messageContent) { res.status(400).json({ message: 'messageContent is required' }); return; }
        const result = await AIService.generateReply(userId, workspaceId, messageContent, platform || 'twitter');
        res.json(result);
    } catch (err: any) {
        handleAiError(err, res, 'Reply generation failed');
    }
};

export const draftFromTrend = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id') as string | undefined;
        const { trendContent, platform } = req.body;
        if (!trendContent) { res.status(400).json({ message: 'trendContent is required' }); return; }
        const result = await AIService.draftFromTrend(userId, workspaceId, trendContent, platform || 'twitter');
        res.json(result);
    } catch (err: any) {
        handleAiError(err, res, 'Trend drafting failed');
    }
};

export const reviewContent = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id') as string | undefined;
        const { content, platform } = req.body;
        if (!content) { res.status(400).json({ message: 'content is required' }); return; }
        const result = await AIService.reviewContent(userId, workspaceId, content, platform || 'twitter');
        res.json(result);
    } catch (err: any) {
        handleAiError(err, res, 'Content review failed');
    }
};

export const improveContent = async (req: Request, res: Response): Promise<void> => {
    try {
        const { content, platform, improvement } = req.body;
        const improved = await AIService.improveContent(req.user!.userId, content, platform, improvement);
        res.json({ content: improved });
    } catch (err: any) {
        handleAiError(err, res, 'Content improvement failed');
    }
};

export const generateImageCaption = async (req: Request, res: Response): Promise<void> => {
    try {
        const { imageDescription, platform, tone } = req.body;
        const caption = await AIService.generateImageCaption(req.user!.userId, imageDescription, platform, tone);
        res.json({ caption });
    } catch (err: any) {
        handleAiError(err, res, 'Caption generation failed');
    }
};

export const generateImage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { prompt, size } = req.body;
        if (!prompt) { res.status(400).json({ message: 'prompt is required' }); return; }
        const url = await AIService.generateImage(req.user!.userId, prompt, size);
        res.json({ url });
    } catch (err: any) {
        handleAiError(err, res, 'Image generation failed');
    }
};

export const generateProductPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const workspaceId = req.header('x-workspace-id') as string | undefined;
        const { productData, platform, tone } = req.body;
        const result = await AIService.generateProductPost(userId, workspaceId, productData, platform, tone);
        res.json(result);
    } catch (err: any) {
        handleAiError(err, res, 'Product post generation failed');
    }
};