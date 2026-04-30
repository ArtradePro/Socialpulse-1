import React, { useState } from 'react';
import { X, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PlanCard from './PlanCard';
import { BillingPlan } from '../../hooks/usePlan';

interface UpgradeModalProps {
    open: boolean;
    onClose: () => void;
    plans?: BillingPlan[];
    onDone?: () => void;
    reason?: 'storage' | 'posts' | 'ai' | 'feature' | 'default';
    message?: string;
}

const REASON_COPY = {
    storage: {
        title: 'Storage limit reached',
        body: "You've used all your media storage. Upgrade to get more space.",
    },
    posts: {
        title: 'Monthly post limit reached',
        body: "You've published the maximum posts for this month. Upgrade for more.",
    },
    ai: {
        title: 'AI credits exhausted',
        body: "You've used all your AI credits. Upgrade to generate more content.",
    },
    feature: {
        title: 'Feature not available',
        body: 'This feature requires a higher plan. Upgrade to unlock it.',
    },
    default: {
        title: 'Choose a Plan',
        body: 'Upgrade to unlock more features and grow your brand.',
    },
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ open, onClose, plans, onDone, reason, message }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState<string | null>(null);
    const copy = REASON_COPY[reason ?? 'default'] ?? REASON_COPY.default;

    const handleUpgrade = async (key: string) => {
        setLoading(key);
        try {
            await api.post('/billing/plan', { plan: key });
            toast.success(`Plan updated successfully!`);
            onDone?.();
            onClose();
        } catch {
            toast.error('Failed to update plan. Please try again.');
        } finally {
            setLoading(null);
        }
    };

    if (!open) return null;

    // If we have plans to show, show the Plan Selection UI
    if (plans && plans.length > 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{copy.title}</h2>
                            <p className="text-gray-500 text-sm">{copy.body}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {plans.map((p) => (
                            <PlanCard
                                key={p.key}
                                plan={p as any} // Cast to any to handle slight interface differences
                                onSelect={() => !p.current && handleUpgrade(p.key)}
                                loading={loading === p.key}
                                currentPlan={p.current ? p.key : ''}
                                interval="monthly"
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Otherwise, show the simple "Limit Reached" alert UI
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 z-10">
                <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <Zap className="w-7 h-7 text-white" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 text-center mb-2">{copy.title}</h2>
                <p className="text-sm text-gray-500 text-center mb-6">{message ?? copy.body}</p>

                <div className="space-y-3">
                    <button
                        onClick={() => { onClose(); navigate('/billing'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
                    >
                        View Plans
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-700">
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;