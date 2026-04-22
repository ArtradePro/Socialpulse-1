// client/src/pages/Analytics.tsx
import React, { useState } from 'react';
import {
    Eye, Users, Heart, MousePointer,
    TrendingUp, RefreshCw, Download, AlertCircle,
} from 'lucide-react';

import { useAnalytics, DateRange, Platform } from '../hooks/useAnalytics';
import MetricCard            from '../components/analytics/MetricCard';
import EngagementChart       from '../components/analytics/EngagementChart';
import PlatformStats         from '../components/analytics/PlatformStats';
import AudienceGrowthChart   from '../components/analytics/AudienceGrowthChart';
import BestTimeHeatmap       from '../components/analytics/BestTimeHeatmap';
import TopPostCard           from '../components/analytics/TopPostCard';
import PostPerformanceTable  from '../components/analytics/PostPerformanceTable';
import AnalyticsSkeleton     from '../components/analytics/AnalyticsSkeleton';

// ─── Filter config ─────────────────────────────────────────────────────────────

const DATE_RANGES: { value: DateRange; label: string }[] = [
    { value: '7d',  label: 'Last 7 days'  },
    { value: '14d', label: 'Last 14 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
];

const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
    { value: 'all',       label: 'All Platforms', emoji: '🌐' },
    { value: 'twitter',   label: 'Twitter',        emoji: '🐦' },
    { value: 'instagram', label: 'Instagram',      emoji: '📸' },
    { value: 'linkedin',  label: 'LinkedIn',       emoji: '💼' },
    { value: 'facebook',  label: 'Facebook',       emoji: '👤' },
];

// ─── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'platforms' | 'posts' | 'audience';

const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview'   },
    { id: 'platforms', label: 'Platforms'  },
    { id: 'posts',     label: 'Posts'      },
    { id: 'audience',  label: 'Audience'   },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
};

