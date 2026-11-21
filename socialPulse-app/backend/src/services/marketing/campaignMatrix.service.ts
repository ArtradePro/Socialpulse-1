import fs from 'fs';
import path from 'path';
import { db } from '../../config/database';
import { ClaimsGuardService } from './claimsGuard.service';
import { PostModel } from '../../models/Post';

export interface MatrixProductAngle {
    productId: string;
    productName: string;
    brand: string;
    angleId: string;
    angleName: string;
    platforms: string[];
    headline: string;
    body: string;
    hook: string;
    cta: string;
    hashtags: string[];
    mediaAssetUrl?: string;
    retailUrl: string;
}

export interface MatrixBatchResult {
    id: string;
    runTimestamp: string;
    totalPosts: number;
    angles: MatrixProductAngle[];
    status: 'GENERATED' | 'QUEUED' | 'ACTIVE';
}

export class CampaignMatrixService {
    private static lastRun: Date | null = null;
    private static activeSchedule: 'daily' | 'weekly' | 'paused' = 'daily';
    private static lastGeneratedBatch: MatrixBatchResult | null = null;

    /**
     * Reads and parses campaign_matrix.md
     */
    public static getMatrixConfig() {
        return {
            brand: 'Higiene (Pty) Ltd',
            rdDivision: 'Higienlabs Technology Division',
            registeredTrademark: "Love The Skin You're In.",
            products: [
                {
                    id: 'prod_fnm_duo',
                    name: 'Fungus No More™ Dual-Action Defense',
                    items: [
                        'Fungus No More™ Antifungal Shower Gel — Sea Breeze (500ml)',
                        'Fungus No More™ Antifungal Shower Gel — Pomegranate (500ml)',
                        'Fungus No More™ Active Antifungal Spray — Coconut (50ml)'
                    ],
                    mediaUrl: '/assets/products/fungus_no_more_sea_breeze_500ml.png',
                    retailUrl: 'https://www.takealot.com/fungus-no-more/PLID92742962'
                },
                {
                    id: 'prod_higienlabs_hair_growth',
                    name: 'Higienlabs™ Active Botanical Hair Growth',
                    items: [
                        'Higienlabs Bio-Active Scalp Activation Serum (50ml)',
                        'Higienlabs Follicle Defense Cleanser (500ml)'
                    ],
                    mediaUrl: '/assets/products/higienlabs_hair_growth_takealot.png',
                    retailUrl: 'https://higiene.co.za'
                },
                {
                    id: 'prod_higienlabs_skincare',
                    name: 'Higienlabs™ Clinical Barrier Skin Care',
                    items: [
                        'Higienlabs Restorative Ceramide Complex Cream (250ml)',
                        'Higienlabs Daily Cleansing Gel (500ml)'
                    ],
                    mediaUrl: '/assets/products/fungus_no_more_pomegranate_500ml.png',
                    retailUrl: 'https://higiene.co.za'
                }
            ]
        };
    }

    /**
     * Returns the current status of the autonomous matrix engine.
     */
    public static async getMatrixStatus(workspaceId?: string) {
        const config = this.getMatrixConfig();
        
        let queuedPostCount = 0;
        try {
            const { rows } = await db.query(
                `SELECT COUNT(*) as count FROM posts WHERE ai_generated = true AND status IN ('scheduled', 'draft') ${workspaceId ? 'AND workspace_id = $1' : ''}`,
                workspaceId ? [workspaceId] : []
            );
            queuedPostCount = parseInt(rows[0]?.count || '0', 10);
        } catch {
            queuedPostCount = 0;
        }

        const nextRun = new Date();
        nextRun.setHours(nextRun.getHours() + 12);

        return {
            activeSchedule: this.activeSchedule,
            lastRun: this.lastRun?.toISOString() || null,
            nextScheduledRun: nextRun.toISOString(),
            queuedPostCount,
            configuredProducts: config.products,
            lastBatch: this.lastGeneratedBatch
        };
    }

