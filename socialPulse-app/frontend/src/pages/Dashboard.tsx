import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Heart, Eye, PenSquare, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const engagementData = [
    { day: 'Mon', likes: 120, comments: 45, shares: 23 },
    { day: 'Tue', likes: 180, comments: 62, shares: 31 },
    { day: 'Wed', likes: 95, comments: 28, shares: 15 },
    { day: 'Thu', likes: 240, comments: 88, shares: 52 },
    { day: 'Fri', likes: 310, comments: 102, shares: 67 },
    { day: 'Sat', likes: 190, comments: 54, shares: 38 },
    { day: 'Sun', likes: 145, comments: 41, shares: 29 },
];

interface StatsCardProps { title: string; value: string; change: number; icon: React.ReactNode; color: string; }

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon, color }) => (
    <div className={g-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow}>
        <div className='flex items-center justify-between mb-4'>
            <div className={w-12 h-12  rounded-xl flex items-center justify-center}>{icon}</div>
            <div className={lex items-center gap-1 text-sm font-medium }>
                {change >= 0 ? <ArrowUpRight className='w-4 h-4' /> : <ArrowDownRight className='w-4 h-4' />}
                {Math.abs(change)}%
            </div>
        </div>
        <p className='text-2xl font-bold text-gray-900'>{value}</p>
        <p className='text-sm text-gray-500 mt-1'>{title}</p>
    </div>
);

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [recentPosts, setRecentPosts] = useState<any[]>([]);
    const [stats] = useState({ totalFollowers: '24.8K', totalEngagement: '8.4K', totalImpressions: '142K', scheduledPosts: 12 });

    useEffect(() => { fetchRecentPosts(); }, []);

    const fetchRecentPosts = async () => {
        try { const { data } = await api.get('/posts?limit=5'); setRecentPosts(data.posts); }
        catch (error) { console.error('Failed to fetch posts'); }
    };

    const statsCards = [
        { title: 'Total Followers', value: stats.totalFollowers, change: 12.5, icon: <Users className='w-6 h-6 text-purple-600' />, color: 'bg-purple-50' },
        { title: 'Total Engagement', value: stats.totalEngagement, change: 8.2, icon: <Heart className='w-6 h-6 text-pink-600' />, color: 'bg-pink-50' },
        { title: 'Impressions', value: stats.totalImpressions, change: -2.1, icon: <Eye className='w-6 h-6 text-blue-600' />, color: 'bg-blue-50' },
        { title: 'Scheduled Posts', value: stats.scheduledPosts.toString(), change: 24.0, icon: <Calendar className='w-6 h-6 text-orange-600' />, color: 'bg-orange-50' },
    ];

    return (
        <div className='space-y-6'>
            <div className='bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white'>
                <div className='flex items-center justify-between'>
                    <div>
                        <h2 className='text-2xl font-bold'>Good morning! 👋</h2>
                        <p className='text-purple-100 mt-1'>You have 3 posts scheduled for today. Make it count!</p>
                    </div>
                    <button onClick={() => navigate('/studio')} className='flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-colors'>
                        <PenSquare className='w-4 h-4' /> Create Post
                    </button>
                </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {statsCards.map(card => <StatsCard key={card.title} {...card} />)}
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                <div className='lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm'>
                    <h3 className='text-lg font-semibold text-gray-900 mb-4'>Engagement This Week</h3>
                    <ResponsiveContainer width='100%' height={220}>
                        <LineChart data={engagementData}>
                            <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                            <XAxis dataKey='day' tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Line type='monotone' dataKey='likes' stroke='#7C3AED' strokeWidth={2} dot={false} />
                            <Line type='monotone' dataKey='comments' stroke='#2563EB' strokeWidth={2} dot={false} />
                            <Line type='monotone' dataKey='shares' stroke='#EC4899' strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className='flex gap-4 mt-2'>
                        {[{ label: 'Likes', color: 'bg-purple-600' }, { label: 'Comments', color: 'bg-blue-600' }, { label: 'Shares', color: 'bg-pink-500' }].map(l => (
                            <div key={l.label} className='flex items-center gap-2'>
                                <div className={w-3 h-3  rounded-full} />
                                <span className='text-xs text-gray-500'>{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className='bg-white rounded-2xl p-6 border border-gray-100 shadow-sm'>
                    <h3 className='text-lg font-semibold text-gray-900 mb-4'>Platform Breakdown</h3>
                    <div className='space-y-4'>
                        {[
                            { platform: 'Instagram', followers: '12.4K', growth: '+5.2%', color: 'bg-pink-500' },
                            { platform: 'Twitter', followers: '6.8K', growth: '+2.1%', color: 'bg-sky-500' },
                            { platform: 'LinkedIn', followers: '3.6K', growth: '+8.7%', color: 'bg-blue-600' },
                            { platform: 'Facebook', followers: '2.0K', growth: '-0.5%', color: 'bg-indigo-600' },
                        ].map(item => (
                            <div key={item.platform} className='flex items-center gap-3'>
                                <div className={w-2 h-10  rounded-full} />
                                <div className='flex-1'>
                                    <div className='flex justify-between'>
                                        <span className='text-sm font-medium text-gray-900'>{item.platform}</span>
                                        <span className={	ext-xs font-medium }>{item.growth}</span>
                                    </div>
                                    <span className='text-xs text-gray-500'>{item.followers} followers</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl border border-gray-100 shadow-sm'>
                <div className='flex items-center justify-between p-6 border-b border-gray-100'>
                    <h3 className='text-lg font-semibold text-gray-900'>Recent Posts</h3>
                    <button onClick={() => navigate('/scheduler')} className='text-sm text-purple-600 font-medium hover:underline'>View all →</button>
                </div>
                <div className='divide-y divide-gray-50'>
                    {recentPosts.length === 0 ? (
                        <div className='p-12 text-center'>
                            <PenSquare className='w-12 h-12 text-gray-200 mx-auto mb-3' />
                            <p className='text-gray-500'>No posts yet. Create your first post!</p>
                            <button onClick={() => navigate('/studio')} className='mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700'>Create Post</button>
                        </div>
                    ) : (
                        recentPosts.map(post => (
                            <div key={post.id} className='flex items-start gap-4 p-4 hover:bg-gray-50'>
                                <div className='flex-1 min-w-0'>
                                    <p className='text-sm text-gray-800 line-clamp-2'>{post.content}</p>
                                    <div className='flex items-center gap-3 mt-2'>
                                        {post.platforms.map((p: string) => (
                                            <span key={p} className='text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize'>{p}</span>
                                        ))}
                                        <span className={	ext-xs px-2 py-0.5 rounded-full font-medium }>{post.status}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
