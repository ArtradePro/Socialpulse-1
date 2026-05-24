import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Heart, Eye, PenSquare, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { PlatformIcon } from '../components/common/BrandIcons';

// Daily engagement data is now fetched from the API and stored in dailyData state


interface StatsCardProps {
    title: string;
    value: string;
    change: number;
    icon: React.ReactNode;
    color: string;
    chartData: { value: number }[];
    strokeColor: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon, color, chartData, strokeColor }) => (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[180px]">
        <div>
            <div className='flex items-center justify-between mb-2'>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-opacity-15`}>{icon}</div>
                <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {change >= 0 ? <ArrowUpRight className='w-3.5 h-3.5' /> : <ArrowDownRight className='w-3.5 h-3.5' />}
                    {Math.abs(change)}%
                </div>
            </div>
            <p className="text-2xl font-black text-gray-950 tracking-tight">{value}</p>
            <p className="text-xs font-medium text-gray-400 mt-0.5">{title}</p>
        </div>
        
        {/* Sparkline */}
        <div className="h-10 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData && chartData.length > 0 ? chartData : [{ value: 0 }, { value: 0 }]}>
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={strokeColor} 
                        strokeWidth={2} 
                        dot={false} 
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
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
    const [rawDailyEngagement, setRawDailyEngagement] = useState<any[]>([]);
    const [audienceData, setAudienceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/analytics/dashboard?range=30d');
            
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

            setRawDailyEngagement(data.dailyEngagement || []);
            setAudienceData(data.audienceGrowth || []);

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
            twitter: 'bg-black',
            x: 'bg-black',
            linkedin: 'bg-blue-600',
            facebook: 'bg-indigo-600',
            tiktok: 'bg-black'
        };
        return colors[platform.toLowerCase()] || 'bg-gray-500';
    };

    const statsCards = [
        { 
            title: 'Total Followers', 
            value: stats.totalFollowers, 
            change: stats.followerChange, 
            icon: <Users className="w-5 h-5 text-purple-600" />, 
            color: 'bg-purple-600',
            strokeColor: '#8B5CF6',
            chartData: audienceData.map(d => ({ value: d.total }))
        },
        { 
            title: 'Total Engagement', 
            value: stats.totalEngagement, 
            change: stats.engagementChange, 
            icon: <Heart className="w-5 h-5 text-pink-600" />, 
            color: 'bg-pink-600',
            strokeColor: '#EC4899',
            chartData: rawDailyEngagement.map(d => ({ value: d.likes + d.comments + d.shares }))
        },
        { 
            title: 'Impressions', 
            value: stats.totalImpressions, 
            change: stats.impressionsChange, 
            icon: <Eye className="w-5 h-5 text-blue-600" />, 
            color: 'bg-blue-600',
            strokeColor: '#3B82F6',
            chartData: rawDailyEngagement.map(d => ({ value: d.impressions }))
        },
        { 
            title: 'Posts Published', 
            value: stats.scheduledPosts.toString(), 
            change: stats.scheduledChange, 
            icon: <Calendar className="w-5 h-5 text-orange-600" />, 
            color: 'bg-orange-600',
            strokeColor: '#F59E0B',
            chartData: rawDailyEngagement.map(d => ({ value: d.clicks }))
        },
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
            <div className='relative overflow-hidden bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-8 text-white shadow-xl shadow-purple-200'>
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl" />
                
                <div className='relative flex items-center justify-between'>
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight">Good morning! 👋</h2>
                        <p className="text-purple-100 mt-2 text-lg font-medium">You have 3 posts scheduled for today. Let's make them viral!</p>
                    </div>
                    <button onClick={() => navigate('/studio')} className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                        <PenSquare className="w-5 h-5" /> Create Post
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
                            <div key={item.platform} className='flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors'>
                                <div className={`p-2 rounded-lg ${item.color} bg-opacity-10`}>
                                    <PlatformIcon platform={item.platform} size={20} />
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <div className='flex justify-between items-center'>
                                        <span className='text-sm font-bold text-gray-900 capitalize'>{item.platform}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${parseFloat(item.growth) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.growth}%
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium">{item.followers} followers</span>
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
                                            <div key={p} className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                                <PlatformIcon platform={p} size={14} />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase">{p}</span>
                                            </div>
                                        ))}
                                        <span className="text-[10px] px-2 py-1 rounded-lg font-bold uppercase border border-indigo-100 bg-indigo-50 text-indigo-700">{post.status}</span>
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