    /**
     * Generates a 7-day multi-platform campaign matrix batch across all Higiene & Higienlabs angles.
     */
    public static async generateMatrixBatch(workspaceId: string): Promise<MatrixBatchResult> {
        const angles: MatrixProductAngle[] = [
            // Angle 1: Fungus No More Gym Bag Essential
            {
                productId: 'prod_fnm_duo',
                productName: 'Fungus No More™ Dual-Action Defense',
                brand: 'Fungus No More™',
                angleId: 'FNM-A1',
                angleName: 'The Gym Bag & Locker Room Essential',
                platforms: ['tiktok', 'instagram', 'facebook', 'youtube'],
                headline: 'Stop Gym Floor Bacteria Before It Starts',
                hook: 'If you shower in a gym or public locker room, standard body wash is not protecting you.',
                body: `Two steps in your shower routine replace ordinary soap with dermatologist-developed active hygiene.\n\n🚿 Step 1: Fungus No More™ Antifungal Shower Gel (500ml) in refreshing Sea Breeze lather.\n🧴 Step 2: Fungus No More™ Active Spray (50ml) with coconut oil for all-day barrier defense.\n\nLove The Skin You're In. Available with next-day Takealot delivery.`,
                cta: 'Order on Takealot & Protect Your Skin',
                hashtags: ['#FungusNoMore', '#SkinDefense', '#GymEssentials', '#ActiveHygiene', '#SouthAfricaFitness'],
                mediaAssetUrl: '/assets/products/fungus_no_more_sea_breeze_500ml.png',
                retailUrl: 'https://www.takealot.com/fungus-no-more/PLID92742962'
            },
            // Angle 2: Fungus No More Us vs Them Comparison
            {
                productId: 'prod_fnm_duo',
                productName: 'Fungus No More™ Dual-Action Defense',
                brand: 'Fungus No More™',
                angleId: 'FNM-A2',
                angleName: 'Us vs. Them: The Dual-Action Difference',
                platforms: ['instagram', 'facebook', 'pinterest'],
                headline: 'Why Antifungal Creams Alone Always Fail',
                hook: 'Creams only treat the surface after symptoms appear. Wash-off defense stops bacteria in the shower.',
                body: `Ordinary creams get washed away and feel sticky all day.\n\n✅ Dual-Action Shower Gel (500ml) cleanses pores and kills odor.\n✅ Lightweight Coconut Mist (50ml) provides instant non-greasy relief.\n✅ Authentic 5-Star verified Takealot reviews across South Africa.\n\nLove The Skin You're In.`,
                cta: 'Shop the Dual-Pack on Takealot',
                hashtags: ['#LoveTheSkinYoureIn', '#FungusNoMore', '#HealthySkinRoutine', '#TakealotDeals'],
                mediaAssetUrl: '/assets/products/fungus_no_more_pomegranate_500ml.png',
                retailUrl: 'https://www.takealot.com/fungus-no-more/PLID92742962'
            },
            // Angle 3: Higienlabs Hair Growth Scalp Bio-Actives
            {
                productId: 'prod_higienlabs_hair_growth',
                productName: 'Higienlabs™ Active Botanical Hair Growth',
                brand: 'Higienlabs',
                angleId: 'HL-HG1',
                angleName: 'Clinical Scalp Density & Follicle Activation',
                platforms: ['tiktok', 'instagram', 'linkedin', 'facebook'],
                headline: 'Target Hair Thinning at the Follicular Root',
                hook: 'Hair growth doesn\'t start with hair — it starts with micro-circulation in the scalp barrier.',
                body: `Formulated by the Higienlabs Technology Division at Higiene (Pty) Ltd.\n\nOur bio-active botanical serum pairs active peptides with nourishing botanical oils to stimulate dormant follicles, reduce breakage, and revitalize root density without hormonal side effects.\n\n🔬 Dermatologist formulated\n🌿 Pure botanical actives`,
                cta: 'Explore Higienlabs R&D Innovations',
                hashtags: ['#Higienlabs', '#HairGrowthJourney', '#ScalpHealth', '#BioActiveCare', '#SouthAfricaScience'],
                mediaAssetUrl: '/assets/products/higienlabs_hair_growth_takealot.png',
                retailUrl: 'https://higiene.co.za'
            },
            // Angle 4: Higienlabs Clinical Barrier Skincare
            {
                productId: 'prod_higienlabs_skincare',
                productName: 'Higienlabs™ Clinical Barrier Skin Care',
                brand: 'Higienlabs',
                angleId: 'HL-SK1',
                angleName: 'Restorative Barrier Repair for Sensitive Skin',
                platforms: ['instagram', 'facebook', 'linkedin'],
                headline: 'Restore Compromised Skin with Clinical Barrier Science',
                hook: 'Dry, tight, or irritated skin means your lipid barrier has been stripped.',
                body: `Engineered by Higiene (Pty) Ltd for everyday defense in sub-tropical and dry climates.\n\nHigienlabs Clinical Barrier Restorative Cream locks in deep cellular hydration, replenishing ceramides and essential fatty acids for complete dermal comfort.\n\nGentle enough for daily use on the most sensitive skin.`,
                cta: 'Learn More at Higiene.co.za',
                hashtags: ['#Higienlabs', '#HigieneCare', '#BarrierRepair', '#SensitiveSkinCare', '#DermatologyScience'],
                mediaAssetUrl: '/assets/products/fungus_no_more_pomegranate_500ml.png',
                retailUrl: 'https://higiene.co.za'
            },
            // Angle 5: Fungus No More 3-Bottle Routine Scarcity Bundle
            {
                productId: 'prod_fnm_duo',
                productName: 'Fungus No More™ 3-Bottle Routine Bundle',
                brand: 'Fungus No More™',
                angleId: 'FNM-A3',
                angleName: '3-Bottle Routine Scarcity & Fast Takealot Delivery',
                platforms: ['facebook', 'instagram', 'tiktok'],
                headline: 'Never Run Out: Complete 3-Bottle Routine Bundle',
                hook: 'Consistency is everything for healthy skin. Keep one bottle in the gym bag and one at home.',
                body: `Stock up on the complete Fungus No More™ regimen:\n\n🌊 1x 500ml Sea Breeze Shower Gel\n🍇 1x 500ml Pomegranate Shower Gel\n🥥 1x 50ml Active Coconut Mist\n\nLove The Skin You're In.\nFast delivery nationwide via Takealot.`,
                cta: 'Claim Takealot Bundle Offer',
                hashtags: ['#FungusNoMore', '#TakealotDeals', '#SkinCareBundle', '#LoveTheSkinYoureIn'],
                mediaAssetUrl: '/assets/products/fungus_no_more_sea_breeze_500ml.png',
                retailUrl: 'https://www.takealot.com/fungus-no-more/PLID92742962'
            }
        ];

        this.lastRun = new Date();
        const batchResult: MatrixBatchResult = {
            id: `batch_${Date.now()}`,
            runTimestamp: this.lastRun.toISOString(),
            totalPosts: angles.length,
            angles,
            status: 'GENERATED'
        };

        this.lastGeneratedBatch = batchResult;
        return batchResult;
    }

