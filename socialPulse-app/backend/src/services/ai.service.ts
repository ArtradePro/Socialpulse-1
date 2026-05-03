import OpenAI from 'openai';
import { db } from '../config/database';

let _openai: OpenAI | null = null;
const getOpenAI = (): OpenAI => {
    if (!_openai) {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
        _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _openai;
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
        options: ContentGenerationOptions
    ): Promise<{ content: string; hashtags: string[] }> {

        const user = await db.query(
            'SELECT ai_credits FROM users WHERE id = $1',
            [userId]
        );

        if (user.rows[0].ai_credits <= 0) {
            throw new Error('Insufficient AI credits. Please upgrade your plan.');
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

        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional social media content creator. Always return valid JSON.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 800,
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        const result = JSON.parse(response.choices[0].message.content || '{}');
        return result;
    }

    static async generateHashtags(
        userId: string,
        topic: string,
        platform: string,
        count: number = 10
    ): Promise<string[]> {

        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a social media hashtag expert. Return only valid JSON arrays.',
                },
                {
                    role: 'user',
                    content: `Generate ${count} relevant, trending hashtags for a ${platform} post about: "${topic}". Mix popular and niche hashtags. Return as JSON array: ["hashtag1", "hashtag2", ...]`,
                },
            ],
            temperature: 0.7,
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        const hashtags = JSON.parse(response.choices[0].message.content || '[]');
        return hashtags;
    }

    static async improveContent(
        userId: string,
        content: string,
        platform: string,
        improvement: string
    ): Promise<string> {

        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional content editor for social media.',
                },
                {
                    role: 'user',
                    content: `Improve this ${platform} post to make it more ${improvement}: \n\n"${content}"\n\nReturn only the improved content, nothing else.`,
                },
            ],
            temperature: 0.7,
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        return response.choices[0].message.content?.trim() || content;
    }

    static async generateImageCaption(
        userId: string,
        imageDescription: string,
        platform: string,
        tone: string
    ): Promise<string> {

        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: `Write a ${tone} caption for a ${platform} post with this image: "${imageDescription}". Include relevant emojis and make it engaging.`,
                },
            ],
        });

        await db.query(
            'UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1',
            [userId]
        );

        return response.choices[0].message.content?.trim() || '';
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

        const response = await getOpenAI().images.generate({
            model:   'dall-e-3',
            prompt,
            n:       1,
            size,
            quality: 'standard',
        });

        await db.query('UPDATE users SET ai_credits = ai_credits - 2 WHERE id = $1', [userId]);

        return response.data?.[0]?.url ?? '';
    }
}