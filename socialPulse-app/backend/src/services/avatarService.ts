import { db } from '../config/database';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';

let _ai: any = null;
const getAI = () => {
    if (!_ai) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("⚠️ GEMINI_API_KEY is not set. Avatar AI actions will use mock text.");
            return null;
        }
        _ai = new GoogleGenAI({ apiKey });
    }
    return _ai;
};

export interface IndustryTemplate {
    name: string;
    industry: string;
    role: string;
    painPoints: string[];
    goals: string[];
    objections: string[];
    copyPrompt: string;
}

// 1-click templates definition
export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
    "roofing_contractors": {
        name: "Roofing Contractor Owner",
        industry: "Construction",
        role: "Business Owner / General Manager",
        painPoints: [
            "High cost of paid lead generation",
            "Severe weather dependencies making cashflow irregular",
            "Negotiating insurance claims and storm damage approvals"
        ],
        goals: [
            "Scale the sales rep team with consistent local inbound leads",
            "Increase average ticket size per project (residential & commercial)",
            "Automate local social proof and review collection"
        ],
        objections: [
            "Scraper leads are low intent",
            "Marketing agencies don't understand local construction business",
            "We get all our work from existing referral networks"
        ],
        copyPrompt: "Focus heavily on storm-damage season preparation, high average ticket size, and the pain of paying lead generation companies monthly margins instead of building an in-house database."
    },
    "epoxy_flooring": {
        name: "Epoxy Coating Specialist",
        industry: "Home Services / Commercial Coatings",
        role: "Owner Operator",
        painPoints: [
            "Obtaining larger commercial contracts (warehouses, garages, hangars)",
            "Competing against low-quality DIY concrete coating kits",
            "Fluctuating material and resin cost margins"
        ],
        goals: [
            "Position the business as the premium local provider",
            "Automate outbound commercial developer queries",
            "Collect video testimonials from residential garage upgrades"
        ],
        objections: [
            "People think epoxy is too expensive compared to plain concrete",
            "We have plenty of work in spring but struggle in winter"
        ],
        copyPrompt: "Emphasize durability, visual appeal, commercial floor ROI, and safety compliance. Address the objection of epoxy floor lifetime value vs temporary concrete paint."
    },
    "local_gyms": {
        name: "Boutique Gym Owner",
        industry: "Fitness & Wellness",
        role: "Gym Owner / Head Coach",
        painPoints: [
            "High member churn rate after winter/summer peaks",
            "Under-filled group training and specialty classes",
            "Intense price competition from corporate budget franchises"
        ],
        goals: [
            "Increase predictable monthly recurring membership revenue",
            "Boost personal training package upsells",
            "Create a community brand that retains members longer"
        ],
        objections: [
            "I can exercise at home with free videos",
            "Membership is too expensive compared to 24-hour chain gyms"
        ],
        copyPrompt: "Focus on community, professional coaching, personalized results, accountability, and member success stories to combat cheap chain competition."
    },
    "saas_founders": {
        name: "SaaS Founder",
        industry: "Technology / software",
        role: "CEO / Head of Growth",
        painPoints: [
            "High Customer Acquisition Cost (CAC) vs Lifetime Value (LTV)",
            "High churn of self-serve users within the first 30 days",
            "Limited funding runway requiring fast product-led growth"
        ],
        goals: [
            "Shorten the B2B sales cycle for enterprise prospects",
            "Achieve reliable organic product referrals",
            "Automate customer success touchpoints to lower churn"
        ],
        objections: [
            "We don't have time to evaluate and onboard another tool",
            "We can build a basic version in-house instead of buying"
        ],
        copyPrompt: "Emphasize immediate developer time saved, direct revenue growth, integrations ease, and lowering CAC through automated operations."
    }
};

/**
 * Get all predefined industry templates
 */
export function getTemplates(): Record<string, IndustryTemplate> {
    return INDUSTRY_TEMPLATES;
}

/**
 * Create a buyer persona from a predefined template
 */
export async function createFromTemplate(workspaceId: string, templateKey: string) {
    const template = INDUSTRY_TEMPLATES[templateKey];
    if (!template) {
        throw new Error(`Template "${templateKey}" not found.`);
    }

    const res = await db.query(
        `INSERT INTO buyer_personas (workspace_id, name, industry, role, pain_points, goals, objections, copy_prompt, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
        [
            workspaceId,
            template.name,
            template.industry,
            template.role,
            template.painPoints,
            template.goals,
            template.objections,
            template.copyPrompt
        ]
    );

    // Sync clarity file dynamically
    await syncClarityFile(workspaceId);

    return res.rows[0];
}

/**
 * Generate a custom buyer persona using Gemini AI
 */
export async function generateAvatarProfile(
    workspaceId: string,
    name: string,
    role: string,
    industry: string
) {
    const ai = getAI();
    if (!ai) {
        // Mock fallback profile
        const mockRes = await db.query(
            `INSERT INTO buyer_personas (workspace_id, name, industry, role, pain_points, goals, objections, copy_prompt, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
            [
                workspaceId,
                name,
                industry,
                role,
                ["Mock Pain Point 1", "Mock Pain Point 2"],
                ["Mock Goal 1", "Mock Goal 2"],
                ["Mock Objection 1", "Mock Objection 2"],
                `Focus on B2B target pain points in ${industry} for ${role}`
            ]
        );
        await syncClarityFile(workspaceId);
        return mockRes.rows[0];
    }

    try {
        const prompt = `
            Create a detailed, high-converting customer Avatar profile card for:
            Avatar Name: "${name}"
            Role/Title: "${role}"
            Industry: "${industry}"

            Analyze this audience segment. You must output exactly a JSON structure:
            {
                "pain_points": ["string", "string", "string"],
                "goals": ["string", "string", "string"],
                "objections": ["string", "string", "string"],
                "copy_prompt": "detailed guide on how to pitch to this avatar"
            }
            Do not wrap in anything else except raw JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: 'You are a master digital marketer specializing in buyer persona modeling and strategic marketing.',
                responseMimeType: 'application/json'
            }
        });

        const text = response.text?.trim() || '{}';
        const data = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());

        const res = await db.query(
            `INSERT INTO buyer_personas (workspace_id, name, industry, role, pain_points, goals, objections, copy_prompt, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
            [
                workspaceId,
                name,
                industry,
                role,
                data.pain_points || [],
                data.goals || [],
                data.objections || [],
                data.copy_prompt || `Targeted pitch instructions for ${name}`
            ]
        );

        await syncClarityFile(workspaceId);
        return res.rows[0];
    } catch (error) {
        console.error('Error generating AI avatar profile:', error);
        throw error;
    }
}

