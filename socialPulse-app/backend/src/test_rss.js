const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

async function test() {
    const url = 'https://www.medscape.com/cx/rssfeed/dermatology.xml';
    console.log('Fetching:', url);
    try {
        const feed = await parser.parseURL(url);
        console.log('Success!');
        console.log('Title:', feed.title);
        console.log('Items:', feed.items.length);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
