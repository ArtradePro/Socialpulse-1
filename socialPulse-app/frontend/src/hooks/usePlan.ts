import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// --- Types ---
export interface UsageItem {
    used: number;
    limit: number | 'unlimited';
}

export interface UsageSummary {
    posts: UsageItem;
    aiCredits: UsageItem;
    socialAccounts: UsageItem;
    storage: {
        usedBytes: number;
        limitMB: number | 'unlimited';
    };
}

export interface PlanInfo {
    id: string;
    name: string;
    monthlyPrice: number;
    badge?: string;
    color?: string;
    price?: string | number;
    limits: Record<string, any>;
}

// Added BillingPlan for the "All Plans" list
export interface BillingPlan extends PlanInfo {
    features: string[];
}

interface UsePlanReturn {
    plan: PlanInfo | null;
    usage: UsageSummary | null;
    allPlans: BillingPlan[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
    isAtLimit: (key: keyof Omit<UsageSummary, 'storage'>) => boolean;
    usedPercent: (key: 'posts' | 'aiCredits' | 'socialAccounts') => number;
}

// --- Hook ---
export const usePlan = (): UsePlanReturn => {
    const [plan, setPlan] = useState<PlanInfo | null>(null);
    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const [allPlans, setAllPlans] = useState<BillingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        // Fetching from /billing to get both usage AND all available plans
        api.get('/billing').then(({ data }) => {
            if (!cancelled) {
                setPlan(data.plan);
                setUsage(data.usage);
                setAllPlans(data.allPlans || []);
                setLoading(false);
            }
        }).catch((err) => {
            if (!cancelled) {
                setError(err.response?.data?.message || 'Failed to load plan info');
                setLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [tick]);

    const isAtLimit = (key: keyof Omit<UsageSummary, 'storage'>): boolean => {
        if (!usage) return false;
        const item = usage[key];
        if (!item || item.limit === 'unlimited') return false;
        return item.used >= (item.limit as number);
    };

    const usedPercent = (key: 'posts' | 'aiCredits' | 'socialAccounts'): number => {
        if (!usage) return 0;
        const item = usage[key];
        if (item.limit === 'unlimited') return 0;
        return Math.min((item.used / (item.limit as number)) * 100, 100);
    };

    return { 
        plan, 
        usage, 
        allPlans, 
        loading, 
        error, 
        refetch, 
        isAtLimit, 
        usedPercent 
    };
};
