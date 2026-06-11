import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    Wand2, Image, Hash, Smile, Calendar, Send, Save, 
    Loader2, X, FolderOpen, FileText, Tag, Megaphone,
    Search, CheckCircle2, AlertCircle, Sparkles, ShoppingBag,
    Video, Share2, Monitor, Square, Palette, Smartphone
} from "lucide-react";
import { PlatformIcon } from '../components/common/BrandIcons';
import toast from 'react-hot-toast';
import api from '../services/api';
import MediaPicker from '../components/media/MediaPicker';
import { MediaFile } from '../services/media.service';
import { ProductPicker } from '../components/ecommerce/ProductPicker';
import { useBrand } from '../contexts/BrandContext';
import { PostPreview } from '../components/studio/PostPreview';

const platforms = [
    { id: 'twitter',   label: 'X (Twitter)', icon: 'twitter',   gradient: 'bg-x-gradient',         limit: 280 },
    { id: 'instagram', label: 'Instagram', icon: 'instagram', gradient: 'bg-instagram-gradient', limit: 2200 },
    { id: 'linkedin',  label: 'LinkedIn',  icon: 'linkedin',  gradient: 'bg-linkedin-gradient',  limit: 3000 },
    { id: 'facebook',  label: 'Facebook',  icon: 'facebook',  gradient: 'bg-facebook-gradient',  limit: 63206 },
    { id: 'tiktok',    label: 'TikTok',    icon: 'tiktok',    gradient: 'bg-tiktok-gradient',    limit: 2200 },
    { id: 'youtube',   label: 'YouTube',   icon: 'youtube',   gradient: 'bg-youtube-gradient',   limit: 5000 },
    { id: 'pinterest', label: 'Pinterest', icon: 'pinterest', gradient: 'bg-pinterest-gradient', limit: 500 },
];
const tones = ['Professional', 'Casual', 'Humorous', 'Inspirational', 'Educational', 'Promotional'];
const contentLengths = ['Short', 'Medium', 'Long'];

const defaultHashtagSets: HashtagSet[] = [
    { id: 'def-tech', name: '🔥 Tech & Coding', hashtags: ['tech', 'coding', 'developer', 'software', 'innovation'] },
    { id: 'def-startup', name: '🚀 Startup & Growth', hashtags: ['startup', 'business', 'marketing', 'growth', 'entrepreneur'] },
    { id: 'def-creative', name: '🎨 Design & UI', hashtags: ['design', 'uidesign', 'branding', 'creative', 'graphicdesign'] },
];

const defaultTemplates: Template[] = [
    { id: 'def-launch', name: '📢 Product Launch', content: "🚀 We are thrilled to introduce our new feature! Designed to help you automate workflows and save hours every week. Try it out and let us know what you think! 👇\n\n#launch #productivity" },
    { id: 'def-tip', name: '💡 Weekly Tip', content: "💡 Tip of the week: Always structure your content with clear, readable sections. Using list formats or bullet points can increase engagement by up to 40%!\n\n#marketingtips #growth" },
    { id: 'def-question', name: '❓ Question of the Day', content: "❓ Quick question: What is the single biggest challenge you face in your daily workflow? Let us know in the comments! 👇" }
];

interface Template { id: string; name: string; content: string; }
interface HashtagSet { id: string; name: string; hashtags: string[]; }
interface Campaign { id: string; name: string; }

