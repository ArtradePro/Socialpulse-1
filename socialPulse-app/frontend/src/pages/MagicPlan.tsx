import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Sparkles, 
    Calendar, 
    Send, 
    Loader2, 
    CheckCircle2, 
    X, 
    ArrowRight, 
    Wand2, 
    Info, 
    Layout, 
    ChevronDown,
    Save,
    Trash2
} from 'lucide-react';
import { PlatformIcon } from '../components/common/BrandIcons';
import toast from 'react-hot-toast';
import api from '../services/api';

interface MagicPost {
    content: string;
    scheduled_offset_days: number;
    platform: string;
    type: string;
    id?: string; // Client-side ID for list management
}

export const MagicPlan: React.FC = () => {
    const navigate = useNavigate();
    const [topic, setTopic] = useState('');
    const [description, setDescription] = useState('');
    const [days, setDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<MagicPost[] | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const generatePlan = async () => {
        if (!topic.trim()) {
            toast.error('Please enter a topic or goal');
            return;
        }

        setLoading(true);
        setPlan(null);
        const toastId = toast.loading('Architecting your magic strategy...');

        try {
            const { data } = await api.post('/ai/magic-plan', {
                topic,
                description,
                days
            });
            
            // Add unique IDs for easy mapping/deletion in UI
            const postsWithIds = data.posts.map((p: MagicPost, idx: number) => ({
                ...p,
                id: `p-${idx}-${Date.now()}`
            }));
            
            setPlan(postsWithIds);
            toast.success('Magic plan generated!', { id: toastId });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to generate plan', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAsDrafts = async () => {
        if (!plan) return;
        setIsSaving(true);
        const toastId = toast.loading('Saving posts as drafts...');

        try {
            // Prepare posts for bulk creation
            const postsToCreate = plan.map(p => {
                const scheduledDate = new Date();
                scheduledDate.setDate(scheduledDate.getDate() + p.scheduled_offset_days);
                
                return {
                    content: p.content,
                    platforms: [p.platform],
                    scheduledAt: scheduledDate.toISOString(),
                    status: 'draft',
                    aiGenerated: true
                };
            });

            await api.post('/posts/bulk', { posts: postsToCreate });
            toast.success('All posts saved to your scheduler!', { id: toastId });
            navigate('/scheduler');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save posts', { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const removePost = (id: string) => {
        setPlan(prev => prev ? prev.filter(p => p.id !== id) : null);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header / Hero Section */}
            <div className="relative overflow-hidden bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-500 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200">
                <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-indigo-400/20 rounded-full blur-2xl" />
                
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-white/20">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        AI Powerhouse
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                        One Goal. <br />
                        <span className="text-amber-200">Infinite</span> Content.
                    </h1>
                    <p className="text-indigo-100 mt-4 text-lg font-medium leading-relaxed">
                        Transform a single idea into a full-scale multi-day social media campaign. 
                        Our AI architect builds the strategy, you lead the growth.
                    </p>
                </div>

                <div className="mt-10 relative z-10">
                    <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-2 flex flex-col md:flex-row gap-2 border border-white/20 shadow-2xl">
                        <div className="flex-1 px-4 py-3">
                            <input 
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="What is your campaign goal? (e.g. Launching a New Coffee Brand)"
                                className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder-white/50 text-white font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-2 p-1">
                            <select 
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="bg-white/20 backdrop-blur-md text-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-300 cursor-pointer"
                            >
                                <option value={3} className="text-gray-900">3 Days</option>
                                <option value={7} className="text-gray-900">7 Days</option>
                                <option value={14} className="text-gray-900">14 Days</option>
                                <option value={30} className="text-gray-900">30 Days</option>
                            </select>
                            <button 
                                onClick={generatePlan}
                                disabled={loading}
                                className="px-8 py-3 bg-amber-400 text-indigo-900 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-amber-300 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                Generate Strategy
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 mt-4 ml-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-white/70">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                            Multi-platform Support
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-white/70">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                            Strategic Sequencing
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-white/70">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                            Direct Draft Sync
                        </div>
                    </div>
                </div>
            </div>

            {/* Generated Plan Section */}
            {plan && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between px-2">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                Your Strategic Roadmap
                                <span className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full">{plan.length} Posts</span>
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Review, edit, or remove posts before saving them to your drafts.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setPlan(null)}
                                className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
                            >
                                Discard
                            </button>
                            <button 
                                onClick={handleSaveAsDrafts}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save All as Drafts
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {plan.map((post, idx) => (
                            <div key={post.id} className="group relative bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all">
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                                    {idx + 1}
                                </div>
                                <div className="flex items-start gap-6">
                                    <div className="flex flex-col items-center gap-4 py-2">
                                        <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                                            <PlatformIcon platform={post.platform} size={24} />
                                        </div>
                                        <div className="h-full w-px bg-linear-to-b from-gray-100 to-transparent" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                                    {post.type}
                                                </span>
                                                <span className="text-xs font-bold text-gray-400">
                                                    Scheduled for Day {post.scheduled_offset_days}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => removePost(post.id!)}
                                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <textarea 
                                            value={post.content}
                                            onChange={(e) => {
                                                const newPlan = [...plan];
                                                newPlan[idx].content = e.target.value;
                                                setPlan(newPlan);
                                            }}
                                            className="w-full bg-transparent border-none focus:ring-0 text-gray-800 text-base leading-relaxed p-0 resize-none min-h-[80px]"
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center pt-8">
                        <button 
                            onClick={handleSaveAsDrafts}
                            disabled={isSaving}
                            className="flex items-center gap-3 px-12 py-5 bg-linear-to-r from-indigo-600 to-violet-600 text-white rounded-[2rem] font-black text-lg shadow-2xl hover:shadow-indigo-300 hover:-translate-y-1 transition-all disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-amber-300" />}
                            Sync Strategy to Scheduler
                        </button>
                    </div>
                </div>
            )}

            {!plan && !loading && (
                <div className="grid md:grid-cols-3 gap-6 pt-10">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                            <Info className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-gray-900">Define Your Goal</h3>
                        <p className="text-sm text-gray-500 mt-2">The more specific your goal, the better the strategy our AI can build.</p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
                            <Layout className="w-6 h-6 text-purple-600" />
                        </div>
                        <h3 className="font-bold text-gray-900">Multi-Platform Mix</h3>
                        <p className="text-sm text-gray-500 mt-2">Reach your audience wherever they are with platform-native content.</p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mb-4">
                            <ChevronDown className="w-6 h-6 text-pink-600" />
                        </div>
                        <h3 className="font-bold text-gray-900">Full Control</h3>
                        <p className="text-sm text-gray-500 mt-2">Edit, reorder, or delete posts before they ever hit your calendar.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
