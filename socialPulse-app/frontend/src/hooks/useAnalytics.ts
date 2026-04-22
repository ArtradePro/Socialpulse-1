// client/src/hooks/useAnalytics.ts
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRange = '7d' | '14d' | '30d' | '90d';
export type Platform  = 'all' | 'twitter' | 'instagram' | 'linkedin' | 'facebook';

export interface OverviewMetrics {
    totalImpressions:   number;
    totalReach:         number;
    totalEngagements:   number;
    totalClicks:        number;
    avgEngagementRate:  number;
    totalFollowers:     number;
    followerGrowth:     number;     // absolute
    followerGrowthPct:  number;     // percentage
    postsPublished:     number;
    // period-over-period deltas (%)
    impressionsDelta:   number;
    reachDelta:         number;
    engagementsDelta:   number;
    clicksDelta:        number;
}

export interface DailyEngagement {
    date:        string;            // "2024-06-01"
    likes:       number;
    comments:    number;
    shares:      number;
    impressions: number;
    reach:       number;
    clicks:      number;
}

export interface PlatformBreakdown {
    platform:       Platform;
    followers:      number;
    followerDelta:  number;
    likes:          number;
    comments:       number;
    shares:         number;
    impressions:    number;
    engagementRate: number;
    postsCount:     number;
}

export interface PostPerformance {
    id:             string;
    content:        string;
    platforms:      string[];
    publishedAt:    string;
    likes:          number;
    comments:       number;
    shares:         number;
    impressions:    number;
    reach:          number;
    engagementRate: number;
    clicks:         number;
    mediaUrl?:      string;
}

export interface AudienceGrowth {
    date:      string;
    twitter:   number;
    instagram: number;
    linkedin:  number;
    facebook:  number;
    total:     number;
}

export interface HeatmapCell {
    day:   number;     // 0 = Sun … 6 = Sat
    hour:  number;     // 0-23
    value: number;     // avg engagement
}

export interface AnalyticsData {
    overview:        OverviewMetrics;
    dailyEngagement: DailyEngagement[];
    platformBreakdown: PlatformBreakdown[];
    topPosts:        PostPerformance[];
    allPosts:        PostPerformance[];
    audienceGrowth:  AudienceGrowth[];
    heatmap:         HeatmapCell[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseAnalyticsReturn {
    data:       AnalyticsData | null;
    loading:    boolean;
    error:      string | null;
    dateRange:  DateRange;
    platform:   Platform;
    setDateRange: (r: DateRange) => void;
    setPlatform:  (p: Platform) => void;
    refetch:    () => void;
}

export const useAnalytics = (): UseAnalyticsReturn => {
    const [data,      setData]      = useState<AnalyticsData | null>(null);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>('30d');
    const [platform,  setPlatform]  = useState<Platform>('all');
    const [tick,      setTick]      = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        const fetch = async () => {
            try {
                const { data: res } = await api.get('/analytics/dashboard', {
                    params: { range: dateRange, platform },
                });
                if (!cancelled) setData(res);
            } catch (err: any) {
                if (!cancelled)
                    setError(err.response?.data?.message ?? 'Failed to load analytics');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetch();
        return () => { cancelled = true; };
    }, [dateRange, platform, tick]);

    return {
        data,
        loading,
        error,
        dateRange,
        platform,
        setDateRange,
        setPlatform,
        refetch,
    };
};