export const ContentStudio: React.FC = () => {
    const brand = useBrand();
    const location = useLocation();
    const [content, setContent] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter']);
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [mediaFiles, setMediaFiles] = useState<File[]>([]);
    const [scheduledAt, setScheduledAt] = useState('');
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState('Professional');
    const [aiLength, setAiLength] = useState('Medium');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'write' | 'ai'>('write');

    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignId, setCampaignId] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);
    const [showHashtagSets, setShowHashtagSets] = useState(false);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [videoFormat, setVideoFormat] = useState('social');

    useEffect(() => {
        const state = location.state as any;
        if (state) {
            if (state.initialContent) setContent(state.initialContent);
            if (state.initialHashtags) setHashtags(state.initialHashtags);
            if (state.initialPlatform) setSelectedPlatforms([state.initialPlatform]);
            if (state.initialMediaUrls) setMediaUrls(state.initialMediaUrls);
            
            // Clear state so it doesn't re-apply on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        api.get('/templates').then(r => setTemplates(r.data)).catch(() => {});
        api.get('/hashtag-sets').then(r => setHashtagSets(r.data)).catch(() => {});
        api.get('/campaigns').then(r => setCampaigns(r.data)).catch(() => {});
    }, []);

    const togglePlatform = (id: string) =>
        setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

    const applyTemplate = (t: Template) => {
        setContent(t.content);
        setShowTemplates(false);
        toast.success(`Template "${t.name}" applied`);
    };

    const applyHashtagSet = (s: HashtagSet) => {
        setHashtags(prev => [...new Set([...prev, ...s.hashtags])]);
        setShowHashtagSets(false);
        toast.success(`Added ${s.hashtags.length} hashtags from "${s.name}"`);
    };

    const handleMediaPickerSelect = (files: MediaFile[]) => {
        const urls = files.map(f => f.url);
        if (urls.length + mediaUrls.length > 4) { toast.error('Maximum 4 media files allowed'); return; }
        setMediaUrls(prev => [...prev, ...urls]);
    };

    const handleAIGenerate = async () => {
        if (!aiTopic.trim()) { toast.error('Please enter a topic'); return; }
        setIsGenerating(true);
        try {
            const { data } = await api.post('/ai/generate', {
                topic: aiTopic, platform: selectedPlatforms[0] || 'twitter',
                tone: aiTone.toLowerCase(), length: aiLength.toLowerCase(),
                includeHashtags: true, includeEmojis: true, language: 'English',
            });
            setContent(data.content);
            setHashtags(data.hashtags || []);
            setActiveTab('write');
            toast.success('Content generated!');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to generate content');
        } finally { setIsGenerating(false); }
    };

    const handleProductSelect = async (product: any) => {
        setShowProductPicker(false);
        setIsGenerating(true);
        try {
            const { data } = await api.post('/ai/product-post', {
                productData: {
                    title: product.title,
                    description: product.description,
                    price: product.price,
                    currency: product.currency,
                    productUrl: product.product_url
                },
                platform: selectedPlatforms[0] || 'twitter',
                tone: aiTone.toLowerCase()
            });
            setContent(data.content);
            setHashtags(data.hashtags || []);
            if (product.image_url) setMediaUrls([product.image_url]);
            setActiveTab('write');
            toast.success(`Generated post for ${product.title}`);
        } catch (error: any) {
            toast.error('Failed to generate product post');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateHashtags = async () => {
        if (!content && !aiTopic) { toast.error('Please enter some content or topic first'); return; }
        try {
            const { data } = await api.post('/ai/hashtags', {
                topic: aiTopic || content.substring(0, 100),
                platform: selectedPlatforms[0] || 'twitter', count: 15,
            });
            setHashtags(data.hashtags);
            toast.success('Hashtags generated!');
        } catch { toast.error('Failed to generate hashtags'); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + mediaFiles.length > 4) { toast.error('Maximum 4 media files allowed'); return; }
        setMediaFiles(prev => [...prev, ...files]);
        setMediaUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    };

    const removeMedia = (i: number) => {
        setMediaFiles(prev => prev.filter((_, idx) => idx !== i));
        setMediaUrls(prev => prev.filter((_, idx) => idx !== i));
    };

    const [isReviewing, setIsReviewing] = useState(false);
    const [reviewResult, setReviewResult] = useState<{
        score: number;
        feedback: { component: string; status: 'pass' | 'fail' | 'warn'; message: string }[];
        remix: string;
    } | null>(null);

    const handleAIReview = async () => {
        if (!content.trim()) { toast.error('Write something first'); return; }
        setIsReviewing(true);
        try {
            const { data } = await api.post('/ai/review', {
                content,
                platform: selectedPlatforms[0] || 'twitter'
            });
            setReviewResult(data);
            toast.success('Review complete!');
        } catch {
            toast.error('Failed to review content');
        } finally {
            setIsReviewing(false);
        }
    };

    const handleApplyRemix = () => {
        if (reviewResult) {
            setContent(reviewResult.remix);
            setReviewResult(null);
            toast.success('AI Remix applied!');
        }
    };

    const handleSaveOrPublish = async (action: 'draft' | 'schedule' | 'publish') => {
        if (!content.trim()) { toast.error('Please write some content'); return; }
        if (selectedPlatforms.length === 0) { toast.error('Select at least one platform'); return; }
        if (action === 'schedule' && !scheduledAt) { toast.error('Please set a schedule time'); return; }
        action === 'draft' ? setIsSaving(true) : setIsPublishing(true);
        try {
            await api.post('/posts', {
                content: `${content}\n\n`.trim(),
                platforms: selectedPlatforms, hashtags: hashtags, mediaUrls: mediaUrls,
                scheduledAt: action === 'schedule' ? scheduledAt : null,
                aiGenerated: activeTab === 'ai',
                campaignId: campaignId || null,
            });
            toast.success(action === 'publish' ? 'Post published!' : action === 'schedule' ? 'Post scheduled!' : 'Draft saved!');
            setContent(''); setHashtags([]); setMediaFiles([]); setMediaUrls([]); setScheduledAt('');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save post');
        } finally { setIsSaving(false); setIsPublishing(false); }
    };

    const currentPlatform = platforms.find(p => selectedPlatforms[0] === p.id);
    const charLimit = currentPlatform?.limit || 280;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Video Formats Header */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <Video className="w-4 h-4 text-brand" />
                                Content Format
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                {[
                                    { id: 'social',   label: 'Social media',   res: '800 x 800 px', icon: Share2 },
                                    { id: 'hd',       label: 'HD video',       res: '1920 x 1080 px (16:9)', icon: Monitor },
                                    { id: 'square',   label: 'Square video',   res: '1080 x 1080 px (1:1)', icon: Square },
                                    { id: 'vertical', label: 'Vertical video', res: '1080 x 1920 px (9:16)', icon: Smartphone },
                                ].map(format => (
                                    <button 
                                        key={format.id}
                                        onClick={() => setVideoFormat(format.id)}
                                        className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                                            videoFormat === format.id 
                                            ? 'border-brand bg-brand-light ring-2 ring-brand/20' 
                                            : 'border-gray-100 bg-white hover:border-gray-200'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg mb-2 ${videoFormat === format.id ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-400'}`}>
                                            <format.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-900">{format.label}</span>
                                        <span className="text-[10px] text-gray-500 mt-0.5">{format.res}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex border-b border-gray-100">
                            {(['write', 'ai'] as const).map(tab => (
                                <button 
                                    key={tab} 
                                    onClick={() => setActiveTab(tab)}
                                    className="flex-1 py-3 text-sm font-medium transition-colors"
                                >
                                    {tab === 'write' ? '✍️ Write' : '🤖 AI Writer'}
                                </button>
                            ))}
                        </div>
                        {activeTab === 'write' ? (
                            <div className="p-4">
                                <textarea 
                                    value={content} 
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Start writing your post..."
                                    className="w-full h-48 resize-none focus:outline-none text-gray-800 placeholder-gray-400 text-base" 
                                />
                                {hashtags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                                        {hashtags.map(tag => (
                                            <div key={tag} className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm">
                                                <span>{tag}</span>
                                                <button onClick={() => setHashtags(prev => prev.filter(h => h !== tag))}><X className="w-3 h-3" /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {mediaUrls.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2 mt-3">
                                        {mediaUrls.map((url, i) => (
                                            <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                                <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className='flex items-center justify-between mt-4 pt-3 border-t border-gray-100'>
                                    <div className='flex items-center gap-2 flex-wrap'>
                                        <label className='p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl cursor-pointer transition-all shadow-xs' title='Upload file'>
                                            <Image className='w-5 h-5' />
                                            <input type='file' className='hidden' accept='image/*,video/*' multiple onChange={handleFileUpload} />
                                        </label>
                                        <button
                                            onClick={() => setShowMediaPicker(true)}
                                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-xl transition-all shadow-xs"
                                            title="Pick from Media Library"
                                        >
                                            <FolderOpen className="w-5 h-5" />
                                        </button>
                                        <div className='relative'>
                                            <button
                                                onClick={() => { setShowHashtagSets(v => !v); setShowTemplates(false); }}
                                                className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 rounded-xl transition-all shadow-xs"
                                                title="Insert Hashtag Set"
                                            >
                                                <Tag className="w-5 h-5" />
                                            </button>
                                            {showHashtagSets && (
                                                <div className="absolute left-0 top-11 z-20 bg-white border border-gray-150 rounded-xl shadow-lg min-w-48 py-1 max-h-60 overflow-y-auto">
                                                    {hashtagSets.length > 0 ? (
                                                        hashtagSets.map(s => (
                                                            <button
                                                                key={s.id}
                                                                onClick={() => applyHashtagSet(s)}
                                                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 truncate text-gray-700"
                                                            >
                                                                <span className="font-medium text-gray-800">{s.name}</span>
                                                                <span className="text-gray-400 ml-1">({s.hashtags.length})</span>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">Default Presets</div>
                                                            {defaultHashtagSets.map(s => (
                                                                 <button
                                                                     key={s.id}
                                                                     onClick={() => applyHashtagSet(s)}
                                                                     className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 truncate text-gray-700"
                                                                 >
                                                                     <span className="font-medium text-gray-800">{s.name}</span>
                                                                     <span className="text-gray-400 ml-1">({s.hashtags.length})</span>
                                                                 </button>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className='relative'>
                                            <button
                                                onClick={() => { setShowTemplates(v => !v); setShowHashtagSets(false); }}
                                                className="p-2 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 rounded-xl transition-all shadow-xs"
                                                title="Load Template"
                                            >
                                                <FileText className="w-5 h-5" />
                                            </button>
                                            {showTemplates && (
                                                <div className="absolute left-0 top-11 z-20 bg-white border border-gray-150 rounded-xl shadow-lg min-w-56 py-1 max-h-60 overflow-y-auto">
                                                    {templates.length > 0 ? (
                                                        templates.map(t => (
                                                            <button
                                                                key={t.id}
                                                                onClick={() => applyTemplate(t)}
                                                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 truncate text-gray-700"
                                                            >
                                                                {t.name}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">Default Presets</div>
                                                            {defaultTemplates.map(t => (
                                                                <button
                                                                    key={t.id}
                                                                    onClick={() => applyTemplate(t)}
                                                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 truncate text-gray-700"
                                                                >
                                                                    {t.name}
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={handleGenerateHashtags} 
                                            className="p-2 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 rounded-xl transition-all shadow-xs" 
                                            title="Generate hashtags"
                                        >
                                            <Hash className="w-5 h-5" />
                                        </button>
                                         <button 
                                            onClick={handleAIReview} 
                                            disabled={isReviewing || !content.trim()}
                                            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md shadow-brand/20 disabled:opacity-50 disabled:shadow-none"
                                        >
                                            {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            Review & Remix with AI
                                        </button>
                                        <button 
                                            onClick={() => setShowProductPicker(true)}
                                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl transition-all shadow-xs" 
                                            title="Promote Product"
                                        >
                                            <ShoppingBag className="w-5 h-5" />
                                        </button>
                                        <div className="w-px h-6 bg-gray-200 mx-1" />
                                        <a 
                                            href="https://www.canva.com/templates/" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00C4CC] to-[#7D2AE8] text-white rounded-xl text-xs font-bold hover:scale-102 hover:opacity-95 active:scale-98 transition-all shadow-sm"
                                            title="Design with Canva"
                                        >
                                            <Palette className="w-4 h-4" />
                                            Canva
                                        </a>
                                        <button 
                                            className="p-2 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 rounded-xl transition-all shadow-xs" 
                                            title="Add emoji"
                                        >
                                            <Smile className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <span className={`text-sm font-medium ${content.length > charLimit * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {content.length}/{charLimit}
                                    </span>
                                </div>

                                {reviewResult && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`text-lg font-bold ${reviewResult.score > 80 ? 'text-green-600' : reviewResult.score > 50 ? 'text-orange-500' : 'text-red-500'}`}>
                                                    {reviewResult.score}%
                                                </div>
                                                <span className="text-sm font-medium text-gray-600">Conversion Score</span>
                                            </div>
                                            <button onClick={() => setReviewResult(null)} className="text-gray-400 hover:text-gray-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {reviewResult.feedback.map((f, i) => (
                                                <div key={i} className="flex items-start gap-2.5">
                                                    {f.status === 'pass' ? (
                                                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                                    ) : f.status === 'fail' ? (
                                                        <X className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                                    ) : (
                                                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-gray-800">{f.component}</p>
                                                        <p className="text-xs text-gray-600">{f.message}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-5 pt-4 border-t border-gray-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                                    <Sparkles className="w-3 h-3 text-purple-600" /> AI Optimized Remix
                                                </span>
                                                <button 
                                                    onClick={handleApplyRemix}
                                                    className="text-[10px] font-bold bg-purple-600 text-white px-2 py-1 rounded-lg hover:bg-purple-700 transition-colors"
                                                >
                                                    APPLY REMIX
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-700 italic bg-white p-3 rounded-lg border border-gray-100 leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                                                "{reviewResult.remix}"
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Topic or Prompt</label>
                                    <input type="text" value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                                        placeholder="e.g. Benefits of remote work for productivity"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                                        <select value={aiTone} onChange={e => setAiTone(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                                            {tones.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                                        <select value={aiLength} onChange={e => setAiLength(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                                            {contentLengths.map(l => <option key={l}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleAIGenerate} disabled={isGenerating}
                                    className='w-full flex items-center justify-center gap-2 py-3 bg-brand text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-60'>
                                    {isGenerating ? <><Loader2 className='w-4 h-4 animate-spin' /> Generating...</> : <><Wand2 className='w-4 h-4' /> Generate with AI</>}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule (optional)</label>
                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => handleSaveOrPublish('draft')} disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                            <Save className="w-4 h-4" /> Save Draft
                        </button>
                        {scheduledAt ? (
                            <button onClick={() => handleSaveOrPublish('schedule')} disabled={isPublishing}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors">
                                <Calendar className="w-4 h-4" /> Schedule Post
                            </button>
                        ) : (
                            <button onClick={() => handleSaveOrPublish('publish')} disabled={isPublishing}
                                className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-60'>
                                {isPublishing ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />} Publish Now
                            </button>
                        )}
                    </div>
                </div>

                <div className='space-y-4'>
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
                        <h3 className='text-sm font-semibold text-gray-900 mb-3'>Publish To</h3>
                        <div className='space-y-2'>
                            {platforms.map(({ id, label }) => (
                                <button 
                                    key={id} 
                                    onClick={() => togglePlatform(id)}
                                     className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all relative overflow-hidden group ${
                                         selectedPlatforms.includes(id) 
                                             ? 'border-indigo-200 bg-indigo-50 shadow-md scale-[1.02]' 
                                             : 'border-gray-100 hover:border-gray-200'
                                     }`}
                                >
                                     <div className="relative z-10 flex-shrink-0">
                                         <PlatformIcon platform={id} size={28} />
                                     </div>
                                     <span className={`text-sm font-bold relative z-10 ${selectedPlatforms.includes(id) ? 'text-gray-900' : 'text-gray-700'}`}>{label}</span>
                                     {selectedPlatforms.includes(id) && (
                                         <div className="ml-auto w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-md relative z-10">
                                             <CheckCircle2 className='text-white w-3.5 h-3.5' />
                                         </div>
                                     )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center justify-between">
                            Preview
                            {selectedPlatforms.length > 0 && (
                                <div className="flex gap-1">
                                    {selectedPlatforms.map(p => (
                                        <PlatformIcon key={p} platform={p} size={14} className="text-gray-400" />
                                    ))}
                                </div>
                            )}
                        </h3>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 min-h-32 flex flex-col gap-6 max-h-[800px] overflow-y-auto">
                            {content || mediaUrls.length > 0 ? (
                                selectedPlatforms.length > 0 ? (
                                    selectedPlatforms.map(platform => (
                                        <PostPreview 
                                            key={platform}
                                            platform={platform}
                                            content={content}
                                            hashtags={hashtags}
                                            mediaUrls={mediaUrls}
                                            brandName={brand.brandName || 'SocialPulse Identity'}
                                            brandLogoUrl={brand.brandLogoUrl || ''}
                                            videoFormat={videoFormat}
                                        />
                                    ))
                                ) : (
                                    <PostPreview 
                                        platform="twitter"
                                        content={content}
                                        hashtags={hashtags}
                                        mediaUrls={mediaUrls}
                                        brandName={brand.brandName || 'SocialPulse Identity'}
                                        brandLogoUrl={brand.brandLogoUrl || ''}
                                        videoFormat={videoFormat}
                                    />
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                    <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-sm text-center">Start writing to see preview...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {campaigns.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Megaphone className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Campaign (optional)</h3>
                            </div>
                            <select
                                value={campaignId}
                                onChange={e => setCampaignId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                            >
                                <option value="">No campaign</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className='bg-linear-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-100 p-4'>
                        <div className='flex items-center gap-2 mb-2'>
                            <Wand2 className='w-4 h-4 text-purple-600' />
                            <span className='text-sm font-semibold text-purple-900'>AI Tips</span>
                        </div>
                        <ul className="space-y-1.5">
                            {['Post between 9-11am for max reach', 'Include a question to boost comments', 'Use 3-5 hashtags on Instagram', 'Tag relevant accounts to expand reach'].map(tip => (
                                <li key={tip} className='text-xs text-purple-700 flex items-start gap-1.5'>
                                    <span className='mt-0.5'>•</span>{tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <MediaPicker
                open={showMediaPicker}
                onClose={() => setShowMediaPicker(false)}
                onSelect={handleMediaPickerSelect}
                multiple
            />
            <ProductPicker 
                open={showProductPicker}
                onClose={() => setShowProductPicker(false)}
                onSelect={handleProductSelect}
            />
        </div>
    );
};

export default ContentStudio;