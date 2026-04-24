// frontend/src/pages/Campaigns.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Megaphone, BarChart2, FileText, Trash2, X, Calendar, Loader2, ChevronRight } from 'lucide-react';
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

    useEffect(() => { fetchCampaigns(); }, []);

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

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
                    <p className="text-sm text-gray-500 mt-1">Group and track posts by marketing campaign</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> New Campaign
                </button>
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
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5" />
                                            {c.post_count} post{c.post_count !== 1 ? 's' : ''}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <BarChart2 className="w-3.5 h-3.5" />
                                            {c.published_count} published
                                        </span>
                                        {c.start_date && (
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {fmtDate(c.start_date)} – {fmtDate(c.end_date)}
                                            </span>
                                        )}
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
                                        <div className="grid grid-cols-4 gap-3 p-5 border-b border-gray-100">
                                            {[
                                                { label: 'Impressions', value: totals.impressions },
                                                { label: 'Likes',       value: totals.likes },
                                                { label: 'Comments',    value: totals.comments },
                                                { label: 'Shares',      value: totals.shares },
                                            ].map(({ label, value }) => (
                                                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                                                    <p className="text-lg font-bold text-gray-900">{value.toLocaleString()}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
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
