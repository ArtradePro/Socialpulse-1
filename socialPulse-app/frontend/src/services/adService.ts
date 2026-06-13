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
    }
};
