import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Trash2, Pencil, X, Loader2, Copy, Check,
         Globe, Lock, Search, Palette, Layout, Video, Sparkles, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import ResourceCard from '../components/content/ResourceCard';

interface Template {
    id:         string;
    user_id:    string;
    name:       string;
    content:    string;
    category:   string | null;
    platforms:  string[] | null;
    is_public:  boolean;
    is_mine:    boolean;
    created_at: string;
}

const PLATFORM_OPTIONS = ['twitter', 'instagram', 'linkedin', 'facebook'] as const;

const PLATFORM_LABELS: Record<string, string> = {
    twitter:   'Twitter',
    instagram: 'Instagram',
    linkedin:  'LinkedIn',
    facebook:  'Facebook',
};

const EXTERNAL_RESOURCES = [
    {
        name: 'Canva',
        description: 'The world\'s most popular design tool for social media. Thousands of ready-to-use templates.',
        bestFor: ['Posts', 'Stories', 'Ads', 'Carousels'],
        rating: 5,
        url: 'https://www.canva.com/templates/',
        icon: <Palette className="w-6 h-6" />,
        color: 'canva',
        isPremium: true
    },
    {
        name: 'Figma Community',
        description: 'Professional design files, brand kits, and high-fidelity social media packs from top designers.',
        bestFor: ['Brand Kits', 'UI Design', 'Vector Assets'],
        rating: 5,
        url: 'https://www.figma.com/community/search?model_type=hub&q=social+media',
        icon: <Layout className="w-6 h-6" />,
        color: 'bg-purple-500',
        isPremium: true
    },
    {
        name: 'CapCut',
        description: 'Powerful video editor with trending templates for TikTok, Reels, and YouTube Shorts.',
        bestFor: ['Reels', 'TikToks', 'Video Ads'],
        rating: 5,
        url: 'https://www.capcut.com/templates',
        icon: <Video className="w-6 h-6" />,
        color: 'bg-black',
        isPremium: true
    },
    {
        name: 'VistaCreate',
        description: 'Easy-to-use graphic design tool with a massive library of animated and static templates.',
        bestFor: ['Animations', 'Static Posts', 'Covers'],
        rating: 4,
        url: 'https://vistacreate.com/templates/',
        icon: <Sparkles className="w-6 h-6" />,
        color: 'bg-indigo-500'
    },
    {
        name: 'Adobe Express',
        description: 'Quickly and easily create standout social graphics, videos, and more from Adobe.',
        bestFor: ['Modern Layouts', 'Quick Edits', 'PDFs'],
        rating: 3,
        url: 'https://www.adobe.com/express/create/social-media',
        icon: <Palette className="w-6 h-6" />,
        color: 'bg-red-500'
    }
];

// ─── Create / Edit modal ──────────────────────────────────────────────────────

