// client/src/components/analytics/MetricCard.tsx
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
    title:       string;
    value:       string | number;
    delta?:      number;        // % change vs previous period
    icon:        React.ReactNode;
    iconBg:      string;        // tailwind bg class  e.g. "bg-purple-50"
    iconColor:   string;        // tailwind text class
    prefix?:     string;
    suffix?:     string;
    loading?:    boolean;
    description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title, value, delta, icon, iconBg, iconColor,
    prefix = '', suffix = '', loading = false, description,
}) => {
    const isPositive = delta !== undefined && delta > 0;
    const isNegative = delta !== undefined && delta < 0;
    const isNeutral  = delta === undefined || delta === 0;

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-gray-200 rounded-xl" />
                    <div className="w-14 h-5 bg-gray-200 rounded-full" />
                </div>
                <div className="w-24 h-7 bg-gray-200 rounded mb-1" />
                <div className="w-32 h-4 bg-gray-100 rounded" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm
                        hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
                {/* Icon */}
                <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center
                                 justify-center ${iconColor}`}>
                    {icon}
                </div>

                {/* Delta badge */}
                {delta !== undefined && (
                    <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full
                                      text-xs font-semibold ${
                        isPositive ? 'bg-green-50  text-green-700' :
                        isNegative ? 'bg-red-50    text-red-600'   :
                                     'bg-gray-100  text-gray-500'
                    }`}>
                        {isPositive && <ArrowUpRight   className="w-3 h-3" />}
                        {isNegative && <ArrowDownRight className="w-3 h-3" />}
                        {isNeutral  && <Minus          className="w-3 h-3" />}
                        {Math.abs(delta).toFixed(1)}%
                    </span>
                )}
            </div>

            <p className="text-2xl font-bold text-gray-900 tracking-tight">
                {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{title}</p>
            {description && (
                <p className="text-xs text-gray-400 mt-1">{description}</p>
            )}
        </div>
    );
};

export default MetricCard;