// ─── Page ──────────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const {
        data, loading, error,
        dateRange, platform,
        setDateRange, setPlatform,
        refetch,
    } = useAnalytics();

    // ── Export CSV ──────────────────────────────────────────────────────────────
    const handleExport = () => {
        if (!data?.allPosts.length) return;

        const headers = [
            'Content', 'Platforms', 'Published At',
            'Likes', 'Comments', 'Shares', 'Impressions', 'Reach', 'Clicks', 'Engagement Rate %',
        ];

        const rows = data.allPosts.map(p => [
            `"${p.content.replace(/"/g, '""')}"`,
            p.platforms.join('|'),
            p.publishedAt,
            p.likes, p.comments, p.shares,
            p.impressions, p.reach, p.clicks,
            p.engagementRate.toFixed(2),
        ]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `social-pulse-analytics-${dateRange}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Error state ─────────────────────────────────────────────────────────────
    if (error && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-96 gap-4">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-red-500" />
                </div>
                <div className="text-center">
                    <p className="text-base font-semibold text-gray-900">
                        Failed to load analytics
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{error}</p>
                </div>
                <button
                    onClick={refetch}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white
                               rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            </div>
        );
    }

    // ── Overview metric cards ────────────────────────────────────────────────────
    const metricCards = data ? [
        {
            title:       'Total Impressions',
            value:       fmt(data.overview.totalImpressions),
            delta:       data.overview.impressionsDelta,
            icon:        <Eye       className="w-5 h-5" />,
            iconBg:      'bg-purple-50',
            iconColor:   'text-purple-600',
            description: 'Times your content was seen',
        },
        {
            title:       'Total Reach',
            value:       fmt(data.overview.totalReach),
            delta:       data.overview.reachDelta,
            icon:        <Users     className="w-5 h-5" />,
            iconBg:      'bg-blue-50',
            iconColor:   'text-blue-600',
            description: 'Unique accounts reached',
        },
        {
            title:       'Total Engagements',
            value:       fmt(data.overview.totalEngagements),
            delta:       data.overview.engagementsDelta,
            icon:        <Heart     className="w-5 h-5" />,
            iconBg:      'bg-pink-50',
            iconColor:   'text-pink-600',
            description: 'Likes, comments & shares',
        },
        {
            title:       'Link Clicks',
            value:       fmt(data.overview.totalClicks),
            delta:       data.overview.clicksDelta,
            icon:        <MousePointer className="w-5 h-5" />,
            iconBg:      'bg-orange-50',
            iconColor:   'text-orange-600',
            description: 'Clicks on your links',
        },
        {
            title:       'Avg Engagement Rate',
            value:       data.overview.avgEngagementRate.toFixed(2),
            suffix:      '%',
            icon:        <TrendingUp className="w-5 h-5" />,
            iconBg:      'bg-green-50',
            iconColor:   'text-green-600',
            description: 'Industry avg: 1–3%',
        },
        {
            title:       'Follower Growth',
            value:       `+${fmt(data.overview.followerGrowth)}`,
            delta:       data.overview.followerGrowthPct,
            icon:        <Users     className="w-5 h-5" />,
            iconBg:      'bg-indigo-50',
            iconColor:   'text-indigo-600',
            description: `${fmt(data.overview.totalFollowers)} total followers`,
        },
    ] : [];

    return (
        <div className="space-y-6">

            {/* ── Page header ────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Track performance across all your social channels
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Platform filter */}
                    <select
                        value={platform}
                        onChange={e => setPlatform(e.target.value as Platform)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-xl
                                   focus:outline-none focus:ring-2 focus:ring-purple-500
                                   bg-white text-gray-700"
                    >
                        {PLATFORMS.map(p => (
                            <option key={p.value} value={p.value}>
                                {p.emoji} {p.label}
                            </option>
                        ))}
                    </select>

                    {/* Date range */}
                    <div className="flex items-center bg-white border border-gray-200
                                    rounded-xl overflow-hidden">
                        {DATE_RANGES.map(r => (
                            <button
                                key={r.value}
                                onClick={() => setDateRange(r.value)}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${
                                    dateRange === r.value
                                        ? 'bg-purple-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={refetch}
                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50
                                   transition-colors text-gray-600"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Export */}
                    <button
                        onClick={handleExport}
                        disabled={!data}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-200
                                   rounded-xl text-sm text-gray-600 hover:bg-gray-50
                                   transition-colors disabled:opacity-40"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab content ────────────────────────────────────────────────── */}

            {/* OVERVIEW */}
            {activeTab === 'overview' && (
                loading && !data
                    ? <AnalyticsSkeleton />
                    : (
                        <div className="space-y-6">
                            {/* Metric grid — 2 rows × 3 cols on lg */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {metricCards.map(card => (
                                    <MetricCard key={card.title} {...card} loading={loading} />
                                ))}
                            </div>

                            {/* Engagement chart + best time */}
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                <div className="lg:col-span-3">
                                    <EngagementChart
                                        data={data?.dailyEngagement ?? []}
                                        loading={loading}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <AudienceGrowthChart
                                        data={data?.audienceGrowth ?? []}
                                        loading={loading}
                                    />
                                </div>
                            </div>

                            {/* Heatmap */}
                            <BestTimeHeatmap
                                data={data?.heatmap ?? []}
                                loading={loading}
                            />
                        </div>
                    )
            )}

            {/* PLATFORMS */}
            {activeTab === 'platforms' && (
                <PlatformStats
                    data={data?.platformBreakdown ?? []}
                    loading={loading}
                />
            )}

            {/* POSTS */}
            {activeTab === 'posts' && (
                <div className="space-y-6">
                    {/* Top posts */}
                    {(data?.topPosts?.length ?? 0) > 0 && (
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 mb-3">
                                🏆 Top Performing Posts
                            </h3>
                            <div className="space-y-3">
                                {(data?.topPosts ?? []).map((post, i) => (
                                    <TopPostCard key={post.id} post={post} rank={i + 1} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All posts table */}
                    <PostPerformanceTable
                        posts={data?.allPosts ?? []}
                        loading={loading}
                    />
                </div>
            )}

            {/* AUDIENCE */}
            {activeTab === 'audience' && (
                <div className="space-y-6">
                    <AudienceGrowthChart
                        data={data?.audienceGrowth ?? []}
                        loading={loading}
                    />
                    <BestTimeHeatmap
                        data={data?.heatmap ?? []}
                        loading={loading}
                    />
                </div>
            )}
        </div>
    );
};

export default Analytics;
