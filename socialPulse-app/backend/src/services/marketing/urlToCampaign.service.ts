import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { ClaimsGuardService } from './claimsGuard.service';
import { db } from '../../config/database';

let _ai: any = null;
const getAI = (): any => {
    if (!_ai) {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
        _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return _ai;
};

export interface ScrapedProductData {
    url: string;
    title: string;
    description: string;
    price?: string;
    currency?: string;
    imageUrl?: string;
    brand?: string;
    features?: string[];
    reviewsCount?: number;
    rating?: number;
    isFNM?: boolean;
}

export interface UGCScriptScene {
    sceneNumber: number;
    type: 'HOOK' | 'PROBLEM_SOLUTION' | 'CTA';
    durationSeconds: number;
    visualDirection: string;
    spokenAudio: string;
    captionText: string;
    emphasisWord?: string;
}

export interface DirectResponseAdConcept {
    style: 'takealot_review' | 'us_vs_them' | 'urgency_deal' | 'clinical_proof' | 'luxury_marble' | 'social_proof_tweet';
    headline: string;
    subheadline?: string;
    badgeText?: string;
    priceText?: string;
    ctaText: string;
    quoteText?: string;
    comparisonPoints?: { label: string; ourProduct: string; others: string }[];
}

export interface GeneratedCampaignResult {
    product: ScrapedProductData;
    videoScripts: {
        title: string;
        hook: string;
        scenes: UGCScriptScene[];
        totalDurationSeconds: number;
    }[];
    adConcepts: DirectResponseAdConcept[];
    socialCopy: {
        platform: string;
        headline: string;
        body: string;
        callToAction: string;
    }[];
    targetAudience: string[];
}

export class UrlToCampaignService {
    /**
     * Crawls an e-commerce or product page URL to extract metadata, pricing, and images.
     */
    public static async crawlProductUrl(url: string): Promise<ScrapedProductData> {
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        let html = '';
        try {
            const resp = await axios.get(cleanUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                timeout: 8000
            });
            html = resp.data || '';
        } catch (err: any) {
            console.warn('[UrlToCampaign] Axios crawl error, falling back to simulated extraction:', err.message);
        }

        // Basic Regex Extraction for Title, Meta, OG Tags, JSON-LD
        let title = '';
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
        if (ogTitleMatch) title = ogTitleMatch[1].trim();

        let description = '';
        const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                            html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        if (ogDescMatch) description = ogDescMatch[1].trim();

        let imageUrl = '';
        const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogImgMatch) imageUrl = ogImgMatch[1].trim();

        // Extract Price if visible (ZAR, USD, etc.)
        let price = '';
        const priceMatch = html.match(/(?:R\s*|ZAR\s*|\$\s*)(\d+(?:[.,]\d{2})?)/i);
        if (priceMatch) {
            price = priceMatch[0].trim();
        }

        // Special handling for Fungus No More / Higiene domains
        const isFNM = cleanUrl.toLowerCase().includes('fungusnomore') ||
                      title.toLowerCase().includes('fungus no more') ||
                      description.toLowerCase().includes('fungus no more');

        if (isFNM) {
            if (!title || title.length < 5) title = 'Fungus No More™ Dual-Action Defense (500ml Shower Gel & 50ml Spray)';
            if (!description) description = 'Dual-Action antifungal skin hygiene duo. Washes away bacteria and odor and provides 24-hour skin barrier defense.';
            if (!price) price = 'R249.00';
            if (!imageUrl) imageUrl = 'https://fungusnomore.co.za/wp-content/uploads/2026/02/FNM-Sea-Breeze.png';
        }

        if (!title) {
            title = 'Premium Health & Wellness Product';
        }

        return {
            url: cleanUrl,
            title,
            description,
            price: price || 'R299.00',
            currency: price.includes('$') ? 'USD' : 'ZAR',
            imageUrl: imageUrl || undefined,
            brand: isFNM ? 'Fungus No More™' : 'Higienlabs',
            isFNM
        };
    }

    /**
     * Converts scraped product data into a complete Zeely-grade multi-platform campaign.
     */
    public static async generateCampaignFromProduct(
        workspaceId: string,
        product: ScrapedProductData
    ): Promise<GeneratedCampaignResult> {
        let isFNM = product.isFNM;
        if (workspaceId && !isFNM) {
            const { rows } = await db.query(`SELECT name, brand_type FROM workspaces WHERE id = $1 LIMIT 1`, [workspaceId]);
            if (rows[0]) {
                isFNM = ClaimsGuardService.isFungusNoMore(rows[0]);
            }
        }

        const approvedClaims = await ClaimsGuardService.getApprovedClaims(workspaceId);
        const claimsList = approvedClaims.map(c => c.claim_text);

        const prompt = `
            You are an elite direct-to-consumer advertising strategist and Creative Director like Zeely AI.
            Create a complete, high-converting launch campaign based on this product:
            
            Product Name: ${product.title}
            Description: ${product.description}
            Price: ${product.price}
            Brand: ${product.brand}
            Website: ${product.url}

            COMPLIANCE RULES:
            ${isFNM 
                ? 'Mandatory: Use registered trademark slogan "Love The Skin You\'re In." Prohibit 100% cure medical claims.' 
                : 'Prohibit using "Love The Skin You\'re In." Prohibit 100% cure guarantees.'}
            ${claimsList.length > 0 ? `Approved Claims:\n${claimsList.map(c => `- ${c}`).join('\n')}` : ''}

            Return a valid JSON object matching this schema exactly:
            {
                "targetAudience": ["Segment 1", "Segment 2", "Segment 3"],
                "videoScripts": [
                    {
                        "title": "Gym & Sweat Defense UGC Ad",
                        "hook": "Stop scrolling if you workout or wear sneakers all day.",
                        "totalDurationSeconds": 30,
                        "scenes": [
                            {
                                "sceneNumber": 1,
                                "type": "HOOK",
                                "durationSeconds": 5,
                                "visualDirection": "Creator holding product close to camera in gym or bathroom",
                                "spokenAudio": "...",
                                "captionText": "...",
                                "emphasisWord": "STOP"
                            },
                            {
                                "sceneNumber": 2,
                                "type": "PROBLEM_SOLUTION",
                                "durationSeconds": 15,
                                "visualDirection": "Demonstrating rich lather / fast-drying spray",
                                "spokenAudio": "...",
                                "captionText": "...",
                                "emphasisWord": "Defend"
                            },
                            {
                                "sceneNumber": 3,
                                "type": "CTA",
                                "durationSeconds": 10,
                                "visualDirection": "Pointing to discount banner and shopping bag icon",
                                "spokenAudio": "...",
                                "captionText": "...",
                                "emphasisWord": "Shop Now"
                            }
                        ]
                    }
                ],
                "adConcepts": [
                    {
                        "style": "takealot_review",
                        "headline": "Over 2,400+ 5-Star Reviews in South Africa",
                        "subheadline": "The shower routine that actually works.",
                        "badgeText": "5.0 ★ TOP RATED",
                        "priceText": "${product.price}",
                        "ctaText": "ORDER ON TAKEALOT",
                        "quoteText": "Completely cleared my gym foot odor in 3 days. Game changer!"
                    },
                    {
                        "style": "us_vs_them",
                        "headline": "Why Normal Soap Fails Against Sweat Bacteria",
                        "badgeText": "HIGIENLABS FORMULATION",
                        "ctaText": "SEE THE DIFFERENCE",
                        "comparisonPoints": [
                            { "label": "Bacteria & Odor Defense", "ourProduct": "Active 24h Barrier", "others": "Surface Wash Only" },
                            { "label": "Skin Barrier Soothing", "ourProduct": "Hydrates & Protects", "others": "Dries Out Skin" },
                            { "label": "Fast Next-Day Delivery", "ourProduct": "Takealot Nationwide", "others": "Standard Shipping" }
                        ]
                    },
                    {
                        "style": "urgency_deal",
                        "headline": "Limited Stock: Dual-Action Shower & Spray Duo",
                        "subheadline": "Order today for next-day dispatch across South Africa",
                        "badgeText": "LIMITED BATCH",
                        "priceText": "${product.price}",
                        "ctaText": "CLAIM OFFER NOW"
                    },
                    {
                        "style": "clinical_proof",
                        "headline": "Dermatologically Formulated for Active Skin",
                        "subheadline": "Formulated by Higienlabs Technology Division",
                        "badgeText": "LAB TESTED",
                        "priceText": "${product.price}",
                        "ctaText": "SHOP HIGIENLABS"
                    },
                    {
                        "style": "luxury_marble",
                        "headline": "Love The Skin You're In.",
                        "subheadline": "Elevate your daily shower ritual with pure botanical defense.",
                        "badgeText": "PREMIUM CARE",
                        "priceText": "${product.price}",
                        "ctaText": "EXPLORE RITUAL"
                    },
                    {
                        "style": "social_proof_tweet",
                        "headline": "Honestly the best purchase I made this year for my gym bag.",
                        "subheadline": "@athletic_sa • Verified Customer",
                        "badgeText": "VIRAL ON TIKTOK",
                        "ctaText": "GET THE DUO"
                    }
                ],
                "socialCopy": [
                    {
                        "platform": "facebook",
                        "headline": "Tired of stubborn gym sweat odor and skin irritation?",
                        "body": "Ordinary body washes clean the surface, but leave odor-causing bacteria behind. Meet the Higienlabs dual-action defense duo. Next-day delivery on Takealot!",
                        "callToAction": "Shop Now"
                    },
                    {
                        "platform": "tiktok",
                        "headline": "The #1 Gym Bag Essential for 2026",
                        "body": "If you don't have this in your gym locker, you're missing out. Two steps to stop sweat irritation before it starts. Link in bio!",
                        "callToAction": "Get Yours"
                    }
                ]
            }
        `;

        let parsed: any;
        if (process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
            try {
                const result = await getAI().models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: { responseMimeType: 'application/json' }
                });
                const raw = result.text || '{}';
                parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
            } catch (err) {
                console.error('[UrlToCampaign] Gemini generation error, using fallback:', err);
                parsed = this.getFallbackCampaign(product, isFNM);
            }
        } else {
            parsed = this.getFallbackCampaign(product, isFNM);
        }

        return {
            product,
            videoScripts: parsed.videoScripts || [],
            adConcepts: parsed.adConcepts || [],
            socialCopy: parsed.socialCopy || [],
            targetAudience: parsed.targetAudience || []
        };
    }

    private static getFallbackCampaign(product: ScrapedProductData, isFNM: boolean = false): any {
        return {
            targetAudience: [
                "Athletes & Gym-Goers",
                "Daily Active Workers in Closed Shoes",
                "Health-Conscious Skin Hygiene Consumers"
            ],
            videoScripts: [
                {
                    title: "UGC Viral Gym Defense",
                    hook: "If you workout or wear sneakers all day, stop scrolling right now.",
                    totalDurationSeconds: 30,
                    scenes: [
                        {
                            sceneNumber: 1,
                            type: "HOOK",
                            durationSeconds: 5,
                            visualDirection: "Creator kicking off sneakers and looking at camera",
                            spokenAudio: "If you workout or wear sneakers all day, stop scrolling right now.",
                            captionText: "STOP scrolling if you wear sneakers all day!",
                            emphasisWord: "STOP"
                        },
                        {
                            sceneNumber: 2,
                            type: "PROBLEM_SOLUTION",
                            durationSeconds: 15,
                            visualDirection: "Holding up product and showing refreshing lather",
                            spokenAudio: isFNM 
                                ? "Fungus No More washes away gym bacteria and odor, locking in 24-hour defense. Love The Skin You're In."
                                : `${product.title} deeply cleanses and eliminates stubborn irritation.`,
                            captionText: "Dual-Action shower routine that protects all day.",
                            emphasisWord: "Protects"
                        },
                        {
                            sceneNumber: 3,
                            type: "CTA",
                            durationSeconds: 10,
                            visualDirection: "Pointing to phone screen showing Takealot button",
                            spokenAudio: "Grab yours on Takealot with next-day delivery — tap Shop Now!",
                            captionText: "Tap Shop Now on Takealot!",
                            emphasisWord: "Shop Now"
                        }
                    ]
                }
            ],
            adConcepts: [
                {
                    style: "takealot_review",
                    headline: "Over 2,400+ 5-Star Reviews in South Africa",
                    subheadline: "The shower routine that actually works.",
                    badgeText: "5.0 ★ TOP RATED",
                    priceText: product.price,
                    ctaText: "ORDER ON TAKEALOT",
                    quoteText: "Completely cleared my gym foot odor in 3 days. Game changer!"
                },
                {
                    style: "us_vs_them",
                    headline: "Why Normal Soap Fails Against Sweat Bacteria",
                    badgeText: "HIGIENLABS FORMULATION",
                    ctaText: "SEE THE DIFFERENCE",
                    comparisonPoints: [
                        { label: "Bacteria & Odor Defense", ourProduct: "Active 24h Barrier", others: "Surface Wash Only" },
                        { label: "Skin Barrier Soothing", ourProduct: "Hydrates & Protects", others: "Dries Out Skin" },
                        { label: "Fast Delivery", ourProduct: "Takealot Nationwide", others: "Standard Shipping" }
                    ]
                },
                {
                    style: "urgency_deal",
                    headline: "Limited Stock: Dual-Action Shower & Spray Duo",
                    subheadline: "Order today for next-day dispatch across South Africa",
                    badgeText: "NEXT-DAY DELIVERY",
                    priceText: product.price,
                    ctaText: "CLAIM OFFER NOW"
                },
                {
                    style: "clinical_proof",
                    headline: "Dermatologically Formulated for Active Skin",
                    subheadline: "Formulated by Higienlabs Technology Division",
                    badgeText: "LAB TESTED",
                    priceText: product.price,
                    ctaText: "SHOP HIGIENLABS"
                },
                {
                    style: "luxury_marble",
                    headline: "Love The Skin You're In.",
                    subheadline: "Elevate your daily shower ritual with pure botanical defense.",
                    badgeText: "PREMIUM CARE",
                    priceText: product.price,
                    ctaText: "EXPLORE RITUAL"
                },
                {
                    style: "social_proof_tweet",
                    headline: "Honestly the best purchase I made this year for my gym bag.",
                    subheadline: "@athletic_sa • Verified Customer",
                    badgeText: "VIRAL ON TIKTOK",
                    ctaText: "GET THE DUO"
                }
            ],
            socialCopy: [
                {
                    platform: "facebook",
                    headline: "Tired of stubborn gym sweat odor and skin irritation?",
                    body: "Ordinary body washes clean the surface, but leave bacteria behind. Meet the Higienlabs dual-action defense duo. Next-day delivery on Takealot!",
                    callToAction: "Shop Now"
                },
                {
                    platform: "tiktok",
                    headline: "The #1 Gym Bag Essential for 2026",
                    body: "Two steps to stop sweat irritation before it starts. Link in bio to order on Takealot!",
                    callToAction: "Get Yours"
                }
            ]
        };
    }
}
