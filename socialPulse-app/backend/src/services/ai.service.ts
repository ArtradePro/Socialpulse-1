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
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction, responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async generateMagicPlan(
        userId: string,
        workspaceId: string | undefined,
        campaignName: string,
        campaignDescription: string,
        days: number = 7
    ): Promise<{ posts: { content: string; scheduled_offset_days: number; platform: string; type: string }[] }> {
        
        const { guidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `
            Create a strategic ${days}-day social media "Magic Plan" for the following:
            Topic/Campaign: "${campaignName}"
            Description: "${campaignDescription}"
            
            Strategy Guidelines:
            - Create exactly ${days} posts.
            - Sequence them logically to build momentum.
            - Include Educational, Engagement, Promotional, and Behind-the-scenes content.
            - If promotional, naturally mention this link: ${purchaseUrl || '[Link]'}.
            
            Platform Mix: Use a variety of platforms (twitter, linkedin, instagram, facebook).
            Brand Guidelines: ${guidelines || 'Professional and engaging'}
            
            Return JSON: 
            {
                "posts": [
                    {
                        "content": "...", 
                        "scheduled_offset_days": 1, 
                        "platform": "twitter",
                        "type": "Educational"
                    }
                ]
            }
        `;

        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction: 'You are a master digital marketer and social media strategist.', responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 7) WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async generateReply(
        userId: string,
        workspaceId: string | undefined,
        messageContent: string,
        platform: string
    ): Promise<{ content: string }> {
        const { guidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `
            Draft a helpful and engaging reply to this ${platform} message:
            Message: "${messageContent}"
            
            Guidelines:
            - Professional yet friendly tone.
            - If relevant, naturally mention this link: ${purchaseUrl || '[Link]'}.
            - Keep it concise (under 280 chars if Twitter).
            
            Return JSON: {"content": "..."}
        `;

        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction: guidelines, responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
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
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Convert this trend into a ${platform} post: "${trendContent}". Link: ${purchaseUrl || '[Link]'}` }] }],
            config: { responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
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
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async generateHashtags(userId: string, topic: string, platform: string, count: number = 10): Promise<string[]> {
        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Generate ${count} hashtags for ${platform} about ${topic}. Return JSON array.` }] }],
            config: { responseMimeType: 'application/json' }
        });
        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
        const resultText = result.text || '[]';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async improveContent(userId: string, content: string, platform: string, improvement: string): Promise<string> {
        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Improve this ${platform} post for ${improvement}: "${content}"` }] }]
        });
        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
        return result.text?.trim() || content;
    }

    static async generateImageCaption(userId: string, imageDescription: string, platform: string, tone: string): Promise<string> {
        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: `Caption for ${platform} (${tone}): "${imageDescription}"` }] }]
        });
        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
        return result.text?.trim() || '';
    }

    static async generateImage(userId: string, prompt: string, size: string = '1024x1024'): Promise<string> {
        const user = await db.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
        if (!user.rows[0] || user.rows[0].ai_credits <= 0) {
            throw new Error('Insufficient AI credits. Please upgrade your plan.');
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY missing in environment variables');

        // Imagen 3.0 via Direct REST API
        try {
            console.log(`[AIService] Attempting image generation for user ${userId}. Prompt: "${prompt}"`);
            
            // Note: imagen-3.0-generate-001 is the standard, but some projects use imagen-3.0-alpha-generate-001
            const modelId = 'imagen-3.0-generate-001';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`;

            const response = await axios.post(
                url,
                {
                    instances: [{ prompt }],
                    parameters: { 
                        sampleCount: 1,
                        // aspect_ratio: size === '1024x1024' ? '1:1' : '3:4' // Imagen supports ratios now
                    }
                },
                { 
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000 // 30s timeout for image generation
                }
            );

            const base64Image = response.data.predictions?.[0]?.bytesBase64Encoded;
            
            if (!base64Image) {
                console.error('[AIService] Imagen API success but no image data. Response:', JSON.stringify(response.data));
                throw new Error('The AI service returned a success response but no image was generated. This can happen if the prompt violates safety guidelines.');
            }

            // Successfully generated - deduct 2 credits for image generation
            await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 2) WHERE id = $1', [userId]);
            console.log(`[AIService] Image generated successfully for user ${userId}`);
            
            return `data:image/png;base64,${base64Image}`;

        } catch (err: any) {
            const status = err.response?.status;
            const errorBody = err.response?.data;
            
            console.error(`[AIService] Imagen API Error [${status || 'No Status'}]:`, JSON.stringify(errorBody || err.message));
            
            if (status === 403) {
                throw new Error('Access Denied: Please ensure the "Generative Language API" and "Imagen API" are enabled in your Google AI Studio project and that your API key has the correct permissions.');
            }
            
            if (status === 404) {
                throw new Error('Model Not Found: The specified Imagen model is not available for this API key. Try checking your Google AI Studio settings.');
            }

            if (status === 429) {
                throw new Error('Quota Exceeded: You have reached the rate limit for image generation. Please try again in a few minutes.');
            }
            
            if (errorBody?.error?.message) {
                throw new Error(`AI Service Error: ${errorBody.error.message}`);
            }

            throw new Error(`Image generation failed: ${err.message || 'Unknown error'}`);
        }
    }

    static async generateProductPost(
        userId: string,
        workspaceId: string | undefined,
        productData: { title: string; description: string; price: number; currency: string; productUrl: string },
        platform: string,
        tone: string = 'promotional'
    ): Promise<{ content: string; hashtags: string[] }> {
        const { guidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `
            Create a highly converting ${tone} social media post for ${platform} promoting this product:
            Title: ${productData.title}
            Description: ${productData.description}
            Price: ${productData.currency} ${productData.price}
            Product Link: ${productData.productUrl}
            
            Strategy: Use the PAIN-AGITATE-SOLVE framework. Mention the benefits, the price, and include a clear call to action using the product link.
            
            Return a JSON object: {"content": "...", "hashtags": ["...", "..."]}
        `;

        const systemInstruction = `You are an expert e-commerce copywriter. 
        MANDATORY: Use this direct product link: ${productData.productUrl}.
        ${guidelines ? `BRAND GUIDELINES: ${guidelines}` : ''}
        Return only JSON.`;

        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction, responseMimeType: 'application/json' }
        });

        await db.query('UPDATE users SET ai_credits = GREATEST(0, ai_credits - 1) WHERE id = $1', [userId]);
        const resultText = result.text || '{}';
        return JSON.parse(resultText.replace(/```json\n?|\n?```/g, '').trim());
    }

    static async generateAnalyticsInsights(metrics: any[]): Promise<string> {
        const statsStr = metrics.map(m => `${m.platform}: ${m.impressions} impr, ${m.engagements} eng, ${m.er.toFixed(2)}% ER`).join('\n');
        
        const prompt = `
            Analyze these social media performance metrics for the last 30 days:
            ${statsStr}
            
            Provide 3 brief, actionable strategic insights to improve performance. 
            Keep them professional, high-converting, and specific to the data.
            Return as a concise markdown list.
        `;

        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction: 'You are a master social media growth analyst.' }
        });

        return result.text || 'Keep posting high-quality content to grow your audience!';
    }
}
