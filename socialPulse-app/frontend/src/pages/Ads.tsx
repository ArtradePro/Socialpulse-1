import React, { useState, useEffect } from 'react';
import { 
    Plus, Megaphone, BarChart2, FileText, Trash2, X, Calendar, 
    Loader2, ChevronRight, Wand2, Sparkles, Eye, ShoppingBag, 
    DollarSign, Percent, ExternalLink, Play, Film, User, Volume2, 
    Layers, Settings, ChevronLeft, ArrowRight, Heart, MessageCircle, Share,
    Info
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { adService, AdCampaign, GeneratedVideo } from '../services/adService';
import api from '../services/api';

interface Product {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    image_url: string;
    product_url: string;
}

export const Ads: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'campaigns' | 'video' | 'banner'>('campaigns');
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [videos, setVideos] = useState<GeneratedVideo[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Wizard Modals
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    
    // Video Modal
    const [playingVideo, setPlayingVideo] = useState<GeneratedVideo | null>(null);

    // Wizard Form States
    const [name, setName] = useState('');
    const [objective, setObjective] = useState<'TRAFFIC' | 'LEADS' | 'SALES'>('SALES');
    const [budgetType, setBudgetType] = useState<'DAILY' | 'LIFETIME'>('DAILY');
    const [budgetAmount, setBudgetAmount] = useState('20');
    const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram']);
    const [targetUrl, setTargetUrl] = useState('');
    const [adCopy, setAdCopy] = useState('');
    const [headline, setHeadline] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [productId, setProductId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [generatingCopy, setGeneratingCopy] = useState(false);

    // Video Generator States
    const [videoTitle, setVideoTitle] = useState('');
    const [videoScript, setVideoScript] = useState('');
    const [avatarStyle, setAvatarStyle] = useState('ugc');
    const [voiceStyle, setVoiceStyle] = useState('trendy');
    const [renderingVideo, setRenderingVideo] = useState(false);
    const [renderStep, setRenderStep] = useState(0);

    // Static Ad Creator states
    const [bannerProductId, setBannerProductId] = useState('');
    const [bannerImageUrl, setBannerImageUrl] = useState('');
    const [discountText, setDiscountText] = useState('50% OFF');
    const [promoText, setPromoText] = useState('Limited Time Offer!');
    const [bannerTheme, setBannerTheme] = useState<'modern' | 'neon' | 'glass'>('modern');
    const [generatingBanner, setGeneratingBanner] = useState(false);
    const [generatedBannerUrl, setGeneratedBannerUrl] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const handleGenerateBanner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!discountText.trim() || !promoText.trim()) {
            toast.error('Discount and promo text are required');
            return;
        }
        setGeneratingBanner(true);
        try {
            const { data } = await api.post('/ads/banner', {
                imageUrl: bannerImageUrl || null,
                discountText,
                promoText,
                theme: bannerTheme
            });
            setGeneratedBannerUrl(data.url);
            toast.success('Static ad banner generated and saved to media library!');
        } catch (err) {
            toast.error('Failed to generate ad banner');
        } finally {
            setGeneratingBanner(false);
        }
    };

    const handleLaunchWithBanner = () => {
        resetWizard();
        setMediaUrl(generatedBannerUrl);
        setName(promoText);
        setHeadline(discountText);
        setTargetUrl(window.location.origin + '/s/slug'); // default placeholder
        setWizardStep(3); // skip straight to preview
        setShowWizard(true);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [campsRes, videosRes, productsRes] = await Promise.all([
                adService.getCampaigns(),
                adService.getVideos(),
                api.get('/ecommerce/products').catch(() => ({ data: { products: [] } }))
            ]);
            setCampaigns(campsRes);
            setVideos(videosRes);
            setProducts(productsRes.data?.products || []);
        } catch (err) {
            toast.error('Failed to load paid advertising data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCampaign = async () => {
        if (!name.trim() || !targetUrl.trim() || !budgetAmount) {
            toast.error('Please complete all basic details');
            return;
        }
        setSaving(true);
        try {
            const camp = await adService.createCampaign({
                name,
                objective,
                budget_type: budgetType,
                budget_amount: parseFloat(budgetAmount),
                platforms,
                target_url: targetUrl,
                ad_copy: adCopy,
                media_url: mediaUrl,
                product_id: productId || null,
                start_date: startDate || null,
                end_date: endDate || null
            });

            // Auto-activate for the simulation
            await adService.updateCampaign(camp.id, { status: 'ACTIVE' });
            
            toast.success('Campaign launched on Facebook & Instagram!');
            setShowWizard(false);
            resetWizard();
            await fetchData();
        } catch {
            toast.error('Failed to launch campaign');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateCreative = async () => {
        setGeneratingCopy(true);
        try {
            // Find active product text to feed Gemini
            let prodName = name;
            let prodDesc = '';
            if (productId) {
                const p = products.find(prod => prod.id === productId);
                if (p) {
                    prodName = p.title;
                    prodDesc = p.description;
                }
            }
            const res = await adService.generateAdCreative({
                productName: prodName,
                productDesc: prodDesc,
                objective,
                tone: 'conversion'
            });
            setAdCopy(res.adCopy);
            setHeadline(res.headline);
            toast.success('AI ad copy generated!');
        } catch {
            toast.error('Failed to generate ad copy');
        } finally {
            setGeneratingCopy(false);
        }
    };

    const handleProductSelect = (id: string) => {
        setProductId(id);
        if (!id) return;
        const p = products.find(prod => prod.id === id);
        if (p) {
            setTargetUrl(p.product_url);
            setMediaUrl(p.image_url);
            if (!name) setName(p.title);
        }
    };

    const handleGenerateVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoTitle.trim() || !videoScript.trim()) {
            toast.error('Please fill in title and script');
            return;
        }

        setRenderingVideo(true);
        setRenderStep(1);

        // Visual simulation of rendering steps
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
        
        await delay(1200);
        setRenderStep(2); // Audio Voiceover synthesis
        await delay(1200);
        setRenderStep(3); // Lip-sync avatars
        await delay(1200);
        setRenderStep(4); // Mixing background beats
        await delay(1000);

        try {
            const vid = await adService.generateVideo({
                title: videoTitle,
                script: videoScript,
                avatar_style: avatarStyle,
                voice_style: voiceStyle
            });
            setVideos(prev => [vid, ...prev]);
            toast.success('AI Video rendered and added to library!');
            setVideoTitle('');
            setVideoScript('');
            setRenderingVideo(false);
            setRenderStep(0);
        } catch {
            toast.error('Failed to generate video');
            setRenderingVideo(false);
            setRenderStep(0);
        }
    };

    const handleStatusToggle = async (camp: AdCampaign) => {
        const nextStatus = camp.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
            await adService.updateCampaign(camp.id, { status: nextStatus });
            setCampaigns(prev => prev.map(c => c.id === camp.id ? { ...c, status: nextStatus } : c));
            toast.success(`Campaign ${nextStatus.toLowerCase()}`);
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this paid ad campaign? This will permanently delete budget history.')) return;
        try {
            await adService.deleteCampaign(id);
            setCampaigns(prev => prev.filter(c => c.id !== id));
            toast.success('Campaign deleted');
        } catch {
            toast.error('Failed to delete campaign');
        }
    };

    const resetWizard = () => {
        setName('');
        setObjective('SALES');
        setBudgetType('DAILY');
        setBudgetAmount('20');
        setTargetUrl('');
        setAdCopy('');
        setHeadline('');
        setMediaUrl('');
        setProductId('');
        setStartDate('');
        setEndDate('');
        setWizardStep(1);
    };

    // Aggregate Analytics Metrics
    const totalSpend = campaigns.reduce((acc, c) => acc + parseFloat(c.spend as any), 0);
    const totalImpr = campaigns.reduce((acc, c) => acc + c.impressions, 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
    const totalConv = campaigns.reduce((acc, c) => acc + c.conversions, 0);

    const ctr = totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(2) : '0.00';
    const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
    const cpa = totalConv > 0 ? (totalSpend / totalConv).toFixed(2) : '0.00';

    // Mock chart dataset - Recharts area mapping
    const chartData = [
        { name: 'Mon', Impressions: totalImpr * 0.1, Clicks: totalClicks * 0.1, Spend: totalSpend * 0.1 },
        { name: 'Tue', Impressions: totalImpr * 0.12, Clicks: totalClicks * 0.11, Spend: totalSpend * 0.11 },
        { name: 'Wed', Impressions: totalImpr * 0.18, Clicks: totalClicks * 0.17, Spend: totalSpend * 0.16 },
        { name: 'Thu', Impressions: totalImpr * 0.22, Clicks: totalClicks * 0.21, Spend: totalSpend * 0.21 },
        { name: 'Fri', Impressions: totalImpr * 0.25, Clicks: totalClicks * 0.26, Spend: totalSpend * 0.26 },
        { name: 'Sat', Impressions: totalImpr * 0.14, Clicks: totalClicks * 0.15, Spend: totalSpend * 0.16 },
        { name: 'Sun', Impressions: totalImpr * 0.16, Clicks: totalClicks * 0.18, Spend: totalSpend * 0.18 },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6 select-none">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Paid Ad Manager</h1>
                    <p className="text-sm text-gray-500 mt-1">Automate customer acquisition on Meta (Zeely-style)</p>
                </div>
                <button
                    onClick={() => { resetWizard(); setShowWizard(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-95 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all"
                >
                    <Plus className="w-4 h-4" /> Create Ad Campaign
                </button>
            </div>

            {/* Stats Summary Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Ad Budget Spend', value: `$${totalSpend.toFixed(2)}`, icon: DollarSign, color: 'text-indigo-500 bg-indigo-50' },
                    { label: 'Impressions', value: totalImpr.toLocaleString(), icon: Eye, color: 'text-blue-500 bg-blue-50' },
                    { label: 'Clicks (CTR)', value: `${totalClicks.toLocaleString()} (${ctr}%)`, icon: Percent, color: 'text-violet-500 bg-violet-50' },
                    { label: 'Conversions (CPA)', value: `${totalConv.toLocaleString()} ($${cpa})`, icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-50' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white p-5 rounded-2xl border border-gray-200 flex items-center justify-between shadow-xs">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{stat.label}</p>
                            <p className="text-lg font-black text-gray-800 mt-1">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Recharts Performance Visualizer */}
            {campaigns.some(c => c.status === 'ACTIVE') && (
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">Campaign Performance Trend (Last 7 Days)</h2>
                        <p className="text-xs text-gray-400">Showing ad budget allocation versus consumer clicks</p>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} />
                                <Tooltip />
                                <Area type="monotone" dataKey="Spend" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpend)" />
                                <Area type="monotone" dataKey="Clicks" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClicks)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all ${
                        activeTab === 'campaigns'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Ad Campaigns ({campaigns.length})
                </button>
                <button
                    onClick={() => setActiveTab('video')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all ${
                        activeTab === 'video'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    AI Talking Avatars ({videos.length})
                </button>
                <button
                    onClick={() => setActiveTab('banner')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all ${
                        activeTab === 'banner'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Static Ad Creator
                </button>
            </div>

            {/* Tab Contents */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : activeTab === 'campaigns' ? (
                campaigns.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                        <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No paid ad campaigns yet</p>
                        <p className="text-gray-400 text-sm mt-1">Set up Meta ad parameters and launch automatically</p>
                        <button
                            onClick={() => { resetWizard(); setShowWizard(true); }}
                            className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                        >
                            Create first campaign
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {campaigns.map(camp => (
                            <div
                                key={camp.id}
                                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {camp.media_url ? (
                                            <img src={camp.media_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Megaphone className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-base font-bold text-gray-900 truncate">{camp.name}</h2>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                                camp.status === 'ACTIVE' 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                    : 'bg-gray-50 text-gray-500 border-gray-150'
                                            }`}>
                                                {camp.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 truncate max-w-lg">{camp.target_url}</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 font-medium flex-wrap">
                                            <span className="text-indigo-600 font-bold">{camp.objective}</span>
                                            <span>•</span>
                                            <span>Spent: ${parseFloat(camp.spend as any).toFixed(2)} / ${camp.budget_amount} ({camp.budget_type})</span>
                                            <span>•</span>
                                            <span>{camp.impressions} Views</span>
                                            <span>•</span>
                                            <span>{camp.clicks} Clicks</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 self-end md:self-center">
                                    <button
                                        onClick={() => handleStatusToggle(camp)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                            camp.status === 'ACTIVE' 
                                                ? 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200' 
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
                                        }`}
                                    >
                                        {camp.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={e => handleDeleteCampaign(camp.id, e)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'video' ? (
                /* AI Avatar Video Generator Panel */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left: Script Maker & Options */}
                    <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2">
                            <Film className="w-5 h-5 text-indigo-500" />
                            <h2 className="text-sm font-bold text-gray-900 animate-pulse">Render AI Avatar Video</h2>
                        </div>
                        
                        <form onSubmit={handleGenerateVideo} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Video Title *</label>
                                <input
                                    required
                                    type="text"
                                    value={videoTitle}
                                    onChange={e => setVideoTitle(e.target.value)}
                                    placeholder="e.g. UGC TikTok Ad Copy"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Spoken Script *</label>
                                <textarea
                                    required
                                    value={videoScript}
                                    onChange={e => setVideoScript(e.target.value)}
                                    rows={4}
                                    placeholder="Write what the avatar should say..."
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            {/* Presets styling */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Avatar Persona</label>
                                    <select
                                        value={avatarStyle}
                                        onChange={e => setAvatarStyle(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="ugc">Sarah (UGC Creator)</option>
                                        <option value="founder">David (Tech Founder)</option>
                                        <option value="professional">Mark (Formal Executive)</option>
                                        <option value="cheerful">Emily (Energetic Friend)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Voice Tone</label>
                                    <select
                                        value={voiceStyle}
                                        onChange={e => setVoiceStyle(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="trendy">Trendy UGC</option>
                                        <option value="professional">Corporate Male</option>
                                        <option value="warm">Warm Female</option>
                                        <option value="friendly">Friendly Conversational</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={renderingVideo}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
                            >
                                {renderingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                                {renderingVideo ? 'Generating Video...' : 'Render AI Video'}
                            </button>
                        </form>

                        {/* Rendering Loader Animation Steps */}
                        {renderingVideo && (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-3 mt-4">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Video Processing Queue</p>
                                <div className="space-y-2 text-xs font-bold text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${renderStep >= 1 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                                        <span className={renderStep === 1 ? 'text-indigo-600 animate-pulse' : ''}>Analyzing script keywords...</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${renderStep >= 2 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                                        <span className={renderStep === 2 ? 'text-indigo-600 animate-pulse' : ''}>Synthesizing natural voiceover...</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${renderStep >= 3 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                                        <span className={renderStep === 3 ? 'text-indigo-600 animate-pulse' : ''}>Syncing avatar lip movements...</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${renderStep >= 4 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                                        <span className={renderStep === 4 ? 'text-indigo-600 animate-pulse' : ''}>Mixing background audio beats...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Rendered Video Gallery */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-center gap-2">
                            <Film className="w-5 h-5 text-gray-400" />
                            <h2 className="text-sm font-bold text-gray-900">Your Video Assets Library</h2>
                        </div>

                        {videos.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
                                <Film className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                                <p className="text-gray-500 font-medium">No videos generated yet</p>
                                <p className="text-gray-400 text-xs mt-1">Use the panel on the left to write scripts and render custom ad videos</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {videos.map(vid => (
                                    <div
                                        key={vid.id}
                                        onClick={() => setPlayingVideo(vid)}
                                        className="bg-white border border-gray-200 rounded-3xl overflow-hidden hover:border-indigo-300 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                                    >
                                        <div className="p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-gray-900 truncate max-w-[150px]">{vid.title}</h3>
                                                <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md">
                                                    {vid.avatar_style}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">"{vid.script}"</p>
                                        </div>
                                        
                                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                                <Volume2 className="w-3.5 h-3.5" />
                                                {vid.voice_style}
                                            </span>
                                            <button className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                                                <Play className="w-3 h-3 fill-indigo-600" /> Play Ad
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Static Banner Creator Panel */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Panel: Settings Form */}
                    <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-500" />
                            <h2 className="text-sm font-bold text-gray-900">Generate Ad Banner</h2>
                        </div>
                        
                        <form onSubmit={handleGenerateBanner} className="space-y-4">
                            {products.length > 0 && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                        Import Product Image
                                    </label>
                                    <select
                                        value={bannerProductId}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setBannerProductId(val);
                                            if (val) {
                                                const p = products.find(prod => prod.id === val);
                                                if (p) {
                                                    setBannerImageUrl(p.image_url);
                                                    setPromoText(p.title);
                                                }
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="">-- Enter URL manually --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Product Image URL</label>
                                <input
                                    type="text"
                                    value={bannerImageUrl}
                                    onChange={e => setBannerImageUrl(e.target.value)}
                                    placeholder="https://example.com/product.jpg"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Discount Badge Text</label>
                                    <input
                                        required
                                        type="text"
                                        value={discountText}
                                        onChange={e => setDiscountText(e.target.value)}
                                        placeholder="e.g. 50% OFF"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Creative Theme</label>
                                    <select
                                        value={bannerTheme}
                                        onChange={e => setBannerTheme(e.target.value as any)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="modern">Modern Minimalist</option>
                                        <option value="neon">Neon Cyberpunk</option>
                                        <option value="glass">Frosted Glassmorphism</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Promo Headline Text</label>
                                <input
                                    required
                                    type="text"
                                    value={promoText}
                                    onChange={e => setPromoText(e.target.value)}
                                    placeholder="e.g. Limited Summer Offer!"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={generatingBanner}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
                            >
                                {generatingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                                {generatingBanner ? 'Compositing Banner...' : 'Generate Ad Banner'}
                            </button>
                        </form>
                    </div>

                    {/* Right Panel: Output & Actions */}
                    <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs flex flex-col items-center justify-center min-h-[480px]">
                        {generatedBannerUrl ? (
                            <div className="w-full space-y-6 flex flex-col items-center">
                                <div className="border border-gray-200 rounded-2xl overflow-hidden max-w-sm shadow-md">
                                    <img src={generatedBannerUrl} alt="Generated Ad Banner" className="w-full h-auto object-cover aspect-square" />
                                </div>
                                <div className="flex gap-4 w-full max-w-sm">
                                    <button
                                        onClick={handleLaunchWithBanner}
                                        className="flex-1 py-2.5 bg-linear-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md shadow-indigo-600/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Megaphone className="w-4 h-4" /> Launch Campaign
                                    </button>
                                    <a
                                        href={generatedBannerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 py-2.5 border border-gray-250 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-4 h-4" /> Download PNG
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-8">
                                <Layers className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                                <p className="text-gray-500 font-bold text-sm">Configure ad details on the left</p>
                                <p className="text-gray-450 text-xs mt-1 leading-normal max-w-xs mx-auto">
                                    Our composition pipeline will fetch your product image, crop it, overlay solid/neon borders, add sticker discount badges, and inject bold text banners automatically.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Campaign Creator Wizard Dialog */}
            {showWizard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-150">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paid Ad Wizard</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Step {wizardStep} of 4</p>
                            </div>
                            <button onClick={() => setShowWizard(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Step content container */}
                        <div className="flex-1 overflow-y-auto p-6">
                            
                            {/* Step 1: Basics & Budget */}
                            {wizardStep === 1 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Campaign Name *</label>
                                            <input
                                                required
                                                type="text"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                placeholder="e.g. Shopify Wallet Ads"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Campaign Objective</label>
                                            <select
                                                value={objective}
                                                onChange={e => setObjective(e.target.value as any)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                            >
                                                <option value="SALES">Conversions & Sales (ROI-focused)</option>
                                                <option value="LEADS">Lead Generation (Submit forms)</option>
                                                <option value="TRAFFIC">Link Clicks & Traffic</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Budget Type</label>
                                            <select
                                                value={budgetType}
                                                onChange={e => setBudgetType(e.target.value as any)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                            >
                                                <option value="DAILY">Daily Budget Limit</option>
                                                <option value="LIFETIME">Lifetime Campaign Limit</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Budget Amount (USD) *</label>
                                            <input
                                                required
                                                type="number"
                                                value={budgetAmount}
                                                onChange={e => setBudgetAmount(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-4">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Publishing Networks</label>
                                        <div className="flex gap-4 text-xs font-bold">
                                            {['facebook', 'instagram'].map(plat => (
                                                <label key={plat} className="flex items-center gap-2 uppercase">
                                                    <input
                                                        type="checkbox"
                                                        checked={platforms.includes(plat)}
                                                        onChange={e => {
                                                            if (e.target.checked) setPlatforms([...platforms, plat]);
                                                            else setPlatforms(platforms.filter(p => p !== plat));
                                                        }}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                                    />
                                                    {plat}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Product Catalog autofills */}
                            {wizardStep === 2 && (
                                <div className="space-y-4">
                                    {products.length > 0 ? (
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                                Link to store product listing (autofills media & URL)
                                            </label>
                                            <select
                                                value={productId}
                                                onChange={e => handleProductSelect(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                            >
                                                <option value="">-- Enter URL manually instead --</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-amber-50 text-amber-700 text-xs border border-amber-200 rounded-xl flex items-center gap-2">
                                            <Info className="w-4 h-4 shrink-0" />
                                            <span>No connected e-commerce products. You can enter the target links manually below.</span>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Target Destination URL *</label>
                                        <input
                                            required
                                            type="text"
                                            value={targetUrl}
                                            onChange={e => setTargetUrl(e.target.value)}
                                            placeholder="e.g. https://usesocialpulse.com/s/leather-wallet"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Creative Image or Video URL</label>
                                        <input
                                            type="text"
                                            value={mediaUrl}
                                            onChange={e => setMediaUrl(e.target.value)}
                                            placeholder="https://example.com/ad-image.jpg"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                        />
                                    </div>
                                    
                                    {videos.length > 0 && (
                                        <div className="border-t border-gray-100 pt-3">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                                Or pick an AI Avatar Video from your library
                                            </label>
                                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                                {videos.map(v => (
                                                    <button
                                                        key={v.id}
                                                        type="button"
                                                        onClick={() => setMediaUrl(v.video_url)}
                                                        className={`p-3 border rounded-xl text-left text-xs font-bold ${
                                                            mediaUrl === v.video_url 
                                                                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' 
                                                                : 'border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <p className="truncate">{v.title}</p>
                                                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">{v.avatar_style} style</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: AI Copywriting & Preview Setup */}
                            {wizardStep === 3 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Ad Creative Copy</label>
                                        <button
                                            type="button"
                                            onClick={handleGenerateCreative}
                                            disabled={generatingCopy}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                        >
                                            {generatingCopy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                            Generate with Gemini AI
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Primary Ad Copy Text *</label>
                                        <textarea
                                            required
                                            value={adCopy}
                                            onChange={e => setAdCopy(e.target.value)}
                                            rows={4}
                                            placeholder="Write hook benefit bullets, and call-to-action copy..."
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none resize-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Ad Short Headline *</label>
                                        <input
                                            required
                                            type="text"
                                            value={headline}
                                            onChange={e => setHeadline(e.target.value)}
                                            placeholder="e.g. RFID Protected Wallet - Slim and Durable"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 4: High-Fidelity Meta Feed Preview */}
                            {wizardStep === 4 && (
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Meta Sponsored Ad Feed Preview</label>
                                        
                                        {/* Mock Mobile Post Card */}
                                        <div className="bg-white border border-gray-200 shadow-md max-w-sm mx-auto rounded-xl overflow-hidden font-sans text-gray-800">
                                            {/* Header */}
                                            <div className="flex items-center gap-2.5 p-3">
                                                <div className="w-9 h-9 rounded-full bg-linear-to-br from-[#0C8CE9] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-black">
                                                    SP
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                                                        SocialPulse Workspace
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 font-semibold flex items-center gap-0.5 mt-0.5">
                                                        Sponsored • 🌐
                                                    </p>
                                                </div>
                                                <button type="button" className="ml-auto text-gray-400">•••</button>
                                            </div>

                                            {/* Ad primary text copy */}
                                            <div className="px-3 pb-2 text-xs leading-relaxed">
                                                {adCopy || 'Write compelling ad copy in step 3 to preview your Facebook/Instagram sponsored post details...'}
                                            </div>

                                            {/* Ad media */}
                                            <div className="relative aspect-video bg-gray-50 flex items-center justify-center border-y border-gray-100 overflow-hidden">
                                                {mediaUrl ? (
                                                    mediaUrl.endsWith('.mp4') ? (
                                                        <video src={mediaUrl} className="w-full h-full object-cover" muted autoPlay loop />
                                                    ) : (
                                                        <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                                    )
                                                ) : (
                                                    <Megaphone className="w-10 h-10 text-gray-300" />
                                                )}
                                            </div>

                                            {/* Footer metadata card */}
                                            <div className="p-3 bg-[#F2F3F5] flex items-center justify-between border-t border-gray-100">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">usesocialpulse.com</p>
                                                    <p className="text-xs font-bold text-gray-900 truncate mt-0.5">{headline || 'Ad Short Headline'}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="px-3 py-1.5 bg-gray-200 border border-gray-300 hover:bg-gray-300 rounded-md text-[10px] font-black uppercase text-gray-700 tracking-wider flex-shrink-0"
                                                >
                                                    Shop Now
                                                </button>
                                            </div>

                                            {/* Social Bar */}
                                            <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> Like</span>
                                                <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> Comment</span>
                                                <span className="flex items-center gap-1"><Share className="w-3.5 h-3.5" /> Share</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer Buttons */}
                        <div className="p-5 border-t border-gray-150 flex items-center justify-between gap-3 bg-gray-50">
                            {wizardStep > 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setWizardStep(wizardStep - 1)}
                                    className="flex items-center gap-1 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Back
                                </button>
                            ) : (
                                <div />
                            )}
                            
                            {wizardStep < 4 ? (
                                <button
                                    type="button"
                                    onClick={() => setWizardStep(wizardStep + 1)}
                                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                                >
                                    Next <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleCreateCampaign}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/10 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                                    Launch Campaign
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* Video Player Modal */}
            {playingVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-150">
                            <h2 className="text-sm font-bold text-gray-900">{playingVideo.title}</h2>
                            <button onClick={() => setPlayingVideo(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="relative aspect-video bg-black flex items-center justify-center">
                            <video
                                src={playingVideo.video_url}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-1 text-xs">
                            <p className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Spoken script:</p>
                            <p className="text-gray-700 italic leading-relaxed font-semibold">"{playingVideo.script}"</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Ads;
