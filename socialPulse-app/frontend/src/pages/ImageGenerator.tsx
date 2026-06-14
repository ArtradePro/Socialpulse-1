import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Download, Copy, Loader2, ImageIcon, Paintbrush, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import MediaPicker from '../components/media/MediaPicker';
import { MediaFile } from '../services/media.service';

type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';

const SIZE_OPTIONS: { value: ImageSize; label: string; desc: string }[] = [
    { value: '1024x1024', label: 'Square',    desc: '1:1  — Instagram, Twitter' },
    { value: '1792x1024', label: 'Landscape', desc: '16:9 — Twitter header, Facebook' },
    { value: '1024x1792', label: 'Portrait',  desc: '9:16 — Instagram Stories, TikTok' },
];

export const ImageGenerator: React.FC = () => {
    const navigate                      = useNavigate();
    const [prompt,      setPrompt]      = useState('');
    const [size,        setSize]        = useState<ImageSize>('1024x1024');
    const [generating,  setGenerating]  = useState(false);
    const [imageUrl,    setImageUrl]    = useState<string | null>(null);
    const [history,     setHistory]     = useState<{ prompt: string; url: string }[]>([]);
    const [refImage,    setRefImage]    = useState<MediaFile | null>(null);
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setGenerating(true);
        try {
            const { data } = await api.post('/ai/image', { 
                prompt, 
                size,
                referenceImageUrl: refImage?.url
            });
            setImageUrl(data.url);
            setHistory(prev => [{ prompt, url: data.url }, ...prev.slice(0, 7)]);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'Image generation failed';
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    const insertToken = () => {
        setPrompt(prev => {
            const token = '@Image';
            if (prev.endsWith(' ') || prev.length === 0) {
                return prev + token;
            }
            return prev + ' ' + token;
        });
    };

    const downloadImage = async () => {
        if (!imageUrl) return;
        try {
            const res  = await fetch(imageUrl);
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'generated-image.png'; a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error('Download failed'); }
    };

    const copyUrl = () => {
        if (!imageUrl) return;
        navigator.clipboard.writeText(imageUrl);
        toast.success('URL copied');
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Image Generator</h1>
                <p className="text-sm text-gray-500 mt-1">Generate custom images for your posts using DALL-E 3 · costs 2 AI credits</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: controls */}
                <div className="space-y-4">
                    <form onSubmit={handleGenerate} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Describe your image</label>
                                <textarea
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    rows={5}
                                    placeholder="A minimalist flat-lay of a coffee cup on a marble surface with autumn leaves, warm lighting, professional product photography style…"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            {/* Reference Image Option */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Reference Image (optional)</label>
                                    {!refImage && (
                                        <button
                                            type="button"
                                            onClick={() => setShowMediaPicker(true)}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
                                        >
                                            <ImageIcon className="w-3.5 h-3.5" /> Select Reference
                                        </button>
                                    )}
                                </div>

                                {refImage ? (
                                    <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/80 transition-all">
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-indigo-200 shrink-0">
                                            <img src={refImage.url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-700 truncate">{refImage.originalName}</p>
                                            <button
                                                type="button"
                                                onClick={insertToken}
                                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold mt-1 flex items-center gap-1 transition-colors"
                                            >
                                                Use <span className="bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">@Image</span> in prompt
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setRefImage(null)}
                                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-gray-200 hover:border-indigo-300 rounded-xl p-3 text-center transition-colors">
                                        <button
                                            type="button"
                                            onClick={() => setShowMediaPicker(true)}
                                            className="inline-flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors py-1 w-full"
                                        >
                                            <ImageIcon className="w-4 h-4 text-gray-400" />
                                            <span>Attach consistent subject/product reference image</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                            <div className="grid grid-cols-3 gap-2">
                                {SIZE_OPTIONS.map(opt => (
                                    <button key={opt.value} type="button" onClick={() => setSize(opt.value)}
                                        className={`py-2.5 px-3 rounded-xl border text-left transition-colors ${size === opt.value ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                                        <p className={`text-sm font-medium ${size === opt.value ? 'text-indigo-700' : 'text-gray-800'}`}>{opt.label}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button type="submit" disabled={generating || !prompt.trim()}
                            className="w-full py-3 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                            {generating
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                                : <><Sparkles className="w-4 h-4" /> Generate Image</>}
                        </button>
                    </form>

                    {/* Tips */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-sm text-gray-600 space-y-1">
                        <p className="font-medium text-gray-700">Prompt tips</p>
                        <ul className="space-y-1 text-xs text-gray-500 list-disc list-inside">
                            <li>Specify style: "watercolor", "photorealistic", "flat illustration"</li>
                            <li>Add lighting: "golden hour", "soft studio light", "dramatic shadows"</li>
                            <li>Include mood: "minimalist", "vibrant", "cozy", "professional"</li>
                            <li>Mention composition: "close-up", "bird's eye view", "centered"</li>
                        </ul>
                    </div>
                </div>

                {/* Right: preview */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        {generating ? (
                            <div className="flex flex-col items-center justify-center h-72 gap-3 text-gray-400">
                                <Loader2 className="w-10 h-10 animate-spin" />
                                <p className="text-sm">Generating your image…</p>
                            </div>
                        ) : imageUrl ? (
                            <>
                                <img src={imageUrl} alt="Generated" className="w-full object-cover" />
                                <div className="p-4 flex gap-2 flex-wrap">
                                    <button onClick={downloadImage}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                        <Download className="w-4 h-4" /> Download
                                    </button>
                                    <button onClick={copyUrl}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                        <Copy className="w-4 h-4" /> Copy URL
                                    </button>
                                    <button onClick={() => navigate(`/image-editor?src=${encodeURIComponent(imageUrl!)}`)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                                        <Paintbrush className="w-4 h-4" /> Edit
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-72 text-gray-300 gap-2">
                                <ImageIcon className="w-12 h-12" />
                                <p className="text-sm text-gray-400">Your image will appear here</p>
                            </div>
                        )}
                    </div>

                    {/* History */}
                    {history.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">Recent generations</p>
                            <div className="grid grid-cols-4 gap-2">
                                {history.map((h, i) => (
                                    <button key={i} onClick={() => setImageUrl(h.url)} title={h.prompt}
                                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${imageUrl === h.url ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'}`}>
                                        <img src={h.url} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <MediaPicker
                open={showMediaPicker}
                onClose={() => setShowMediaPicker(false)}
                onSelect={(files) => setRefImage(files[0] || null)}
                multiple={false}
            />
        </div>
    );
};

export default ImageGenerator;
