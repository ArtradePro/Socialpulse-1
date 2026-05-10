import { GoogleGenAI } from '@google/genai';
import { db } from '../config/database';
import { LinkService } from './link.service';
import axios from 'axios';

let _gemini: GoogleGenAI | null = null;
const getGemini = (): GoogleGenAI => {
    if (!_gemini) {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
        _gemini = new GoogleGenAI(process.env.GEMINI_API_KEY);
    }
    return _gemini;
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

        const user = await db.query(
            'SELECT ai_credits FROM users WHERE id = $1',
            [userId]
        );

        if (user.rows[0].ai_credits <= 0) {
            throw new Error('Insufficient AI credits. Please upgrade your plan.');
        }

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
            
            Return a JSON object with:
            {
                "content": "the post content",
                "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
            }
        `;

        const systemInstruction = `You are a professional social media content creator and conversion optimizer.
        
        YOUR CORE FRAMEWORK (PAIN-SOLUTION-CTA):
        1. Start with a PAIN-POINT HOOK (first 1-2 lines) that stops the scroll by calling out a specific problem the customer is suffering from.
        2. Provide a SIMPLE PROMISE (one clear benefit) of what the product/service does.
        3. Include SOCIAL PROOF (credibility, numbers, testimonials) if applicable.
        4. End with a CLEAR CALL TO ACTION (CTA) that pushes directly to a sale.
        5. MANDATORY: You MUST include this purchase link in the CTA: ${purchaseUrl || '[Insert Purchase Link Here]'}. 
           ${purchaseUrl ? 'Never use a placeholder, always use the actual URL provided.' : 'If no URL is provided, use the placeholder [Link to Buy].'}
        
        CRITICAL RULES:
        - Every post must drive revenue. No "awareness only" posts.
        - No "brand story" or "checking in" fluff.
        - Target the sale at the source.
        
        ${customGuidelines ? `\nADDITIONAL BRAND GUIDELINES:\n${customGuidelines}` : ''}
        
        Always return valid JSON without markdown wrapping.`;

        const model = getGemini().getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction,
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
            }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);

        const resultText = result.response.text() || '{}';
        const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    }

    static async generateMagicPlan(
        userId: string,
        workspaceId: string | undefined,
        campaignName: string,
        campaignDescription: string
    ): Promise<{ posts: { content: string; scheduled_offset_days: number; platform: string }[] }> {
        
        const { guidelines: customGuidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `Create a 7-day high-conversion social media plan for this campaign:
        
        NAME: "${campaignName}"
        DESCRIPTION: "${campaignDescription}"
        
        For each of the 7 days, generate one post draft. Use the PAIN-SOLUTION-CTA framework.
        Mix platforms between Twitter, Instagram, and LinkedIn.
        
        Return a JSON object with:
        {
            "posts": [
                {
                    "content": "...",
                    "scheduled_offset_days": 1, 
                    "platform": "twitter"
                },
                ... (7 items)
            ]
        }`;

        const systemInstruction = `You are a master digital marketer. 
        Your goal is to maximize ROI for the campaign through strategic storytelling and direct-response copywriting.
        
        MANDATORY: Every post must include this purchase link in the CTA: ${purchaseUrl || '[Insert Purchase Link Here]'}.
        
        ${customGuidelines ? `\nADDITIONAL BRAND GUIDELINES:\n${customGuidelines}` : ''}
        
        Always return valid JSON without markdown wrapping.`;

        const model = getGemini().getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction,
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
            }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 7 WHERE id = $1', [userId]);

        const resultText = result.response.text() || '{}';
        const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    }

    static async draftFromTrend(
        userId: string,
        workspaceId: string | undefined,
        trendContent: string,
        platform: string
    ): Promise<{ content: string; hashtags: string[] }> {

        const { guidelines: customGuidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `Convert this social trend/mention into a high-conversion ${platform} post draft:
        
        TREND CONTENT: "${trendContent}"
        
        Follow the PAIN-SOLUTION-CTA framework strictly:
        1. Identify the core PAIN-POINT from the trend and start with a hook.
        2. Offer a SIMPLE PROMISE/SOLUTION.
        3. Include a placeholder for SOCIAL PROOF.
        4. End with a CLEAR CTA containing this link: ${purchaseUrl || '[Insert Purchase Link Here]'}.
        
        Return a JSON object with:
        {
            "content": "the post content",
            "hashtags": ["hashtag1", "hashtag2", ...]
        }`;

        const systemInstruction = `You are a viral social media strategist. 
        Your goal is to turn trend data into REVENUE. 
        
        ${customGuidelines ? `\nADDITIONAL BRAND GUIDELINES:\n${customGuidelines}` : ''}
        
        Always return valid JSON without markdown wrapping.`;

        const model = getGemini().getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction,
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
            }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);

        const resultText = result.response.text() || '{}';
        const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
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

        const { guidelines: customGuidelines, purchaseUrl } = await this.getWorkspaceContext(workspaceId);

        const prompt = `Review this ${platform} post based on the PAIN-SOLUTION-CTA framework:
        
        "${content}"
        
        Return a JSON object with:
        {
            "score": number (0-100),
            "feedback": [
                {"component": "Hook", "status": "pass/fail/warn", "message": "..."},
                {"component": "Promise", "status": "pass/fail/warn", "message": "..."},
                {"component": "Social Proof", "status": "pass/fail/warn", "message": "..."},
                {"component": "CTA", "status": "pass/fail/warn", "message": "..."},
                {"component": "Link", "status": "pass/fail/warn", "message": "..."}
            ],
            "remix": "An improved version of the post that strictly follows the framework and includes the purchase link"
        }`;

        const systemInstruction = `You are a world-class conversion copywriter. You are brutal but helpful. 
        Evaluate the content based on whether it will DRIVE REVENUE. 
        Fail any component that is vague, "brand-story" focused, or lacks a clear sale-focused CTA.
        
        MANDATORY FOR REMIX: You MUST include this purchase link: ${purchaseUrl || '[Insert Purchase Link Here]'}.
        If the original content is missing this link, point it out as a major failure in the feedback.
        
        ${customGuidelines ? `\nADDITIONAL BRAND GUIDELINES:\n${customGuidelines}` : ''}
        
        Always return valid JSON without markdown wrapping.`;

        const model = getGemini().getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction,
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
            }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1', [userId]);

        const resultText = result.response.text() || '{}';
        const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    }

    static async generateHashtags(
        userId: string,
        topic: string,
        platform: string,
        count: number = 10
    ): Promise<string[]> {

        const model = getGemini().getGenerativeModel({
            model: 'gemini-1.5-flash',
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `Generate ${count} relevant, trending hashtags for a ${platform} post about: "${topic}". Mix popular and niche hashtags. Return as JSON array: ["hashtag1", "hashtag2", ...]` }] }],
            generationConfig: {
                temperature: 0.7,
                responseMimeType: 'application/json',
            }
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        const resultText = result.response.text() || '[]';
        const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    }

    static async improveContent(
        userId: string,
        content: string,
        platform: string,
        improvement: string
    ): Promise<string> {

        const model = getGemini().getGenerativeModel({
            model: 'gemini-1.5-flash',
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `Improve this ${platform} post to make it more ${improvement}: \n\n"${content}"\n\nReturn only the improved content, nothing else.` }] }],
            generationConfig: {
                temperature: 0.7,
            }
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        return result.response.text()?.trim() || content;
    }

    static async generateImageCaption(
        userId: string,
        imageDescription: string,
        platform: string,
        tone: string
    ): Promise<string> {

        const model = getGemini().getGenerativeModel({
            model: 'gemini-1.5-flash',
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `Write a ${tone} caption for a ${platform} post with this image: "${imageDescription}". Include relevant emojis and make it engaging.` }] }]
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        return result.response.text()?.trim() || '';
    }

    static async generateImage(
        userId: string,
        prompt: string,
        size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'
    ): Promise<string> {
        const user = await db.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
        if (user.rows[0].ai_credits <= 0) {
            throw new Error('Insufficient AI credits. Please upgrade your plan.');
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

        // Imagen 3.0 via Direct REST API (Stable fallback)
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
                {
                    instances: [{ prompt }],
                    parameters: { sampleCount: 1 }
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const base64Image = response.data.predictions?.[0]?.bytesBase64Encoded;
            if (!base64Image) throw new Error('No image returned from Imagen API');

            await db.query('UPDATE users SET ai_credits = ai_credits - 2 WHERE id = $1', [userId]);
            return `data:image/jpeg;base64,${base64Image}`;

        } catch (err: any) {
            console.error('[AIService] Imagen API error:', err.response?.data || err.message);
            
            // If Imagen is not enabled for this key, fall back to a high-quality placeholder for UI stability
            // but log the error so the user knows to enable it in Google Cloud/AI Studio.
            if (err.response?.status === 403 || err.response?.status === 404) {
                 throw new Error('Imagen 3.0 is not enabled for this API Key. Please enable it in Google AI Studio.');
            }
            throw err;
        }
    }
}