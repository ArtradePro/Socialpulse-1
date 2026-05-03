import { GoogleGenAI } from '@google/genai';
import { db } from '../config/database';

let _gemini: GoogleGenAI | null = null;
const getGemini = (): GoogleGenAI => {
    if (!_gemini) {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
        _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

        let customGuidelines = '';
        if (workspaceId) {
            const ws = await db.query('SELECT ai_guidelines FROM workspaces WHERE id = $1', [workspaceId]);
            if (ws.rows.length > 0 && ws.rows[0].ai_guidelines) {
                customGuidelines = ws.rows[0].ai_guidelines;
            }
        }

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
                "content": "the post content without hashtags",
                "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
            }
        `;

        const systemInstruction = customGuidelines 
            ? `You are a professional social media content creator.\n\nCRITICAL BRAND GUIDELINES YOU MUST FOLLOW:\n${customGuidelines}\n\nAlways return valid JSON without markdown wrapping.`
            : 'You are a professional social media content creator. Always return valid JSON without markdown wrapping.';

        const response = await getGemini().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: prompt }] }
            ],
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.8,
                responseMimeType: 'application/json',
            }
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        const resultText = response.text || '{}';
        // Clean markdown backticks if Gemini includes them despite instructions
        const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    }

    static async generateHashtags(
        userId: string,
        topic: string,
        platform: string,
        count: number = 10
    ): Promise<string[]> {

        const response = await getGemini().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: `Generate ${count} relevant, trending hashtags for a ${platform} post about: "${topic}". Mix popular and niche hashtags. Return as JSON array: ["hashtag1", "hashtag2", ...]` }] }
            ],
            config: {
                systemInstruction: 'You are a social media hashtag expert. Return only valid JSON arrays without markdown wrapping.',
                temperature: 0.7,
                responseMimeType: 'application/json',
            }
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        const resultText = response.text || '[]';
        const cleanText = resultText.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    }

    static async improveContent(
        userId: string,
        content: string,
        platform: string,
        improvement: string
    ): Promise<string> {

        const response = await getGemini().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: `Improve this ${platform} post to make it more ${improvement}: \n\n"${content}"\n\nReturn only the improved content, nothing else.` }] }
            ],
            config: {
                systemInstruction: 'You are a professional content editor for social media.',
                temperature: 0.7,
            }
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        return response.text?.trim() || content;
    }

    static async generateImageCaption(
        userId: string,
        imageDescription: string,
        platform: string,
        tone: string
    ): Promise<string> {

        const response = await getGemini().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: `Write a ${tone} caption for a ${platform} post with this image: "${imageDescription}". Include relevant emojis and make it engaging.` }] }
            ]
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        return response.text?.trim() || '';
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

        let aspectRatio = "1:1";
        if (size === '1792x1024') aspectRatio = "16:9";
        if (size === '1024x1792') aspectRatio = "9:16";

        const response = await getGemini().models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio,
            }
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 2 WHERE id = $1', [userId]);

        const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
        if (!base64Image) {
            throw new Error('Image generation failed to return an image.');
        }

        return `data:image/jpeg;base64,${base64Image}`;
    }
}