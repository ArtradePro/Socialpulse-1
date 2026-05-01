import React from 'react';

interface UsageBarProps {
    label: string;
    used: number;
    limit: number | 'unlimited';
    formatUsed?: (n: number) => string;
    formatLimit?: (n: number | 'unlimited') => string;
    icon?: React.ReactNode;
}

const defaultFmt = (n: number) => n.toLocaleString();
const defaultLimitFmt = (n: number | 'unlimited') =>
    n === 'unlimited' ? '∞' : n.toLocaleString();

export const UsageBar: React.FC<UsageBarProps> = ({
    label, used, limit,
    formatUsed = defaultFmt,
    formatLimit = defaultLimitFmt,
    icon,
}) => {
    const isUnlimited = limit === 'unlimited';
    const pct = isUnlimited
        ? 0
        : Math.min((used / (limit as number)) * 100, 100);

    const nearLimit = pct >= 90;

    const barColor =
        pct >= 90 ? 'bg-red-500' :
        pct >= 70 ? 'bg-orange-400' :
        'bg-purple-600';

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                    {icon}
                    {label}
                </span>
                <span className={`font-semibold ${nearLimit ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatUsed(used)}
                    <span className="text-gray-400 font-normal"> / {formatLimit(limit)}</span>
                </span>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                {isUnlimited ? (
                    <div className="h-2 w-full bg-linear-to-r from-purple-400 to-blue-400 rounded-full animate-pulse" />
                ) : (
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                    />
                )}
            </div>

            {nearLimit && !isUnlimited && (
                <p className="text-xs text-red-500 mt-1 font-medium">
                    {pct.toFixed(0)}% used — consider upgrading
                </p>
            )}
        </div>
    );
};

export default UsageBar;