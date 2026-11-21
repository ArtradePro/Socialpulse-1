import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PlanCard, { Plan } from '../components/billing/PlanCard';
import UsageBar from '../components/billing/UsageBar';
import { usePlan } from '../hooks/usePlan';
import toast from 'react-hot-toast';
import api from '../services/api';

export const Billing: React.FC = () => {
    const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const { plan, usage, allPlans, loading, refetch } = usePlan();

    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            toast.success('Subscription updated!');
            refetch();
            setSearchParams({});
        } else if (searchParams.get('canceled') === 'true') {
            toast('Checkout canceled.');
            setSearchParams({});
        }
    }, [searchParams, refetch, setSearchParams]);

    const handlePlanSelect = async (priceId: string) => {
        if (!priceId) {
            toast.error('Stripe price ID is not configured for this plan yet.');
            return;
        }
        setCheckoutLoading(priceId);
        try {
            const { data } = await api.post('/billing/checkout', { priceId, interval });
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.error('Failed to start checkout session.');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to start checkout.');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const handleOpenPortal = async () => {
        setPortalLoading(true);
        try {
            const { data } = await api.post('/billing/portal');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'No billing portal available yet.');
        } finally {
            setPortalLoading(false);
        }
    };

    const currentPlanId = plan?.id || 'free';

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-6">
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold text-gray-900">Subscription & Billing</h1>
                <p className="text-gray-500">Manage your plan, usage, and billing details</p>

                {currentPlanId !== 'free' && (
                    <div>
                        <button
                            onClick={handleOpenPortal}
                            disabled={portalLoading}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                        >
                            {portalLoading ? 'Opening Portal...' : 'Manage Subscription & Invoices'}
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-center gap-4 mt-6">
                    <span className={interval === 'monthly' ? 'font-bold' : 'text-gray-500'}>Monthly</span>
                    <button
                        onClick={() => setInterval(interval === 'monthly' ? 'yearly' : 'monthly')}
                        className="w-12 h-6 bg-purple-600 rounded-full relative transition-colors"
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${interval === 'yearly' ? 'left-7' : 'left-1'}`} />
                    </button>
                    <span className={interval === 'yearly' ? 'font-bold' : 'text-gray-500'}>
                        Yearly <span className="text-green-500 text-xs">(Save 20%)</span>
                    </span>
                </div>
            </div>

            {usage && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 grid md:grid-cols-4 gap-6">
                    <UsageBar label="Social Accounts" used={usage.socialAccounts.used} limit={usage.socialAccounts.limit} />
                    <UsageBar label="Posts This Month" used={usage.posts.used} limit={usage.posts.limit} />
                    <UsageBar label="AI Credits This Month" used={usage.aiCredits.used} limit={usage.aiCredits.limit} />
                    <UsageBar
                        label="Media Storage (MB)"
                        used={Math.round(usage.storage.usedBytes / (1024 * 1024))}
                        limit={usage.storage.limitMB}
                    />
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading plans...</div>
            ) : (
                <div className="grid md:grid-cols-3 gap-6">
                    {allPlans.map((p: any) => {
                        const cardPlan: Plan = {
                            id: p.id || p.key,
                            name: p.name,
                            tagline: p.tagline || '',
                            badge: p.badge,
                            monthlyPrice: p.monthlyPrice,
                            yearlyPrice: p.yearlyPrice ?? Math.round(p.monthlyPrice * 12 * 0.8),
                            stripePriceIds: p.stripePriceIds ?? { monthly: '', yearly: '' },
                            limits: p.limits,
                        };
                        const selectedPriceId = cardPlan.stripePriceIds[interval];

                        return (
                            <PlanCard
                                key={cardPlan.id}
                                plan={cardPlan}
                                interval={interval}
                                currentPlan={currentPlanId}
                                loading={!!selectedPriceId && checkoutLoading === selectedPriceId}
                                onSelect={handlePlanSelect}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Billing;
