import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, RefreshCw, Loader2, MessageSquare, AtSign, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Message {
    id:            string;
    platform:      string;
    type:          string;
    external_id:   string;
    author_name:   string | null;
    author_handle: string | null;
    author_avatar: string | null;
    content:       string | null;
    url:           string | null;
    is_read:       boolean;
    published_at:  string | null;
    created_at:    string;
}

const PLATFORM_COLORS: Record<string, string> = {
    twitter:   'bg-sky-100 text-sky-700',
    instagram: 'bg-pink-100 text-pink-700',
    linkedin:  'bg-blue-100 text-blue-700',
    facebook:  'bg-indigo-100 text-indigo-700',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
    mention: <AtSign className="w-3.5 h-3.5" />,
    comment: <MessageSquare className="w-3.5 h-3.5" />,
    dm:      <Mail className="w-3.5 h-3.5" />,
};

export const UnifiedInbox: React.FC = () => {
    const [messages,    setMessages]    = useState<Message[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading,     setLoading]     = useState(true);
    const [syncing,     setSyncing]     = useState(false);
    const [filter,      setFilter]      = useState<'all' | 'unread'>('all');
    const [platform,    setPlatform]    = useState<string>('all');

    const load = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filter === 'unread') params.set('unread', 'true');
            if (platform !== 'all')  params.set('platform', platform);
            const { data } = await api.get(`/inbox?${params}`);
            setMessages(data.messages);
            setUnreadCount(data.unreadCount);
        } catch { toast.error('Failed to load inbox'); }
        finally { setLoading(false); }
    }, [filter, platform]);

    useEffect(() => { load(); }, [load]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const { data } = await api.post('/inbox/sync');
            toast.success(data.message);
            await load();
        } catch { toast.error('Sync failed'); }
        finally { setSyncing(false); }
    };

    const handleMarkRead = async (id: string) => {
        try {
            await api.patch(`/inbox/${id}/read`);
            setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
            setUnreadCount(c => Math.max(0, c - 1));
        } catch { toast.error('Failed to mark as read'); }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.patch('/inbox/read-all');
            setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
            setUnreadCount(0);
        } catch { toast.error('Failed to mark all as read'); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Unified Inbox
                        {unreadCount > 0 && (
                            <span className="text-sm bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">{unreadCount}</span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Mentions and comments from your connected accounts</p>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead}
                            className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium transition-colors">
                            Mark all read
                        </button>
                    )}
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing…' : 'Sync now'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
                    {(['all', 'unread'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                            {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                        </button>
                    ))}
                </div>
                <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
                    {['all', 'twitter', 'instagram', 'linkedin', 'facebook'].map(p => (
                        <button key={p} onClick={() => setPlatform(p)}
                            className={`px-3 py-2 text-sm font-medium transition-colors capitalize ${platform === p ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                            {p === 'all' ? 'All' : p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            ) : messages.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                    <Inbox className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">
                        {filter === 'unread' ? 'No unread messages' : 'Your inbox is empty'}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">Click Sync now to fetch the latest mentions</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {messages.map(msg => (
                        <div key={msg.id}
                            className={`bg-white rounded-xl border p-4 transition-colors ${msg.is_read ? 'border-gray-200' : 'border-indigo-200 bg-indigo-50/30'}`}>
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                                    {msg.author_name?.[0]?.toUpperCase() ?? msg.author_handle?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-gray-900">
                                            {msg.author_name ?? msg.author_handle ?? 'Unknown'}
                                        </span>
                                        {msg.author_handle && (
                                            <span className="text-xs text-gray-400">@{msg.author_handle}</span>
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${PLATFORM_COLORS[msg.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                                            {TYPE_ICON[msg.type]} {msg.type}
                                        </span>
                                        {!msg.is_read && (
                                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                        )}
                                        <span className="ml-auto text-xs text-gray-400">
                                            {msg.published_at ? new Date(msg.published_at).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-1.5 line-clamp-3">{msg.content}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        {msg.url && (
                                            <a href={msg.url} target="_blank" rel="noopener noreferrer"
                                                className="text-xs text-indigo-600 hover:underline">View original →</a>
                                        )}
                                        {!msg.is_read && (
                                            <button onClick={() => handleMarkRead(msg.id)}
                                                className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
                                                Mark read
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UnifiedInbox;
