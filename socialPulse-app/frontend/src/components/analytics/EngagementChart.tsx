// client/src/components/analytics/EngagementChart.tsx
import React, { useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, Area,
} from 'recharts';
import { DailyEngagement } from '../../hooks/useAnalytics';

interface Props {
    data:    DailyEngagement[];
    loading: boolean;
}

type Metric = 'likes' | 'comments' | 'shares' | 'impressions' | 'reach' | 'clicks';

const METRICS: { key: Metric; label: string; color: string }[] = [
    { key: 'likes',       label: 'Likes',       color: '#7C3AED' },
    { key: 'comments',    label: 'Comments',    color: '#2563EB' },
    { key: 'shares',      label: 'Shares',      color: '#EC4899' },
    { key: 'impressions', label: 'Impressions', color: '#F59E0B' },
    { key: 'reach',       label: 'Reach',       color: '#10B981' },
    { key: 'clicks',      label: 'Clicks',      color: '#EF4444' },
];

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm">
            <p className="font-semibold text-gray-800 mb-2">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.name} className="flex items-center justify-between gap-6">
                    <span className="flex items-center gap-1.5 text-gray-600">
                        <span className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ background: entry.color }} />
                        {entry.name}
                    </span>
                    <span className="font-medium text-gray-900">
                        {entry.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
};

const EngagementChart: React.FC<Props> = ({ data, loading }) => {
    const [activeMetrics, setActiveMetrics] = useState<Metric[]>([
        'likes', 'comments', 'shares',
    ]);
    const [chartType, setChartType] = useState<'line' | 'bar'>('line');

    const toggleMetric = (key: Metric) => {
        setActiveMetrics(prev =>
            prev.includes(key)
                ? prev.length > 1 ? prev.filter(m => m !== key) : prev
                : [...prev, key]
        );
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse">
                <div className="flex justify-between items-center mb-6">
                    <div className="w-40 h-5 bg-gray-200 rounded" />
                    <div className="w-24 h-8 bg-gray-200 rounded-lg" />
                </div>
                <div className="h-56 bg-gray-100 rounded-xl" />
            </div>
        );
    }

    // Format dates for display
    const formatted = data.map(d => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

    return (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h3 className="text-base font-semibold text-gray-900">
                    Engagement Over Time
                </h3>

                {/* Chart type toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    {(['line', 'bar'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setChartType(type)}
                            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                                chartType === type
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metric toggles */}
            <div className="flex flex-wrap gap-2 mb-5">
                {METRICS.map(({ key, label, color }) => (
                    <button
                        key={key}
                        onClick={() => toggleMetric(key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                                    font-medium border transition-all ${
                            activeMetrics.includes(key)
                                ? 'border-transparent text-white'
                                : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                        }`}
                        style={activeMetrics.includes(key)
                            ? { backgroundColor: color, borderColor: color }
                            : {}}
                    >
                        <span className="w-2 h-2 rounded-full"
                              style={{ background: activeMetrics.includes(key) ? '#fff' : color }} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {METRICS.filter(m => activeMetrics.includes(m.key)).map(({ key, color }) =>
                        chartType === 'line' ? (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={color}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />
                        ) : (
                            <Bar
                                key={key}
                                dataKey={key}
                                fill={color}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                                fillOpacity={0.85}
                            />
                        )
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default EngagementChart;
