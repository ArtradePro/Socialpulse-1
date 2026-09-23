import React, { useState, useEffect } from 'react';
import { 
    Plus, Megaphone, BarChart2, FileText, Trash2, X, Calendar, 
    Loader2, ChevronRight, Wand2, Sparkles, Eye, ShoppingBag, 
    DollarSign, Percent, ExternalLink, Play, Film, User, Volume2, 
    Layers, Settings, ChevronLeft, ArrowRight, Heart, MessageCircle, Share,
    Info, Check, Copy, Download, RefreshCw, ShieldCheck, Star, Award, Zap, ArrowUpRight,
    Pause, VolumeX, Smartphone, Music, Disc3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { 
    adService, 
    AdCampaign, 
    GeneratedVideo, 
    GeneratedCampaignResult, 
    BatchBannerResponse, 
    UGCScriptScene, 
    DirectResponseAdConcept 
} from '../services/adService';
import api from '../services/api';
import { storefrontService } from '../services/storefrontService';

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
    const [activeTab, setActiveTab] = useState<'magic-url' | 'campaigns' | 'video' | 'banner'>('magic-url');
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [videos, setVideos] = useState<GeneratedVideo[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Zeely Magic URL-to-Campaign States
    const [magicUrl, setMagicUrl] = useState('https://fungusnomore.co.za');
    const [generatingCampaign, setGeneratingCampaign] = useState(false);
    const [campaignResult, setCampaignResult] = useState<GeneratedCampaignResult | null>(null);
    const [batchBanners, setBatchBanners] = useState<BatchBannerResponse['banners']>([]);
    const [generatingBatch, setGeneratingBatch] = useState(false);
    const [selectedScriptIdx, setSelectedScriptIdx] = useState(0);
    const [selectedCopyPlatform, setSelectedCopyPlatform] = useState('tiktok');
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [autoGenBanners, setAutoGenBanners] = useState(true);
    const [generatingStorefront, setGeneratingStorefront] = useState(false);
    const [generatedStorefrontSlug, setGeneratedStorefrontSlug] = useState<string | null>(null);

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
    const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram', 'tiktok']);
    const [targetUrl, setTargetUrl] = useState('');
    const [adCopy, setAdCopy] = useState('');
    const [headline, setHeadline] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [productId, setProductId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [generatingCopy, setGeneratingCopy] = useState(false);

    // Video Generator States (Zeely 9:16 UGC Studio)
    const [videoTitle, setVideoTitle] = useState('Fungus No More™ Dual Action — Viral Gym Hook');
    const [videoScript, setVideoScript] = useState('If you shower in a gym or public locker room, standard body wash is not protecting your skin. I started using Fungus No More™ Dual Action and it completely eliminated stubborn irritation. Love The Skin You\'re In.');
    const [avatarStyle, setAvatarStyle] = useState<'ugc_female' | 'ugc_male' | 'skincare_expert' | 'founder'>('ugc_female');
    const [voiceStyle, setVoiceStyle] = useState<'en-ZA' | 'en-US' | 'en-GB'>('en-ZA');
    const [subtitleStyle, setSubtitleStyle] = useState<'pop_yellow' | 'neon_cyan' | 'clean_white'>('pop_yellow');
    const [backgroundBeat, setBackgroundBeat] = useState<'trendy_lofi' | 'viral_bounce' | 'lab_clean'>('viral_bounce');
    const [emphasisWord, setEmphasisWord] = useState('STOP');
    const [renderingVideo, setRenderingVideo] = useState(false);
    const [renderStep, setRenderStep] = useState(0);
    const [simPlaying, setSimPlaying] = useState(true);
    const [simMuted, setSimMuted] = useState(true);

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
        if (bannerImageUrl) {
            const urlLower = bannerImageUrl.toLowerCase().trim();
            const isWebpage = urlLower.includes('takealot.com/') || 
                              urlLower.includes('amazon.com/') || 
                              urlLower.includes('ebay.com/') || 
                              urlLower.includes('search') || 
                              urlLower.endsWith('.html') ||
                              urlLower.endsWith('.htm');
            
            const hasImageExtension = /\.(jpg|jpeg|png|webp|gif|svg|bmp)/.test(urlLower);
            const hasImagePathKeyword = /(image|img|upload|assets|media|pic)/.test(urlLower);
            
            if (isWebpage || (!hasImageExtension && !hasImagePathKeyword)) {
                toast.error('Please enter a direct link to an image file (e.g. ending in .jpg, .png) rather than a webpage URL.', {
                    duration: 6000
                });
                return;
            }
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

    const copyToClipboard = async (text: string, fieldId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldId);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopiedField(null), 2000);
        } catch {
            toast.error('Failed to copy to clipboard');
        }
    };

    const handleUrlToCampaign = async (e?: React.FormEvent, customUrl?: string) => {
        if (e) e.preventDefault();
        const urlToUse = customUrl || magicUrl;
        if (!urlToUse.trim()) {
            toast.error('Please enter a valid product URL');
            return;
        }
        setGeneratingCampaign(true);
        try {
            const result = await adService.urlToCampaign(urlToUse.trim());
            setCampaignResult(result);
            toast.success('Extracted product metadata & generated AI campaign assets!');

            if (autoGenBanners) {
                setGeneratingBatch(true);
                try {
                    const headline = result.adConcepts[0]?.headline || 'Dual-Action Antifungal Defense';
                    const subheadline = result.adConcepts[0]?.subheadline || 'Love The Skin You\'re In';
                    const priceText = result.product.price ? `${result.product.currency || 'R'}${result.product.price}` : undefined;
                    
                    const batch = await adService.generateBannerBatch({
                        imageUrl: result.product.imageUrl,
                        productTitle: result.product.title,
                        headline,
                        subheadline,
                        priceText,
                        isFNM: result.product.isFNM
                    });
                    setBatchBanners(batch.banners);
                    toast.success(`Generated ${batch.count} direct-response ad banners!`);
                } catch (bErr) {
                    console.error('Batch banner generation error:', bErr);
                    toast.error('Campaign generated, but banner generation failed');
                } finally {
                    setGeneratingBatch(false);
                }
            }
        } catch (err: any) {
            console.error('URL-to-campaign error:', err);
            toast.error(err.response?.data?.message || 'Failed to generate campaign from URL');
        } finally {
            setGeneratingCampaign(false);
        }
    };

    const handleGenerateBatchOnly = async () => {
        if (!campaignResult) return;
        setGeneratingBatch(true);
        try {
            const headline = campaignResult.adConcepts[0]?.headline || 'Dual-Action Antifungal Defense';
            const subheadline = campaignResult.adConcepts[0]?.subheadline || 'Love The Skin You\'re In';
            const priceText = campaignResult.product.price ? `${campaignResult.product.currency || 'R'}${campaignResult.product.price}` : undefined;

            const batch = await adService.generateBannerBatch({
                imageUrl: campaignResult.product.imageUrl,
                productTitle: campaignResult.product.title,
                headline,
                subheadline,
                priceText,
                isFNM: campaignResult.product.isFNM
            });
            setBatchBanners(batch.banners);
            toast.success(`Re-generated ${batch.count} direct-response ad banners!`);
        } catch (err) {
            console.error('Batch banner regeneration error:', err);
            toast.error('Failed to regenerate banners');
        } finally {
            setGeneratingBatch(false);
        }
    };

    const handleUseBannerInCampaign = (bannerUrl: string, bannerTitle?: string) => {
        resetWizard();
        setMediaUrl(bannerUrl);
        setName(bannerTitle || campaignResult?.product.title || 'Product Ad Campaign');
        setHeadline(campaignResult?.adConcepts[0]?.headline || 'Special Offer');
        setTargetUrl(campaignResult?.product.url || targetUrl || window.location.origin);
        if (campaignResult?.socialCopy?.[0]?.body) {
            setAdCopy(campaignResult.socialCopy[0].body);
        }
        setWizardStep(3); // skip straight to preview & adjust
        setShowWizard(true);
    };

    const handleCreateStorefrontFromCampaign = async () => {
        if (!campaignResult) return;
        setGeneratingStorefront(true);
        try {
            const prod = campaignResult.product;
            const concept = campaignResult.adConcepts[0];
            const newPage = await storefrontService.createPage({
                title: prod.title || 'Fungus No More™ Dual Action Defense',
                headline: concept?.headline || 'Eliminate Stubborn Fungus in 10 Days',
                description: prod.description || 'Clinical botanical defense against stubborn skin and nail fungal infections. Fast absorbing, soothing relief. Formulated by Higiene (Pty) Ltd.',
                price: typeof prod.price === 'number' ? prod.price : (parseFloat(String(prod.price)) || 349),
                currency: prod.currency || 'R',
                image_url: batchBanners[0]?.url || prod.imageUrl || '',
                cta_text: 'Order Now — Instant Dispatch',
                features: [
                    'Laboratory Tested Dual-Action Antifungal Bio-actives',
                    'Deeply Penetrates Nail Beds and Skin Barrier',
                    'Rapid Relief from Itching, Redness & Peeling',
                    'Free Express Courier Delivery Across South Africa',
                    '100% Satisfaction Guarantee — Love The Skin You\'re In'
                ],
                theme: 'modern',
                use_live_payments: false
            });
            setGeneratedStorefrontSlug(newPage.slug);
            toast.success(`Mobile Storefront created: /s/${newPage.slug}`);
        } catch (err: any) {
            console.error('Storefront generation error:', err);
            toast.error(err.response?.data?.message || 'Failed to create mobile storefront');
        } finally {
            setGeneratingStorefront(false);
        }
    };

    const handleSendScriptToTalkingVideo = (scriptTitle: string, scenes: UGCScriptScene[]) => {
        const fullScript = scenes.map(s => s.spokenAudio).join(' ');
        setVideoTitle(scriptTitle);
        setVideoScript(fullScript);
        setActiveTab('video');
        toast.success('Loaded script into AI Talking Avatar studio!');
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
            
            const networkNames = platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
            toast.success(`Campaign launched on ${networkNames || 'selected platforms'}!`);
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
            <div className="flex border-b border-gray-200 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('magic-url')}
                    className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'magic-url'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Magic URL-to-Campaign</span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        Zeely AI
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'campaigns'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Ad Campaigns ({campaigns.length})
                </button>
                <button
                    onClick={() => setActiveTab('video')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'video'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    AI Talking Avatars ({videos.length})
                </button>
                <button
                    onClick={() => setActiveTab('banner')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
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
            ) : activeTab === 'magic-url' ? (
                <div className="space-y-6">
                    {/* Hero Input Box */}
                    <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative z-10 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-indigo-200 border border-white/10">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Zeely-Grade 1-Click Growth Engine</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-indigo-200">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    <span>ClaimsGuard™ & Higiene Compliance Guard Active</span>
                                </div>
                            </div>

                            <div className="max-w-2xl">
                                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                                    Turn Any Product URL into High-Converting Ads in Seconds
                                </h2>
                                <p className="text-xs md:text-sm text-indigo-200/80 mt-1 leading-relaxed">
                                    Paste a Shopify, Takealot, or custom store URL. Our system extracts metadata, applies brand rules, and generates 3 UGC video scripts + 6 high-ROAS creative banners simultaneously.
                                </p>
                            </div>

                            {/* URL Input Form */}
                            <form onSubmit={handleUrlToCampaign} className="space-y-3 pt-2">
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-300">
                                            <Wand2 className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="url"
                                            required
                                            value={magicUrl}
                                            onChange={e => setMagicUrl(e.target.value)}
                                            placeholder="https://fungusnomore.co.za or Takealot / Shopify product link..."
                                            className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-sm text-white placeholder-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={generatingCampaign || generatingBatch}
                                        className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-gray-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                                    >
                                        {generatingCampaign || generatingBatch ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin text-gray-950" />
                                                <span>{generatingCampaign ? 'Analyzing URL & Copy...' : 'Compositing 6 Banners...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-4 h-4 fill-gray-950" />
                                                <span>Generate Campaign</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Quick URL Shortcuts & Options */}
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-indigo-300/80 text-[11px] font-medium mr-1">Quick Test:</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMagicUrl('https://fungusnomore.co.za');
                                                handleUrlToCampaign(undefined, 'https://fungusnomore.co.za');
                                            }}
                                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-medium text-white transition-colors"
                                        >
                                            🌊 Fungus No More™ Dual Action
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMagicUrl('https://higiene.co.za');
                                                handleUrlToCampaign(undefined, 'https://higiene.co.za');
                                            }}
                                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-medium text-white transition-colors"
                                        >
                                            🌿 Higiene™ Hair & Skin
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMagicUrl('https://www.takealot.com/fungus-no-more/PLID92742962');
                                                handleUrlToCampaign(undefined, 'https://www.takealot.com/fungus-no-more/PLID92742962');
                                            }}
                                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-medium text-white transition-colors"
                                        >
                                            🛍️ Takealot Store
                                        </button>
                                    </div>

                                    <label className="flex items-center gap-2 text-indigo-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoGenBanners}
                                            onChange={e => setAutoGenBanners(e.target.checked)}
                                            className="rounded border-white/20 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                                        />
                                        <span className="text-[11px]">Auto-composite 6 direct-response banners</span>
                                    </label>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Campaign Output Workspace */}
                    {campaignResult && (
                        <div className="space-y-8">
                            {/* Product Intelligence Card */}
                            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div className="flex items-center gap-5">
                                    <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center p-1 shadow-inner">
                                        {campaignResult.product.imageUrl ? (
                                            <img
                                                src={campaignResult.product.imageUrl}
                                                alt={campaignResult.product.title}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <ShoppingBag className="w-8 h-8 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                                                {campaignResult.product.brand || 'Higiene™'}
                                            </span>
                                            {campaignResult.product.isFNM && (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> ClaimsGuard™ Verified
                                                </span>
                                            )}
                                            {campaignResult.product.price && (
                                                <span className="text-xs font-bold text-gray-900 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                                                    {campaignResult.product.currency || 'R'}{campaignResult.product.price}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-bold text-gray-900">{campaignResult.product.title}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-1 max-w-xl">{campaignResult.product.description}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                                    <button
                                        type="button"
                                        onClick={handleCreateStorefrontFromCampaign}
                                        disabled={generatingStorefront}
                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <ShoppingBag className={`w-3.5 h-3.5 ${generatingStorefront ? 'animate-spin' : ''}`} />
                                        <span>{generatingStorefront ? 'Publishing Funnel...' : '1-Click Mobile Storefront'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGenerateBatchOnly}
                                        disabled={generatingBatch}
                                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${generatingBatch ? 'animate-spin' : ''}`} />
                                        <span>{generatingBatch ? 'Rendering Banners...' : 'Regenerate Banners'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUseBannerInCampaign(batchBanners[0]?.url || campaignResult.product.imageUrl || '')}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Megaphone className="w-4 h-4" />
                                        <span>Launch Full Campaign</span>
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Storefront Live Banner */}
                            {generatedStorefrontSlug && (
                                <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-300 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
                                            <ShoppingBag className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                                    Storefront Live
                                                </span>
                                                <span className="text-xs text-gray-500 font-medium">Zeely-Style High-Converting Micro-Funnel</span>
                                            </div>
                                            <h4 className="text-sm font-extrabold text-gray-900 mt-1">
                                                Your direct checkout landing page is live and ready for ad traffic!
                                            </h4>
                                            <p className="text-xs text-gray-600 font-mono mt-0.5">
                                                {window.location.origin}/s/{generatedStorefrontSlug}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(`${window.location.origin}/s/${generatedStorefrontSlug}`, 'storefront-url')}
                                            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 flex items-center gap-1.5 shadow-xs transition-all"
                                        >
                                            {copiedField === 'storefront-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copiedField === 'storefront-url' ? 'Copied' : 'Copy Link'}</span>
                                        </button>
                                        <a
                                            href={`/s/${generatedStorefrontSlug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
                                        >
                                            <span>Preview Storefront</span>
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Batch Creative Banners Gallery (6 High-ROAS Styles) */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-5 h-5 text-indigo-600" />
                                            <h3 className="text-lg font-black text-gray-900">
                                                6 Direct-Response Creative Styles (Batch Generated)
                                            </h3>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Engineered with high-converting visual hierarchy: Takealot reviews, comparison tables, urgency, and laboratory validation.
                                        </p>
                                    </div>
                                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full self-start sm:self-auto">
                                        {batchBanners.length} Banners Ready
                                    </span>
                                </div>

                                {generatingBatch ? (
                                    <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                                        <p className="text-sm font-bold text-gray-800">Compositing 6 Vector Ad Banners with Sharp...</p>
                                        <p className="text-xs text-gray-400">Rendering high-resolution typography, badges, gradients, and product cutouts.</p>
                                    </div>
                                ) : batchBanners.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {batchBanners.map((banner, idx) => (
                                            <div
                                                key={banner.id || idx}
                                                className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
                                            >
                                                {/* Header Style Badge */}
                                                <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
                                                        {banner.styleTitle || banner.style}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-gray-400">
                                                        {banner.width || 1080}x{banner.height || 1080}
                                                    </span>
                                                </div>

                                                {/* Banner Image Preview */}
                                                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                                    <img
                                                        src={banner.url}
                                                        alt={banner.styleTitle}
                                                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                                    />
                                                </div>

                                                {/* Actions */}
                                                <div className="p-3.5 bg-white border-t border-gray-100 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUseBannerInCampaign(banner.url, banner.styleTitle)}
                                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <Megaphone className="w-3.5 h-3.5" />
                                                        <span>Use in Ad</span>
                                                    </button>
                                                    <a
                                                        href={banner.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        download
                                                        className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-medium transition-colors"
                                                        title="Download high-resolution image"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </a>
                                                    <a
                                                        href={banner.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-medium transition-colors"
                                                        title="Open in new tab"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white p-8 rounded-3xl border border-gray-200 text-center">
                                        <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-gray-700">No Banners Generated Yet</p>
                                        <p className="text-xs text-gray-400 mt-1">Click "Regenerate Banners" above to composite the 6 direct-response styles.</p>
                                    </div>
                                )}
                            </div>

                            {/* Dual Grid: 3 UGC Video Scripts & Multi-Platform Ad Copy */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                {/* Left: 3 UGC Video Scripts (7 cols) */}
                                <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Film className="w-5 h-5 text-violet-600" />
                                            <h3 className="text-base font-bold text-gray-900">
                                                3 UGC Video Ad Scripts (High Hook Rate)
                                            </h3>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 px-2 py-0.5 rounded-md border border-violet-100">
                                            TikTok / Reels / Shorts
                                        </span>
                                    </div>

                                    {/* Script Selectors */}
                                    <div className="flex gap-2 border-b border-gray-150 pb-3 overflow-x-auto">
                                        {campaignResult.videoScripts.map((script, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setSelectedScriptIdx(idx)}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                                    selectedScriptIdx === idx
                                                        ? 'bg-violet-600 text-white shadow-xs'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                Script {idx + 1}: {script.title}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Selected Script Breakdown */}
                                    {campaignResult.videoScripts[selectedScriptIdx] && (
                                        <div className="space-y-4">
                                            <div className="bg-violet-50/50 border border-violet-100 p-3.5 rounded-2xl">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Opening Hook</p>
                                                <p className="text-sm font-bold text-gray-900 mt-0.5">
                                                    "{campaignResult.videoScripts[selectedScriptIdx].hook}"
                                                </p>
                                            </div>

                                            {/* Scenes Progression */}
                                            <div className="space-y-3">
                                                {campaignResult.videoScripts[selectedScriptIdx].scenes.map((scene, sIdx) => (
                                                    <div
                                                        key={sIdx}
                                                        className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/40 space-y-2"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">
                                                                    {scene.sceneNumber}
                                                                </span>
                                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                                                    scene.type === 'HOOK'
                                                                        ? 'bg-amber-100 text-amber-800'
                                                                        : scene.type === 'PROBLEM_SOLUTION'
                                                                        ? 'bg-blue-100 text-blue-800'
                                                                        : 'bg-emerald-100 text-emerald-800'
                                                                }`}>
                                                                    {scene.type.replace('_', ' ')}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-semibold text-gray-400">
                                                                {scene.durationSeconds}s duration
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span className="font-bold text-[10px] uppercase text-gray-400 block mb-0.5">Visual Action:</span>
                                                                <p className="text-gray-600 bg-white p-2 rounded-lg border border-gray-150 leading-relaxed">
                                                                    {scene.visualDirection}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-[10px] uppercase text-gray-400 block mb-0.5">Spoken Audio:</span>
                                                                <p className="text-gray-900 font-medium bg-white p-2 rounded-lg border border-gray-150 leading-relaxed italic">
                                                                    "{scene.spokenAudio}"
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="text-[11px] text-gray-500 bg-white/70 px-2.5 py-1.5 rounded-lg border border-gray-150 flex items-center justify-between">
                                                            <span><strong>Kinetic Caption:</strong> {scene.captionText}</span>
                                                            {scene.emphasisWord && (
                                                                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">
                                                                    Pop: {scene.emphasisWord}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Action Bar for Script */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(
                                                        campaignResult.videoScripts[selectedScriptIdx].scenes.map(s => s.spokenAudio).join(' '),
                                                        `script-${selectedScriptIdx}`
                                                    )}
                                                    className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                                                >
                                                    {copiedField === `script-${selectedScriptIdx}` ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                                                    )}
                                                    <span>{copiedField === `script-${selectedScriptIdx}` ? 'Copied Audio Script!' : 'Copy Script Audio'}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSendScriptToTalkingVideo(
                                                        campaignResult.videoScripts[selectedScriptIdx].title,
                                                        campaignResult.videoScripts[selectedScriptIdx].scenes
                                                    )}
                                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 active:scale-[0.98] transition-all"
                                                >
                                                    <Play className="w-3.5 h-3.5 fill-white" />
                                                    <span>Send to AI Talking Avatar</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Multi-Platform Ad Copy (5 cols) */}
                                <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-indigo-600" />
                                            <h3 className="text-base font-bold text-gray-900">Social Ad Copy</h3>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                            Multi-Channel
                                        </span>
                                    </div>

                                    {/* Platform Pills */}
                                    <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
                                        {campaignResult.socialCopy.map(copy => (
                                            <button
                                                key={copy.platform}
                                                type="button"
                                                onClick={() => setSelectedCopyPlatform(copy.platform.toLowerCase())}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                                    selectedCopyPlatform === copy.platform.toLowerCase()
                                                        ? 'bg-white text-indigo-600 shadow-xs'
                                                        : 'text-gray-500 hover:text-gray-800'
                                                }`}
                                            >
                                                {copy.platform}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Active Platform Copy Display */}
                                    {(() => {
                                        const currentCopy = campaignResult.socialCopy.find(
                                            c => c.platform.toLowerCase() === selectedCopyPlatform
                                        ) || campaignResult.socialCopy[0];

                                        if (!currentCopy) return null;

                                        return (
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                                                        Primary Headline
                                                    </label>
                                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 flex items-center justify-between">
                                                        <span>{currentCopy.headline}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(currentCopy.headline, 'copy-headline')}
                                                            className="text-gray-400 hover:text-indigo-600 ml-2"
                                                        >
                                                            {copiedField === 'copy-headline' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                                                        Ad Body & Hook
                                                    </label>
                                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
                                                        {currentCopy.body}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                                                        Call-to-Action
                                                    </label>
                                                    <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 flex items-center justify-between">
                                                        <span>{currentCopy.callToAction}</span>
                                                        <span className="text-[9px] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-indigo-200">
                                                            High CTR Button
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="pt-2 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(
                                                            `${currentCopy.headline}\n\n${currentCopy.body}\n\nCTA: ${currentCopy.callToAction}`,
                                                            'copy-all'
                                                        )}
                                                        className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                                                    >
                                                        {copiedField === 'copy-all' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                        <span>{copiedField === 'copy-all' ? 'Copied Full Copy!' : 'Copy Full Post'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAdCopy(currentCopy.body);
                                                            setHeadline(currentCopy.headline);
                                                            handleUseBannerInCampaign(batchBanners[0]?.url || campaignResult.product.imageUrl || '');
                                                        }}
                                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                                                    >
                                                        <Megaphone className="w-3.5 h-3.5" />
                                                        <span>Use in Campaign</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Target Audience Insights */}
                            {campaignResult.targetAudience && campaignResult.targetAudience.length > 0 && (
                                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mr-2">
                                        <Award className="w-4 h-4 text-indigo-500" /> Recommended Ad Targeting:
                                    </span>
                                    {campaignResult.targetAudience.map((aud, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200"
                                        >
                                            {aud}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
                /* Zeely 9:16 Interactive UGC Video Studio with Smartphone Simulator */
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                                    <Smartphone className="w-5 h-5" />
                                </span>
                                <h2 className="text-lg font-black text-gray-900">
                                    Zeely 9:16 Interactive UGC Video Studio
                                </h2>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Real-time mobile phone simulator with dynamic kinetic captions, South African AI voiceovers, and TikTok/Reels direct export.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> ClaimsGuard™ Compliant
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left: Customizer & Director Controls (7 cols) */}
                        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-5">
                            {/* Script Prefills from URL-to-Campaign */}
                            {campaignResult?.videoScripts && campaignResult.videoScripts.length > 0 && (
                                <div className="space-y-2 pb-2 border-b border-gray-150">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                                        Import Generated UGC Script (From URL-to-Campaign)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {campaignResult.videoScripts.map((s, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setVideoTitle(s.title);
                                                    setVideoScript(s.scenes.map(sc => sc.spokenAudio).join(' '));
                                                    if (s.scenes[0]?.emphasisWord) {
                                                        setEmphasisWord(s.scenes[0].emphasisWord);
                                                    }
                                                    toast.success(`Loaded "${s.title}"!`);
                                                }}
                                                className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-xl border border-violet-100 transition-colors flex items-center gap-1"
                                            >
                                                <Sparkles className="w-3 h-3 text-amber-500" />
                                                <span>Script {idx + 1}: {s.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleGenerateVideo} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                                        Video Campaign Title *
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={videoTitle}
                                        onChange={e => setVideoTitle(e.target.value)}
                                        placeholder="e.g. Fungus No More Dual Action — Gym Hook Ad"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                                            Spoken Script *
                                        </label>
                                        <span className="text-[10px] text-gray-400">
                                            {videoScript.split(/\s+/).filter(Boolean).length} words (~{Math.round(videoScript.split(/\s+/).filter(Boolean).length / 2.5)}s)
                                        </span>
                                    </div>
                                    <textarea
                                        required
                                        value={videoScript}
                                        onChange={e => setVideoScript(e.target.value)}
                                        rows={4}
                                        placeholder="Type or paste what the avatar should say..."
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                    />
                                </div>

                                {/* Avatar Persona Selector (Visual 4-Grid) */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                                        Avatar Persona
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {[
                                            { id: 'ugc_female', name: 'Emma', role: 'Lifestyle & Routine', badge: 'High Hook Rate' },
                                            { id: 'ugc_male', name: 'Liam', role: 'Gym & Athletics', badge: 'Fitness Hook' },
                                            { id: 'skincare_expert', name: 'Dr. Marcus', role: 'Clinical Formulator', badge: 'Dermatologist' },
                                            { id: 'founder', name: 'Sarah', role: 'Higienlabs Tech Lead', badge: 'Brand Story' },
                                        ].map(av => (
                                            <button
                                                key={av.id}
                                                type="button"
                                                onClick={() => setAvatarStyle(av.id as any)}
                                                className={`p-3 rounded-2xl border text-left transition-all ${
                                                    avatarStyle === av.id
                                                        ? 'border-violet-600 bg-violet-50/60 shadow-xs ring-2 ring-violet-500/20'
                                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-900">{av.name}</span>
                                                    <User className={`w-3.5 h-3.5 ${avatarStyle === av.id ? 'text-violet-600' : 'text-gray-400'}`} />
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{av.role}</p>
                                                <span className="inline-block mt-2 text-[8px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                                    {av.badge}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Voice Tone, Kinetic Subtitle Preset & Background Beat */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                                            Voice & Accent
                                        </label>
                                        <select
                                            value={voiceStyle}
                                            onChange={e => setVoiceStyle(e.target.value as any)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                                        >
                                            <option value="en-ZA">🇿🇦 South African English</option>
                                            <option value="en-US">🇺🇸 US Viral Energetic</option>
                                            <option value="en-GB">🇬🇧 British Clinical</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                                            Kinetic Caption Preset
                                        </label>
                                        <select
                                            value={subtitleStyle}
                                            onChange={e => setSubtitleStyle(e.target.value as any)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                                        >
                                            <option value="pop_yellow">🔥 Viral TikTok Gold Pop</option>
                                            <option value="neon_cyan">⚡ Cyber Cyan Contrast</option>
                                            <option value="clean_white">✨ Minimal White Bold</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                                            Background Beat
                                        </label>
                                        <select
                                            value={backgroundBeat}
                                            onChange={e => setBackgroundBeat(e.target.value as any)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                                        >
                                            <option value="viral_bounce">🎵 TikTok Trap Bounce</option>
                                            <option value="trendy_lofi">☕ Chill Lo-Fi Shower</option>
                                            <option value="lab_clean">🔬 Bio-Acoustic Clean</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                                            Subtitles Emphasis Word (Pop Color)
                                        </label>
                                        <input
                                            type="text"
                                            value={emphasisWord}
                                            onChange={e => setEmphasisWord(e.target.value)}
                                            placeholder="e.g. STOP, RESULTS, DOCTOR"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500 uppercase"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="submit"
                                            disabled={renderingVideo}
                                            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-violet-600/20 disabled:opacity-50 cursor-pointer"
                                        >
                                            {renderingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                                            {renderingVideo ? 'Rendering 9:16 MP4...' : 'Render 9:16 Video Asset'}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Rendering Progress */}
                            {renderingVideo && (
                                <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                                        Zeely Video Compositor Pipeline
                                    </p>
                                    <div className="space-y-2 text-xs font-bold text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${renderStep >= 1 ? 'bg-violet-600' : 'bg-gray-300'}`} />
                                            <span className={renderStep === 1 ? 'text-violet-600 animate-pulse' : ''}>1. Analyzing hook retention & timing...</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${renderStep >= 2 ? 'bg-violet-600' : 'bg-gray-300'}`} />
                                            <span className={renderStep === 2 ? 'text-violet-600 animate-pulse' : ''}>2. Synthesizing South African English voiceover...</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${renderStep >= 3 ? 'bg-violet-600' : 'bg-gray-300'}`} />
                                            <span className={renderStep === 3 ? 'text-violet-600 animate-pulse' : ''}>3. Synchronizing avatar lip movements & kinematics...</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${renderStep >= 4 ? 'bg-violet-600' : 'bg-gray-300'}`} />
                                            <span className={renderStep === 4 ? 'text-violet-600 animate-pulse' : ''}>4. Burning kinetic subtitles & mixing background audio...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: 9:16 Smartphone Simulator Frame (5 cols) */}
                        <div className="lg:col-span-5 flex flex-col items-center space-y-4">
                            {/* iPhone Frame */}
                            <div className="relative w-full max-w-[280px] aspect-[9/16] bg-black rounded-[42px] border-[7px] border-gray-900 shadow-2xl overflow-hidden ring-1 ring-white/10 select-none">
                                {/* Top Notch / Dynamic Island */}
                                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-4 bg-gray-950 rounded-full z-30 flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-900 ml-auto mr-2" />
                                </div>

                                {/* Top Badges */}
                                <div className="absolute top-8 left-3 right-3 z-20 flex items-center justify-between text-[9px] font-bold text-white drop-shadow">
                                    <span className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live 9:16
                                    </span>
                                    <span className="bg-emerald-600/80 backdrop-blur-md px-2 py-0.5 rounded-full text-white flex items-center gap-1">
                                        <ShieldCheck className="w-2.5 h-2.5" /> ClaimsGuard™
                                    </span>
                                </div>

                                {/* Avatar Video Stream */}
                                {(() => {
                                    const templateMap: Record<string, string> = {
                                        ugc_female: 'https://assets.mixkit.co/videos/preview/mixkit-smiling-woman-talking-to-camera-at-home-42436-large.mp4',
                                        ugc_male: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-giving-a-lecture-at-a-screen-40767-large.mp4',
                                        skincare_expert: 'https://assets.mixkit.co/videos/preview/mixkit-man-in-suit-explaining-something-at-camera-40081-large.mp4',
                                        founder: 'https://assets.mixkit.co/videos/preview/mixkit-happy-girl-talking-on-video-call-42861-large.mp4'
                                    };
                                    const videoSrc = templateMap[avatarStyle] || templateMap.ugc_female;

                                    return (
                                        <video
                                            key={videoSrc}
                                            src={videoSrc}
                                            autoPlay
                                            loop
                                            muted={simMuted}
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                    );
                                })()}

                                {/* Dynamic Kinetic Subtitle Overlay (Floating Center) */}
                                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none text-center">
                                    <div className="inline-block bg-black/60 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/10 shadow-lg">
                                        <p className="text-xs font-black tracking-wide leading-tight text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                            {videoScript.slice(0, 75)}...
                                        </p>
                                        {emphasisWord && (
                                            <span className={`inline-block mt-1 text-sm font-black tracking-widest px-2 py-0.5 rounded-md uppercase animate-bounce ${
                                                subtitleStyle === 'pop_yellow'
                                                    ? 'bg-amber-400 text-gray-950 shadow-md shadow-amber-400/50'
                                                    : subtitleStyle === 'neon_cyan'
                                                    ? 'bg-cyan-400 text-gray-950 shadow-md shadow-cyan-400/50'
                                                    : 'bg-white text-gray-950'
                                            }`}>
                                                {emphasisWord}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Simulated TikTok / Instagram Reels Right Rail */}
                                <div className="absolute right-2.5 bottom-16 z-20 flex flex-col items-center gap-3 text-white text-shadow">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                                            <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                                        </div>
                                        <span className="text-[9px] font-bold mt-0.5">28.4K</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                                            <MessageCircle className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-[9px] font-bold mt-0.5">412</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                                            <Share className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-[9px] font-bold mt-0.5">1.5K</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-black/60 border border-white/30 flex items-center justify-center animate-spin">
                                        <Disc3 className="w-4 h-4 text-amber-300" />
                                    </div>
                                </div>

                                {/* Simulated Bottom Creator Tag & Audio Track */}
                                <div className="absolute inset-x-3 bottom-3 z-20 text-white space-y-1 drop-shadow">
                                    <p className="text-[11px] font-black tracking-tight text-white flex items-center gap-1">
                                        <span>@higiene.official</span>
                                        <Check className="w-3 h-3 text-cyan-400 stroke-[3]" />
                                    </p>
                                    <p className="text-[10px] text-white/90 line-clamp-1 font-medium">
                                        {videoTitle} #LoveTheSkinYoureIn #Takealot
                                    </p>
                                    <p className="text-[9px] text-amber-300 flex items-center gap-1 font-semibold">
                                        <Music className="w-2.5 h-2.5" />
                                        <span>Original Audio — Higiene Labs ({voiceStyle})</span>
                                    </p>
                                </div>
                            </div>

                            {/* Simulator Player Controls */}
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSimMuted(!simMuted)}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                    title={simMuted ? 'Unmute Sound' : 'Mute Sound'}
                                >
                                    {simMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-violet-600" />}
                                    <span>{simMuted ? 'Muted' : 'Sound On'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetWizard();
                                        const templateMap: Record<string, string> = {
                                            ugc_female: 'https://assets.mixkit.co/videos/preview/mixkit-smiling-woman-talking-to-camera-at-home-42436-large.mp4',
                                            ugc_male: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-giving-a-lecture-at-a-screen-40767-large.mp4',
                                            skincare_expert: 'https://assets.mixkit.co/videos/preview/mixkit-man-in-suit-explaining-something-at-camera-40081-large.mp4',
                                            founder: 'https://assets.mixkit.co/videos/preview/mixkit-happy-girl-talking-on-video-call-42861-large.mp4'
                                        };
                                        setMediaUrl(templateMap[avatarStyle] || templateMap.ugc_female);
                                        setName(videoTitle);
                                        setHeadline('Fungus No More™ Dual Action');
                                        setAdCopy(videoScript);
                                        setTargetUrl(campaignResult?.product.url || 'https://www.takealot.com/fungus-no-more/PLID92742962');
                                        setWizardStep(3);
                                        setShowWizard(true);
                                    }}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Megaphone className="w-3.5 h-3.5" />
                                    <span>Launch As Video Campaign</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Library of Generated Videos */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Film className="w-5 h-5 text-gray-500" />
                                <h3 className="text-base font-bold text-gray-900">Your Rendered Video Library ({videos.length})</h3>
                            </div>
                        </div>

                        {videos.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
                                <Film className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                                <p className="text-xs text-gray-400">No custom videos rendered yet. Use the simulator above to create your first 9:16 asset.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {videos.map(vid => (
                                    <div
                                        key={vid.id}
                                        onClick={() => setPlayingVideo(vid)}
                                        className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden hover:border-violet-300 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                                    >
                                        <div className="p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-gray-900 truncate max-w-[160px]">{vid.title}</h4>
                                                <span className="text-[9px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 px-2 py-0.5 rounded">
                                                    {vid.avatar_style}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed italic">
                                                "{vid.script}"
                                            </p>
                                        </div>
                                        <div className="px-4 py-2.5 bg-white border-t border-gray-150 flex items-center justify-between text-xs">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                                <Volume2 className="w-3 h-3" /> {vid.voice_style}
                                            </span>
                                            <span className="text-xs font-black text-violet-600 flex items-center gap-1">
                                                <Play className="w-3 h-3 fill-violet-600" /> Play MP4
                                            </span>
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
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Product Image URL</label>
                                    <span className="text-[9px] text-gray-400 normal-case">(Must be direct image link)</span>
                                </div>
                                <input
                                    type="text"
                                    value={bannerImageUrl}
                                    onChange={e => setBannerImageUrl(e.target.value)}
                                    placeholder="https://example.com/product.jpg"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <p className="mt-1 text-[9px] text-gray-400 leading-normal">
                                    To get this, visit the product page, right-click the product image, and select <strong>"Copy image link"</strong> or <strong>"Copy image address"</strong>.
                                </p>
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
                                            {['facebook', 'instagram', 'tiktok'].map(plat => (
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
                                                {adCopy || 'Write compelling ad copy in step 3 to preview your Facebook/Instagram/TikTok sponsored post details...'}
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
