import dotenv from 'dotenv';
dotenv.config();
import { AIService } from '../src/services/ai.service';

async function test() {
    try {
        console.log('Testing AIService.reviewContent...');
        const userId = '3f73bd30-914e-4105-badb-8e72bfb09059'; // Venon
        const result = await AIService.reviewContent(userId, undefined, 'Test content about athlete shower gel', 'twitter');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error('Error:', err.message || err);
    } finally {
        process.exit();
    }
}

test();
