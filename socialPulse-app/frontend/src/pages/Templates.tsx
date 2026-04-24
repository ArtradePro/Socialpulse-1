import React, { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Trash2, Pencil, X, Loader2, Copy, Check,
         Globe, Lock, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

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

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const togglePlatform = (p: string) =>
        setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

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
                isPublic,
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
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Product Announcement"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                        <textarea
                            required
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={6}
                            placeholder="Write your template content here…"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                        <p className="mt-1 text-xs text-gray-400 text-right">{content.length} chars</p>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <input
                            type="text"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            placeholder="e.g. Product, Event, Promo"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Platforms */}
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

                    {/* Public toggle */}
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
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                                        border-2 border-transparent transition-colors ${
                                isPublic ? 'bg-indigo-600' : 'bg-gray-200'
                            }`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white
                                             shadow transform transition-transform ${
                                isPublic ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm
                                       font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm
                                       font-medium hover:bg-indigo-700 disabled:opacity-50
                                       flex items-center justify-center gap-2 transition-colors"
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
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template: t, onEdit, onDelete }) => {
    const [copied, setCopied] = useState(false);

    const copyContent = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(t.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300
                        hover:shadow-sm transition-all flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold text-gray-900 truncate">{t.name}</h2>
                        {t.category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                {t.category}
                            </span>
                        )}
                        {t.is_public
                            ? <Globe className="w-3.5 h-3.5 text-green-500 shrink-0" title="Public" />
                            : <Lock  className="w-3.5 h-3.5 text-gray-400 shrink-0"  title="Private" />
                        }
                        {!t.is_mine && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                                Community
                            </span>
                        )}
                    </div>
                    {t.platforms && t.platforms.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {t.platforms.map(p => (
                                <span key={p}
                                      className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50
                                                 text-indigo-600 font-medium capitalize">
                                    {p}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={copyContent}
                        title="Copy content"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                   rounded-lg transition-colors"
                    >
                        {copied
                            ? <Check    className="w-4 h-4 text-green-500" />
                            : <Copy     className="w-4 h-4" />}
                    </button>
                    {t.is_mine && (
                        <>
                            <button
                                onClick={() => onEdit(t)}
                                title="Edit"
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                           rounded-lg transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(t.id)}
                                title="Delete"
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50
                                           rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content preview */}
            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{t.content}</p>
        </div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const Templates: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [search,    setSearch]    = useState('');
    const [tab,       setTab]       = useState<'mine' | 'all'>('mine');
    const [modal,     setModal]     = useState<{ open: boolean; editing: Template | null }>({
        open: false, editing: null,
    });

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get<Template[]>('/templates', {
                params: { search: search || undefined },
            });
            setTemplates(data);
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
        if (!confirm('Delete this template? This cannot be undone.')) return;
        try {
            await api.delete(`/templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success('Template deleted');
        } catch {
            toast.error('Failed to delete template');
        }
    };

    const visible = tab === 'mine'
        ? templates.filter(t => t.is_mine)
        : templates;

    const myCount        = templates.filter(t => t.is_mine).length;
    const communityCount = templates.filter(t => !t.is_mine).length;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Reusable post templates — apply them instantly from the Content Studio
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600
                               to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> New Template
                </button>
            </div>

            {/* Search + tabs */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search templates…"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl
                                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
                    {([
                        { key: 'mine', label: `My Templates (${myCount})` },
                        { key: 'all',  label: `All (${templates.length}${communityCount > 0 ? ` · ${communityCount} community` : ''})` },
                    ] as const).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                tab === key
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : visible.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">
                        {tab === 'mine' ? 'No templates yet' : 'No templates found'}
                    </p>
                    {tab === 'mine' && (
                        <>
                            <p className="text-gray-400 text-sm mt-1">
                                Create a template to quickly reuse content when writing posts
                            </p>
                            <button
                                onClick={openCreate}
                                className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm
                                           font-medium hover:bg-indigo-700 transition-colors"
                            >
                                Create your first template
                            </button>
                        </>
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
