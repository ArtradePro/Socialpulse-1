import React, { useState, useEffect, useCallback } from 'react';
import {
    Grid3X3, List, Trash2, Search,
    SortAsc, RefreshCw, HardDrive, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

import MediaService, { MediaFile, MediaListParams,
                         MediaSortOption, MediaTypeFilter } from '../services/media.service';
import MediaCard     from '../components/media/MediaCard';
import MediaUploader from '../components/media/MediaUploader';
import UsageBar      from '../components/billing/UsageBar';
import UpgradeModal  from '../components/billing/UpgradeModal';

const SORT_OPTIONS: { value: MediaSortOption; label: string }[] = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'name',   label: 'Name A–Z'     },
    { value: 'size',   label: 'Largest first' },
];

const MediaLibraryPage: React.FC = () => {
    const [files,      setFiles]      = useState<MediaFile[]>([]);
    const [total,      setTotal]      = useState(0);
    const [page,       setPage]       = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading,    setLoading]    = useState(true);
    const [selected,   setSelected]   = useState<Set<string>>(new Set());
    const [viewMode,   setViewMode]   = useState<'grid' | 'list'>('grid');
    const [params,     setParams]     = useState<MediaListParams>({
        sort: 'newest', type: 'all', page: 1, limit: 24,
    });
    const [search,     setSearch]     = useState('');
    const [storage,    setStorage]    = useState<any>(null);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [showUploader, setShowUploader] = useState(false);

    // Fetch files
    const fetchFiles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await MediaService.list({ ...params, search: search || undefined });
            setFiles(res.files);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        } catch {
            toast.error('Failed to load media');
        } finally {
            setLoading(false);
        }
    }, [params, search]);

    // Fetch storage usage
    const fetchStorage = useCallback(async () => {
        try {
            const res = await MediaService.getStorageUsage();
            setStorage(res);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);
    useEffect(() => { fetchStorage(); }, [fetchStorage]);

    // Listen for upgrade events from useUpload hook
    useEffect(() => {
        const handler = () => setUpgradeOpen(true);
        window.addEventListener('plan:upgrade-required', handler);
        return () => window.removeEventListener('plan:upgrade-required', handler);
    }, []);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this file?')) return;
        try {
            await MediaService.delete(id);
            toast.success('File deleted');
            fetchFiles();
            fetchStorage();
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleBulkDelete = async () => {
        if (!selected.size) return;
        if (!window.confirm(`Delete ${selected.size} file(s)?`)) return;
        try {
            const { deleted } = await MediaService.bulkDelete([...selected]);
            toast.success(`${deleted} file(s) deleted`);
            setSelected(new Set());
            fetchFiles();
            fetchStorage();
        } catch {
            toast.error('Bulk delete failed');
        }
    };

    const handleUploaded = () => {
        fetchFiles();
        fetchStorage();
        toast.success(`Files added to your library`);
        setShowUploader(false);
    };

    const handleCopyUrl = (url: string) => toast.success('URL copied!', { duration: 2000 });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {total.toLocaleString()} file{total !== 1 ? 's' : ''}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {storage && (
                        <div className="w-48 hidden sm:block">
                            <UsageBar
                                label="Storage"
                                used={Math.round(storage.totalBytes / (1024 * 1024))}
                                limit={storage.limitBytes ? Math.round(storage.limitBytes / (1024 * 1024)) : 'unlimited'}
                                formatUsed={n => `${n} MB`}
                                formatLimit={n => n === 'unlimited' ? '∞' : `${n} MB`}
                                icon={<HardDrive className="w-4 h-4 text-purple-500" />}
                            />
                        </div>
                    )}
                    <button
                        onClick={() => setShowUploader(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Upload
                    </button>
                </div>
            </div>

            {/* Uploader (toggle) */}
            {showUploader && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <MediaUploader folder="library" onUploaded={handleUploaded} />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search files…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                    {(['all', 'image', 'video'] as MediaTypeFilter[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setParams(p => ({ ...p, type: t, page: 1 }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                                params.type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <select
                    value={params.sort}
                    onChange={e => setParams(p => ({ ...p, sort: e.target.value as MediaSortOption }))}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
                        <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
                        <List className="w-4 h-4" />
                    </button>
                </div>

                <button onClick={fetchFiles} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <span className="text-sm font-medium text-purple-700">{selected.size} selected</span>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-purple-500 hover:underline">Clear</button>
                    <button onClick={handleBulkDelete} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">
                        <Trash2 className="w-3.5 h-3.5" /> Delete selected
                    </button>
                </div>
            )}

            {/* Library Grid */}
            {loading ? (
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' : 'grid-cols-1'}`}>
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="animate-pulse bg-gray-100 rounded-xl aspect-square" />
                    ))}
                </div>
            ) : files.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <HardDrive className="w-14 h-14 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No files yet</p>
                    <p className="text-sm mt-1">Upload your first file above</p>
                </div>
            ) : (
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                    {files.map(f => (
                        <MediaCard
                            key={f.id}
                            file={f}
                            selected={selected.has(f.id)}
                            onSelect={toggleSelect}
                            onDelete={handleDelete}
                            onCopyUrl={handleCopyUrl}
                        />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                    <button
                        onClick={() => setParams(p => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))}
                        disabled={params.page === 1}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-40"
                    >
                        ← Prev
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-500">{params.page} / {totalPages}</span>
                    <button
                        onClick={() => setParams(p => ({ ...p, page: Math.min(totalPages, (params.page ?? 1) + 1) }))}
                        disabled={params.page === totalPages}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-40"
                    >
                        Next →
                    </button>
                </div>
            )}

            <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="storage" />
        </div>
    );
};

export default MediaLibraryPage;
