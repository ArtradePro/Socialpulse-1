import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    CreditCard, Zap, ExternalLink,
    CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import toast       from 'react-hot-toast';
import api           from '../services/api';
import PlanCard, { Plan } from '../components/billing/PlanCard';
import UsageBar    from '../components/billing/UsageBar';
import { usePlan } from '../hooks/usePlan';
import UpgradeModal from '../components/billing/UpgradeModal';

const PLANS: Plan[] = [
    {
        id: 'free', name: 'Free', tagline: 'Get started for free', badge: undefined,
        monthlyPrice: 0, yearlyPrice: 0,
        stripePriceIds: { monthly: '', yearly: '' },
        limits: {
            socialAccounts: 2, postsPerMonth: 10, aiCreditsPerMonth: 5,
            mediaStorageMB: 100, teamMembers: 1, analyticsHistory: 7,
            scheduling: true, bulkScheduling: false, customBranding: false,
            apiAccess: false, prioritySupport: false,
        },
    },
    {
        id: 'starter', name: 'Starter', tagline: 'For creators & solopreneurs', badge: undefined,
        monthlyPrice: 1900, yearlyPrice: 18240,
        stripePriceIds: { monthly: 'price_starter_monthly', yearly: 'price_starter_yearly' },
        limits: {
            socialAccounts: 5, postsPerMonth: 100, aiCreditsPerMonth: 50,
            mediaStorageMB: 1024, teamMembers: 1, analyticsHistory: 30,
            scheduling: true, bulkScheduling: false, customBranding: false,
            apiAccess: false, prioritySupport: false,
        },
    },
    {
        id: 'pro', name: 'Pro', tagline: 'For growing teams', badge: 'Most Popular',
        monthlyPrice: 4900, yearlyPrice: 47040,
        stripePriceIds: { monthly: 'price_pro_monthly', yearly: 'price_pro_yearly' },
        limits: {
            socialAccounts: 15, postsPerMonth: 'unlimited', aiCreditsPerMonth: 200,
            mediaStorageMB: 10240, teamMembers: 5, analyticsHistory: 90,
            scheduling: true, bulkScheduling: true, customBranding: true,
            apiAccess: true, prioritySupport: false,
        },
    },
    {
        id: 'enterprise', name: 'Enterprise', tagline: 'For agencies & large teams', badge: undefined,
        monthlyPrice: 14900, yearlyPrice: 143040,
        stripePriceIds: { monthly: 'price_enterprise_monthly', yearly: 'price_enterprise_yearly' },
        limits: {
            socialAccounts: 'unlimited', postsPerMonth: 'unlimited', aiCreditsPerMonth: 'unlimited',
            mediaStorageMB: 'unlimited', teamMembers: 'unlimited', analyticsHistory: 365,
            scheduling: true, bulkScheduling: true, customBranding: true,
            apiAccess: true, prioritySupport: true,
        },
    },
];

const Billing: React.FC = () => {
    const [searchParams]        = useSearchParams();
    const navigate              = useNavigate();
    const { plan, usage, loading, refetch } = usePlan();
    const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [portalLoading,   setPortalLoading]   = useState(false);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            toast.success('🎉 Subscription activated! Welcome to the next level.');
            refetch();
            navigate('/billing', { replace: true });
        }
        if (searchParams.get('canceled') === 'true') {
            toast('Checkout canceled.', { icon: 'ℹ️' });
            navigate('/billing', { replace: true });
        }
    }, [searchParams, navigate, refetch]);

    const handleSelectPlan = async (priceId: string) => {
        if (!priceId) {
            toast.error('Plan not available yet. Contact support.');
            return;
        }
        setCheckoutLoading(priceId);
        try {
            const { data } = await api.post('/billing/checkout', { priceId, interval });
            window.location.href = data.url;
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Could not start checkout');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const handleManageBilling = async () => {
        setPortalLoading(true);
        try {
            const { data } = await api.post('/billing/portal');
            window.open(data.url, '_blank');
        } catch {
            toast.error('Could not open billing portal');
        } finally {
            setPortalLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Plans & Billing</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage your subscription and monitor usage</p>
            </div>

            {plan && usage && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">Current Usage</h2>
                            <p className="text-sm text-gray-400 mt-0.5">Resets on the 1st of each month</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-semibold">
                                <Zap className="w-4 h-4" />
                                {plan.name} Plan
                            </span>
                            {plan.id !== 'free' && (
                                <button onClick={handleManageBilling} disabled={portalLoading} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                                    {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                    Manage billing
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <UsageBar label="Posts" used={usage.posts?.used ?? 0} limit={usage.posts?.limit ?? 0} />
                        <UsageBar label="AI credits" used={usage.aiCredits?.used ?? 0} limit={usage.aiCredits?.limit ?? 0} icon={<Zap className="w-4 h-4 text-purple-500" />} />
                        <UsageBar label="Accounts" used={usage.socialAccounts?.used ?? 0} limit={usage.socialAccounts?.limit ?? 0} />
                        <UsageBar label="Storage" used={Math.round((usage.storage?.usedBytes ?? 0) / (1024 * 1024))} limit={usage.storage?.limitMB ?? 0} formatUsed={n => `${n} MB`} />
                    </div>
                </div>
            )}

            <div>
                <div className="flex items-center justify-center gap-3 mb-6">
                    <span className={`text-sm font-medium ${interval === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
                    <button onClick={() => setInterval(i => i === 'monthly' ? 'yearly' : 'monthly')} className={`w-12 h-6 rounded-full transition-colors relative ${interval === 'yearly' ? 'bg-purple-600' : 'bg-gray-200'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${interval === 'yearly' ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-medium ${interval === 'yearly' ? 'text-gray-900' : 'text-gray-400'}`}>Yearly <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Save 20%</span></span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {PLANS.map(p => (
                        <PlanCard key={p.id} plan={p} currentPlan={plan?.id ?? 'free'} interval={interval} onSelect={handleSelectPlan} loading={checkoutLoading === p.stripePriceIds[interval]} />
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Frequently Asked</h3>
                <div className="space-y-4">
                    {[
                        { q: 'Can I change plans anytime?', a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your billing period.' },
                        { q: 'Is there a free trial?', a: 'All paid plans include a 14-day free trial.' },
                    ].map(({ q, a }) => (
                        <div key={q} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                            <p className="text-sm font-semibold text-gray-900 mb-1">{q}</p>
                            <p className="text-sm text-gray-500">{a}</p>
                        </div>
                    ))}
                </div>
            </div>
            <UpgradeModal open={showModal} onClose={() => setShowModal(false)} onDone={refetch} />
        </div>
    );
};

export default Billing;
