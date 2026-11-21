import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, Plus, Trash2, RefreshCw, X, Loader2, Radio, ToggleLeft, ToggleRight, 
    Sparkles, ExternalLink, AlertTriangle, ShieldAlert, CheckCircle2, Copy, Send
} from 'lucide-react';
import { PlatformIcon } from '../components/common/BrandIcons';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Rule {
    id:           string;
    keyword:      string;
    platforms:    string[];
    is_active:    boolean;
    query_type?:   'keyword' | 'boolean';
    exclude_keywords?: string[];
    result_count: number;
    negative_count?: number;
    positive_count?: number;
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
    author_avatar:string | null;
    content:      string | null;
    url:          string | null;
    likes:        number;
    reposts:      number;
    published_at: string | null;
    fetched_at:   string;
    sentiment?:   'positive' | 'neutral' | 'negative';
    sentiment_score?: number;
    author_followers?: number;
}

interface CrisisSummary {
    isCrisis: boolean;
    negativePct: number;
    totalCount: number;
    severity: 'normal' | 'caution' | 'crisis';
    summary: string;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    healthyRatio: number;
}

const PLATFORM_STYLE: Record<string, { bg: string; text: string }> = {
    twitter:   { bg: 'bg-gray-100', text: 'text-gray-800' },
    instagram: { bg: 'bg-pink-100', text: 'text-pink-700' },
    linkedin:  { bg: 'bg-blue-100', text: 'text-blue-700' },
    facebook:  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    tiktok:    { bg: 'bg-black/5',  text: 'text-black' },
};

