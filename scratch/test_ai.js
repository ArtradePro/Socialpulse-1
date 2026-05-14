const { AIService } = require('./backend/src/services/ai.service');
const { db } = require('./backend/src/config/database');

async function test() {
    try {
        console.log('Testing AIService.reviewContent...');
        // Mock a user with credits
        const userId = '3f73bd30-914e-4105-badb-8e72bfb09059'; // Venon
        const result = await AIService.reviewContent(userId, undefined, 'Test content', 'twitter');
        console.log('Result:', result);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

test();
