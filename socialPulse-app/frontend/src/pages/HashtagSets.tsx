import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Hash, Trash2, Pencil, X, Loader2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface HashtagSet {
    id:         string;
    name:       string;
    hashtags:   string[];
    created_at: string;
}

// Accepts: #tag1 #tag2, tag1 tag2, tag1,tag2 — normalises to ['#tag1', '#tag2']
function parseHashtags(raw: string): string[] {
    return raw
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`))
        .filter((t, i, arr) => arr.indexOf(t) === i);
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

interface SetModalProps {
    initial?: HashtagSet | null;
    onClose:  () => void;
    onSaved:  (set: HashtagSet) => void;
}

const SetModal: React.FC<SetModalProps> = ({ initial, onClose, onSaved }) => {
    const [name,   setName]   = useState(initial?.name ?? '');
    const [raw,    setRaw]    = useState(initial?.hashtags.join(' ') ?? '');
    const [saving, setSaving] = useState(false);

    const preview = parseHashtags(raw);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { toast.error('Name is required'); return; }
        if (preview.length === 0) { toast.error('Add at least one hashtag'); return; }

        setSaving(true);
        try {
            const payload = { name: name.trim(), hashtags: preview };
            const { data } = initial
                ? await api.patch<HashtagSet>(`/hashtag-sets/${initial.id}`, payload)
                : await api.post<HashtagSet>('/hashtag-sets', payload);
            onSaved(data);
            toast.success(initial ? 'Set updated' : 'Set created');
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {initial ? 'Edit Set' : 'New Hashtag Set'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Brand Awareness"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Hashtags *
                            <span className="font-normal text-gray-400 ml-1">(space or comma separated)</span>
                        </label>
                        <textarea
                            value={raw}
                            onChange={e => setRaw(e.target.value)}
                            rows={3}
                            placeholder="#marketing #socialmedia branding"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    {preview.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 mb-2">
                                {preview.length} hashtag{preview.length !== 1 ? 's' : ''}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {preview.map(tag => (
                                    <span key={tag}
                                          className="inline-flex items-center px-2.5 py-1 rounded-full
                                                     bg-indigo-50 text-indigo-700 text-xs font-medium">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

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
                            {initial ? 'Save Changes' : 'Create Set'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Set card ─────────────────────────────────────────────────────────────────

interface SetCardProps {
    set:      HashtagSet;
    onEdit:   (set: HashtagSet) => void;
    onDelete: (id: string) => void;
}

const SetCard: React.FC<SetCardProps> = ({ set, onEdit, onDelete }) => {
    const [copied, setCopied] = useState(false);

    const copyAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(set.hashtags.join(' '));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const PREVIEW_MAX = 8;
    const preview  = set.hashtags.slice(0, PREVIEW_MAX);
    const overflow = set.hashtags.length - PREVIEW_MAX;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300
                        hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-indigo-500 shrink-0" />
                        <h2 className="text-base font-semibold text-gray-900 truncate">{set.name}</h2>
                        <span className="text-xs text-gray-400 shrink-0">
                            {set.hashtags.length} tag{set.hashtags.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {preview.map(tag => (
                            <span key={tag}
                                  className="inline-flex items-center px-2.5 py-1 rounded-full
                                             bg-gray-100 text-gray-600 text-xs font-medium">
                                {tag}
                            </span>
                        ))}
                        {overflow > 0 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full
                                             bg-gray-100 text-gray-400 text-xs">
                                +{overflow} more
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={copyAll}
                        title="Copy all hashtags"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                   rounded-lg transition-colors"
                    >
                        {copied
                            ? <Check  className="w-4 h-4 text-green-500" />
                            : <Copy   className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => onEdit(set)}
                        title="Edit"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                   rounded-lg transition-colors"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(set.id)}
                        title="Delete"
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50
                                   rounded-lg transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const HashtagSets: React.FC = () => {
    const [sets,    setSets]    = useState<HashtagSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal,   setModal]   = useState<{ open: boolean; editing: HashtagSet | null }>({
        open: false, editing: null,
    });

    const fetchSets = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get<HashtagSet[]>('/hashtag-sets');
            setSets(data);
        } catch {
            toast.error('Failed to load hashtag sets');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSets(); }, [fetchSets]);

    const openCreate = () => setModal({ open: true, editing: null });
    const openEdit   = (set: HashtagSet) => setModal({ open: true, editing: set });
    const closeModal = () => setModal({ open: false, editing: null });

    const handleSaved = (saved: HashtagSet) => {
        setSets(prev => {
            const idx = prev.findIndex(s => s.id === saved.id);
            return idx >= 0
                ? prev.map(s => s.id === saved.id ? saved : s)
                : [saved, ...prev];
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this hashtag set? This cannot be undone.')) return;
        try {
            await api.delete(`/hashtag-sets/${id}`);
            setSets(prev => prev.filter(s => s.id !== id));
            toast.success('Set deleted');
        } catch {
            toast.error('Failed to delete set');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hashtag Sets</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Save groups of hashtags to apply instantly when composing posts
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600
                               to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> New Set
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : sets.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                    <Hash className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No hashtag sets yet</p>
                    <p className="text-gray-400 text-sm mt-1">
                        Create a set to quickly apply hashtags when writing posts
                    </p>
                    <button
                        onClick={openCreate}
                        className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm
                                   font-medium hover:bg-indigo-700 transition-colors"
                    >
                        Create your first set
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {sets.map(s => (
                        <SetCard key={s.id} set={s} onEdit={openEdit} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {modal.open && (
                <SetModal
                    initial={modal.editing}
                    onClose={closeModal}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
};

export default HashtagSets;
