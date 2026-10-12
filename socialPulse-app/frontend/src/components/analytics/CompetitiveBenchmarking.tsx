// client/src/components/analytics/CompetitiveBenchmarking.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Trophy, Users, Plus, Trash2, Loader2, ArrowUpRight, 
    Smile, Frown, BarChart2, ShieldCheck, X
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface Competitor {
    id: string;
    name: string;
    handle: string;
    mentions: number;
    shareOfVoice: number;
    sentimentScore: number;
    positivePct: number;
    negativePct: number;
}

interface BenchmarkData {
    brand: {
        name: string;
        mentions: number;
        shareOfVoice: number;
        positivePct: number;
        negativePct: number;
        neutralPct: number;
        sentimentScore: number;
    };
    competitors: Competitor[];
    totalMarketMentions: number;
    isCustomTracked: boolean;
}

export const CompetitiveBenchmarking: React.FC = () => {
    const [data, setData] = useState<BenchmarkData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [adding, setAdding] = useState(false);

    // Add Form State
    const [compName, setCompName] = useState('');
    const [compHandle, setCompHandle] = useState('');
    const [estMentions, setEstMentions] = useState('30');

    const loadData = useCallback(async () => {
        try {
            const { data } = await api.get('/analytics/benchmarking');
            setData(data);
        } catch {
            toast.error('Failed to load competitive benchmarks');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAddCompetitor = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);
        try {
            await api.post('/analytics/benchmarking/competitors', {
                competitorName: compName.trim(),
                handle: compHandle.trim(),
                estimatedMentions: parseInt(estMentions) || 25,
            });
            toast.success(`Tracking competitor: ${compName}`);
            setCompName('');
            setCompHandle('');
            setShowAddModal(false);
            await loadData();
        } catch {
            toast.error('Failed to save competitor');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteCompetitor = async (id: string) => {
        try {
            await api.delete(`/analytics/benchmarking/competitors/${id}`);
            toast.success('Competitor removed');
            await loadData();
        } catch {
            toast.error('Failed to remove competitor');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!data) return null;

    const allBrands = [
        { ...data.brand, isSelf: true, id: 'self' },
        ...data.competitors.map(c => ({ ...c, isSelf: false }))
    ];

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-linear-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
                                Brandwatch Intelligence Suite
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold mt-2">Competitive Share of Voice (SoV)</h2>
                        <p className="text-sm text-purple-200/80 mt-1 max-w-xl">
                            Analyze conversation volume, audience perception, and market visibility against competitors.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-900 hover:bg-gray-100 rounded-xl font-bold text-xs transition-colors shadow-lg">
                            <Plus className="w-4 h-4 text-purple-600" /> Track Competitor
                        </button>
                    </div>
                </div>

                {/* Big Share of Voice Bar */}
                <div className="mt-8 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-purple-200">
                        <span>Market Share of Voice Distribution</span>
                        <span>{data.totalMarketMentions} total mentions tracked</span>
                    </div>

                    <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-white/10">
                        <div 
                            style={{ width: `${Math.max(data.brand.shareOfVoice, 8)}%` }}
                            className="h-full bg-linear-to-r from-emerald-400 to-emerald-500 rounded-l-full transition-all flex items-center justify-center"
                            title={`${data.brand.name}: ${data.brand.shareOfVoice}%`}
                        />
                        {data.competitors.map((c, idx) => {
                            const colors = ['bg-indigo-400', 'bg-purple-400', 'bg-blue-400', 'bg-amber-400'];
                            return (
                                <div
                                    key={c.id}
                                    style={{ width: `${Math.max(c.shareOfVoice, 6)}%` }}
                                    className={`h-full ${colors[idx % colors.length]} transition-all`}
                                    title={`${c.name}: ${c.shareOfVoice}%`}
                                />
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 flex-wrap pt-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                            {data.brand.name} ({data.brand.shareOfVoice}%)
                        </div>
                        {data.competitors.map((c, idx) => {
                            const dots = ['bg-indigo-400', 'bg-purple-400', 'bg-blue-400', 'bg-amber-400'];
                            return (
                                <div key={c.id} className="flex items-center gap-1.5 text-gray-300">
                                    <span className={`w-2.5 h-2.5 rounded-full ${dots[idx % dots.length]}`} />
                                    {c.name} ({c.shareOfVoice}%)
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Competitive Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Your Brand Card */}
                <div className="bg-white rounded-2xl border-2 border-emerald-500/50 p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                        Your Brand
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-base">{data.brand.name}</h3>
                            <p className="text-xs text-gray-500">Active Workspace</p>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
                        <div className="bg-gray-50 p-2.5 rounded-xl">
                            <p className="text-xs text-gray-500 font-medium">Share of Voice</p>
                            <p className="text-xl font-black text-gray-900 mt-0.5">{data.brand.shareOfVoice}%</p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded-xl">
                            <p className="text-xs text-gray-500 font-medium">Est. Mentions</p>
                            <p className="text-xl font-black text-gray-900 mt-0.5">{data.brand.mentions}</p>
                        </div>
                    </div>

                    {/* Sentiment meter */}
                    <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-emerald-700 flex items-center gap-1">
                                <Smile className="w-3.5 h-3.5" /> {data.brand.positivePct}% Positive
                            </span>
                            <span className="text-rose-600 flex items-center gap-1">
                                <Frown className="w-3.5 h-3.5" /> {data.brand.negativePct}% Negative
                            </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
                            <div style={{ width: `${data.brand.positivePct}%` }} className="bg-emerald-500 h-full" />
                            <div style={{ width: `${data.brand.neutralPct}%` }} className="bg-gray-300 h-full" />
                            <div style={{ width: `${data.brand.negativePct}%` }} className="bg-rose-500 h-full" />
                        </div>
                    </div>
                </div>

                {/* Tracked Competitors */}
                {data.competitors.map(comp => (
                    <div key={comp.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs hover:border-indigo-200 transition-all">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm">
                                    <BarChart2 className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-base">{comp.name}</h3>
                                    <p className="text-xs text-gray-400">{comp.handle || 'Tracked Competitor'}</p>
                                </div>
                            </div>
                            {data.isCustomTracked && comp.id !== 'comp-1' && comp.id !== 'comp-2' && (
                                <button
                                    onClick={() => handleDeleteCompetitor(comp.id)}
                                    className="text-gray-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                                    title="Remove competitor">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
                            <div className="bg-gray-50 p-2.5 rounded-xl">
                                <p className="text-xs text-gray-500 font-medium">Share of Voice</p>
                                <p className="text-xl font-black text-gray-900 mt-0.5">{comp.shareOfVoice}%</p>
                            </div>
                            <div className="bg-gray-50 p-2.5 rounded-xl">
                                <p className="text-xs text-gray-500 font-medium">Est. Mentions</p>
                                <p className="text-xl font-black text-gray-900 mt-0.5">{comp.mentions}</p>
                            </div>
                        </div>

                        {/* Sentiment meter */}
                        <div className="mt-4 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-gray-600 flex items-center gap-1">
                                    <Smile className="w-3.5 h-3.5 text-gray-400" /> {comp.positivePct}% Pos
                                </span>
                                <span className="text-gray-600 flex items-center gap-1">
                                    <Frown className="w-3.5 h-3.5 text-gray-400" /> {comp.negativePct}% Neg
                                </span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                <div style={{ width: `${comp.positivePct}%` }} className="bg-indigo-400 h-full" />
                                <div style={{ width: `${Math.max(0, 100 - comp.positivePct - comp.negativePct)}%` }} className="bg-gray-300 h-full" />
                                <div style={{ width: `${comp.negativePct}%` }} className="bg-rose-400 h-full" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Strategic Insight Box */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-900">Brand Positioning Analysis</h4>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        Your brand currently commands <strong className="text-indigo-900">{data.brand.shareOfVoice}% Share of Voice</strong> with a net sentiment advantage over competitors. 
                        To capture more organic conversation from rival audiences, publish responsive content addressing pain points flagged in Social Listening during peak engagement hours.
                    </p>
                </div>
            </div>

            {/* Add Competitor Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Track New Competitor</h3>
                                <p className="text-xs text-gray-500">Benchmark your brand against a key industry rival</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddCompetitor} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                    Competitor Brand Name *
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={compName}
                                    onChange={e => setCompName(e.target.value)}
                                    placeholder="e.g. Acme Corp or Rival Cosmetics"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                    Social Handle (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={compHandle}
                                    onChange={e => setCompHandle(e.target.value)}
                                    placeholder="e.g. @acmecorp"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                    Estimated Monthly Mentions Benchmark
                                </label>
                                <input
                                    type="number"
                                    min="5"
                                    max="5000"
                                    value={estMentions}
                                    onChange={e => setEstMentions(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">Average monthly conversation volume to benchmark against</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={adding}
                                    className="flex-1 py-2.5 bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm">
                                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Competitor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default CompetitiveBenchmarking;