export const SocialListening: React.FC = () => {
    const navigate = useNavigate();
    const [isDrafting, setIsDrafting] = useState<string | null>(null);
    const [rules,       setRules]       = useState<Rule[]>([]);
    const [results,     setResults]     = useState<Result[]>([]);
    const [activeRule,  setActiveRule]  = useState<string | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [showCreate,  setShowCreate]  = useState(false);
    const [fetching,    setFetching]    = useState<string | null>(null);

    // Crisis summary
    const [crisisInfo,  setCrisisInfo]  = useState<CrisisSummary | null>(null);
    const [activeSentimentFilter, setActiveSentimentFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');

    // Create Rule State
    const [keyword,          setKeyword]          = useState('');
    const [queryType,        setQueryType]        = useState<'keyword' | 'boolean'>('keyword');
    const [excludeText,      setExcludeText]      = useState('');
    const [platforms,        setPlatforms]        = useState(['twitter']);
    const [saving,           setSaving]           = useState(false);

    // Crisis Response Modal
    const [crisisModalData,  setCrisisModalData]  = useState<{ item: Result; reply: string; loading: boolean } | null>(null);

    const loadRules = useCallback(async () => {
        try {
            const { data } = await api.get('/listening/rules');
            setRules(data);
        } catch { toast.error('Failed to load rules'); }
        finally { setLoading(false); }
    }, []);

    const loadCrisisSummary = useCallback(async () => {
        try {
            const { data } = await api.get('/listening/crisis-summary');
            setCrisisInfo(data);
        } catch { /* silent fallback */ }
    }, []);

    const loadResults = useCallback(async (ruleId?: string, sentiment?: string) => {
        try {
            const params = new URLSearchParams();
            if (ruleId) params.set('rule_id', ruleId);
            if (sentiment && sentiment !== 'all') params.set('sentiment', sentiment);
            const queryStr = params.toString() ? `?${params.toString()}` : '';

            const { data } = await api.get(`/listening/results${queryStr}`);
            setResults(data);
        } catch { toast.error('Failed to load results'); }
    }, []);

    useEffect(() => { 
        loadRules(); 
        loadResults(); 
        loadCrisisSummary();
    }, [loadRules, loadResults, loadCrisisSummary]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const excludes = excludeText
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            const { data } = await api.post('/listening/rules', { 
                keyword: keyword.trim(), 
                platforms,
                query_type: queryType,
                exclude_keywords: excludes
            });
            setRules(prev => [data, ...prev]);
            setKeyword(''); 
            setExcludeText('');
            setQueryType('keyword');
            setPlatforms(['twitter']); 
            setShowCreate(false);
            toast.success('Listening rule created');
            loadCrisisSummary();
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
            loadCrisisSummary();
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
            await loadResults(activeRule ?? undefined, activeSentimentFilter);
            loadCrisisSummary();
        } catch { toast.error('Failed to fetch mentions'); }
        finally { setFetching(null); }
    };

    const selectRule = (id: string | null) => {
        setActiveRule(id);
        loadResults(id ?? undefined, activeSentimentFilter);
    };

    const handleSentimentFilter = (s: 'all' | 'positive' | 'neutral' | 'negative') => {
        setActiveSentimentFilter(s);
        loadResults(activeRule ?? undefined, s);
    };

    const togglePlatform = (p: string) =>
        setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

    const handleDraftWithAI = async (result: Result) => {
        setIsDrafting(result.id);
        try {
            const { data } = await api.post('/ai/draft-from-trend', {
                trendContent: result.content,
                platform: result.platform
            });
            
            navigate('/studio', { 
                state: { 
                    initialContent: data.content,
                    initialHashtags: data.hashtags,
                    initialPlatform: result.platform
                } 
            });
            toast.success('Draft generated in Studio!');
        } catch {
            toast.error('Failed to generate draft');
        } finally {
            setIsDrafting(null);
        }
    };

    const handleOpenCrisisReply = async (result: Result) => {
        setCrisisModalData({ item: result, reply: '', loading: true });
        try {
            const { data } = await api.post('/listening/crisis-response', {
                content: result.content,
                authorName: result.author_name || result.author_handle || 'user',
                platform: result.platform
            });
            setCrisisModalData({ item: result, reply: data.suggestedReply || '', loading: false });
        } catch {
            toast.error('Could not auto-generate reply');
            setCrisisModalData({ item: result, reply: 'Thank you for reaching out. We apologize for the frustration and want to make this right immediately. Please send us a direct message so our senior team can assist you directly.', loading: false });
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Social Listening & Brand Intelligence
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold">
                            Brandwatch Engine
                        </span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time keyword monitoring, Boolean queries, and sentiment crisis detection</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-sm self-start sm:self-auto">
                    <Plus className="w-4 h-4" /> Add Listening Rule
                </button>
            </div>

            {/* Brandwatch Style Crisis / Sentiment Overview Banner */}
            {crisisInfo && (
                <div className={`rounded-2xl border p-5 transition-all ${
                    crisisInfo.isCrisis 
                        ? 'bg-rose-50 border-rose-200' 
                        : crisisInfo.severity === 'caution' 
                            ? 'bg-amber-50 border-amber-200' 
                            : 'bg-white border-gray-200'
                }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                                crisisInfo.isCrisis ? 'bg-rose-100 text-rose-600' :
                                crisisInfo.severity === 'caution' ? 'bg-amber-100 text-amber-600' :
                                'bg-emerald-50 text-emerald-600'
                            }`}>
                                {crisisInfo.isCrisis ? (
                                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                                ) : crisisInfo.severity === 'caution' ? (
                                    <AlertTriangle className="w-6 h-6" />
                                ) : (
                                    <CheckCircle2 className="w-6 h-6" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-gray-900">
                                        {crisisInfo.isCrisis ? 'Active Negative Sentiment Spike Alert' : 
                                         crisisInfo.severity === 'caution' ? 'Sentiment Caution Notice' : 
                                         'Brand Health & Perception: Healthy'}
                                    </h3>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                        crisisInfo.isCrisis ? 'bg-rose-200 text-rose-800' :
                                        crisisInfo.severity === 'caution' ? 'bg-amber-200 text-amber-800' :
                                        'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {crisisInfo.severity}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1 max-w-2xl">{crisisInfo.summary}</p>
                            </div>
                        </div>

                        {/* Sentiment Pills Bar */}
                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                            <div className="flex items-center gap-1.5 bg-white/80 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                <span className="text-gray-700">Positive: {crisisInfo.positiveCount}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/80 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
                                <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
                                <span className="text-gray-700">Neutral: {crisisInfo.neutralCount}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/80 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                                <span className="text-rose-700">Negative: {crisisInfo.negativeCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Rules sidebar */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Tracking Rules</p>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
                    ) : rules.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-4">
                            <Radio className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                            <p className="text-sm font-medium text-gray-600">No listening rules yet</p>
                            <p className="text-xs text-gray-400 mt-1">Add keywords or Boolean queries to scan social feeds.</p>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => selectRule(null)}
                                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${!activeRule ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm">All Keywords</p>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{results.length} total</span>
                                </div>
                            </button>
                            {rules.map(rule => (
                                <div key={rule.id}
                                    className={`bg-white rounded-xl border p-3 cursor-pointer transition-colors ${activeRule === rule.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}
                                    onClick={() => selectRule(rule.id)}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className={`text-sm font-semibold truncate ${activeRule === rule.id ? 'text-indigo-800' : 'text-gray-900'}`}>
                                                    {rule.keyword}
                                                </p>
                                                {rule.query_type === 'boolean' && (
                                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded-md">Boolean</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {rule.result_count} mentions · {rule.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={e => { e.stopPropagation(); handleToggle(rule.id); }}
                                                title={rule.is_active ? 'Disable' : 'Enable'}
                                                className="text-gray-400 hover:text-indigo-500">
                                                {rule.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleFetch(rule.id); }}
                                                disabled={fetching === rule.id}
                                                title="Fetch latest"
                                                className="text-gray-400 hover:text-blue-500 disabled:opacity-40 p-1">
                                                <RefreshCw className={`w-3.5 h-3.5 ${fetching === rule.id ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDelete(rule.id); }}
                                                title="Delete"
                                                className="text-gray-400 hover:text-red-500 p-1">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                            {activeRule ? `Results for "${rules.find(r => r.id === activeRule)?.keyword}"` : 'All Mentions'}
                        </p>

                        {/* Sentiment Filter Chips */}
                        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-medium">
                            <button
                                onClick={() => handleSentimentFilter('all')}
                                className={`px-2.5 py-1 rounded-lg transition-colors ${activeSentimentFilter === 'all' ? 'bg-white shadow-xs text-gray-900 font-bold' : 'text-gray-600 hover:text-gray-900'}`}>
                                All
                            </button>
                            <button
                                onClick={() => handleSentimentFilter('positive')}
                                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${activeSentimentFilter === 'positive' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-gray-600 hover:text-emerald-600'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Positive
                            </button>
                            <button
                                onClick={() => handleSentimentFilter('neutral')}
                                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${activeSentimentFilter === 'neutral' ? 'bg-white shadow-xs text-gray-700 font-bold' : 'text-gray-600 hover:text-gray-900'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Neutral
                            </button>
                            <button
                                onClick={() => handleSentimentFilter('negative')}
                                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${activeSentimentFilter === 'negative' ? 'bg-white shadow-xs text-rose-700 font-bold' : 'text-gray-600 hover:text-rose-600'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Negative
                            </button>
                        </div>
                    </div>

                    {results.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                            <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-600 font-medium">No results match this view</p>
                            <p className="text-gray-400 text-sm mt-1">Switch sentiment filter or click Refresh to pull new mentions</p>
                        </div>
                    ) : (
                        results.map(r => (
                            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-100 transition-all shadow-2xs">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 overflow-hidden border border-gray-100">
                                        {r.author_avatar ? (
                                            <img src={r.author_avatar} alt={r.author_name || ''} className="w-full h-full object-cover" />
                                        ) : (
                                            r.author_name?.[0]?.toUpperCase() ?? '?'
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-gray-900">{r.author_name ?? r.author_handle ?? 'Unknown'}</span>
                                            {r.author_handle && <span className="text-xs text-gray-400">@{r.author_handle}</span>}
                                            
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${PLATFORM_STYLE[r.platform]?.bg ?? 'bg-gray-100'} ${PLATFORM_STYLE[r.platform]?.text ?? 'text-gray-600'}`}>
                                                <PlatformIcon platform={r.platform} size={12} />
                                                <span className="capitalize">{r.platform}</span>
                                            </div>

                                            {/* Sentiment Badge */}
                                            {r.sentiment && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                                    r.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                    r.sentiment === 'negative' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                    'bg-gray-50 text-gray-600 border border-gray-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        r.sentiment === 'positive' ? 'bg-emerald-500' :
                                                        r.sentiment === 'negative' ? 'bg-rose-500' :
                                                        'bg-gray-400'
                                                    }`} />
                                                    {r.sentiment.toUpperCase()}
                                                    {r.sentiment_score !== undefined && r.sentiment_score !== 0 && (
                                                        <span className="opacity-75">({r.sentiment_score > 0 ? `+${r.sentiment_score}` : r.sentiment_score})</span>
                                                    )}
                                                </span>
                                            )}

                                            <span className="ml-auto text-xs text-gray-400">{r.published_at ? new Date(r.published_at).toLocaleDateString() : ''}</span>
                                        </div>

                                        <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.content}</p>

                                        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400 flex-wrap">
                                            {r.likes > 0 && <span className="font-medium text-gray-500">♥ {r.likes}</span>}
                                            {r.reposts > 0 && <span className="font-medium text-gray-500">↩ {r.reposts}</span>}
                                            
                                            <span className="text-indigo-600 font-semibold px-2 py-0.5 bg-indigo-50 rounded-md border border-indigo-100/60">
                                                {r.keyword}
                                            </span>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 ml-auto">
                                                {r.sentiment === 'negative' && (
                                                    <button
                                                        onClick={() => handleOpenCrisisReply(r)}
                                                        className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg hover:bg-rose-100 transition-colors">
                                                        <ShieldAlert className="w-3 h-3 text-rose-600" />
                                                        AI Crisis Reply
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => handleDraftWithAI(r)}
                                                    disabled={isDrafting === r.id}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-linear-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-xs"
                                                >
                                                    {isDrafting === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                                    Draft in Studio
                                                </button>

                                                {r.url && (
                                                    <a href={r.url} target="_blank" rel="noopener noreferrer" 
                                                       className="flex items-center p-1 text-gray-400 hover:text-indigo-600 rounded-md transition-colors"
                                                       title="View original">
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Create Rule Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Add Listening Rule</h2>
                                <p className="text-xs text-gray-500">Configure exact keywords or advanced Boolean filters</p>
                            </div>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleCreate} className="p-5 space-y-4">
                            {/* Query Type Toggle */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Query Engine</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setQueryType('keyword')}
                                        className={`p-2.5 rounded-xl border text-left transition-all ${queryType === 'keyword' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                        <p className="text-xs font-bold">Standard Keyword</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Simple brand or phrase match</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQueryType('boolean')}
                                        className={`p-2.5 rounded-xl border text-left transition-all ${queryType === 'boolean' ? 'border-purple-600 bg-purple-50/50 text-purple-900 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-bold">Boolean Query</p>
                                            <span className="text-[9px] bg-purple-200 text-purple-800 px-1 rounded-sm">Brandwatch</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-0.5">AND, OR, NOT operators</p>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {queryType === 'boolean' ? 'Boolean Query Expression *' : 'Keyword or phrase *'}
                                </label>
                                <input required type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
                                    placeholder={queryType === 'boolean' ? '("Fungus No More" OR "Higiene") AND (skin OR serum)' : 'e.g. "Fungus No More" or #Higiene'}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                {queryType === 'boolean' && (
                                    <p className="text-[11px] text-purple-600 mt-1">
                                        Tip: Use uppercase <code>AND</code>, <code>OR</code>, <code>NOT</code> to pinpoint high-relevance discussions.
                                    </p>
                                )}
                            </div>

                            {/* Negative Exclude Keywords */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Negative Exclude Keywords (Optional)</label>
                                <input type="text" value={excludeText} onChange={e => setExcludeText(e.target.value)}
                                    placeholder="e.g. plant, agriculture, spam, crypto (comma separated)"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                <p className="text-[11px] text-gray-400 mt-1">Filters out irrelevant noise from entering your listening inbox.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                                <div className="flex gap-2">
                                    {['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok'].map(p => (
                                        <button key={p} type="button" onClick={() => togglePlatform(p)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${platforms.includes(p) ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'}`}>
                                            <PlatformIcon platform={p} size={14} />
                                            <span className="capitalize">{p}</span>
                                        </button>
                                    ))}
                                </div>
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

            {/* AI Crisis Response Modal */}
            {crisisModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-rose-50/50">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-rose-600" />
                                <h3 className="text-base font-bold text-gray-900">AI Crisis & De-escalation Response</h3>
                            </div>
                            <button onClick={() => setCrisisModalData(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Customer Post / Mention</p>
                                <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 border border-gray-200 italic">
                                    "{crisisModalData.item.content}"
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Suggested De-escalating Reply</p>
                                {crisisModalData.loading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
                                    </div>
                                ) : (
                                    <textarea
                                        rows={4}
                                        value={crisisModalData.reply}
                                        onChange={e => setCrisisModalData({ ...crisisModalData, reply: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans"
                                    />
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(crisisModalData.reply);
                                        toast.success('Copied to clipboard!');
                                    }}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5">
                                    <Copy className="w-4 h-4" /> Copy Reply
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigate('/studio', {
                                            state: {
                                                initialContent: `@${crisisModalData.item.author_handle || ''} ${crisisModalData.reply}`,
                                                initialPlatform: crisisModalData.item.platform
                                            }
                                        });
                                    }}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-sm">
                                    <Send className="w-4 h-4" /> Open in Studio
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialListening;
