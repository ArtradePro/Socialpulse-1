import React, { useState } from 'react';
import { Play, FileImage, Copy, Trash2, Check } from 'lucide-react';
import MediaService, { MediaFile } from '../../services/media.service';

interface MediaCardProps {
    file:      MediaFile;
    selected:  boolean;
    // Updated to (file: MediaFile) to match the parent's expectations
    onSelect:  (file: MediaFile) => void; 
    onDelete:  (id: string) => void;
    onCopyUrl: (url: string) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({
    file, selected, onSelect, onDelete, onCopyUrl,
}) => {
    const [copied,  setCopied]  = useState(false);
    const [hovered, setHovered] = useState(false);

    const isImage = MediaService.isImage(file);
    const isVideo = MediaService.isVideo(file);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(file.url);
        setCopied(true);
        onCopyUrl(file.url);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(file.id);
    };

    return (
        <div
            // Updated to pass the full 'file' object
            onClick={() => onSelect(file)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`relative rounded-xl overflow-hidden cursor-pointer border-2
                         transition-all duration-150 group ${
                selected
                    ? 'border-purple-500 ring-2 ring-purple-300'
                    : 'border-transparent hover:border-purple-200'
            }`}
        >
            {/* Media preview */}
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
                                  <Play className="w-10 h-10 text-gray-400" />
                              </div>
                        }
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center">
                                <Play className="w-5 h-5 text-white ml-0.5" />
                            </div>
                        </div>
                    </>
                )}
                {!isImage && !isVideo && (
                    <FileImage className="w-10 h-10 text-gray-400" />
                )}
            </div>

            {/* Selection checkbox */}
            <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex
                             items-center justify-center transition-all ${
                selected
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
            }`}>
                {selected && <Check className="w-3 h-3 text-white" />}
            </div>

            {/* Hover overlay */}
            {hovered && (
                <div className="absolute inset-0 bg-black/30 flex items-end justify-between p-2">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                    >
                        {copied
                            ? <Check   className="w-3.5 h-3.5 text-green-600" />
                            : <Copy    className="w-3.5 h-3.5 text-gray-700" />}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="p-1.5 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                </div>
            )}

            {/* File info */}
            <div className="p-2 bg-white">
                <p className="text-xs text-gray-700 truncate font-medium">
                    {file.originalName}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                    {MediaService.formatSize(file.sizeBytes || 0)}
                    {file.width && file.height && ` · ${file.width}×${file.height}`}
                </p>
            </div>
        </div>
    );
};

export default MediaCard;