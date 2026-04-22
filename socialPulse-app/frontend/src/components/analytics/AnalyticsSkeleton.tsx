// client/src/components/analytics/AnalyticsSkeleton.tsx
import React from 'react';

const AnalyticsSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div className="w-11 h-11 bg-gray-200 rounded-xl" />
                        <div className="w-14 h-5 bg-gray-200 rounded-full" />
                    </div>
                    <div className="w-24 h-7 bg-gray-200 rounded mb-1" />
                    <div className="w-32 h-4 bg-gray-100 rounded" />
                </div>
            ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="w-44 h-5 bg-gray-200 rounded mb-6" />
                <div className="h-56 bg-gray-100 rounded-xl" />
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="w-32 h-5 bg-gray-200 rounded mb-6" />
                <div className="h-56 bg-gray-100 rounded-xl" />
            </div>
        </div>
    </div>
);

export default AnalyticsSkeleton;
