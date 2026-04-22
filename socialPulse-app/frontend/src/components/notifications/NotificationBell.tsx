// frontend/src/components/notifications/NotificationBell.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface Notification {
    id:         string;
    type:       string;
    title:      string;
    message:    string | null;
    link:       string | null;
    read:       boolean;
    created_at: string;
}

const TYPE_ICON: Record<string, string> = {
    post_published:  '✅',
    post_failed:     '❌',
    ai_credits_low:  '⚡',
    storage_near_limit: '💾',
    trial_ending:    '⏰',
    team_invite:     '👥',
    payment_failed:  '💳',
};

export const NotificationBell: React.FC = () => {
    const [open,         setOpen]         = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount,  setUnreadCount]  = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await api.get('/notifications?limit=15');
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch {
            // ignore — user may not be authenticated yet
        }
    }, []);

    // Fetch on mount and every 30 s
    useEffect(() => {
        fetchNotifications();
        const id = setInterval(fetchNotifications, 30_000);
        return () => clearInterval(id);
    }, [fetchNotifications]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markRead = async (id: string) => {
        await api.patch(`/notifications/${id}/read`).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllRead = async () => {
        await api.patch('/notifications/read-all').catch(() => {});
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const dismiss = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await api.delete(`/notifications/${id}`).catch(() => {});
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnreadCount(prev => {
            const was = notifications.find(n => n.id === id);
            return was && !was.read ? Math.max(0, prev - 1) : prev;
        });
    };

    const handleClick = (n: Notification) => {
        if (!n.read) markRead(n.id);
        if (n.link) {
            if (n.link.startsWith('/')) navigate(n.link);
            else window.open(n.link, '_blank', 'noopener,noreferrer');
        }
        setOpen(false);
    };

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60_000);
        if (mins < 1)  return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(v => !v)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 top-11 z-50 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {notifications.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 text-sm">
                                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => handleClick(n)}
                                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${!n.read ? 'bg-indigo-50/50' : ''}`}
                                >
                                    <span className="text-lg mt-0.5 shrink-0">
                                        {TYPE_ICON[n.type] ?? '🔔'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'} truncate`}>
                                            {n.title}
                                        </p>
                                        {n.message && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        {n.link && <ExternalLink className="w-3 h-3 text-gray-300" />}
                                        <button
                                            onClick={e => dismiss(e, n.id)}
                                            className="p-0.5 rounded hover:bg-gray-200 text-gray-300 hover:text-gray-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-gray-100 text-center">
                        <button
                            onClick={() => { setOpen(false); navigate('/settings?tab=notifications'); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            Notification settings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
