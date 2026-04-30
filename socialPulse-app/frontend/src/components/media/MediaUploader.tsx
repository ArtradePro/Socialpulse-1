import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { useUpload } from '../../hooks/useUpload';
import { MediaFile } from '../../services/media.service';
import MediaService   from '../../services/media.service';

interface MediaUploaderProps {
    folder?:        string;
    onUploaded?:   (files: MediaFile[]) => void;
    maxFiles?:      number;
    accept?:        string;
    compact?:       boolean;
}

interface PreviewFile {
    file:     File;
    preview:  string;
    isImage:  boolean;
    isVideo:  boolean;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
    folder     = 'uploads',
    onUploaded,
    maxFiles   = 10,
    accept     = 'image/*,video/*',
    compact    = false,
}) => {
    const { upload, uploading, progress, error } = useUpload();
    const [previews,  setPreviews]  = useState<PreviewFile[]>([]);
    const [dragging,  setDragging]  = useState(false);
    const [succeeded, setSucceeded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback((incoming: File[]) => {
        const allowed = incoming.slice(0, maxFiles - previews.length);
        const next = allowed.map(f => ({
            file:    f,
            preview: URL.createObjectURL(f),
            isImage: f.type.startsWith('image/'),
            isVideo: f.type.startsWith('video/'),
        }));
        setPreviews(prev => [...prev, ...next]);
    }, [previews.length, maxFiles]);

    const removePreview = (idx: number) => {
        setPreviews(prev => {
            URL.revokeObjectURL(prev[idx].preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const clear = () => {
        previews.forEach(p => URL.revokeObjectURL(p.preview));
        setPreviews([]);
        setSucceeded(false);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
    }, [addFiles]);

    const handleUpload = async () => {
        if (!previews.length) return;
        const files   = previews.map(p => p.file);
        const results = await upload(files, folder);

        if (results && results.length > 0) {
            setSucceeded(true);
            setTimeout(() => setSucceeded(false), 3000);
            previews.forEach(p => URL.revokeObjectURL(p.preview));
            setPreviews([]);
            onUploaded?.(results);
        }
    };

    if (compact) {
        return (
            <label
                className="flex items-center gap-2 px-3 py-2 border border-dashed
                             border-gray-300 rounded-xl cursor-pointer hover:border-purple-400
                             hover:bg-purple-50 transition-colors text-sm text-gray-600"
            >
                <Upload className="w-4 h-4 text-purple-500" />
                {uploading ? `Uploading… ${progress}%` : 'Upload files'}
                <input
                    type="file" className="hidden"
                    accept={accept} multiple
                    onChange={e => { addFiles(Array.from(e.target.files ?? [])); handleUpload(); }}
                />
            </label>
        );
    }

    return (
        <div className="space-y-4">
            {/* Drop zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                             transition-all ${
                    dragging
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    multiple
                    onChange={e => addFiles(Array.from(e.target.files ?? []))}
                />
                <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center
                                justify-center mx-auto mb-3">
                    <Upload className="w-7 h-7 text-purple-500" />
                </div>
                <p className="text-base font-semibold text-gray-800">
                    Drop files here or <span className="text-purple-600">browse</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">
                    Images & videos up to your plan's file size limit
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Previews */}
            {previews.length > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                        {previews.map((p, i) => (
                            <div key={i} className="relative rounded-xl overflow-hidden aspect-square bg-gray-100">
                                {p.isImage
                                    ? <img src={p.preview} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center">
                                          <span className="text-xs text-gray-500">{p.file.name}</span>
                                      </div>
                                }
                                <button
                                    onClick={(e) => { e.stopPropagation(); removePreview(i); }}
                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white
                                               rounded-full flex items-center justify-center"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                                <div className="absolute bottom-1 left-1 text-[9px] bg-black/50
                                                text-white px-1 rounded">
                                    {MediaService.formatSize(p.file.size)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                            disabled={uploading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Uploading… {progress}%
                                </>
                            ) : succeeded ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Done!
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Start Upload
                                </>
                            )}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); clear(); }}
                            disabled={uploading}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="Clear all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaUploader;
