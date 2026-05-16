// backend/src/database/seed.ts
import { db } from '../config/database';

const premadeTemplates = [
    {
        name: 'Instagram Product Spotlight',
        content: 'Check out our new {product_name}! 🚀 Only {price}. Click the link in bio to shop now. #product #newrelease',
        category: 'Promotional',
        platforms: ['instagram'],
        is_public: true
    },
    {
        name: 'Facebook Community Update',
        content: "Hi everyone! We've just updated our {feature_name}. Check it out and let us know what you think! 💬 #community #update",
        category: 'Update',
        platforms: ['facebook'],
        is_public: true
    },
    {
        name: 'LinkedIn Thought Leadership',
        content: "I've been thinking a lot about {topic} lately. Here are my 3 key takeaways: \n\n1. {takeaway_1}\n2. {takeaway_2}\n3. {takeaway_3}\n\nWhat are your thoughts? #leadership #business",
        category: 'Educational',
        platforms: ['linkedin'],
        is_public: true
    },
    {
        name: 'X (Twitter) Quick Tip',
        content: 'Pro tip: {tip_content} 💡 #tips #productivity',
        category: 'Educational',
        platforms: ['twitter'],
        is_public: true
    }
];

const premadeHashtagSets = [
    {
        name: 'General Growth',
        hashtags: ['growth', 'success', 'business', 'entrepreneur', 'motivation']
    },
    {
        name: 'E-commerce Standard',
        hashtags: ['shop', 'shopping', 'online', 'sale', 'deal', 'fashion', 'store']
    },
    {
        name: 'SaaS / Tech',
        hashtags: ['saas', 'tech', 'software', 'cloud', 'developer', 'startup']
    }
];

export const seed = async () => {
    console.log('🌱 Seeding database with premade content...');

    try {
        // Seed Templates
        for (const t of premadeTemplates) {
            await db.query(
                `INSERT INTO templates (name, content, category, platforms, is_public)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT DO NOTHING`,
                [t.name, t.content, t.category, t.platforms, t.is_public]
            );
        }
        console.log('✅ Premade templates seeded.');

        // Seed Hashtag Sets
        for (const s of premadeHashtagSets) {
            await db.query(
                `INSERT INTO hashtag_sets (name, hashtags)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [s.name, s.hashtags]
            );
        }
        console.log('✅ Premade hashtag sets seeded.');

        console.log('🎉 Seeding complete!');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    }
};

if (require.main === module) {
    seed().then(() => process.exit(0));
}
