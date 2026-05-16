import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MetricCardProps {
    title:       string;
    value:       string | number;
    delta?:      number;
    icon:        React.ReactNode;
    iconBg:      string;
    iconColor:   string;
    prefix?:     string;
    suffix?:     string;
    loading?:    boolean;
    description?: string;
    chartData?:  any[]; // For sparklines
}

const MetricCard: React.FC<MetricCardProps> = ({
    title, value, delta, icon, iconBg, iconColor,
    prefix = '', suffix = '', loading = false, description, chartData
}) => {
    const isPositive = delta !== undefined && delta > 0;
    const isNegative = delta !== undefined && delta < 0;
    const isNeutral  = delta === undefined || delta === 0;

    if (loading) {
        return (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-gray-100 rounded-xl" />
                    <div className="w-14 h-5 bg-gray-100 rounded-full" />
                </div>
                <div className="w-24 h-7 bg-gray-100 rounded mb-1" />
                <div className="w-32 h-4 bg-gray-50 rounded" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group overflow-hidden relative">
            <div className="relative z-10 flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center ${iconColor} shadow-xs group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                {delta !== undefined && (
                    <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-black ${
                        isPositive ? 'bg-green-50 text-green-700' :
                        isNegative ? 'bg-red-50 text-red-600' :
                        'bg-gray-50 text-gray-400'
                    }`}>
                        {isPositive && <ArrowUpRight className="w-3 h-3" />}
                        {isNegative && <ArrowDownRight className="w-3 h-3" />}
                        {isNeutral && <Minus className="w-3 h-3" />}
                        {Math.abs(delta).toFixed(1)}%
                    </span>
                )}
            </div>

            <div className="relative z-10">
                <p className="text-3xl font-black text-gray-900 tracking-tight">
                    {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
                </p>
                <p className="text-sm font-bold text-gray-500 mt-0.5">{title}</p>
                {description && (
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {description}
                    </p>
                )}
            </div>

            {/* Sparkline */}
            {chartData && (
                <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 group-hover:opacity-60 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isPositive ? '#10B981' : isNegative ? '#EF4444' : '#6366F1'} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={isPositive ? '#10B981' : isNegative ? '#EF4444' : '#6366F1'} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={isPositive ? '#10B981' : isNegative ? '#EF4444' : '#6366F1'} 
                                strokeWidth={2} 
                                fill={`url(#gradient-${title})`} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default MetricCard;
