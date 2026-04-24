import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, RefreshCw, X, Loader2, Radio, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Rule {
    id:           string;
    keyword:      string;
    platforms:    string[];
    is_active:    boolean;
    result_count: number;
    created_at:   string;
}

interface Result {
    id:           string;
    rule_id:      string;
    keyword:      string;
    platform:     string;
    external_id:  string;
    author_name:  string | null;
    author_handle:string | null;
    content:      string | null;
    url:          string | null;
    likes:        number;
    reposts:      number;
    published_at: string | null;
    fetched_at:   string;
}

const PLATFORM_COLOR: Record<string, string> = {
    twitter:   'bg-sky-100 text-sky-700',
    instagram: 'bg-pink-100 text-pink-700',
    linkedin:  'bg-blue-100 text-blue-700',
    facebook:  'bg-indigo-100 text-indigo-700',
};

export const SocialListening: React.FC = () => {
    const [rules,       setRules]       = useState<Rule[]>([]);
    const [results,     setResults]     = useState<Result[]>([]);
    const [activeRule,  setActiveRule]  = useState<string | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [showCreate,  setShowCreate]  = useState(false);
    const [fetching,    setFetching]    = useState<string | null>(null);

    const [keyword,   setKeyword]   = useState('');
    const [platforms, setPlatforms] = useState(['twitter']);
    const [saving,    setSaving]    = useState(false);

    const loadRules = useCallback(async () => {
        try {
            const { data } = await api.get('/listening/rules');
            setRules(data);
        } catch { toast.error('Failed to load rules'); }
        finally { setLoading(false); }
    }, []);

    const loadResults = useCallback(async (ruleId?: string) => {
        try {
            const params = ruleId ? `?rule_id=${ruleId}` : '';
            const { data } = await api.get(`/listening/results${params}`);
            setResults(data);
        } catch { toast.error('Failed to load results'); }
    }, []);

    useEffect(() => { loadRules(); loadResults(); }, [loadRules, loadResults]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await api.post('/listening/rules', { keyword: keyword.trim(), platforms });
            setRules(prev => [data, ...prev]);
            setKeyword(''); setPlatforms(['twitter']); setShowCreate(false);
            toast.success('Keyword rule added');
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to create rule');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this listening rule and all its results?')) return;
        try {
            await api.delete(`/listening/rules/${id}`);
            setRules(prev => prev.filter(r => r.id !== id));
            if (activeRule === id) { setActiveRule(null); loadResults(); }
            toast.success('Rule deleted');
        } catch { toast.error('Failed to delete rule'); }
    };

    const handleToggle = async (id: string) => {
        try {
            const { data } = await api.patch(`/listening/rules/${id}/toggle`);
            setRules(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
        } catch { toast.error('Failed to toggle rule'); }
    };

    const handleFetch = async (id: string) => {
        setFetching(id);
        try {
            const { data } = await api.post(`/listening/rules/${id}/fetch`);
            toast.success(data.message);
            await loadRules();
            await loadResults(activeRule ?? undefined);
        } catch { toast.error('Failed to fetch mentions'); }
        finally { setFetching(null); }
    };

    const selectRule = (id: string | null) => {
        setActiveRule(id);
        loadResults(id ?? undefined);
    };

    const togglePlatform = (p: string) =>
        setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Social Listening</h1>
                    <p className="text-sm text-gray-500 mt-1">Monitor keywords and mentions across connected platforms</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" /> Add Keyword
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Rules sidebar */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Keywords</p>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
                    ) : rules.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                            <Radio className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                            <p className="text-sm text-gray-400">No keywords yet</p>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => selectRule(null)}
                                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${!activeRule ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
                                <p className="text-sm font-medium">All results</p>
                                <p className="text-xs text-gray-400 mt-0.5">{results.length} total</p>
                            </button>
                            {rules.map(rule => (
                                <div key={rule.id}
                                    className={`bg-white rounded-xl border p-3 cursor-pointer transition-colors ${activeRule === rule.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}
                                    onClick={() => selectRule(rule.id)}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium truncate ${activeRule === rule.id ? 'text-indigo-800' : 'text-gray-900'}`}>
                                                {rule.keyword}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">{rule.result_count} results · {rule.platforms.join(', ')}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={e => { e.stopPropagation(); handleToggle(rule.id); }}
                                                className="text-gray-400 hover:text-indigo-500">
                                                {rule.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleFetch(rule.id); }}
                                                disabled={fetching === rule.id}
                                                className="text-gray-400 hover:text-blue-500 disabled:opacity-40">
                                                <RefreshCw className={`w-3.5 h-3.5 ${fetching === rule.id ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDelete(rule.id); }}
                                                className="text-gray-400 hover:text-red-500">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Results feed */}
                <div className="lg:col-span-2 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                        {activeRule ? `Results for "${rules.find(r => r.id === activeRule)?.keyword}"` : 'All results'}
                    </p>
                    {results.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                            <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No results yet</p>
                            <p className="text-gray-400 text-sm mt-1">Add a keyword rule and click Refresh to fetch mentions</p>
                        </div>
                    ) : (
                        results.map(r => (
                            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                        {r.author_name?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-gray-900">{r.author_name ?? r.author_handle ?? 'Unknown'}</span>
                                            {r.author_handle && <span className="text-xs text-gray-400">@{r.author_handle}</span>}
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLOR[r.platform] ?? 'bg-gray-100 text-gray-600'}`}>{r.platform}</span>
                                            <span className="ml-auto text-xs text-gray-400">{r.published_at ? new Date(r.published_at).toLocaleDateString() : ''}</span>
                                        </div>
                                        <p className="text-sm text-gray-700 mt-1 line-clamp-3">{r.content}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                            {r.likes > 0 && <span>♥ {r.likes}</span>}
                                            {r.reposts > 0 && <span>↩ {r.reposts}</span>}
                                            <span className="text-indigo-600 font-medium px-2 py-0.5 bg-indigo-50 rounded-full">{r.keyword}</span>
                                            {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 ml-auto">View →</a>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Add Keyword Rule</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Keyword or phrase *</label>
                                <input required type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
                                    placeholder='e.g. "SocialPulse" or #yourbrand'
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                                <div className="flex gap-2">
                                    {['twitter', 'instagram', 'linkedin', 'facebook'].map(p => (
                                        <button key={p} type="button" onClick={() => togglePlatform(p)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${platforms.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5">Only Twitter search is active — other platforms coming soon</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Rule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialListening;
