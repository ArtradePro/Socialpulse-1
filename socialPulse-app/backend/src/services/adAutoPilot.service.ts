import { db } from '../config/database';

export interface AutoPilotConfig {
    enabled: boolean;
    maxTargetCpa: number; // e.g. 85 in ZAR
    minCtrThreshold: number; // e.g. 1.2%
    minImpressionsBeforePause: number;
    autoScaleWinners: boolean;
    scaleBudgetPercent: number;
}

export interface AutoPilotIntervention {
    id: string;
    action: 'PAUSED' | 'SCALED' | 'MAINTAINED';
    campaignId: string;
    campaignName: string;
    reason: string;
    metrics: {
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        ctr: number;
        cpa: number;
    };
    timestamp: string;
}

// Global in-memory configuration & audit trail (persisted per runtime)
let globalConfig: AutoPilotConfig = {
    enabled: true,
    maxTargetCpa: 85, // Default R85 CPA ceiling for Fungus No More & Higiene direct response
    minCtrThreshold: 1.2,
    minImpressionsBeforePause: 150,
    autoScaleWinners: true,
    scaleBudgetPercent: 15
};

const interventionLog: AutoPilotIntervention[] = [
    {
        id: 'init-seed-1',
        action: 'SCALED',
        campaignId: 'seed-camp-1',
        campaignName: 'Fungus No More™ Dual Action — Takealot Review Angle',
        reason: 'Exceptional ROAS & Low CPA (R48.20 vs ceiling R85.00). Scaled daily budget by 15%.',
        metrics: { spend: 289.20, impressions: 4200, clicks: 112, conversions: 6, ctr: 2.67, cpa: 48.20 },
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
    }
];

export const adAutoPilotService = {
    getConfig: (): AutoPilotConfig => {
        return { ...globalConfig };
    },

    updateConfig: (newConfig: Partial<AutoPilotConfig>): AutoPilotConfig => {
        globalConfig = { ...globalConfig, ...newConfig };
        return { ...globalConfig };
    },

    getInterventions: (limit: number = 20): AutoPilotIntervention[] => {
        return interventionLog.slice(0, limit);
    },

    // Evaluate all active campaigns for stop-loss and winner-scaling
    evaluateActiveCampaigns: async (workspaceId?: string) => {
        if (!globalConfig.enabled) {
            return {
                status: 'skipped',
                reason: 'Auto-Pilot is currently disabled in settings',
                actionsCount: 0
            };
        }

        try {
            let query = `SELECT * FROM ad_campaigns WHERE status = 'ACTIVE'`;
            const params: any[] = [];
            if (workspaceId) {
                query += ` AND workspace_id = $1`;
                params.push(workspaceId);
            }

            const { rows: campaigns } = await db.query(query, params);
            let pausedCount = 0;
            let scaledCount = 0;

            for (const camp of campaigns) {
                const spend = parseFloat(camp.spend) || 0;
                const impressions = parseInt(camp.impressions) || 0;
                const clicks = parseInt(camp.clicks) || 0;
                const conversions = parseInt(camp.conversions) || 0;
                const currentBudget = parseFloat(camp.budget_amount) || 0;

                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpa = conversions > 0 ? (spend / conversions) : spend;
                const currSymbol = 'R';

                // Check 1: Stop-Loss Protection (High spend without conversions)
                if (impressions >= globalConfig.minImpressionsBeforePause && conversions === 0 && spend > (globalConfig.maxTargetCpa * 1.25)) {
                    await db.query(`UPDATE ad_campaigns SET status = 'PAUSED', updated_at = NOW() WHERE id = $1`, [camp.id]);
                    pausedCount++;

                    interventionLog.unshift({
                        id: `auto-${Date.now()}-${camp.id.substring(0, 4)}`,
                        action: 'PAUSED',
                        campaignId: camp.id,
                        campaignName: camp.name,
                        reason: `[Stop-Loss Triggered] Zero conversions with ${currSymbol}${spend.toFixed(2)} ad spend exceeding safety threshold. Paused to prevent budget waste.`,
                        metrics: { spend, impressions, clicks, conversions, ctr, cpa },
                        timestamp: new Date().toISOString()
                    });
                    continue;
                }

                // Check 2: Stop-Loss Protection (High CPA exceeding target threshold)
                if (conversions > 0 && cpa > (globalConfig.maxTargetCpa * 1.35) && impressions >= globalConfig.minImpressionsBeforePause) {
                    await db.query(`UPDATE ad_campaigns SET status = 'PAUSED', updated_at = NOW() WHERE id = $1`, [camp.id]);
                    pausedCount++;

                    interventionLog.unshift({
                        id: `auto-${Date.now()}-${camp.id.substring(0, 4)}`,
                        action: 'PAUSED',
                        campaignId: camp.id,
                        campaignName: camp.name,
                        reason: `[Stop-Loss Triggered] Acquisition cost (${currSymbol}${cpa.toFixed(2)}) exceeded maximum allowable ceiling of ${currSymbol}${globalConfig.maxTargetCpa.toFixed(2)}. Paused to preserve ROAS.`,
                        metrics: { spend, impressions, clicks, conversions, ctr, cpa },
                        timestamp: new Date().toISOString()
                    });
                    continue;
                }

                // Check 3: Winner Scaling (High CTR & sub-target CPA)
                if (globalConfig.autoScaleWinners && conversions >= 2 && cpa <= (globalConfig.maxTargetCpa * 0.8) && ctr >= globalConfig.minCtrThreshold) {
                    const newBudget = Math.round(currentBudget * (1 + globalConfig.scaleBudgetPercent / 100));
                    
                    // Only scale if not already scaled recently
                    const recentScale = interventionLog.find(
                        log => log.campaignId === camp.id && 
                        log.action === 'SCALED' && 
                        (Date.now() - new Date(log.timestamp).getTime()) < 3600000 * 12
                    );

                    if (!recentScale && newBudget > currentBudget) {
                        await db.query(
                            `UPDATE ad_campaigns SET budget_amount = $1, updated_at = NOW() WHERE id = $2`, 
                            [newBudget, camp.id]
                        );
                        scaledCount++;

                        interventionLog.unshift({
                            id: `auto-${Date.now()}-${camp.id.substring(0, 4)}`,
                            action: 'SCALED',
                            campaignId: camp.id,
                            campaignName: camp.name,
                            reason: `[Winner Scaler Triggered] High-efficiency performance detected (CPA ${currSymbol}${cpa.toFixed(2)} vs target ${currSymbol}${globalConfig.maxTargetCpa}, CTR ${ctr.toFixed(2)}%). Scaled daily budget from ${currSymbol}${currentBudget} to ${currSymbol}${newBudget}.`,
                            metrics: { spend, impressions, clicks, conversions, ctr, cpa },
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }

            // Keep log size bounded
            if (interventionLog.length > 50) {
                interventionLog.length = 50;
            }

            return {
                status: 'evaluated',
                evaluatedCount: campaigns.length,
                pausedCount,
                scaledCount,
                interventions: interventionLog.slice(0, 10)
            };
        } catch (err) {
            console.error('[AdAutoPilot] evaluation error:', err);
            throw err;
        }
    }
};
