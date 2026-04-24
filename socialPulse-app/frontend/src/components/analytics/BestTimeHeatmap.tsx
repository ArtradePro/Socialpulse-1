// client/src/components/analytics/BestTimeHeatmap.tsx
import React from 'react';
import { HeatmapCell } from '../../hooks/useAnalytics';

interface Props {
    data:    HeatmapCell[];
    loading: boolean;
}

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
);

const BestTimeHeatmap: React.FC<Props> = ({ data, loading }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    const getCell = (day: number, hour: number) =>
        data.find(d => d.day === day && d.hour === hour);

    const getOpacity = (value: number) => 0.08 + (value / maxValue) * 0.92;

    const getTextColor = (value: number) =>
        value / maxValue > 0.55 ? 'text-white' : 'text-purple-900';

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse">
                <div className="w-52 h-5 bg-gray-200 rounded mb-6" />
                <div className="h-48 bg-gray-100 rounded-xl" />
            </div>
        );
    }

    // Find top 3 best slots
    const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 3);

    return (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-base font-semibold text-gray-900">
                        Best Time to Post
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Based on your audience engagement patterns
                    </p>
                </div>

                {/* Top slot badge */}
                {sorted[0] && (
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Peak time</p>
                        <p className="text-sm font-semibold text-purple-600">
                            {DAYS[sorted[0].day]} · {HOURS[sorted[0].hour]}
                        </p>
                    </div>
                )}
            </div>

            {/* Heatmap grid */}
            <div className="overflow-x-auto">
                <div style={{ minWidth: 560 }}>
                    {/* Hour labels — show every 3 hours */}
                    <div className="flex mb-1 ml-10">
                        {HOURS.map((h, i) => (
                            <div key={i} className="flex-1 text-center">
                                {i % 3 === 0 && (
                                    <span className="text-[9px] text-gray-400">{h}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {DAYS.map((day, dayIdx) => (
                        <div key={day} className="flex items-center mb-1">
                            <span className="text-xs text-gray-400 w-10 shrink-0 text-right pr-2">
                                {day}
                            </span>
                            {HOURS.map((_, hourIdx) => {
                                const cell = getCell(dayIdx, hourIdx);
                                const val  = cell?.value ?? 0;
                                return (
                                    <div key={hourIdx} className="flex-1 px-px">
                                        <div
                                            title={`${day} ${HOURS[hourIdx]}: ${val.toFixed(0)} avg engagement`}
                                            className={`h-7 rounded-sm flex items-center justify-center
                                                        cursor-default transition-transform
                                                        hover:scale-110 hover:z-10 relative ${getTextColor(val)}`}
                                            style={{
                                                backgroundColor: `rgba(124,58,237,${getOpacity(val)})`,
                                            }}
                                        >
                                            {val > 0 && val / maxValue > 0.7 && (
                                                <span className="text-[8px] font-bold leading-none">
                                                    ★
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-gray-400">Low</span>
                <div className="flex gap-0.5">
                    {[0.08, 0.25, 0.45, 0.65, 0.85, 1].map(op => (
                        <div
                            key={op}
                            className="w-5 h-3 rounded-sm"
                            style={{ backgroundColor: `rgba(124,58,237,${op})` }}
                        />
                    ))}
                </div>
                <span className="text-xs text-gray-400">High</span>

                {/* Top slots */}
                <div className="ml-auto flex gap-2">
                    {sorted.map((s, i) => (
                        <span key={i} className="text-xs bg-purple-50 text-purple-700
                                                  px-2 py-0.5 rounded-full font-medium">
                            #{i + 1} {DAYS[s.day]} {HOURS[s.hour]}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BestTimeHeatmap;
