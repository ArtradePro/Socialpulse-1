import api from './api';

export interface AdCampaign {
    id: string;
    workspace_id: string;
    name: string;
    objective: 'TRAFFIC' | 'LEADS' | 'SALES';
    budget_type: 'DAILY' | 'LIFETIME';
    budget_amount: number;
    platforms: string[];
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    target_url: string;
    ad_copy: string | null;
    media_url: string | null;
    product_id: string | null;
    product_title?: string;
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface GeneratedVideo {
    id: string;
    workspace_id: string;
    title: string;
    script: string;
    avatar_style: string;
    voice_style: string;
    video_url: string;
    created_at: string;
}

export const adService = {
    getCampaigns: async () => {
        const { data } = await api.get<AdCampaign[]>('/ads');
        return data;
    },
    
    getCampaign: async (id: string) => {
        const { data } = await api.get<AdCampaign>(`/ads/${id}`);
        return data;
    },
    
    createCampaign: async (campaignData: Partial<AdCampaign>) => {
        const { data } = await api.post<AdCampaign>('/ads', campaignData);
        return data;
    },
    
    updateCampaign: async (id: string, campaignData: Partial<AdCampaign>) => {
        const { data } = await api.patch<AdCampaign>(`/ads/${id}`, campaignData);
        return data;
    },
    
    deleteCampaign: async (id: string) => {
        await api.delete(`/ads/${id}`);
    },
    
    generateVideo: async (videoData: {
        title: string;
        script: string;
        avatar_style: string;
        voice_style: string;
    }) => {
        const { data } = await api.post<GeneratedVideo>('/ads/video', videoData);
        return data;
    },
    
    getVideos: async () => {
        const { data } = await api.get<GeneratedVideo[]>('/ads/video');
        return data;
    },
    
    generateAdCreative: async (creativeParams: {
        productName: string;
        productDesc: string;
        objective: string;
        tone?: string;
    }) => {
        const { data } = await api.post<{ adCopy: string; headline: string }>('/ai/generate-ad-creative', creativeParams);
        return data;
    },

    urlToCampaign: async (url: string) => {
        const { data } = await api.post<GeneratedCampaignResult>('/ads/url-to-campaign', { url });
        return data;
    },

    generateBannerBatch: async (batchData: {
        imageUrl?: string;
        productTitle: string;
        headline: string;
        subheadline?: string;
        priceText?: string;
        isFNM?: boolean;
    }) => {
        const { data } = await api.post<BatchBannerResponse>('/ads/banner-batch', batchData);
        return data;
    },

    getAutoPilotStatus: async () => {
        const { data } = await api.get<AutoPilotStatusResponse>('/ads/autopilot/status');
        return data;
    },

    updateAutoPilotConfig: async (config: Partial<AutoPilotConfigData>) => {
        const { data } = await api.post<{ message: string; config: AutoPilotConfigData }>('/ads/autopilot/config', config);
        return data;
    },

    runAutoPilotNow: async () => {
        const { data } = await api.post<{
            status: string;
            evaluatedCount: number;
            pausedCount: number;
            scaledCount: number;
            interventions: any[];
        }>('/ads/autopilot/run');
        return data;
    }
};

export interface AutoPilotConfigData {
    enabled: boolean;
    maxTargetCpa: number;
    minCtrThreshold: number;
    minImpressionsBeforePause: number;
    autoScaleWinners: boolean;
    scaleBudgetPercent: number;
}

export interface AutoPilotInterventionItem {
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

export interface AutoPilotStatusResponse {
    config: AutoPilotConfigData;
    interventions: AutoPilotInterventionItem[];
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
}

export interface GeneratedCampaignResult {
    product: {
        url: string;
        title: string;
        description: string;
        price?: string;
        currency?: string;
        imageUrl?: string;
        brand?: string;
        isFNM?: boolean;
    };
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

export interface BatchBannerResponse {
    count: number;
    banners: {
        id: string;
        style: string;
        styleTitle: string;
        original_name: string;
        url: string;
        thumbnail_url: string;
        width: number;
        height: number;
    }[];
}

