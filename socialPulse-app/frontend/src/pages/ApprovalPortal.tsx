import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, MessageSquare, ShieldCheck, Clock, Globe, BarChart3, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export const ApprovalPortal: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const { data } = await api.get(`/approvals/public/${token}`);
                setPost(data);
                if (data.approved_at) setStatus('approved');
            } catch (err) {
                toast.error('Post not found or link expired');
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [token]);

    const handleSubmit = async (newStatus: 'approved' | 'rejected') => {
        setSubmitting(true);
        try {
            await api.post(`/approvals/public/${token}/submit`, { status: newStatus, feedback });
            setStatus(newStatus);
            toast.success(newStatus === 'approved' ? 'Post approved!' : 'Feedback sent');
        } catch {
            toast.error('Failed to submit');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 bg-indigo-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
        </div>
    );

    if (!post) return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Link Expired</h1>
            <p className="text-gray-500 mt-2">This approval link is no longer valid or the post has been deleted.</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Branded Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    {post.workspace_logo ? (
                        <img src={post.workspace_logo} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-gray-100" />
                    ) : (
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
                            {post.workspace_name?.[0] ?? 'S'}
                        </div>
                    )}
                    <div>
                        <h1 className="font-bold text-gray-900 leading-none">{post.workspace_name ?? 'Client Portal'}</h1>
                        <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase mt-1">Approval Portal</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-tighter">Secure Link</span>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-10 grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* Left: Content Preview */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Content Preview</span>
                            <div className="flex gap-1.5">
                                {post.platforms?.map((p: string) => (
                                    <span key={p} className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg border border-gray-200 text-gray-600 uppercase">{p}</span>
                                ))}
                            </div>
                        </div>
                        <div className="p-8">
                            <p className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                                {post.content}
                            </p>
                            
                            {post.media_urls?.length > 0 && (
                                <div className="mt-8 grid grid-cols-1 gap-4">
                                    {post.media_urls.map((url: string, i: number) => (
                                        <img key={i} src={url} alt="Media" className="rounded-2xl w-full object-cover shadow-sm border border-gray-100" />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center">
                            <Clock className="w-4 h-4 mx-auto text-indigo-500 mb-2" />
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Scheduled For</p>
                            <p className="text-xs font-bold text-gray-900 mt-1">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString() : 'Immediate'}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center">
                            <Globe className="w-4 h-4 mx-auto text-indigo-500 mb-2" />
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Reach</p>
                            <p className="text-xs font-bold text-gray-900 mt-1">Multi-Channel</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center">
                            <BarChart3 className="w-4 h-4 mx-auto text-indigo-500 mb-2" />
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Strategy</p>
                            <p className="text-xs font-bold text-gray-900 mt-1">Conversion</p>
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="lg:col-span-2 space-y-6">
                    {status === 'pending' ? (
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-6 md:p-8 sticky top-28">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Review Action</h2>
                            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                                Please review the post content and media. You can approve it for scheduling or request changes.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Feedback (Optional)</label>
                                    <textarea
                                        value={feedback}
                                        onChange={e => setFeedback(e.target.value)}
                                        placeholder="Suggest changes or leave a note..."
                                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[120px]"
                                    />
                                </div>

                                <button
                                    onClick={() => handleSubmit('approved')}
                                    disabled={submitting}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    APPROVE POST
                                </button>

                                <button
                                    onClick={() => handleSubmit('rejected')}
                                    disabled={submitting}
                                    className="w-full bg-white text-gray-700 border border-gray-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    <MessageSquare className="w-5 h-5" />
                                    REQUEST CHANGES
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={`rounded-3xl border p-8 text-center sticky top-28 ${status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                            {status === 'approved' ? (
                                <>
                                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                    <h2 className="text-2xl font-bold text-green-900">Post Approved</h2>
                                    <p className="text-green-700/70 mt-2 text-sm">Thank you! This post has been moved to the scheduling queue.</p>
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                                    <h2 className="text-2xl font-bold text-orange-900">Feedback Sent</h2>
                                    <p className="text-orange-700/70 mt-2 text-sm">Your feedback has been received. Our team will review and update the post.</p>
                                </>
                            )}
                            <button 
                                onClick={() => setStatus('pending')}
                                className="mt-8 text-sm font-bold text-gray-400 hover:text-gray-600"
                            >
                                Re-open Review
                            </button>
                        </div>
                    )}

                    <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Assigned Account</p>
                            <p className="text-xs font-bold text-gray-700">{post.owner_name}</p>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-10 text-center">
                <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em]">Powered by SocialPulse Engine</p>
            </footer>
        </div>
    );
};
