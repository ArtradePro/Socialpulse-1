// client/src/components/analytics/PlatformStats.tsx
import React from 'react';
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
    ResponsiveContainer, Tooltip,
} from 'recharts';
import { PlatformBreakdown } from '../../hooks/useAnalytics';

interface Props {
    data:    PlatformBreakdown[];
    loading: boolean;
}

const PLATFORM_META: Record<string, { color: string; bg: string; emoji: string }> = {
    twitter:   { color: '#1DA1F2', bg: 'bg-sky-50',    emoji: '🐦' },
    instagram: { color: '#E1306C', bg: 'bg-pink-50',   emoji: '📸' },
    linkedin:  { color: '#0077B5', bg: 'bg-blue-50',   emoji: '💼' },
    facebook:  { color: '#1877F2', bg: 'bg-indigo-50', emoji: '👤' },
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
);

const PlatformCard: React.FC<{ item: PlatformBreakdown }> = ({ item }) => {
    const meta = PLATFORM_META[item.platform] ?? { color: '#6B7280', bg: 'bg-gray-50', emoji: '🌐' };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                        hover:shadow-md transition-shadow">
            {/* Platform header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center
                                      justify-center text-lg`}>
                        {meta.emoji}
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-gray-900 capitalize">
                            {item.platform}
                        </p>
                        <p className="text-xs text-gray-400">
                            {item.postsCount} posts
                        </p>
                    </div>
                </div>

                {/* Follower delta */}
                <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                        {item.followers.toLocaleString()}
                    </p>
                    <p className={`text-xs font-medium ${
                        item.followerDelta >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                        {item.followerDelta >= 0 ? '+' : ''}{item.followerDelta.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Engagement rate bar */}
            <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Engagement Rate</span>
                    <span className="font-semibold text-gray-800">
                        {item.engagementRate.toFixed(2)}%
                    </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                            width: `${Math.min(item.engagementRate * 10, 100)}%`,
                            backgroundColor: meta.color,
                        }}
                    />
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 pt-3 border-t border-gray-50">
                <Stat label="Likes"    value={item.likes}    />
                <Stat label="Comments" value={item.comments} />
                <Stat label="Shares"   value={item.shares}   />
            </div>
        </div>
    );
};

const PlatformStats: React.FC<Props> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 bg-gray-200 rounded-xl" />
                            <div className="space-y-1">
                                <div className="w-20 h-4 bg-gray-200 rounded" />
                                <div className="w-14 h-3 bg-gray-100 rounded" />
                            </div>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full mb-4" />
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="space-y-1">
                                    <div className="w-10 h-4 bg-gray-200 rounded mx-auto" />
                                    <div className="w-8  h-3 bg-gray-100 rounded mx-auto" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Radar chart data
    const radarData = [
        { metric: 'Reach',       ...Object.fromEntries(data.map(d => [d.platform, d.impressions])) },
        { metric: 'Likes',       ...Object.fromEntries(data.map(d => [d.platform, d.likes])) },
        { metric: 'Comments',    ...Object.fromEntries(data.map(d => [d.platform, d.comments])) },
        { metric: 'Shares',      ...Object.fromEntries(data.map(d => [d.platform, d.shares])) },
        { metric: 'Engagement',  ...Object.fromEntries(data.map(d => [d.platform, d.engagementRate * 100])) },
    ];

    return (
        <div className="space-y-6">
            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {data.map(item => <PlatformCard key={item.platform} item={item} />)}
            </div>

            {/* Radar comparison */}
            {data.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">
                        Platform Comparison
                    </h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="#f0f0f0" />
                            <PolarAngleAxis
                                dataKey="metric"
                                tick={{ fontSize: 11, fill: '#6B7280' }}
                            />
                            <Tooltip />
                            {data.map(d => (
                                <Radar
                                    key={d.platform}
                                    name={d.platform}
                                    dataKey={d.platform}
                                    stroke={PLATFORM_META[d.platform]?.color ?? '#6B7280'}
                                    fill={PLATFORM_META[d.platform]?.color ?? '#6B7280'}
                                    fillOpacity={0.12}
                                    strokeWidth={2}
                                />
                            ))}
                        </RadarChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                        {data.map(d => (
                            <div key={d.platform} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span className="w-3 h-3 rounded-full"
                                      style={{ background: PLATFORM_META[d.platform]?.color }} />
                                <span className="capitalize">{d.platform}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformStats;
