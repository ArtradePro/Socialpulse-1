import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface UsageItem {
    used:  number;
    limit: number | 'unlimited';
}

export interface UsageSummary {
    posts:          UsageItem;
    aiCredits:      UsageItem;
    socialAccounts: UsageItem;
    storage: {
        usedBytes: number;
        limitMB:   number | 'unlimited';
    };
}

export interface PlanInfo {
    id:           string;
    name:         string;
    monthlyPrice: number;
    limits:       Record<string, any>;
    badge?:       string;
    color?:       string;
}

interface UsePlanReturn {
    plan:    PlanInfo | null;
    usage:   UsageSummary | null;
    loading: boolean;
    refetch: () => void;
    isAtLimit: (key: keyof UsageSummary) => boolean;
    usedPercent: (key: 'posts' | 'aiCredits' | 'socialAccounts') => number;
}

export const usePlan = (): UsePlanReturn => {
    const [plan,    setPlan]    = useState<PlanInfo | null>(null);
    const [usage,   setUsage]   = useState<UsageSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick,    setTick]    = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        api.get('/billing/usage').then(({ data }) => {
            if (!cancelled) {
                setPlan(data.plan);
                setUsage(data.usage);
                setLoading(false);
            }
        }).catch(() => {
            if (!cancelled) setLoading(false);
        });

        return () => { cancelled = true; };
    }, [tick]);

    const isAtLimit = (key: keyof UsageSummary): boolean => {
        if (!usage) return false;
        const item = usage[key] as UsageItem;
        if (!item || item.limit === 'unlimited') return false;
        return item.used >= (item.limit as number);
    };

    const usedPercent = (key: 'posts' | 'aiCredits' | 'socialAccounts'): number => {
        if (!usage) return 0;
        const item = usage[key];
        if (item.limit === 'unlimited') return 0;
        return Math.min((item.used / (item.limit as number)) * 100, 100);
    };

    return { plan, usage, loading, refetch, isAtLimit, usedPercent };
};
