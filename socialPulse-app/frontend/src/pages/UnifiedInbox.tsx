import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, RefreshCw, Loader2, MessageSquare, AtSign, Mail, CheckCircle2, Sparkles, ExternalLink } from 'lucide-react';
import { PlatformIcon } from '../components/common/BrandIcons';
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

const PLATFORM_STYLE: Record<string, { bg: string; text: string }> = {
    twitter:   { bg: 'bg-gray-100', text: 'text-gray-800' },
    instagram: { bg: 'bg-pink-100', text: 'text-pink-700' },
    linkedin:  { bg: 'bg-blue-100', text: 'text-blue-700' },
    facebook:  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    tiktok:    { bg: 'bg-black/5',  text: 'text-black' },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
    mention: <AtSign className="w-3.5 h-3.5" />,
    comment: <MessageSquare className="w-3.5 h-3.5" />,
    dm:      <Mail className="w-3.5 h-3.5" />,
};

export const UnifiedInbox: React.FC = () => {
    const navigate = useNavigate();
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
                <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                    {['all', 'twitter', 'instagram', 'linkedin', 'facebook', 'tiktok'].map(p => (
                        <button key={p} onClick={() => setPlatform(p)}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold transition-all capitalize ${platform === p ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                            {p !== 'all' && <PlatformIcon platform={p} size={14} />}
                            {p === 'all' ? 'All Platforms' : p}
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
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0 overflow-hidden border border-gray-100">
                                    {msg.author_avatar ? (
                                        <img src={msg.author_avatar} alt={msg.author_name || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        msg.author_name?.[0]?.toUpperCase() ?? msg.author_handle?.[0]?.toUpperCase() ?? '?'
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-gray-900">
                                            {msg.author_name ?? msg.author_handle ?? 'Unknown'}
                                        </span>
                                        {msg.author_handle && (
                                            <span className="text-xs text-gray-400">@{msg.author_handle}</span>
                                        )}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 uppercase ${PLATFORM_STYLE[msg.platform]?.bg ?? 'bg-gray-100'} ${PLATFORM_STYLE[msg.platform]?.text ?? 'text-gray-600'}`}>
                                            <PlatformIcon platform={msg.platform} size={12} />
                                            {msg.platform} · {msg.type}
                                        </span>
                                        {!msg.is_read && (
                                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                        )}
                                        <span className="ml-auto text-xs text-gray-400">
                                            {msg.published_at ? new Date(msg.published_at).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-2 leading-relaxed">{msg.content}</p>
                                    
                                    <div className="flex items-center gap-3 mt-4">
                                        {msg.url && (
                                            <a href={msg.url} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
                                                <ExternalLink className="w-3.5 h-3.5" /> View original
                                            </a>
                                        )}
                                        
                                        <button 
                                            onClick={async () => {
                                                const id = toast.loading('Generating magic reply...');
                                                try {
                                                    const { data } = await api.post('/ai/reply', {
                                                        messageContent: msg.content,
                                                        platform: msg.platform
                                                    });
                                                    // Navigate to studio with the draft
                                                    navigate('/studio', { 
                                                        state: { 
                                                            initialContent: data.content,
                                                            initialPlatform: msg.platform
                                                        } 
                                                    });
                                                    toast.success('Reply draft ready!', { id });
                                                } catch {
                                                    toast.error('Failed to generate reply', { id });
                                                }
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                                        >
                                            <Sparkles className="w-3.5 h-3.5" /> Magic Reply
                                        </button>

                                        {!msg.is_read && (
                                            <button onClick={() => handleMarkRead(msg.id)}
                                                className="text-xs font-medium text-gray-400 hover:text-indigo-600 transition-colors ml-auto">
                                                Mark as read
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