interface TemplateModalProps {
    initial?: Template | null;
    onClose:  () => void;
    onSaved:  (t: Template) => void;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ initial, onClose, onSaved }) => {
    const [name,      setName]      = useState(initial?.name ?? '');
    const [content,   setContent]   = useState(initial?.content ?? '');
    const [category,  setCategory]  = useState(initial?.category ?? '');
    const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? []);
    const [isPublic,  setIsPublic]  = useState(initial?.is_public ?? false);
    const [saving,    setSaving]    = useState(false);
    const [improving, setImproving] = useState(false);

    // Hashtag Bundle Manager states
    const [savedSets, setSavedSets] = useState<any[]>([]);
    const [showHashtagDrawer, setShowHashtagDrawer] = useState(false);
    const [hashtagTopic, setHashtagTopic] = useState('');
    const [generatingTags, setGeneratingTags] = useState(false);
    const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
    const [selectedSuggestedTags, setSelectedSuggestedTags] = useState<string[]>([]);

    useEffect(() => {
        // Fetch saved hashtag sets
        api.get('/hashtag-sets')
            .then(({ data }) => setSavedSets(data))
            .catch(() => {});
    }, []);

    const handleGenerateHashtags = async () => {
        if (!hashtagTopic.trim()) return;
        setGeneratingTags(true);
        try {
            const { data } = await api.post('/ai/hashtags', {
                topic: hashtagTopic.trim(),
                platform: platforms[0] || 'twitter',
                count: 8
            });
            const tags = data.hashtags || [];
            setSuggestedTags(tags);
            setSelectedSuggestedTags(tags);
            toast.success('Hashtags suggested!');
        } catch {
            toast.error('Failed to generate suggestions');
        } finally {
            setGeneratingTags(false);
        }
    };

    const handleInsertSuggested = () => {
        if (selectedSuggestedTags.length === 0) return;
        const tagsStr = '\n\n' + selectedSuggestedTags.join(' ');
        setContent(prev => prev + tagsStr);
        setSuggestedTags([]);
        toast.success('Hashtags inserted!');
    };

    const handleInsertSavedSet = (set: any) => {
        const tagsStr = '\n\n' + set.hashtags.join(' ');
        setContent(prev => prev + tagsStr);
        toast.success(`Set "${set.name}" inserted!`);
    };

    const toggleSuggestedTag = (tag: string) => {
        setSelectedSuggestedTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const togglePlatform = (p: string) =>
        setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

    const handleAIImprove = async () => {
        if (!content.trim()) return;
        setImproving(true);
        try {
            const { data } = await api.post('/ai/improve', { 
                content,
                platform: platforms[0] || 'twitter' 
            });
            setContent(data.improvedContent);
            toast.success('AI has optimized your content!');
        } catch {
            toast.error('AI optimization failed');
        } finally {
            setImproving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim())    { toast.error('Name is required');    return; }
        if (!content.trim()) { toast.error('Content is required'); return; }

        setSaving(true);
        try {
            const payload = {
                name:      name.trim(),
                content:   content.trim(),
                category:  category.trim() || undefined,
                platforms: platforms.length > 0 ? platforms : undefined,
                is_public: isPublic, // Ensure snake_case matches backend if necessary
            };
            const { data } = initial
                ? await api.patch<Template>(`/templates/${initial.id}`, payload)
                : await api.post<Template>('/templates', payload);
            onSaved(data);
            toast.success(initial ? 'Template updated' : 'Template created');
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-gray-200 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {initial ? 'Edit Template' : 'New Template'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Product Announcement"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">Content *</label>
                            <button 
                                type="button"
                                onClick={handleAIImprove}
                                disabled={improving || !content.trim()}
                                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50"
                            >
                                {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                AI Optimize
                            </button>
                        </div>
                        <textarea
                            required
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={6}
                            placeholder="Write your template content here…"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                        <p className="mt-1 text-xs text-gray-400 text-right">{content.length} chars</p>

                        {/* Hashtag Bundle Drawer Section */}
                        <div className="mt-3 bg-gray-50 border border-gray-200/60 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                    ✨ Gemini Hashtag Bundle Manager
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowHashtagDrawer(p => !p)}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    {showHashtagDrawer ? 'Hide Manager' : 'Show Manager'}
                                </button>
                            </div>

                            {showHashtagDrawer && (
                                <div className="space-y-4 border-t border-gray-200/50 pt-3">
                                    {/* AI SUGGESTION */}
                                    <div className="space-y-2">
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                            AI Suggestions (Gemini)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={hashtagTopic}
                                                onChange={e => setHashtagTopic(e.target.value)}
                                                placeholder="e.g. Artificial Intelligence, Marketing"
                                                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleGenerateHashtags}
                                                disabled={generatingTags || !hashtagTopic.trim()}
                                                className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {generatingTags ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Suggest'}
                                            </button>
                                        </div>

                                        {suggestedTags.length > 0 && (
                                            <div className="bg-white border border-gray-200/60 rounded-xl p-3 space-y-2">
                                                <p className="text-[10px] text-gray-400">Select hashtags to append:</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {suggestedTags.map(tag => (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            onClick={() => toggleSuggestedTag(tag)}
                                                            className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                                                                selectedSuggestedTags.includes(tag)
                                                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'
                                                            }`}
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleInsertSuggested}
                                                    className="w-full py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Insert Selected Tags
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* SAVED SETS */}
                                    <div className="space-y-2 border-t border-gray-200/40 pt-3">
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                            Saved Hashtag Sets ({savedSets.length})
                                        </label>
                                        {savedSets.length === 0 ? (
                                            <p className="text-[10px] text-gray-400">No pre-saved sets. Create them in "Hashtag Sets" page!</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                                                {savedSets.map(set => (
                                                    <button
                                                        key={set.id}
                                                        type="button"
                                                        onClick={() => handleInsertSavedSet(set)}
                                                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 flex items-center gap-1 transition-colors"
                                                    >
                                                        #{set.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <input
                            type="text"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            placeholder="e.g. Product, Event, Promo"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                        <div className="flex flex-wrap gap-2">
                            {PLATFORM_OPTIONS.map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => togglePlatform(p)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                        platforms.includes(p)
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                                    }`}
                                >
                                    {PLATFORM_LABELS[p]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Make public</p>
                            <p className="text-xs text-gray-400">Other users can see and use this template</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isPublic}
                            onClick={() => setIsPublic(p => !p)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                isPublic ? 'bg-indigo-600' : 'bg-gray-200'
                            }`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                                isPublic ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {initial ? 'Save Changes' : 'Create Template'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Template card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
    template: Template;
    onEdit:   (t: Template) => void;
    onDelete: (id: string) => void;
    onUse:    (content: string) => void;
    onClone:  (t: Template) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template: t, onEdit, onDelete, onUse, onClone }) => {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const copyContent = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(t.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isLong = t.content.length > 200;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold text-gray-900 truncate">{t.name}</h2>
                        {t.category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                {t.category}
                            </span>
                        )}
                        {/* FIX: Removed 'title' from Lucide icons and used span wrappers for accessibility */}
                        <span title={t.is_public ? "Public Template" : "Private Template"}>
                            {t.is_public
                                ? <Globe className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                : <Lock  className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            }
                        </span>
                        {!t.is_mine && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                                Community
                            </span>
                        )}
                    </div>
                    {t.platforms && t.platforms.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {t.platforms.map(p => (
                                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium capitalize">
                                    {p}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={copyContent}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                        {copied
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <Copy  className="w-4 h-4" />}
                    </button>
                    {t.is_mine && (
                        <>
                            <button
                                onClick={() => onUse(t.content)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                                title="Use in Content Studio"
                            >
                                <Send className="w-3 h-3" />
                                Use
                            </button>
                            <button
                                onClick={() => onClone(t)}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Duplicate Template"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onEdit(t)}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Template"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(t.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Template"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="relative">
                <p className={`text-sm text-gray-600 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
                    {t.content}
                </p>
                {isLong && (
                    <button 
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-1"
                    >
                        {expanded ? 'Show Less' : 'Read More...'}
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const Templates: React.FC = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [search,    setSearch]    = useState('');
    const [tab,       setTab]       = useState<'mine' | 'all' | 'resources'>('mine');
    const [modal,     setModal]     = useState<{ open: boolean; editing: Template | null }>({
        open: false, editing: null,
    });

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get<Template[]>('/templates', {
                params: { search: search || undefined },
            });
            setTemplates(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Failed to load templates');
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const openCreate = () => setModal({ open: true, editing: null });
    const openEdit   = (t: Template) => setModal({ open: true, editing: t });
    const closeModal = () => setModal({ open: false, editing: null });

    const handleSaved = (saved: Template) => {
        setTemplates(prev => {
            const idx = prev.findIndex(t => t.id === saved.id);
            return idx >= 0
                ? prev.map(t => t.id === saved.id ? saved : t)
                : [saved, ...prev];
        });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this template? This cannot be undone.')) return;
        try {
            await api.delete(`/templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success('Template deleted');
        } catch {
            toast.error('Failed to delete template');
        }
    };

    const templateList = Array.isArray(templates) ? templates : [];

    const visible = tab === 'mine'
        ? templateList.filter(t => t?.is_mine)
        : templateList;

    const myCount        = templateList.filter(t => t?.is_mine).length;
    const communityCount = templateList.filter(t => !t?.is_mine).length;

    const filteredResources = EXTERNAL_RESOURCES.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase()) || 
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.bestFor.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Reusable post templates — apply them instantly from the Content Studio
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> New Template
                </button>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search templates…"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
                    {(['mine', 'all', 'resources'] as const).map((key) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                tab === key
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {key === 'mine' ? `My Templates (${myCount})` : 
                             key === 'all' ? `All (${templates.length})` : 
                             'Design Resources'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : tab === 'resources' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredResources.map(res => (
                        <ResourceCard key={res.name} {...res} />
                    ))}
                    {filteredResources.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                            <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No resources found for "{search}"</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {visible.map(t => (
                        <TemplateCard
                            key={t.id}
                            template={t}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onUse={(content) => navigate('/studio', { state: { initialContent: content } })}
                            onClone={(t) => setModal({ open: true, editing: { ...t, id: '', name: `${t.name} (Copy)` } as any })}
                        />
                    ))}
                </div>
            )}

            {modal.open && (
                <TemplateModal
                    initial={modal.editing}
                    onClose={closeModal}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
};

export default Templates;