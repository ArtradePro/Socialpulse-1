import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Download, Copy, Loader2, ImageIcon, Paintbrush } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

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

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        setGenerating(true);
        try {
            const { data } = await api.post('/ai/image', { prompt, size });
            setImageUrl(data.url);
            setHistory(prev => [{ prompt, url: data.url }, ...prev.slice(0, 7)]);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'Image generation failed';
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
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
        </div>
    );
};

export default ImageGenerator;
