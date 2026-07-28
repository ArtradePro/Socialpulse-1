import axios from 'axios';
import { ScrapedLeadData } from '../types/automation';

/**
 * Extract email from a business website using a lightweight HTML scraper
 */
async function extractEmailFromWebsite(url: string): Promise<string | undefined> {
    if (!url) return undefined;
    
    // Add protocol if missing
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'http://' + targetUrl;
    }

    try {
        const response = await axios.get(targetUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });

        const html = response.data;
        if (typeof html !== 'string') return undefined;

        // Match public emails (excluding common image extensions or spam traps if possible)
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const matches = html.match(emailRegex);
        if (matches && matches.length > 0) {
            // Filter out common false positives
            const excludedDomains = ['sentry.io', 'github.com', 'wix.com', 'bootstrap.com', 'example.com', 'png', 'jpg', 'gif'];
            for (const email of matches) {
                const lowerEmail = email.toLowerCase();
                const domain = lowerEmail.split('@')[1] || '';
                if (!excludedDomains.some(excluded => lowerEmail.includes(excluded) || domain.includes(excluded))) {
                    return email;
                }
            }
            return matches[0];
        }
    } catch (err: any) {
        console.warn(`[WebScraper] Failed to extract email from ${targetUrl}:`, err.message);
    }
    return undefined;
}

/**
 * Scrape leads using SerpApi Google Maps Search API
 */
export async function scrapeGoogleMapsSerpApi(
    query: string,
    location: string,
    limit: number = 20
): Promise<ScrapedLeadData[]> {
    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
        throw new Error("Missing SERPAPI_API_KEY");
    }

    const fullQuery = `${query} in ${location}`;
    console.log(`📡 SerpApi: Scraping Google Maps for "${fullQuery}" (limit: ${limit})`);

    const url = 'https://serpapi.com/search.json';
    const response = await axios.get(url, {
        params: {
            engine: 'google_maps',
            q: fullQuery,
            api_key: apiKey
        }
    });

    const data = response.data;
    const localResults = data.local_results || [];

    const leads: ScrapedLeadData[] = [];
    
    // Process results up to limit
    const resultsToProcess = localResults.slice(0, limit);

    for (const item of resultsToProcess) {
        const rating = item.rating || 4.0;
        const competitorRating = Math.max(1.0, Math.min(5.0, rating + (Math.random() * 0.8 - 0.4)));
        const website = item.website || undefined;
        
        let email = undefined;
        if (website) {
            console.log(`🔍 WebScraper: Crawling website ${website} for business email...`);
            email = await extractEmailFromWebsite(website);
        }

        leads.push({
            businessName: item.title,
            email: email,
            phone: item.phone || undefined,
            address: item.address || undefined,
            city: location.split(',')[0].trim(),
            category: item.type || query,
            rating: rating,
            reviewsCount: item.reviews || 0,
            website: website,
            competitorRating: parseFloat(competitorRating.toFixed(1))
        });
    }

    return leads;
}
