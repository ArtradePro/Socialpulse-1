import React, { useState, useEffect } from 'react';
import { 
    Wand2, Image, Hash, Smile, Calendar, Send, Save, 
    Loader2, X, FolderOpen, FileText, Tag, Megaphone,
    Share2 as TwitterIcon, 
    Share2 as InstagramIcon, 
    Share2 as LinkedinIcon, 
    Share2 as FacebookIcon 
} from "lucide-react";
import toast from 'react-hot-toast';
import api from '../services/api';
import MediaPicker from '../components/media/MediaPicker';
import { MediaFile } from '../services/media.service';

const platforms = [
    { id: 'twitter', label: 'Twitter/X', icon: TwitterIcon, color: 'text-sky-500', limit: 280 },
    { id: 'instagram', label: 'Instagram', icon: InstagramIcon, color: 'text-pink-600', limit: 2200 },
    { id: 'linkedin', label: 'LinkedIn', icon: LinkedinIcon, color: 'text-blue-700', limit: 3000 },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon, color: 'text-blue-600', limit: 63206 },
];
const tones = ['Professional', 'Casual', 'Humorous', 'Inspirational', 'Educational', 'Promotional'];
const contentLengths = ['Short', 'Medium', 'Long'];

interface Template { id: string; name: string; content: string; }
interface HashtagSet { id: string; name: string; hashtags: string[]; }
interface Campaign { id: string; name: string; }

