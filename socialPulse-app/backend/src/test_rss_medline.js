const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

async function test() {
    const url = 'https://medlineplus.gov/rss/healthtopics/skindiseases.xml';
    console.log('Fetching:', url);
    try {
        const feed = await parser.parseURL(url);
        console.log('Success!');
        console.log('Title:', feed.title);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
