import React, { useState, useEffect } from 'react';
import PlanCard from '../components/billing/PlanCard';
import UpgradeModal from '../components/billing/UpgradeModal';
import toast from 'react-hot-toast';
import api from '../services/api';

// 1. Define the Plan interface strictly
export interface Plan {
    id: string;
    name: string;
    tagline: string;
    price: number;
    yearlyPrice: number;
    features: string[];
    stripePriceIds: {
        monthly: string;
        yearly: string;
    };
    isPopular?: boolean;
}

// 2. Populate the plans array with all required fields
const allPlans: Plan[] = [
    {
        id: 'free',
        name: 'Free',
        tagline: 'Perfect for getting started',
        price: 0,
        yearlyPrice: 0,
        features: ['3 Social Accounts', 'Basic Analytics', '1 Workspace'],
        stripePriceIds: { monthly: '', yearly: '' }
    },
    {
        id: 'pro',
        name: 'Pro',
        tagline: 'Best for growing brands',
        price: 29,
        yearlyPrice: 290,
        isPopular: true,
        features: ['10 Social Accounts', 'Advanced Analytics', 'Unlimited Workspaces', 'Priority Support'],
        stripePriceIds: { 
            monthly: 'price_pro_monthly_id', 
            yearly: 'price_pro_yearly_id' 
        }
    },
    {
        id: 'business',
        name: 'Business',
        tagline: 'Scale your agency',
        price: 99,
        yearlyPrice: 990,
        features: ['Unlimited Accounts', 'Custom Reports', 'Team Collaboration', 'API Access'],
        stripePriceIds: { 
            monthly: 'price_biz_monthly_id', 
            yearly: 'price_biz_yearly_id' 
        }
    }
];

export const Billing: React.FC = () => {
    const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [isUpgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [subscription, setSubscription] = useState<any>(null);

    const fetchSubscription = async () => {
        try {
            const { data } = await api.get('/billing/subscription');
            setSubscription(data);
        } catch (err) {
            console.error('Failed to fetch subscription');
        }
    };

    useEffect(() => {
        fetchSubscription();
    }, []);

    const handlePlanSelect = (planId: string) => {
        setUpgradeModalOpen(true);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-6">
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold text-gray-900">Subscription & Billing</h1>
                <p className="text-gray-500">Manage your plan and billing details</p>
                
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

            <div className="grid md:grid-cols-3 gap-6">
                {allPlans.map((p) => {
                    const planData = p as any;

                    return (
                        <PlanCard
                            key={p.id}
                            plan={planData}
                            interval={interval}
                            // FIX: Passing currentPlan to resolve TS2741
                            currentPlan={subscription?.planId || 'free'}
                            loading={checkoutLoading === planData.stripePriceIds?.[interval]}
                            onSelect={() => handlePlanSelect(p.id)}
                        />
                    );
                })}
            </div>

            <UpgradeModal
                open={isUpgradeModalOpen}
                onClose={() => setUpgradeModalOpen(false)}
                // Use 'plans' as a prop
                plans={allPlans as any} 
                onDone={() => fetchSubscription()}
            />
        </div>
    );
};

export default Billing;