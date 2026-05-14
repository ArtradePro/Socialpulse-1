import { GoogleGenAI } from '@google/genai';
import { db } from '../config/database';
import { LinkService } from './link.service';
import axios from 'axios';

let _ai: any = null;
const getAI = (): any => {
    if (!_ai) {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
        _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return _ai;
};

interface ContentGenerationOptions {
    topic: string;
    platform: string;
    tone: string;
    length: string;
    includeHashtags: boolean;
    includeEmojis: boolean;
    language: string;
    targetAudience?: string;
    keywords?: string[];
}

export class AIService {

    private static async getWorkspaceContext(workspaceId?: string): Promise<{ guidelines: string; purchaseUrl: string }> {
        if (!workspaceId) return { guidelines: '', purchaseUrl: '' };
        const { rows } = await db.query('SELECT ai_guidelines, purchase_url FROM workspaces WHERE id = $1', [workspaceId]);
        if (rows.length === 0) return { guidelines: '', purchaseUrl: '' };

        let purchaseUrl = rows[0].purchase_url || '';
        if (purchaseUrl && purchaseUrl.startsWith('http')) {
            purchaseUrl = await LinkService.shorten(purchaseUrl, workspaceId);
        }

        return {
            guidelines: rows[0].ai_guidelines || '',
            purchaseUrl
        };
    }

    static async generateContent(
        userId: string,
        workspaceId: string | undefined,
        options: ContentGenerationOptions
    ): Promise<{ content: string; hashtags: string[] }> {

        const user = await db.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
        if (user.rows[0].ai_credits <= 0) throw new Error('Insufficient AI credits.');

        const { guidelines: customGuidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const platformGuide: Record<string, string> = {
            twitter: 'Keep it under 280 characters. Be concise and engaging.',
            instagram: 'Make it visually descriptive, engaging, up to 2200 chars.',
            linkedin: 'Professional tone, thought leadership style, detailed.',
            facebook: 'Conversational, community-focused, can be longer.',
            tiktok: 'Fun, trendy, youth-oriented, include call-to-action.',
        };

        const lengthGuide: Record<string, string> = {
            short: '1-2 sentences',
            medium: '3-4 sentences',
            long: '5-7 sentences or a detailed post',
        };

        const prompt = `
            Create a ${options.tone} social media post for ${options.platform}.
            Topic: ${options.topic}
            Platform guidelines: ${platformGuide[options.platform] || ''}
            Length: ${lengthGuide[options.length] || lengthGuide.medium}
            ${options.includeEmojis ? 'Include relevant emojis.' : 'Do not include emojis.'}
            ${options.includeHashtags ? 'Include 3-5 relevant hashtags at the end.' : 'Do not include hashtags in the content.'}
            ${options.targetAudience ? `Target audience: ${options.targetAudience}` : ''}
            ${options.keywords?.length ? `Include these keywords naturally: ${options.keywords.join(', ')}` : ''}
            Language: ${options.language}
            
            Return a JSON object: {"content": "...", "hashtags": ["...", "..."]}
        `;

        const systemInstruction = `You are a professional social media content creator. 
        MANDATORY: Include this purchase link: ${purchaseUrl || '[Link]'}.
        ${customGuidelines ? `BRAND GUIDELINES: ${customGuidelines}` : ''}
        Return only JSON.`;

        const result = await getAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction, responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async generateMagicPlan(
        userId: string,
        workspaceId: string | undefined,
        campaignName: string,
        campaignDescription: string
    ): Promise<{ posts: { content: string; scheduled_offset_days: number; platform: string }[] }> {
        
        const { guidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `Create a 7-day conversion plan for: "${campaignName}" (${campaignDescription}). 
        Include purchase link: ${purchaseUrl || '[Link]'}. 
        Return JSON: {"posts": [{"content": "...", "scheduled_offset_days": 1, "platform": "twitter"}]}`;

        const result = await getAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction: guidelines, responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 7 WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async draftFromTrend(
        userId: string,
        workspaceId: string | undefined,
        trendContent: string,
        platform: string
    ): Promise<{ content: string; hashtags: string[] }> {

        const { purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const result = await getAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Convert this trend into a ${platform} post: "${trendContent}". Link: ${purchaseUrl || '[Link]'}` }] }],
            config: { responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async reviewContent(
        userId: string,
        workspaceId: string | undefined,
        content: string,
        platform: string
    ): Promise<{
        score: number;
        feedback: { component: string; status: 'pass' | 'fail' | 'warn'; message: string }[];
        remix: string;
    }> {

        const { purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `Review this ${platform} post: "${content}". 
        Check for PAIN-SOLUTION-CTA and link: ${purchaseUrl || '[Link]'}. 
        Return JSON: {"score": 0-100, "feedback": [...], "remix": "..."}`;

        const result = await getAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async generateHashtags(userId: string, topic: string, platform: string, count: number = 10): Promise<string[]> {
        const result = await getAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Generate ${count} hashtags for ${platform} about ${topic}. Return JSON array.` }] }],
            config: { responseMimeType: 'application/json' }
        });
        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);
        const resultText = result.text || '[]';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async improveContent(userId: string, content: string, platform: string, improvement: string): Promise<string> {
        const result = await getAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Improve this ${platform} post for ${improvement}: "${content}"` }] }]
        });
        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);
        return result.text?.trim() || content;
    }

    static async generateImageCaption(userId: string, imageDescription: string, platform: string, tone: string): Promise<string> {
        const result = await getAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Caption for ${platform} (${tone}): "${imageDescription}"` }] }]
        });
        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);
        return result.text?.trim() || '';
    }

    static async generateImage(userId: string, prompt: string, size: string = '1024x1024'): Promise<string> {
        const user = await db.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
        if (user.rows[0].ai_credits <= 0) throw new Error('Insufficient AI credits.');

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY missing');

        // Imagen 4.0 via Direct REST API
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
                {
                    instances: [{ prompt }],
                    parameters: { sampleCount: 1 }
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const base64Image = response.data.predictions?.[0]?.bytesBase64Encoded;
            if (!base64Image) throw new Error('Generation failed.');

            await db.query('UPDATE users SET ai_credits = ai_credits - 2 WHERE id = $1', [userId]);
            return `data:image/png;base64,${base64Image}`;

        } catch (err: any) {
            console.error('[AIService] Imagen error:', err.response?.data || err.message);
            if (err.response?.status === 403) throw new Error('Imagen 4.0 access denied. Check Google AI Studio.');
            throw new Error('Image generation failed.');
        }
    }
}