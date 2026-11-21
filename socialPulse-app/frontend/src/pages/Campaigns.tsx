import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Plus, Megaphone, BarChart2, FileText, Trash2, X, Calendar, 
    Loader2, ChevronRight, Wand2, Sparkles, Mail, Play, ShieldCheck, 
    CheckCircle2, RefreshCw, Send, Layers, Award, ExternalLink, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Campaign {
    id:              string;
    name:            string;
    description:     string | null;
    status:          'active' | 'completed' | 'paused';
    start_date:      string | null;
    end_date:        string | null;
    post_count:      number;
    published_count: number;
    created_at:      string;
}

interface CampaignPost {
    id:               string;
    content:          string;
    platforms:        string[];
    status:           string;
    scheduled_at:     string | null;
    published_at:     string | null;
    total_impressions: number;
    total_likes:      number;
    total_comments:   number;
    total_shares:     number;
}

interface CampaignDetail extends Campaign {
    posts: CampaignPost[];
}

const STATUS_BADGE: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    paused:    'bg-yellow-100 text-yellow-700',
};

export const Campaigns: React.FC = () => {
    const [isPlanning, setIsPlanning] = useState<string | null>(null);
    const [matrixStatus, setMatrixStatus] = useState<any>(null);
    const [runningMatrix, setRunningMatrix] = useState(false);
    const [generatedMatrixBatch, setGeneratedMatrixBatch] = useState<any>(null);
    const [queueingMatrix, setQueueingMatrix] = useState(false);

    const handleMagicPlan = async (id: string) => {
        const toastId = toast.loading('Strategizing your 7-day magic plan...');
        setIsPlanning(id);
        try {
            await api.post(`/campaigns/${id}/magic-plan`);
            toast.success('Magic 7-day plan generated as drafts!', { id: toastId });
            await fetchCampaigns();
            if (selected?.id === id) await openDetail(id);
        } catch {
            toast.error('Failed to generate magic plan', { id: toastId });
        } finally {
            setIsPlanning(null);
        }
    };

    const [campaigns,   setCampaigns]   = useState<Campaign[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [showCreate,  setShowCreate]  = useState(false);
    const [selected,    setSelected]    = useState<CampaignDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Create form state
    const [name,        setName]        = useState('');
    const [description, setDescription] = useState('');
    const [startDate,   setStartDate]   = useState('');
    const [endDate,     setEndDate]     = useState('');
    const [saving,      setSaving]      = useState(false);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/campaigns');
            setCampaigns(data);
        } catch {
            toast.error('Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    };

    const fetchMatrixStatus = async () => {
        try {
            const { data } = await api.get('/campaigns/matrix/status');
            setMatrixStatus(data);
            if (data.lastBatch) {
                setGeneratedMatrixBatch(data.lastBatch);
            }
        } catch (err) {
            console.warn('Matrix status error:', err);
        }
    };

    const handleRunMatrixNow = async () => {
        setRunningMatrix(true);
        try {
            const { data } = await api.post('/campaigns/matrix/trigger');
            setGeneratedMatrixBatch(data);
            toast.success(`Generated ${data.totalPosts} multi-platform campaign posts from campaign_matrix.md!`);
            await fetchMatrixStatus();
        } catch {
            toast.error('Failed to run campaign matrix');
        } finally {
            setRunningMatrix(false);
        }
    };

    const handleQueueMatrixBatch = async () => {
        if (!generatedMatrixBatch) return;
        setQueueingMatrix(true);
        try {
            const { data } = await api.post('/campaigns/matrix/queue');
            toast.success(data.message || 'Queued all campaign posts to publishing schedule!');
            await fetchMatrixStatus();
            await fetchCampaigns();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to queue campaign batch');
        } finally {
            setQueueingMatrix(false);
        }
    };

    useEffect(() => { 
        fetchCampaigns(); 
        fetchMatrixStatus();
    }, []);

    const openDetail = async (id: string) => {
        setDetailLoading(true);
        try {
            const { data } = await api.get(`/campaigns/${id}`);
            setSelected(data);
        } catch {
            toast.error('Failed to load campaign details');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            const { data } = await api.post('/campaigns', { name, description, startDate: startDate || undefined, endDate: endDate || undefined });
            setCampaigns(prev => [{ ...data, post_count: 0, published_count: 0 }, ...prev]);
            setShowCreate(false);
            setName(''); setDescription(''); setStartDate(''); setEndDate('');
            toast.success('Campaign created');
        } catch {
            toast.error('Failed to create campaign');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this campaign? Posts will be unlinked but not deleted.')) return;
        try {
            await api.delete(`/campaigns/${id}`);
            setCampaigns(prev => prev.filter(c => c.id !== id));
            if (selected?.id === id) setSelected(null);
            toast.success('Campaign deleted');
        } catch {
            toast.error('Failed to delete campaign');
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            await api.patch(`/campaigns/${id}`, { status });
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: status as Campaign['status'] } : c));
            if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: status as Campaign['status'] } : null);
        } catch {
            toast.error('Failed to update status');
        }
    };

    const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : '—';

    const navigate = useNavigate();

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Social Media Campaigns</h1>
                    <p className="text-sm text-gray-500 mt-1">Group and track posts by social media campaign</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/marketing')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Mail className="w-4 h-4" /> Email & SMS Campaigns
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" /> New Campaign
                    </button>
                </div>
            </div>

            {/* Autonomous Campaign Matrix (campaign_matrix.md) Panel */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 md:p-7 border border-indigo-900/60 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-indigo-200 border border-white/10 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>Autonomous Campaign Matrix Engine</span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" /> ClaimsGuard™ Verified
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-indigo-200 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Schedule: Daily Auto-Rotation</span>
                            <span className="text-gray-400">•</span>
                            <span>{matrixStatus?.queuedPostCount || 0} Posts Staged</span>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="max-w-2xl">
                            <h2 className="text-lg md:text-xl font-black text-white">
                                Higiene (Pty) Ltd — Higienlabs Master Content Playbook
                            </h2>
                            <p className="text-xs text-indigo-200/80 mt-1 leading-relaxed">
                                Autonomously generates scheduled multi-platform posts for <strong>Fungus No More™ Dual Action</strong> (500ml Shower Gels & 50ml Coconut Spray), <strong>Higienlabs™ Hair Growth</strong>, and <strong>Clinical Skincare</strong> with Takealot & Shopify retail routing.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleRunMatrixNow}
                                disabled={runningMatrix}
                                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-gray-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                                {runningMatrix ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-950" />
                                        <span>Evaluating Matrix...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-3.5 h-3.5 fill-gray-950" />
                                        <span>Run Matrix Cycle Now</span>
                                    </>
                                )}
                            </button>

                            {generatedMatrixBatch && (
                                <button
                                    type="button"
                                    onClick={handleQueueMatrixBatch}
                                    disabled={queueingMatrix || generatedMatrixBatch.status === 'QUEUED'}
                                    className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 ${
                                        generatedMatrixBatch.status === 'QUEUED'
                                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-[0.98]'
                                    }`}
                                >
                                    {queueingMatrix ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : generatedMatrixBatch.status === 'QUEUED' ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                        {generatedMatrixBatch.status === 'QUEUED'
                                            ? 'Queued to Schedule'
                                            : `Queue ${generatedMatrixBatch.totalPosts} Posts to Schedule`}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Generated Angles Preview if available */}
                    {generatedMatrixBatch?.angles && (
                        <div className="pt-3 border-t border-white/10 space-y-3">
                            <div className="flex items-center justify-between text-xs text-indigo-300">
                                <span className="font-bold flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-indigo-400" />
                                    Generated Multi-Platform Post Batch ({generatedMatrixBatch.angles.length} Angles):
                                </span>
                                <span className="text-[11px] text-gray-400">
                                    Batch ID: {generatedMatrixBatch.id}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {generatedMatrixBatch.angles.map((ang: any, aIdx: number) => (
                                    <div
                                        key={aIdx}
                                        className="bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-2 hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                                                {ang.brand}
                                            </span>
                                            <div className="flex gap-1">
                                                {ang.platforms.map((p: string) => (
                                                    <span key={p} className="text-[8px] font-bold uppercase text-gray-400 bg-white/5 px-1 py-0.5 rounded">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <p className="text-xs font-bold text-white truncate">{ang.headline}</p>
                                        <p className="text-[11px] text-indigo-200/70 line-clamp-2 leading-relaxed italic">
                                            "{ang.hook}"
                                        </p>

                                        <div className="pt-1 flex items-center justify-between text-[10px] text-indigo-300/80 border-t border-white/5">
                                            <span className="truncate max-w-[140px]">{ang.angleName}</span>
                                            <a
                                                href={ang.retailUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-bold"
                                            >
                                                Retail Link <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Campaign list */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                    <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No campaigns yet</p>
                    <p className="text-gray-400 text-sm mt-1">Create a campaign to group related posts together</p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                    >
                        Create your first campaign
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {campaigns.map(c => (
                        <div
                            key={c.id}
                            onClick={() => openDetail(c.id)}
                            className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h2 className="text-base font-semibold text-gray-900 truncate">{c.name}</h2>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status] ?? STATUS_BADGE.paused}`}>
                                            {c.status}
                                        </span>
                                    </div>
                                    {c.description && (
                                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{c.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400 mb-1">
                                                <span>Campaign Progress</span>
                                                <span>{Math.round((c.published_count / (c.post_count || 1)) * 100)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-linear-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                                    style={{ width: `${(c.published_count / (c.post_count || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 ml-auto">
                                            <span className="flex items-center gap-1">
                                                <FileText className="w-3.5 h-3.5" />
                                                {c.post_count}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <BarChart2 className="w-3.5 h-3.5" />
                                                {c.published_count}
                                            </span>
                                            {c.start_date && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {fmtDate(c.start_date)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={e => handleDelete(c.id, e)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create campaign modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">New Campaign</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Q2 Product Launch"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={2}
                                    placeholder="Optional description…"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Campaign detail side panel */}
            {(selected || detailLoading) && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
                    <div className="w-full max-w-2xl bg-white h-full flex flex-col overflow-hidden shadow-2xl">
                        {detailLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            </div>
                        ) : selected ? (
                            <>
                                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2>
                                        {selected.description && <p className="text-sm text-gray-500 mt-0.5">{selected.description}</p>}
                                    </div>
                                    <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Status + dates */}
                                <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">Status:</span>
                                        <select
                                            value={selected.status}
                                            onChange={e => updateStatus(selected.id, e.target.value)}
                                            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                                        >
                                            {['active', 'paused', 'completed'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="text-sm text-gray-500">
                                        {fmtDate(selected.start_date)} – {fmtDate(selected.end_date)}
                                    </span>
                                    <span className="ml-auto text-sm text-gray-500">
                                        {selected.post_count} posts · {selected.published_count} published
                                    </span>
                                    <button 
                                        onClick={() => handleMagicPlan(selected.id)}
                                        disabled={isPlanning === selected.id}
                                        className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
                                    >
                                        {isPlanning === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                        Magic 7-Day Plan
                                    </button>
                                </div>

                                {/* Aggregate stats */}
                                {selected.posts.length > 0 && (() => {
                                    const totals = selected.posts.reduce((acc, p) => ({
                                        impressions: acc.impressions + Number(p.total_impressions),
                                        likes:       acc.likes       + Number(p.total_likes),
                                        comments:    acc.comments    + Number(p.total_comments),
                                        shares:      acc.shares      + Number(p.total_shares),
                                    }), { impressions: 0, likes: 0, comments: 0, shares: 0 });
                                    return (
                                        <div className="grid grid-cols-4 gap-4 p-5 border-b border-gray-100 bg-linear-to-b from-gray-50/50 to-transparent">
                                            {[
                                                { label: 'Impressions', value: totals.impressions, color: 'text-blue-600' },
                                                { label: 'Likes',       value: totals.likes,       color: 'text-pink-600' },
                                                { label: 'Comments',    value: totals.comments,    color: 'text-indigo-600' },
                                                { label: 'Shares',      value: totals.shares,      color: 'text-purple-600' },
                                            ].map(({ label, value, color }) => (
                                                <div key={label} className="bg-white rounded-2xl p-4 text-center border border-gray-100 shadow-sm">
                                                    <p className={`text-xl font-black ${color}`}>{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}</p>
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1">{label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Posts table */}
                                <div className="flex-1 overflow-y-auto p-5">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Posts</h3>
                                    {selected.posts.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-8">No posts in this campaign yet</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {selected.posts.map(p => (
                                                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <p className="text-sm text-gray-800 line-clamp-2 flex-1">{p.content}</p>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                                            p.status === 'published' ? 'bg-green-100 text-green-700' :
                                                            p.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>{p.status}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                                        <span>{p.platforms.join(', ')}</span>
                                                        {p.published_at && <span>Published {fmtDate(p.published_at)}</span>}
                                                        {p.total_impressions > 0 && (
                                                            <span>{Number(p.total_impressions).toLocaleString()} impressions</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Campaigns;
