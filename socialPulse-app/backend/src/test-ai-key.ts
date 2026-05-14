import { AIService } from './services/ai.service';
import { db } from './config/database';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyAI() {
    const userId = '5c1f19f4-f1bd-4d44-be3b-a4efd9f6f889';
    console.log('--- SocialPulse AI Verification ---');
    console.log('Target User ID:', userId);
    
    try {
        console.log('\n1. Testing Content Generation (Gemini 2.5 Flash)...');
        const content = await AIService.generateContent(userId, undefined, {
            topic: 'The future of AI in Social Media Management',
            platform: 'twitter',
            tone: 'professional',
            length: 'short',
            includeHashtags: true,
            includeEmojis: true,
            language: 'English'
        });
        console.log('✅ Content Generation Success!');
        console.log('Sample content:', content.content.substring(0, 100) + '...');

        console.log('\n2. Testing Image Generation (Imagen 4.0 via REST)...');
        const imageUrl = await AIService.generateImage(userId, 'A futuristic social media dashboard, high resolution, 3d render', '1024x1024');
        console.log('✅ Image Generation Success!');
        console.log('Image URL:', imageUrl);

    } catch (err: any) {
        console.error('\n❌ AI Verification Failed!');
        console.error('Error Details:', err.message || err);
        if (err.response?.data) {
            console.error('API Response:', JSON.stringify(err.response.data, null, 2));
        }
    } finally {
        process.exit();
    }
}

verifyAI();