export const ContentStudio: React.FC = () => {
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

    const handleSaveOrPublish = async (action: 'draft' | 'schedule' | 'publish') => {
        if (!content.trim()) { toast.error('Please write some content'); return; }
        if (selectedPlatforms.length === 0) { toast.error('Select at least one platform'); return; }
        if (action === 'schedule' && !scheduledAt) { toast.error('Please set a schedule time'); return; }
        action === 'draft' ? setIsSaving(true) : setIsPublishing(true);
        try {
            await api.post('/posts', {
                content: `${content}\n\n`.trim(),
                platforms: selectedPlatforms, hashtags, mediaUrls,
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
        <div className='max-w-6xl mx-auto'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                <div className='lg:col-span-2 space-y-4'>
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
                        <div className='flex border-b border-gray-100'>
                            {(['write', 'ai'] as const).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500 hover:text-gray-700'}`}>
                                    {tab === 'write' ? '✍️ Write' : '🤖 AI Writer'}
                                </button>
                            ))}
                        </div>
                        {activeTab === 'write' ? (
                            <div className='p-4'>
                                <textarea value={content} onChange={e => setContent(e.target.value)}
                                    placeholder='Start writing your post...'
                                    className='w-full h-48 resize-none focus:outline-none text-gray-800 placeholder-gray-400 text-base' />
                                {hashtags.length > 0 && (
                                    <div className='flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100'>
                                        {hashtags.map(tag => (
                                            <div key={tag} className='flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm'>
                                                <span>{tag}</span>
                                                <button onClick={() => setHashtags(prev => prev.filter(h => h !== tag))}><X className='w-3 h-3' /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {mediaUrls.length > 0 && (
                                    <div className='grid grid-cols-4 gap-2 mt-3'>
                                        {mediaUrls.map((url, i) => (
                                            <div key={i} className='relative rounded-lg overflow-hidden aspect-square'>
                                                <img src={url} alt='' className='w-full h-full object-cover' />
                                                <button onClick={() => removeMedia(i)} className='absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center'>
                                                    <X className='w-3 h-3' />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className='flex items-center justify-between mt-4 pt-3 border-t border-gray-100'>
                                    <div className='flex items-center gap-1 flex-wrap'>
                                        <label className='p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors' title='Upload file'>
                                            <Image className='w-5 h-5 text-gray-500' />
                                            <input type='file' className='hidden' accept='image/*,video/*' multiple onChange={handleFileUpload} />
                                        </label>
                                        <button
                                            onClick={() => setShowMediaPicker(true)}
                                            className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
                                            title='Pick from Media Library'
                                        >
                                            <FolderOpen className='w-5 h-5 text-gray-500' />
                                        </button>
                                        <div className='relative'>
                                            <button
                                                onClick={() => { setShowHashtagSets(v => !v); setShowTemplates(false); }}
                                                className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
                                                title='Insert Hashtag Set'
                                            >
                                                <Tag className='w-5 h-5 text-gray-500' />
                                            </button>
                                            {showHashtagSets && hashtagSets.length > 0 && (
                                                <div className='absolute left-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-48 py-1'>
                                                    {hashtagSets.map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => applyHashtagSet(s)}
                                                            className='w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate'
                                                        >
                                                            <span className='font-medium'>{s.name}</span>
                                                            <span className='text-gray-400 ml-1'>({s.hashtags.length})</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className='relative'>
                                            <button
                                                onClick={() => { setShowTemplates(v => !v); setShowHashtagSets(false); }}
                                                className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
                                                title='Load Template'
                                            >
                                                <FileText className='w-5 h-5 text-gray-500' />
                                            </button>
                                            {showTemplates && templates.length > 0 && (
                                                <div className='absolute left-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-56 py-1 max-h-56 overflow-y-auto'>
                                                    {templates.map(t => (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => applyTemplate(t)}
                                                            className='w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate'
                                                        >
                                                            {t.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleGenerateHashtags} className='p-2 hover:bg-gray-100 rounded-lg transition-colors' title='Generate hashtags'>
                                            <Hash className='w-5 h-5 text-gray-500' />
                                        </button>
                                        <button className='p-2 hover:bg-gray-100 rounded-lg transition-colors' title='Add emoji'>
                                            <Smile className='w-5 h-5 text-gray-500' />
                                        </button>
                                    </div>
                                    <span className={`text-sm font-medium ${content.length > charLimit * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {content.length}/{charLimit}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className='p-4 space-y-4'>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-1'>Topic or Prompt</label>
                                    <input type='text' value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                                        placeholder='e.g. Benefits of remote work for productivity'
                                        className='w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm' />
                                </div>
                                <div className='grid grid-cols-2 gap-3'>
                                    <div>
                                        <label className='block text-sm font-medium text-gray-700 mb-1'>Tone</label>
                                        <select value={aiTone} onChange={e => setAiTone(e.target.value)} className='w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm'>
                                            {tones.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className='block text-sm font-medium text-gray-700 mb-1'>Length</label>
                                        <select value={aiLength} onChange={e => setAiLength(e.target.value)} className='w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm'>
                                            {contentLengths.map(l => <option key={l}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleAIGenerate} disabled={isGenerating}
                                    className='w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-60'>
                                    {isGenerating ? <><Loader2 className='w-4 h-4 animate-spin' /> Generating...</> : <><Wand2 className='w-4 h-4' /> Generate with AI</>}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>Schedule (optional)</label>
                        <input type='datetime-local' value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className='w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm' />
                    </div>

                    <div className='flex gap-3'>
                        <button onClick={() => handleSaveOrPublish('draft')} disabled={isSaving}
                            className='flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors'>
                            <Save className='w-4 h-4' /> Save Draft
                        </button>
                        {scheduledAt ? (
                            <button onClick={() => handleSaveOrPublish('schedule')} disabled={isPublishing}
                                className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors'>
                                <Calendar className='w-4 h-4' /> Schedule Post
                            </button>
                        ) : (
                            <button onClick={() => handleSaveOrPublish('publish')} disabled={isPublishing}
                                className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-60'>
                                {isPublishing ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />} Publish Now
                            </button>
                        )}
                    </div>
                </div>

                <div className='space-y-4'>
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
                        <h3 className='text-sm font-semibold text-gray-900 mb-3'>Publish To</h3>
                        <div className='space-y-2'>
                            {platforms.map(({ id, label, icon: Icon }) => (
                                <button key={id} onClick={() => togglePlatform(id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all ${selectedPlatforms.includes(id) ? 'border-purple-600 bg-purple-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                                    <Icon className={`w-5 h-5 ${selectedPlatforms.includes(id) ? 'text-purple-600' : 'text-gray-400'}`} />
                                    <span className={`text-sm font-medium ${selectedPlatforms.includes(id) ? 'text-purple-900' : 'text-gray-700'}`}>{label}</span>
                                    {selectedPlatforms.includes(id) && <div className='ml-auto w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center'><span className='text-white text-[10px]'>✓</span></div>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
                        <h3 className='text-sm font-semibold text-gray-900 mb-3'>Preview</h3>
                        <div className='bg-gray-50 rounded-xl p-4 min-h-32'>
                            {content ? (
                                <div>
                                    <div className='flex items-center gap-2 mb-3'>
                                        <div className='w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full' />
                                        <div><p className='text-xs font-medium text-gray-900'>Your Name</p><p className='text-xs text-gray-500'>@username</p></div>
                                    </div>
                                    <p className='text-sm text-gray-800 whitespace-pre-wrap'>{content}</p>
                                    {hashtags.length > 0 && <p className='text-sm text-blue-500 mt-2'>{hashtags.join(' ')}</p>}
                                    {mediaUrls[0] && <img src={mediaUrls[0]} alt='' className='mt-3 rounded-lg w-full object-cover max-h-40' />}
                                </div>
                            ) : <p className='text-sm text-gray-400 text-center pt-8'>Start writing to see preview...</p>}
                        </div>
                    </div>

                    {campaigns.length > 0 && (
                        <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
                            <div className='flex items-center gap-2 mb-2'>
                                <Megaphone className='w-4 h-4 text-indigo-600' />
                                <h3 className='text-sm font-semibold text-gray-900'>Campaign (optional)</h3>
                            </div>
                            <select
                                value={campaignId}
                                onChange={e => setCampaignId(e.target.value)}
                                className='w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm'
                            >
                                <option value=''>No campaign</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className='bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-100 p-4'>
                        <div className='flex items-center gap-2 mb-2'>
                            <Wand2 className='w-4 h-4 text-purple-600' />
                            <span className='text-sm font-semibold text-purple-900'>AI Tips</span>
                        </div>
                        <ul className='space-y-1.5'>
                            {['Post between 9-11am for max reach', 'Include a question to boost comments', 'Use 3-5 hashtags on Instagram', 'Tag relevant accounts to expand reach'].map(tip => (
                                <li key={tip} className='text-[10px] text-purple-700 flex items-start gap-1.5'><span className='mt-0.5'>•</span>{tip}</li>
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
        </div>
    );
};

export default ContentStudio;