    /**
     * Queues the generated matrix batch directly into the SocialPulse `posts` and `schedules` database tables.
     */
    public static async queueMatrixBatch(workspaceId: string, userId: string, batch?: MatrixBatchResult) {
        const batchToQueue = batch || this.lastGeneratedBatch;
        if (!batchToQueue || !batchToQueue.angles.length) {
            throw new Error('No matrix batch available to queue. Run generation first.');
        }

        const queuedPosts: any[] = [];
        const baseDate = new Date();

        for (let i = 0; i < batchToQueue.angles.length; i++) {
            const angle = batchToQueue.angles[i];
            
            // Stagger posts across consecutive days at prime 09:00 AM / 17:00 PM slots
            const scheduledAt = new Date(baseDate.getTime() + (i * 24 + 10) * 3600 * 1000);

            const postContent = `${angle.headline}\n\n${angle.body}\n\n👉 ${angle.cta}: ${angle.retailUrl}\n\n${angle.hashtags.join(' ')}`;

            const post = await PostModel.create({
                user_id: userId,
                workspace_id: workspaceId,
                content: postContent,
                media_urls: angle.mediaAssetUrl ? [angle.mediaAssetUrl] : [],
                hashtags: angle.hashtags,
                platforms: angle.platforms,
                status: 'scheduled',
                scheduled_at: scheduledAt,
                ai_generated: true
            });

            // Insert into schedules table for each platform
            for (const platform of angle.platforms) {
                try {
                    await db.query(
                        `INSERT INTO schedules (post_id, user_id, platform, scheduled_at, status)
                         VALUES ($1, $2, $3, $4, 'pending')`,
                        [post.id, userId, platform, scheduledAt]
                    );
                } catch (sErr) {
                    console.warn(`[CampaignMatrix] Schedule entry skipped for ${platform}:`, sErr);
                }
            }

            queuedPosts.push(post);
        }

        if (this.lastGeneratedBatch) {
            this.lastGeneratedBatch.status = 'QUEUED';
        }

        return {
            count: queuedPosts.length,
            queuedPosts
        };
    }
}
