// client/src/components/analytics/AudienceGrowthChart.tsx
import React, { useState } from 'react';
import {
    ResponsiveContainer, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { AudienceGrowth } from '../../hooks/useAnalytics';

interface Props {
    data:    AudienceGrowth[];
    loading: boolean;
}

const PLATFORMS = [
    { key: 'total',     label: 'Total',     color: '#7C3AED' },
    { key: 'instagram', label: 'Instagram', color: '#E1306C' },
    { key: 'twitter',   label: 'Twitter',   color: '#1DA1F2' },
    { key: 'linkedin',  label: 'LinkedIn',  color: '#0077B5' },
    { key: 'facebook',  label: 'Facebook',  color: '#1877F2' },
];

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm min-w-32">
            <p className="font-semibold text-gray-800 mb-2">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.name}
                     className="flex items-center justify-between gap-4 py-0.5">
                    <span className="flex items-center gap-1.5 text-gray-500 capitalize text-xs">
                        <span className="w-2 h-2 rounded-full"
                              style={{ background: entry.stroke }} />
                        {entry.name}
                    </span>
                    <span className="font-semibold text-gray-900 text-xs">
                        {entry.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
};

const AudienceGrowthChart: React.FC<Props> = ({ data, loading }) => {
    const [selected, setSelected] = useState<string[]>(['total']);

    const toggle = (key: string) => {
        setSelected(prev =>
            prev.includes(key)
                ? prev.length > 1 ? prev.filter(k => k !== key) : prev
                : [...prev, key]
        );
    };

    const formatted = data.map(d => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse">
                <div className="w-40 h-5 bg-gray-200 rounded mb-6" />
                <div className="h-52 bg-gray-100 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h3 className="text-base font-semibold text-gray-900">Audience Growth</h3>
                <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(({ key, label, color }) => (
                        <button
                            key={key}
                            onClick={() => toggle(key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                        text-xs font-medium border transition-all ${
                                selected.includes(key)
                                    ? 'text-white border-transparent'
                                    : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                            }`}
                            style={selected.includes(key)
                                ? { backgroundColor: color }
                                : {}}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <defs>
                        {PLATFORMS.map(({ key, color }) => (
                            <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={color} stopOpacity={0}    />
                            </linearGradient>
                        ))}
                    </defs>
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
                        tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {PLATFORMS.filter(p => selected.includes(p.key)).map(({ key, color }) => (
                        <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={color}
                            strokeWidth={2.5}
                            fill={`url(#grad-${key})`}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default AudienceGrowthChart;
