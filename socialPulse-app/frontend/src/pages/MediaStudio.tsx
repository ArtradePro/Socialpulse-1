import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Image as ImageIcon, Video, Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

type MediaKind = 'image' | 'video';

interface ParallaxModel {
    id: string;
    kind: MediaKind;
    name: string;
    vendor: string;
    tagline: string;
    eta: number;
}

interface MediaFile {
    id: string;
    url: string;
    mime_type: string;
    thumbnail_url?: string;
}

export const MediaStudio: React.FC = () => {
    const navigate = useNavigate();
    const [kind, setKind] = useState<MediaKind>('image');
    const [configured, setConfigured] = useState<boolean>(true);
    const [configMessage, setConfigMessage] = useState<string>('');
    const [models, setModels] = useState<ParallaxModel[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string>('');
    const [prompt, setPrompt] = useState<string>('');
    const [quoteCredits, setQuoteCredits] = useState<number | null>(null);
    const [loadingModels, setLoadingModels] = useState<boolean>(true);
    const [generating, setGenerating] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>('');
    const [resultFiles, setResultFiles] = useState<MediaFile[]>([]);
    const pollRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (pollRef.current) window.clearInterval(pollRef.current);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoadingModels(true);
        setSelectedModelId('');
        setQuoteCredits(null);

        api.get(`/ai/media/models?kind=${kind}`)
            .then(({ data }) => {
                if (cancelled) return;
                setConfigured(data.configured !== false);
                setConfigMessage(data.message || '');
                const list: ParallaxModel[] = data.models || [];
                setModels(list);
                if (list.length > 0) {
                    setSelectedModelId(list[0].id);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                toast.error(err.response?.data?.message || 'Failed to load AI models');
            })
            .finally(() => {
                if (!cancelled) setLoadingModels(false);
            });

        return () => {
            cancelled = true;
        };
    }, [kind]);

    useEffect(() => {
        if (!selectedModelId || !configured) {
            setQuoteCredits(null);
            return;
        }
        const timer = window.setTimeout(() => {
            api.post('/ai/media/quote', {
                modelId: selectedModelId,
                prompt: prompt || 'sample prompt',
            })
                .then(({ data }) => setQuoteCredits(data.socialPulseCredits ?? null))
                .catch(() => setQuoteCredits(null));
        }, 300);

        return () => window.clearTimeout(timer);
    }, [selectedModelId, prompt, configured]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedModelId) {
            toast.error('Select a model first.');
            return;
        }
        if (!prompt.trim()) {
            toast.error('Enter a prompt.');
            return;
        }

        setGenerating(true);
        setResultFiles([]);
        setStatusText('Submitting job...');

        try {
            const { data } = await api.post('/ai/media/generate', {
                modelId: selectedModelId,
                prompt: prompt.trim(),
            });
            const gen = data.generations?.[0];
            if (!gen?.id) {
                throw new Error('No generation ID returned.');
            }

            setStatusText(`Queued (est. ${gen.eta || 10}s)...`);

            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = window.setInterval(async () => {
                try {
                    const res = await api.get(`/ai/media/generations/${gen.id}`);
                    const updated = res.data.generation;
                    if (updated.status === 'running') {
                        setStatusText('Generating media...');
                    } else if (updated.status === 'succeeded') {
                        if (pollRef.current) window.clearInterval(pollRef.current);
                        setResultFiles(res.data.mediaFiles || []);
                        setGenerating(false);
                        setStatusText('');
                        toast.success('Saved to your Media Library!');
                    } else if (updated.status === 'failed' || updated.status === 'canceled') {
                        if (pollRef.current) window.clearInterval(pollRef.current);
                        setGenerating(false);
                        setStatusText('');
                        toast.error(updated.error?.message || `Generation ${updated.status}.`);
                    }
                } catch (pollErr: any) {
                    if (pollRef.current) window.clearInterval(pollRef.current);
                    setGenerating(false);
                    setStatusText('');
                    toast.error(pollErr.response?.data?.message || 'Failed while checking generation status.');
                }
            }, 2000);
        } catch (err: any) {
            setGenerating(false);
            setStatusText('');
            toast.error(err.response?.data?.message || 'Failed to start generation.');
        }
    };

    const selectedModel = models.find((m) => m.id === selectedModelId);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    AI Media Studio
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Generate images and videos for your posts. Results are saved straight to your Media Library.
                </p>
            </div>

            {!configured && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-900">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Parallax media engine is not connected yet</p>
                        <p className="mt-0.5 text-amber-800">{configMessage}</p>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setKind('image')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        kind === 'image'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <ImageIcon className="w-4 h-4" />
                    Images
                </button>
                <button
                    type="button"
                    onClick={() => setKind('video')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        kind === 'video'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Video className="w-4 h-4" />
                    Videos
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form onSubmit={handleGenerate} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                        {loadingModels ? (
                            <div className="text-sm text-gray-400 py-2">Loading models...</div>
                        ) : models.length === 0 ? (
                            <div className="text-sm text-gray-400 py-2">No {kind} models available.</div>
                        ) : (
                            <select
                                value={selectedModelId}
                                onChange={(e) => setSelectedModelId(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                {models.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.vendor})
                                    </option>
                                ))}
                            </select>
                        )}
                        {selectedModel?.tagline && (
                            <p className="text-xs text-gray-500 mt-1">{selectedModel.tagline}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                        <textarea
                            rows={4}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={`Describe the ${kind} you want to create...`}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-gray-500">
                            {quoteCredits !== null ? `Estimated cost: ${quoteCredits} AI credit${quoteCredits === 1 ? '' : 's'}` : ''}
                        </span>
                        <button
                            type="submit"
                            disabled={generating || !configured || !selectedModelId}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
                        >
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {generating ? statusText || 'Generating...' : 'Generate'}
                        </button>
                    </div>
                </form>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center justify-center min-h-[320px]">
                    {generating ? (
                        <div className="text-center space-y-2 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
                            <p className="text-sm font-medium">{statusText || 'Generating...'}</p>
                        </div>
                    ) : resultFiles.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm">
                            Your generated {kind} will appear here.
                        </div>
                    ) : (
                        <div className="w-full space-y-4">
                            {resultFiles.map((file) => (
                                <div key={file.id} className="space-y-3">
                                    {file.mime_type?.startsWith('video/') ? (
                                        <video src={file.url} controls className="w-full rounded-xl max-h-80 bg-black" />
                                    ) : (
                                        <img src={file.url} alt="Generated media" className="w-full rounded-xl max-h-80 object-contain bg-gray-50" />
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Saved to Media Library
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/studio', { state: { mediaUrl: file.url } })}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            Use in Content Studio
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaStudio;
