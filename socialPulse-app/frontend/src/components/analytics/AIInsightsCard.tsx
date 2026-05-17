import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, ChevronRight, Lightbulb, Zap, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const AIInsightsCard: React.FC = () => {
    const [insights, setInsights] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const fetchInsights = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/analytics/insights');
            setInsights(data.insights);
        } catch (err) {
            console.error('Failed to fetch AI insights', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    return (
        <div className="relative overflow-hidden bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-6 text-white shadow-xl shadow-purple-200/50">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-400/20 rounded-full blur-xl" />
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                            <Sparkles className="w-5 h-5 text-amber-300" />
                        </div>
                        <h3 className="text-lg font-black tracking-tight uppercase tracking-widest text-xs opacity-90">AI Strategy Insights</h3>
                    </div>
                    <button 
                        onClick={fetchInsights} 
                        disabled={loading}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-3 py-2">
                        <div className="h-4 bg-white/20 rounded-full w-3/4 animate-pulse" />
                        <div className="h-4 bg-white/20 rounded-full w-1/2 animate-pulse" />
                        <div className="h-4 bg-white/20 rounded-full w-2/3 animate-pulse" />
                    </div>
                ) : (
                    <div className="prose prose-sm prose-invert max-w-none">
                        <div className="grid md:grid-cols-3 gap-4">
                            {insights.split('\n').filter(l => l.trim().startsWith('-')).map((insight, idx) => {
                                const icons = [<Zap />, <TrendingUp />, <Lightbulb />];
                                return (
                                    <div key={idx} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-white/20 transition-all cursor-default group">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 text-amber-300 group-hover:scale-110 transition-transform">
                                                {React.cloneElement(icons[idx % icons.length] as React.ReactElement<any>, { size: 16 })}
                                            </div>
                                            <p className="text-xs font-medium leading-relaxed text-indigo-50">
                                                {insight.replace(/^- /, '')}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {!insights && <p className="text-sm opacity-70 italic">Analyzing your performance data...</p>}
                    </div>
                )}
            </div>
        </div>
    );
};
