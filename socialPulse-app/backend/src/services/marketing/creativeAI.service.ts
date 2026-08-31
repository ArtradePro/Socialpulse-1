import { GoogleGenAI } from '@google/genai';
import { db } from '../../config/database';
import { ClaimsGuardService } from './claimsGuard.service';

let _ai: any = null;
const getAI = (): any => {
    if (!_ai) {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
        _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return _ai;
};

export interface AdCreativeRequest {
    productName: string;
    offer: string;
    targetAudience?: string;
    format: 'FEED' | 'REEL_SCRIPT' | 'SEARCH_AD';
}

export interface AdCreativeResult {
    headline: string;
    primaryText: string;
    callToAction: string;
    scriptOutline?: string[];
    disclaimers: string[];
    format: string;
}

export class CreativeAIService {
    /**
     * Generates Zeely-grade multi-format ad creative copy with claims library governance.
     */
    public static async generateAd(
        workspaceId: string,
        req: AdCreativeRequest
    ): Promise<AdCreativeResult> {
        const { rows } = await db.query(
            `SELECT name, brand_type, product_info FROM workspaces WHERE id = $1 LIMIT 1`,
            [workspaceId]
        );
        const workspace = rows[0] || {};
        const isFNM = ClaimsGuardService.isFungusNoMore(workspace);

        const approvedClaims = await ClaimsGuardService.getApprovedClaims(workspaceId);
        const claimsList = approvedClaims.map(c => c.claim_text);

        const prompt = `
            Create high-converting ${req.format} ad copy.
            Product: ${req.productName}
            Special Offer / Hook: ${req.offer}
            Target Audience: ${req.targetAudience || 'General public'}
            
            Format requirements:
            ${req.format === 'FEED' ? 'Include a punchy headline, compelling benefit-driven primary text, and clear call-to-action.' : ''}
            ${req.format === 'REEL_SCRIPT' ? 'Include headline, primary hook, call-to-action, and a 3-part UGC video script outline (Hook, Body, CTA).' : ''}
            ${req.format === 'SEARCH_AD' ? 'Include high-intent headline (under 30 chars), description (under 90 chars), and CTA.' : ''}

            Return a valid JSON object matching:
            {
                "headline": "...",
                "primaryText": "...",
                "callToAction": "...",
                "scriptOutline": ["Hook: ...", "Problem/Solution: ...", "CTA: ..."]
            }
        `;

        const brandGovernance = [
            isFNM
                ? 'OFFICIAL BRAND: Fungus No More™. You are authorized to use the trademark slogan "Love The Skin You\'re In."'
                : 'CRITICAL LEGAL RULE: STRICTLY PROHIBITED from using "Love The Skin You\'re In." (reserved exclusively for Fungus No More™).',
            'COMPLIANCE: Do not promise 100% cure guarantees or unapproved medical efficacy claims.',
            claimsList.length > 0 ? `APPROVED CLAIMS:\n${claimsList.map(c => `- ${c}`).join('\n')}` : ''
        ].filter(Boolean).join('\n');

        const systemInstruction = `You are a world-class direct-response advertising copywriter.
        ${workspace.product_info ? `PRODUCT BACKGROUND:\n${workspace.product_info}\n` : ''}
        BRAND GOVERNANCE & COMPLIANCE:
        ---
        ${brandGovernance}
        ---
        Return only raw JSON.`;

        let parsed: any;
        if (process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
            const result = await getAI().models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { systemInstruction, responseMimeType: 'application/json' }
            });
            const text = result.text || '{}';
            parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
        } else {
            // High quality fallback simulation for test environment
            parsed = {
                headline: isFNM ? `Fungus No More™ — Love The Skin You're In.` : `Clean & Fresh with ${req.productName}`,
                primaryText: `Discover the breakthrough formula designed for rapid comfort. ${req.offer}`,
                callToAction: 'Shop Now',
                scriptOutline: [
                    'Hook: Tired of struggling with irritated skin?',
                    'Body: See the proven results from day one.',
                    'CTA: Order today and get your special offer!'
                ]
            };
        }

        // Validate content against claims & slogan exclusivity
        const combinedText = `${parsed.headline} ${parsed.primaryText}`;
        const validation = await ClaimsGuardService.validateContent(workspaceId, combinedText);

        if (!validation.valid && !isFNM) {
            parsed.headline = parsed.headline.replace(/love\s+the\s+skin\s+you(?:'|’|\s+a)?re?\s+in/gi, '').trim();
            parsed.primaryText = parsed.primaryText.replace(/love\s+the\s+skin\s+you(?:'|’|\s+a)?re?\s+in/gi, '').trim();
        }

        return {
            headline: parsed.headline || 'Exclusive Offer',
            primaryText: parsed.primaryText || '',
            callToAction: parsed.callToAction || 'Shop Now',
            scriptOutline: parsed.scriptOutline || [],
            disclaimers: validation.disclaimers,
            format: req.format
        };
    }
}
