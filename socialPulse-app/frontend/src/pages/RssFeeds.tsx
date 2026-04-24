import React, { useState, useEffect } from 'react';
import { Rss, Plus, Trash2, RefreshCw, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface RssFeed {
    id:              string;
    name:            string;
    url:             string;
    platforms:       string[];
    auto_post:       boolean;
    interval_hours:  number;
    is_active:       boolean;
    last_fetched_at: string | null;
    posted_count:    number;
    total_entries:   number;
}

const ALL_PLATFORMS = ['twitter', 'instagram', 'linkedin', 'facebook'];

export const RssFeeds: React.FC = () => {
    const [feeds,       setFeeds]       = useState<RssFeed[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [showCreate,  setShowCreate]  = useState(false);
    const [fetching,    setFetching]    = useState<string | null>(null);

    // Create form
    const [url,           setUrl]           = useState('');
    const [name,          setName]          = useState('');
    const [platforms,     setPlatforms]     = useState<string[]>(['twitter']);
    const [autoPost,      setAutoPost]      = useState(false);
    const [intervalHours, setIntervalHours] = useState(24);
    const [saving,        setSaving]        = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/rss').then(({ data }) => { if (!cancelled) { setFeeds(data); setLoading(false); } })
            .catch(() => { setLoading(false); toast.error('Failed to load RSS feeds'); });
        return () => { cancelled = true; };
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await api.post('/rss', { url, name: name || undefined, platforms, autoPost, intervalHours });
            setFeeds(prev => [data, ...prev]);
            setShowCreate(false);
            setUrl(''); setName(''); setPlatforms(['twitter']); setAutoPost(false); setIntervalHours(24);
            toast.success('RSS feed added');
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to add feed');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (feed: RssFeed) => {
        try {
            const { data } = await api.patch(`/rss/${feed.id}`, { isActive: !feed.is_active });
            setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, ...data } : f));
        } catch { toast.error('Failed to update feed'); }
    };

    const toggleAutoPost = async (feed: RssFeed) => {
        try {
            const { data } = await api.patch(`/rss/${feed.id}`, { autoPost: !feed.auto_post });
            setFeeds(prev => prev.map(f => f.id === feed.id ? { ...f, ...data } : f));
        } catch { toast.error('Failed to update feed'); }
    };

    const handleFetchNow = async (id: string) => {
        setFetching(id);
        try {
            const { data } = await api.post(`/rss/${id}/fetch`);
            toast.success(data.message);
            const { data: updated } = await api.get('/rss');
            setFeeds(updated);
        } catch { toast.error('Failed to fetch feed'); }
        finally { setFetching(null); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this RSS feed?')) return;
        try {
            await api.delete(`/rss/${id}`);
            setFeeds(prev => prev.filter(f => f.id !== id));
            toast.success('Feed deleted');
        } catch { toast.error('Failed to delete feed'); }
    };

    const togglePlatform = (p: string) =>
        setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">RSS Auto-posting</h1>
                    <p className="text-sm text-gray-500 mt-1">Automatically create posts from RSS / Atom feeds</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> Add Feed
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            ) : feeds.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                    <Rss className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No RSS feeds yet</p>
                    <p className="text-gray-400 text-sm mt-1">Add a feed to auto-generate posts from blog or news sources</p>
                    <button onClick={() => setShowCreate(true)}
                        className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                        Add your first feed
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {feeds.map(feed => (
                        <div key={feed.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Rss className="w-4 h-4 text-orange-500 shrink-0" />
                                        <span className="font-semibold text-gray-900 truncate">{feed.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${feed.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {feed.is_active ? 'active' : 'paused'}
                                        </span>
                                        {feed.auto_post && (
                                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">auto-post</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 truncate">{feed.url}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                                        <span>{feed.posted_count}/{feed.total_entries} entries posted</span>
                                        <span>Every {feed.interval_hours}h</span>
                                        {feed.platforms.length > 0 && <span>{feed.platforms.join(', ')}</span>}
                                        {feed.last_fetched_at && (
                                            <span>Last fetched {new Date(feed.last_fetched_at).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button title="Toggle auto-post" onClick={() => toggleAutoPost(feed)}
                                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                                        {feed.auto_post ? <ToggleRight className="w-5 h-5 text-purple-600" /> : <ToggleLeft className="w-5 h-5" />}
                                    </button>
                                    <button title="Fetch now" onClick={() => handleFetchNow(feed.id)}
                                        disabled={fetching === feed.id}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50">
                                        <RefreshCw className={`w-4 h-4 ${fetching === feed.id ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button title={feed.is_active ? 'Pause' : 'Resume'} onClick={() => toggleActive(feed)}
                                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-xs font-medium px-3">
                                        {feed.is_active ? 'Pause' : 'Resume'}
                                    </button>
                                    <button onClick={() => handleDelete(feed.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Add RSS Feed</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Feed URL *</label>
                                <input required type="url" value={url} onChange={e => setUrl(e.target.value)}
                                    placeholder="https://example.com/feed.xml"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Display name (optional)</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)}
                                    placeholder="Auto-detected from feed"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Platforms</label>
                                <div className="flex gap-2 flex-wrap">
                                    {ALL_PLATFORMS.map(p => (
                                        <button key={p} type="button" onClick={() => togglePlatform(p)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${platforms.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Check every (hours)</label>
                                    <select value={intervalHours} onChange={e => setIntervalHours(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        {[1, 3, 6, 12, 24, 48].map(h => <option key={h} value={h}>{h}h</option>)}
                                    </select>
                                </div>
                                <div className="flex items-end gap-2 pb-0.5">
                                    <label className="text-sm font-medium text-gray-700">Auto-post new entries</label>
                                    <button type="button" onClick={() => setAutoPost(v => !v)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${autoPost ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${autoPost ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Feed
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RssFeeds;
