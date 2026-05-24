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
import { PlatformIcon } from '../components/common/BrandIcons';

// ─── Filter config ─────────────────────────────────────────────────────────────

const DATE_RANGES: { value: DateRange; label: string }[] = [
    { value: '7d',  label: 'Last 7 days'  },
    { value: '14d', label: 'Last 14 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
];

const PLATFORMS: { value: Platform | 'all'; label: string; icon?: string }[] = [
    { value: 'all',       label: 'All Platforms' },
    { value: 'twitter',   label: 'Twitter/X', icon: 'twitter' },
    { value: 'instagram', label: 'Instagram', icon: 'instagram' },
    { value: 'linkedin',  label: 'LinkedIn',  icon: 'linkedin' },
    { value: 'facebook',  label: 'Facebook',  icon: 'facebook' },
    { value: 'tiktok',    label: 'TikTok',    icon: 'tiktok' },
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

import { AIInsightsCard } from '../components/analytics/AIInsightsCard';

const Analytics: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const {
        data, loading, error,
        dateRange, platform,
        setDateRange, setPlatform,
        refetch,
    } = useAnalytics();

    const [calcClicks, setCalcClicks] = useState(0);
    const [calcConvRate, setCalcConvRate] = useState(2.5);
    const [calcCustValue, setCalcCustValue] = useState(150);

    // Sync clicks when data is loaded
    React.useEffect(() => {
        if (data?.overview?.totalClicks) {
            setCalcClicks(data.overview.totalClicks);
        }
    }, [data]);

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

    const handleExportPDF = () => {
        const token = localStorage.getItem('accessToken');
        const workspaceId = localStorage.getItem('activeWorkspaceId');
        const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
        const resolvedBase = apiBaseUrl.startsWith('http') 
            ? apiBaseUrl 
            : `${window.location.origin}${apiBaseUrl}`;
            
        const url = `${resolvedBase}/analytics/export?token=${token}&workspace_id=${workspaceId}`;
        window.open(url, '_blank');
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

    // ── Metric Cards with Sparklines ─────────────────────────────────────────────
    const metricCards = data ? [
        {
            title:       'Total Impressions',
            value:       fmt(data.overview.totalImpressions),
            delta:       data.overview.impressionsDelta,
            icon:        <Eye       className="w-5 h-5" />,
            iconBg:      'bg-purple-50',
            iconColor:   'text-purple-600',
            description: 'Times your content was seen',
            chartData:   data.dailyEngagement.map(d => ({ value: d.impressions })),
        },
        {
            title:       'Total Reach',
            value:       fmt(data.overview.totalReach),
            delta:       data.overview.reachDelta,
            icon:        <Users     className="w-5 h-5" />,
            iconBg:      'bg-blue-50',
            iconColor:   'text-blue-600',
            description: 'Unique accounts reached',
            chartData:   data.dailyEngagement.map(d => ({ value: d.reach })),
        },
        {
            title:       'Total Engagements',
            value:       fmt(data.overview.totalEngagements),
            delta:       data.overview.engagementsDelta,
            icon:        <Heart     className="w-5 h-5" />,
            iconBg:      'bg-pink-50',
            iconColor:   'text-pink-600',
            description: 'Likes, comments & shares',
            chartData:   data.dailyEngagement.map(d => ({ value: d.likes + d.comments + d.shares })),
        },
        {
            title:       'Link Clicks',
            value:       fmt(data.overview.totalClicks),
            delta:       data.overview.clicksDelta,
            icon:        <MousePointer className="w-5 h-5" />,
            iconBg:      'bg-orange-50',
            iconColor:   'text-orange-600',
            description: 'Clicks on your links',
            chartData:   data.dailyEngagement.map(d => ({ value: d.clicks })),
        },
        {
            title:       'Avg Engagement Rate',
            value:       data.overview.avgEngagementRate.toFixed(2),
            suffix:      '%',
            icon:        <TrendingUp className="w-5 h-5" />,
            iconBg:      'bg-green-50',
            iconColor:   'text-green-600',
            description: 'Industry avg: 1–3%',
            chartData:   data.dailyEngagement.map(d => ({ value: d.impressions > 0 ? ((d.likes + d.comments + d.shares) / d.impressions * 100) : 0 })),
        },
        {
            title:       'Follower Growth',
            value:       `+${fmt(data.overview.followerGrowth)}`,
            delta:       data.overview.followerGrowthPct,
            icon:        <Users     className="w-5 h-5" />,
            iconBg:      'bg-indigo-50',
            iconColor:   'text-indigo-600',
            description: `${fmt(data.overview.totalFollowers)} total followers`,
            chartData:   data.audienceGrowth.map(d => ({ value: d.total })),
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
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2">
                        <span className="text-gray-400">
                            {platform === 'all' ? '🌐' : <PlatformIcon platform={platform} size={16} />}
                        </span>
                        <select
                            value={platform}
                            onChange={e => setPlatform(e.target.value as Platform)}
                            className="pr-2 py-2 text-sm focus:outline-none bg-transparent text-gray-700 font-medium"
                        >
                            {PLATFORMS.map(p => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>

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

                    {/* Export PDF */}
                    <button
                        onClick={handleExportPDF}
                        disabled={!data}
                        className="flex items-center gap-2 px-3 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white
                                   rounded-xl text-sm font-semibold hover:opacity-95
                                   transition-opacity disabled:opacity-40"
                    >
                        <Download className="w-4 h-4" />
                        Export PDF Report
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
                            <AIInsightsCard />
                            
                            {/* Metric grid — 2 rows × 3 cols on lg */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {metricCards.map(card => (
                                    <MetricCard key={card.title} {...card} loading={loading} />
                                ))}
                            </div>

                            {/* ROI & Conversion Rate Calculator */}
                            <div className="bg-linear-to-br from-purple-50/50 via-white to-indigo-50/50 rounded-3xl p-6 border border-purple-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                                        <TrendingUp className="w-5 h-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-950 text-base">Client Social ROI Calculator</h3>
                                        <p className="text-xs text-gray-400">Estimate how much revenue your link clicks generate based on industry average conversions</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                                    {/* Clicks */}
                                    <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Clicks</label>
                                        <input 
                                            type="number"
                                            value={calcClicks}
                                            onChange={(e) => setCalcClicks(parseInt(e.target.value) || 0)}
                                            className="w-full text-xl font-extrabold text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Pulled from analytics clicks</p>
                                    </div>

                                    {/* Conversion Rate */}
                                    <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Conversion Rate (%)</label>
                                        <input 
                                            type="number"
                                            step="0.1"
                                            value={calcConvRate}
                                            onChange={(e) => setCalcConvRate(parseFloat(e.target.value) || 0)}
                                            className="w-full text-xl font-extrabold text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Average e-commerce is 2% - 3%</p>
                                    </div>

                                    {/* Customer Value */}
                                    <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Avg Customer Value ($)</label>
                                        <input 
                                            type="number"
                                            value={calcCustValue}
                                            onChange={(e) => setCalcCustValue(parseInt(e.target.value) || 0)}
                                            className="w-full text-xl font-extrabold text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Average revenue per sale</p>
                                    </div>

                                    {/* Results Card */}
                                    <div className="bg-linear-to-r from-purple-600 to-indigo-600 p-5 rounded-2xl text-white flex flex-col justify-between shadow-lg shadow-purple-100">
                                        <div>
                                            <span className="text-[10px] font-bold tracking-wider uppercase opacity-85">Estimated Value Created</span>
                                            <p className="text-2xl font-black mt-1">
                                                ${( (calcClicks * calcConvRate / 100) * calcCustValue ).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                            </p>
                                        </div>
                                        <div className="text-[10px] opacity-75 mt-2">
                                            Based on {Math.round(calcClicks * calcConvRate / 100)} conversion sales from links
                                        </div>
                                    </div>
                                </div>
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
