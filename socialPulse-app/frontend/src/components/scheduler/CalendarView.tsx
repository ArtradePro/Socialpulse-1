import React, { useState, useEffect, useCallback } from 'react';
import { usePosts } from '../../hooks/usePosts';
import { PlatformIcon } from '../common/BrandIcons';
import { 
    ChevronLeft, 
    ChevronRight, 
    Plus, 
    MoreVertical, 
    Calendar as CalendarIcon,
    Clock,
    Layers,
    X,
    Trash2,
    Eye,
    Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC = () => {
    const { posts, fetchPosts } = usePosts();
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchPosts({ limit: 200 });
    }, [fetchPosts]);

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    
    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    const goToToday = () => setViewDate(new Date());

    const postsByDay: Record<number, any[]> = {};
    posts.forEach(post => {
        if (post.scheduled_at) {
            const d = new Date(post.scheduled_at);
            if (d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth()) {
                const day = d.getDate();
                if (!postsByDay[day]) postsByDay[day] = [];
                postsByDay[day].push(post);
            }
        }
    });

    const monthName = viewDate.toLocaleString('default', { month: 'long' });
    const year = viewDate.getFullYear();

    const cells: (number | null)[] = [
        ...Array(firstDayOfMonth).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ];

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this scheduled post?')) return;
        setIsDeleting(id);
        try {
            await api.delete(`/posts/${id}`);
            toast.success('Post deleted');
            fetchPosts();
        } catch {
            toast.error('Failed to delete post');
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-linear-to-r from-gray-50/50 to-transparent">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-xs">
                        <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">
                        {monthName} <span className="text-indigo-600">{year}</span>
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={goToToday} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors">
                        Today
                    </button>
                    <div className="h-6 w-px bg-gray-200 mx-2" />
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors">
                        <Layers className="w-4 h-4" /> Month
                    </button>
                </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-50">
                {DAYS.map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                    const dayPosts = day ? postsByDay[day] : [];
                    const isToday = day && 
                        day === new Date().getDate() && 
                        viewDate.getMonth() === new Date().getMonth() && 
                        viewDate.getFullYear() === new Date().getFullYear();

                    return (
                        <div 
                            key={i} 
                            onClick={() => day && setSelectedDay(day)}
                            className={`min-h-[120px] p-2 border-r border-b border-gray-50 transition-colors relative group cursor-pointer ${
                                day ? 'hover:bg-indigo-50/30' : 'bg-gray-50/30'
                            }`}
                        >
                            {day && (
                                <>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold ${
                                            isToday ? 'w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200' : 'text-gray-400'
                                        }`}>
                                            {day}
                                        </span>
                                        <Plus className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                                        {dayPosts?.slice(0, 3).map(p => (
                                            <div 
                                                key={p.id} 
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold truncate transition-all ${
                                                    p.status === 'published' 
                                                        ? 'bg-green-50 text-green-700 border-green-100' 
                                                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                }`}
                                            >
                                                <PlatformIcon platform={p.platforms?.[0] || 'post'} size={10} />
                                                <span className="truncate">{p.content}</span>
                                            </div>
                                        ))}
                                        {dayPosts?.length > 3 && (
                                            <div className="text-[9px] font-bold text-indigo-400 pl-1">
                                                + {dayPosts.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Day Detail Modal/Overlay */}
            {selectedDay !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-linear-to-r from-indigo-50 to-white">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">
                                    {monthName} {selectedDay}, {year}
                                </h3>
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mt-1">
                                    {postsByDay[selectedDay]?.length || 0} Scheduled Posts
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedDay(null)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            {(!postsByDay[selectedDay] || postsByDay[selectedDay].length === 0) ? (
                                <div className="text-center py-12">
                                    <CalendarIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-500 font-bold">No posts scheduled for today</p>
                                    <button className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90">
                                        Schedule Post
                                    </button>
                                </div>
                            ) : (
                                postsByDay[selectedDay].map(p => (
                                    <div key={p.id} className="group bg-white border border-gray-100 rounded-2xl p-4 hover:border-indigo-200 hover:shadow-md transition-all">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                                                <PlatformIcon platform={p.platforms?.[0]} size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{p.platforms?.join(', ')}</span>
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(p.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors">
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(p.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-800 leading-relaxed line-clamp-3">
                                                    {p.content}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setSelectedDay(null)}
                                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Close
                            </button>
                            <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90">
                                <Plus className="w-4 h-4" /> New Post
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};