import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Check, Play, FileImage, Images } from 'lucide-react';
import MediaService, { MediaFile, MediaTypeFilter, MediaSortOption } from '../../services/media.service';

interface MediaPickerProps {
    open:      boolean;
    onClose:   () => void;
    onSelect:  (files: MediaFile[]) => void;
    multiple?: boolean;
}

// ─── Picker card — thumbnail + checkbox only, no delete/copy ─────────────────

interface PickerCardProps {
    file:     MediaFile;
    selected: boolean;
    onToggle: (id: string) => void;
}

const PickerCard: React.FC<PickerCardProps> = ({ file, selected, onToggle }) => {
    const isImage = MediaService.isImage(file);
    const isVideo = MediaService.isVideo(file);

    return (
        <div
            onClick={() => onToggle(file.id)}
            className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-150 group ${
                selected
                    ? 'border-purple-500 ring-2 ring-purple-300'
                    : 'border-transparent hover:border-purple-200'
            }`}
        >
            <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {isImage && (
                    <img
                        src={file.thumbnailUrl ?? file.url}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                )}
                {isVideo && (
                    <>
                        {file.thumbnailUrl
                            ? <img src={file.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <Play className="w-8 h-8 text-gray-400" />
                              </div>
                        }
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center">
                                <Play className="w-4 h-4 text-white ml-0.5" />
                            </div>
                        </div>
                    </>
                )}
                {!isImage && !isVideo && (
                    <FileImage className="w-8 h-8 text-gray-400" />
                )}
            </div>

            {/* Checkbox */}
            <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full border-2 flex items-center
                             justify-center transition-all ${
                selected
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
            }`}>
                {selected && <Check className="w-3 h-3 text-white" />}
            </div>

            {/* Name */}
            <div className="p-1.5 bg-white">
                <p className="text-[10px] text-gray-600 truncate" title={file.originalName}>
                    {file.originalName}
                </p>
            </div>
        </div>
    );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
    <div className="rounded-xl overflow-hidden border-2 border-transparent animate-pulse">
        <div className="aspect-square bg-gray-200" />
        <div className="p-1.5 bg-white">
            <div className="h-2.5 bg-gray-200 rounded w-3/4" />
        </div>
    </div>
);

// ─── MediaPicker ─────────────────────────────────────────────────────────────

const MediaPicker: React.FC<MediaPickerProps> = ({ open, onClose, onSelect, multiple = true }) => {
    const [files,      setFiles]      = useState<MediaFile[]>([]);
    const [loading,    setLoading]    = useState(false);
    const [search,     setSearch]     = useState('');
    const [type,       setType]       = useState<MediaTypeFilter>('all');
    const [sort,       setSort]       = useState<MediaSortOption>('newest');
    const [page,       setPage]       = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selected,   setSelected]   = useState<Set<string>>(new Set());
    const [fileMap,    setFileMap]    = useState<Map<string, MediaFile>>(new Map());

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await MediaService.list({ page, limit: 18, sort, type, search: search || undefined });
            setFiles(res.files);
            setTotalPages(res.totalPages);
        } catch {
            // silently keep previous results; toast is noisy inside a modal
        } finally {
            setLoading(false);
        }
    }, [page, sort, type, search]);

    // Reset state whenever modal opens
    useEffect(() => {
        if (!open) return;
        setSelected(new Set());
        setFileMap(new Map());
        setSearch('');
        setType('all');
        setSort('newest');
        setPage(1);
    }, [open]);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    // Page 1 whenever filters change
    useEffect(() => { setPage(1); }, [search, type, sort]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const toggle = (id: string) => {
        const file = files.find(f => f.id === id);
        if (!file) return;

        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                setFileMap(m => { const nm = new Map(m); nm.delete(id); return nm; });
            } else {
                if (!multiple) {
                    next.clear();
                    setFileMap(new Map([[id, file]]));
                } else {
                    setFileMap(m => new Map(m).set(id, file));
                }
                next.add(id);
            }
            return next;
        });
    };

    const confirm = () => {
        onSelect(Array.from(fileMap.values()));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-xl flex flex-col"
                 style={{ maxHeight: '90vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <Images className="h-5 w-5 text-purple-600" />
                        <h2 className="text-base font-semibold text-gray-900">
                            {multiple ? 'Select from Media Library' : 'Choose from Media Library'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 shrink-0 flex-wrap">
                    <div className="relative flex-1 min-w-40">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search files…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg
                                       focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                    </div>

                    <select
                        value={type}
                        onChange={e => setType(e.target.value as MediaTypeFilter)}
                        className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5
                                   focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    >
                        <option value="all">All types</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                    </select>

                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value as MediaSortOption)}
                        className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5
                                   focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    >
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="name">Name</option>
                        <option value="size">Size</option>
                    </select>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                            <Images className="h-10 w-10" />
                            <p className="text-sm">No files found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {files.map(f => (
                                <PickerCard
                                    key={f.id}
                                    file={f}
                                    selected={selected.has(f.id)}
                                    onToggle={toggle}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100 shrink-0">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 text-sm rounded-lg border border-gray-200
                                       disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 text-sm rounded-lg border border-gray-200
                                       disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0">
                    <p className="text-sm text-gray-500">
                        {selected.size > 0
                            ? `${selected.size} file${selected.size !== 1 ? 's' : ''} selected`
                            : 'No files selected'}
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg
                                       hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirm}
                            disabled={selected.size === 0}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                                       bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40
                                       transition-colors"
                        >
                            <Check className="h-4 w-4" />
                            {selected.size > 0 ? `Select (${selected.size})` : 'Select'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaPicker;
