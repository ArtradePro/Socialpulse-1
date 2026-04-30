import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// --- Interfaces ---

export interface PlanLimits {
    socialAccounts: number | 'unlimited';
    postsPerMonth: number | 'unlimited';
    aiCreditsPerMonth: number | 'unlimited';
    teamMembers: number | 'unlimited';
    scheduledPosts: number | 'unlimited';
    mediaStorageMb: number | 'unlimited';
    mediaFileSizeMb: number | 'unlimited';
    customBranding: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    prioritySupport: boolean;
}

export interface PlanUsage {
    socialAccounts: number;
    postsThisMonth: number;
    mediaBytes: number;
    mediaMb: number;
    aiCredits: number;
}

export interface PlanInfo {
    id: string;
    key: string;
    name: string;
    price: string;
    badge?: string;
    color?: string;
}

export interface BillingPlan {
    key: string;
    name: string;
    price: string;
    color: string;
    badge: string;
    features: string[];
    limits: PlanLimits;
    current: boolean;
}

interface BillingData {
    plan: PlanInfo;
    limits: PlanLimits;
    usage: PlanUsage;
    allPlans: BillingPlan[];
}

interface UsePlanReturn {
    plan: PlanInfo | undefined;
    limits: PlanLimits | undefined;
    usage: PlanUsage | undefined;
    allPlans: BillingPlan[] | undefined;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    usedPercent: (key: keyof PlanUsage) => number;
}

// --- Hook Implementation ---

export const usePlan = (): UsePlanReturn => {
    const [data, setData] = useState<BillingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlanData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // We use the /billing endpoint as seen in your second version
            const res = await api.get<BillingData>('/billing');
            setData(res.data);
        } catch (err) {
            console.error('Failed to load plan info', err);
            setError('Failed to load plan info');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlanData();
    }, [fetchPlanData]);

    /**
     * Calculates percentage used for a given resource.
     * Maps usage keys to their corresponding limit keys.
     */
    const usedPercent = (usageKey: keyof PlanUsage): number => {
        if (!data?.usage || !data?.limits) return 0;

        const usedValue = data.usage[usageKey];
        
        // Map usage keys to limit keys
        let limitValue: number | 'unlimited' = 'unlimited';
        if (usageKey === 'postsThisMonth') limitValue = data.limits.postsPerMonth;
        if (usageKey === 'aiCredits') limitValue = data.limits.aiCreditsPerMonth;
        if (usageKey === 'socialAccounts') limitValue = data.limits.socialAccounts;
        if (usageKey === 'mediaMb') limitValue = data.limits.mediaStorageMb;

        if (limitValue === 'unlimited') return 0;
        return Math.min((usedValue / limitValue) * 100, 100);
    };

    return {
        plan: data?.plan,
        limits: data?.limits,
        usage: data?.usage,
        allPlans: data?.allPlans,
        loading,
        error,
        refetch: fetchPlanData,
        usedPercent
    };
};