/**
 * Generate marketing copy tailored directly to a specific avatar card and brand voice
 */
export async function generateAvatarCopy(
    workspaceId: string,
    avatarId: string,
    topic: string,
    platform: string
): Promise<string> {
    // 1. Fetch Brand Voice
    const voiceRes = await db.query('SELECT * FROM brand_voices WHERE workspace_id = $1', [workspaceId]);
    const voice = voiceRes.rows[0] || {
        tone_of_voice: 'professional, friendly',
        value_proposition: 'All-in-one social growth automation platform.',
        target_keywords: [],
        forbidden_words: []
    };

    // 2. Fetch Avatar Card
    const avatarRes = await db.query('SELECT * FROM buyer_personas WHERE id = $1 AND workspace_id = $2', [avatarId, workspaceId]);
    const avatar = avatarRes.rows[0];
    if (!avatar) {
        throw new Error('Target Buyer Persona not found.');
    }

    const ai = getAI();
    if (!ai) {
        return `[Mock Targeted Outreach for ${avatar.name} regarding "${topic}"]\n` +
               `Value Prop: ${voice.value_proposition}\n` +
               `Tone: ${voice.tone_of_voice}\n` +
               `Addressing Pain Point: "${avatar.pain_points[0] || 'Need efficiency'}"\n` +
               `Objection Handler: "${avatar.objections[0] || 'Pricing is clear'}"`;
    }

    try {
        const prompt = `
            Write high-converting marketing/outreach copy for platform "${platform}" about "${topic}".
            
            Core Target Buyer Profile:
            - Name/Role: ${avatar.name} (${avatar.role} in ${avatar.industry})
            - Primary Pain Points: ${JSON.stringify(avatar.pain_points)}
            - Primary Goals: ${JSON.stringify(avatar.goals)}
            - Objections we must pre-handle: ${JSON.stringify(avatar.objections)}
            - Copy guidance: ${avatar.copy_prompt}

            Brand Guidelines:
            - Tone: ${voice.tone_of_voice}
            - Core Value Proposition: ${voice.value_proposition}
            - Target Keywords: ${JSON.stringify(voice.target_keywords)}
            - Forbidden terms (DO NOT use these): ${JSON.stringify(voice.forbidden_words)}

            Keep it engaging, professional, and optimized for high CTR.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: `You are a master digital strategist. Tone of voice: ${voice.tone_of_voice}.`
            }
        });

        return response.text?.trim() || "Failed to generate AI copy.";
    } catch (error) {
        console.error('Error generating AI targeted copy:', error);
        throw error;
    }
}

/**
 * Dynamically exports workspace clarity parameters to a JSON file in the root
 * this serves as the self-documenting "workspace_clarity.json" for AI agents and human audits.
 */
export async function syncClarityFile(workspaceId: string): Promise<void> {
    try {
        const voiceRes = await db.query('SELECT * FROM brand_voices WHERE workspace_id = $1', [workspaceId]);
        const voice = voiceRes.rows[0];

        const personasRes = await db.query(
            'SELECT name, role, industry, pain_points, goals, objections, copy_prompt FROM buyer_personas WHERE workspace_id = $1 AND is_active = true',
            [workspaceId]
        );

        const workspaceRes = await db.query('SELECT name, brand_name, brand_color FROM workspaces WHERE id = $1', [workspaceId]);
        const workspaceName = workspaceRes.rows[0]?.brand_name || workspaceRes.rows[0]?.name || 'Workspace';

        const clarityObj = {
            workspaceId,
            workspaceName,
            brandVoice: voice ? {
                toneOfVoice: voice.tone_of_voice,
                valueProposition: voice.value_proposition,
                targetKeywords: voice.target_keywords,
                forbiddenWords: voice.forbidden_words
            } : null,
            targetBuyerPersonas: personasRes.rows,
            lastSyncedAt: new Date().toISOString()
        };

        const dir = path.resolve(__dirname, '../../'); // Output at backend root
        const filepath = path.join(dir, `workspace_clarity_${workspaceId}.json`);

        await fs.writeFile(filepath, JSON.stringify(clarityObj, null, 2), 'utf-8');
        console.log(`✅ Clarity Sync: Wrote workspace_clarity_${workspaceId}.json successfully.`);
    } catch (error) {
        console.error('❌ Error syncing clarity file:', error);
    }
}
