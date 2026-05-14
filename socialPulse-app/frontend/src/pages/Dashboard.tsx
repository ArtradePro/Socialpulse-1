import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Heart, Eye, PenSquare, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

// Daily engagement data is now fetched from the API and stored in dailyData state


interface StatsCardProps { title: string; value: string; change: number; icon: React.ReactNode; }

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon }) => (
    <div className={"bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"}>
        <div className='flex items-center justify-between mb-4'>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center">{icon}</div>
            <div className="flex items-center gap-1 text-sm font-medium">
                {change >= 0 ? <ArrowUpRight className='w-4 h-4' /> : <ArrowDownRight className='w-4 h-4' />}
                {Math.abs(change)}%
            </div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{title}</p>
    </div>
);


export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    interface Post {
        id: string;
        content: string;
        platforms?: string[];
        status?: string;
    }
    const [recentPosts, setRecentPosts] = useState<Post[]>([]);
    const [stats, setStats] = useState({
        totalFollowers: '0',
        totalEngagement: '0',
        totalImpressions: '0',
        scheduledPosts: 0,
        followerChange: 0,
        engagementChange: 0,
        impressionsChange: 0,
        scheduledChange: 0
    });
    const [dailyData, setDailyData] = useState<any[]>([]);
    const [platformData, setPlatformData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/api/analytics/dashboard?range=30d');
            
            // Stats from overview
            setStats({
                totalFollowers: formatNumber(data.overview.totalFollowers),
                totalEngagement: formatNumber(data.overview.totalEngagements),
                totalImpressions: formatNumber(data.overview.totalImpressions),
                scheduledPosts: data.overview.postsPublished || 0,
                followerChange: data.overview.followerGrowthPct || 0,
                engagementChange: data.overview.engagementsDelta || 0,
                impressionsChange: data.overview.impressionsDelta || 0,
                scheduledChange: 0
            });

            // Charts data
            setDailyData(data.dailyEngagement.map((d: any) => ({
                day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
                likes: d.likes,
                comments: d.comments,
                shares: d.shares
            })));

            setPlatformData(data.platformBreakdown.map((p: any) => ({
                platform: p.platform,
                followers: formatNumber(p.followers),
                growth: `${p.followerDelta > 0 ? '+' : ''}${p.followerDelta}`,
                color: getPlatformColor(p.platform)
            })));

            // Recent posts
            setRecentPosts(data.allPosts.slice(0, 5));

        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDashboardData(); }, []);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const getPlatformColor = (platform: string) => {
        const colors: Record<string, string> = {
            instagram: 'bg-pink-500',
            twitter: 'bg-sky-500',
            linkedin: 'bg-blue-600',
            facebook: 'bg-indigo-600'
        };
        return colors[platform.toLowerCase()] || 'bg-gray-500';
    };

    const statsCards = [
        { title: 'Total Followers', value: stats.totalFollowers, change: stats.followerChange, icon: <Users className="w-6 h-6 text-purple-600" />, color: 'bg-purple-50' },
        { title: 'Total Engagement', value: stats.totalEngagement, change: stats.engagementChange, icon: <Heart className="w-6 h-6 text-pink-600" />, color: 'bg-pink-50' },
        { title: 'Impressions', value: stats.totalImpressions, change: stats.impressionsChange, icon: <Eye className="w-6 h-6 text-blue-600" />, color: 'bg-blue-50' },
        { title: 'Posts Published', value: stats.scheduledPosts.toString(), change: stats.scheduledChange, icon: <Calendar className="w-6 h-6 text-orange-600" />, color: 'bg-orange-50' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className='space-y-6'>
            <div className='bg-linear-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white'>
                <div className='flex items-center justify-between'>
                    <div>
                        <h2 className="text-2xl font-bold">Good morning! 👋</h2>
                        <p className="text-purple-100 mt-1">You have 3 posts scheduled for today. Make it count!</p>
                    </div>
                    <button onClick={() => navigate('/studio')} className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-colors">
                        <PenSquare className="w-4 h-4" /> Create Post
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map(card => <StatsCard key={card.title} {...card} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement This Week</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={dailyData.length > 0 ? dailyData : [{ day: '', likes: 0, comments: 0, shares: 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="likes" stroke="#7C3AED" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="comments" stroke="#2563EB" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="shares" stroke="#EC4899" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2">
                        {[{ label: 'Likes', color: 'bg-purple-600' }, { label: 'Comments', color: 'bg-blue-600' }, { label: 'Shares', color: 'bg-pink-500' }].map(l => (
                            <div key={l.label} className='flex items-center gap-2'>
                                <div className={`w-3 h-3 rounded-full ${l.color}`} />
                                <span className='text-xs text-gray-500'>{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Breakdown</h3>
                    <div className="space-y-4">
                        {platformData.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-10">No accounts connected</p>
                        ) : platformData.map(item => (
                            <div key={item.platform} className='flex items-center gap-3'>
                                <div className={`w-2 h-10 rounded-full ${item.color}`} />
                                <div className='flex-1'>
                                    <div className='flex justify-between'>
                                        <span className='text-sm font-medium text-gray-900'>{item.platform}</span>
                                        <span className={`text-xs font-medium ${parseFloat(item.growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.growth}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">{item.followers} followers</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
                    <button onClick={() => navigate('/scheduler')} className="text-sm text-purple-600 font-medium hover:underline">View all →</button>
                </div>
                <div className="divide-y divide-gray-50">
                    {recentPosts.length === 0 ? (
                        <div className="p-12 text-center">
                            <PenSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-500">No posts yet. Create your first post!</p>
                            <button onClick={() => navigate('/studio')} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Create Post</button>
                        </div>
                    ) : (
                        recentPosts.map(post => (
                            <div key={post.id} className="flex items-start gap-4 p-4 hover:bg-gray-50">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-800 line-clamp-2">{post.content}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        {(post.platforms || []).map((p: string) => (
                                            <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{p}</span>
                                        ))}
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium">{post.status}</span>
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