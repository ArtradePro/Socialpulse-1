// client/src/components/media/MediaPicker.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import MediaLibrary from './MediaLibrary';
import { MediaFile } from '../../services/media.service';

interface Props {
  open:      boolean;
  onClose:   () => void;
  /** Called with selected files on confirm */
  onSelect:  (files: MediaFile[]) => void;
  /** Allow selecting more than one file */
  multiple?: boolean;
}

export function MediaPicker({ open, onClose, onSelect, multiple = false }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingMap,  setPendingMap]  = useState<Map<string, MediaFile>>(new Map());

  const handleSelect = (file: MediaFile) => {
    if (multiple) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(file.id)) {
          next.delete(file.id);
          setPendingMap(m => { const nm = new Map(m); nm.delete(file.id); return nm; });
        } else {
          next.add(file.id);
          setPendingMap(m => new Map(m).set(file.id, file));
        }
        return next;
      });
    } else {
      setSelectedIds(new Set([file.id]));
      setPendingMap(new Map([[file.id, file]]));
    }
  };

  const confirm = () => {
    onSelect(Array.from(pendingMap.values()));
    onClose();
  };

  if (!open) return null;

  const count = selectedIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-semibold">
            {multiple ? 'Choose files from Media Library' : 'Choose from Media Library'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <MediaLibrary
            selectable
            onSelect={handleSelect}
            selected={multiple ? null : (count === 1 ? Array.from(selectedIds)[0] : null)}
            selectedIds={multiple ? selectedIds : undefined}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <p className="text-gray-400 text-sm">
            {count > 0
              ? multiple ? `${count} file${count !== 1 ? 's' : ''} selected` : Array.from(pendingMap.values())[0]?.originalName
              : 'No file selected'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              disabled={count === 0}
              onClick={confirm}
              className="px-4 py-2 rounded-xl text-sm bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
            >
              {multiple && count > 1 ? `Add ${count} files` : 'Select'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaPicker;

