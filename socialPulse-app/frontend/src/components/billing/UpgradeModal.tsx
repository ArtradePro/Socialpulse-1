// client/src/components/billing/UpgradeModal.tsx
import React from 'react';
import { X, Zap, ArrowRight } from 'lucide-react';
import { useNavigate }        from 'react-router-dom';

interface UpgradeModalProps {
    open:    boolean;
    onClose: () => void;
    reason?: string;    // 'storage' | 'posts' | 'ai' | 'feature' | generic
    message?: string;
}

const REASON_COPY: Record<string, { title: string; body: string }> = {
    storage: {
        title: 'Storage limit reached',
        body:  'You\'ve used all your media storage. Upgrade to get more space and keep creating.',
    },
    posts: {
        title: 'Monthly post limit reached',
        body:  'You\'ve published the maximum posts for this month. Upgrade for unlimited posting.',
    },
    ai: {
        title: 'AI credits exhausted',
        body:  'You\'ve used all your AI credits this month. Upgrade to generate more content with AI.',
    },
    feature: {
        title: 'Feature not available',
        body:  'This feature requires a higher plan. Upgrade to unlock it.',
    },
    default: {
        title: 'Upgrade your plan',
        body:  'You\'ve reached a limit on your current plan. Upgrade to keep growing.',
    },
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ open, onClose, reason, message }) => {
    const navigate = useNavigate();
    const copy = REASON_COPY[reason ?? 'default'] ?? REASON_COPY.default;

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Card */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 z-10">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-lg"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Icon */}
                <div className="w-14 h-14 bg-linear-to-br from-purple-600 to-blue-600
                                rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <Zap className="w-7 h-7 text-white" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                    {copy.title}
                </h2>
                <p className="text-sm text-gray-500 text-center mb-2">
                    {message ?? copy.body}
                </p>

                <div className="mt-6 space-y-3">
                    <button
                        onClick={() => { onClose(); navigate('/billing'); }}
                        className="w-full flex items-center justify-center gap-2 py-3
                                   bg-linear-to-r from-purple-600 to-blue-600 text-white
                                   rounded-xl font-semibold hover:opacity-90 transition-opacity"
                    >
                        View Plans
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-700"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;

interface Props {
  open:     boolean;
  onClose:  () => void;
  plans:    BillingPlan[];
  onDone?:  () => void;
}

export default function UpgradeModal({ open, onClose, plans, onDone }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const upgrade = async (key: string) => {
    setLoading(key);
    try {
      await api.post('/billing/plan', { plan: key });
      toast.success(`Plan updated to ${plans.find(p => p.key === key)?.name}`);
      onDone?.();
      onClose();
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setLoading(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-lg">Choose a Plan</h2>
            <p className="text-gray-400 text-sm">Upgrade to unlock more features</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(p => (
            <PlanCard
              key={p.key}
              plan={p}
              onUpgrade={p.current ? undefined : upgrade}
              loading={loading === p.key}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
