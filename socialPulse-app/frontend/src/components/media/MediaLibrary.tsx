// client/src/components/media/MediaLibrary.tsx
import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import mediaService, { MediaFile } from '../../services/media.service';
import MediaCard from './MediaCard';
import toast from 'react-hot-toast';

interface Props {
  selectable?: boolean;
  onSelect?: (file: MediaFile) => void;
  selected?: string | null;
}

export default function MediaLibrary({ selectable, onSelect, selected }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cast type to any to bypass the MediaTypeFilter strictness if necessary
      const data = await mediaService.list({ page, limit: 24, type: (type || undefined) as any });
      
      // FIX: Use 'files' and calculate 'pages' correctly based on your API structure
      setFiles(data.files || []); 
      setPages(data.total ? Math.ceil(data.total / 24) : 1);
    } catch {
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [page, type]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      await mediaService.delete(id);
      setFiles(f => f.filter(x => x.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const filtered = query
    ? files.filter(f => f.originalName.toLowerCase().includes(query.toLowerCase()))
    : files;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={type}
          onChange={e => { setType(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
        <button onClick={load} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No media found</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map(f => (
    <MediaCard
        key={f.id}
        file={f}
        // 1. Ensure this is always a boolean
        selected={selectable ? selected === f.id : false}
        
        // 2. Pass the full file object to onSelect
        onSelect={(file) => selectable && onSelect ? onSelect(file) : null}
        
        // 3. Pass the ID string to onDelete
        onDelete={(id) => !selectable ? handleDelete(id) : null}
        
        // 4. Handle the URL copy feedback
        onCopyUrl={(url) => toast.success('Link copied!')}
    />
))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm transition-colors
                ${page === i + 1 ? 'bg-violet-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}