const Parser = require('rss-parser');
const parser = new Parser({ 
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

async function test() {
    const url = 'https://www.medscape.com/cx/rssfeed/dermatology.xml';
    console.log('Fetching with User-Agent:', url);
    try {
        const feed = await parser.parseURL(url);
        console.log('Success!');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
