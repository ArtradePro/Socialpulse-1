import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CreditCard, Mail, Smartphone, Zap, Users, ChevronLeft,
    Check, ArrowRight, Sparkles, Shield, Crown
} from 'lucide-react';

interface MarketingTier {
    id: string;
    name: string;
    icon: React.ElementType;
    price: number;
    description: string;
    gradient: string;
    borderColor: string;
    badgeColor: string;
    isPopular?: boolean;
    limits: {
        emailsPerMonth: string;
        smsCredits: string;
        automations: string;
        contacts: string;
    };
    features: string[];
}

const TIERS: MarketingTier[] = [
    {
        id: 'starter',
        name: 'Starter',
        icon: Mail,
        price: 0,
        description: 'Perfect for testing email & SMS marketing',
        gradient: 'from-gray-50 to-white',
        borderColor: 'border-gray-200',
        badgeColor: 'bg-gray-100 text-gray-600',
        limits: {
            emailsPerMonth: '500',
            smsCredits: '50',
            automations: '2',
            contacts: '250',
        },
        features: [
            'Basic email campaigns',
            'SMS broadcasts',
            'Contact management',
            'Delivery analytics',
        ],
    },
    {
        id: 'growth',
        name: 'Growth',
        icon: Sparkles,
        price: 29,
        description: 'Scale your outreach with advanced automation',
        gradient: 'from-purple-50 to-indigo-50',
        borderColor: 'border-purple-200',
        badgeColor: 'bg-purple-100 text-purple-700',
        isPopular: true,
        limits: {
            emailsPerMonth: '10,000',
            smsCredits: '1,000',
            automations: '15',
            contacts: '5,000',
        },
        features: [
            'Everything in Starter',
            'Advanced automation workflows',
            'A/B testing campaigns',
            'Custom email templates',
            'Priority delivery queue',
            'Webhook integrations',
        ],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        icon: Crown,
        price: 99,
        description: 'Unlimited marketing power for agencies',
        gradient: 'from-amber-50 to-orange-50',
        borderColor: 'border-amber-200',
        badgeColor: 'bg-amber-100 text-amber-700',
        limits: {
            emailsPerMonth: 'Unlimited',
            smsCredits: '10,000',
            automations: 'Unlimited',
            contacts: 'Unlimited',
        },
        features: [
            'Everything in Growth',
            'Unlimited email volume',
            'Unlimited automations',
            'Unlimited contacts',
            'Dedicated sending IP',
            'Custom SMTP / SendGrid relay',
            'DKIM/SPF domain verification',
            'SLA & priority support',
        ],
    },
];

const LIMIT_ITEMS = [
    { key: 'emailsPerMonth' as const, label: 'Emails / month', icon: Mail, color: 'text-indigo-600' },
    { key: 'smsCredits' as const, label: 'SMS credits', icon: Smartphone, color: 'text-sky-600' },
    { key: 'automations' as const, label: 'Automations', icon: Zap, color: 'text-purple-600' },
    { key: 'contacts' as const, label: 'Contacts', icon: Users, color: 'text-emerald-600' },
];

export const MarketingPlans: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <button
                        onClick={() => navigate('/marketing')}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition absolute left-8"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-full">
                        <CreditCard className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Marketing Plans</span>
                    </div>
                </div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-4">
                    Choose Your Marketing Tier
                </h1>
                <p className="text-gray-500 mt-2 text-sm md:text-base">
                    Unlock higher email volumes, SMS credits, and automation workflows. Upgrade anytime.
                </p>
            </div>

            {/* Tier Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TIERS.map((tier) => {
                    const TierIcon = tier.icon;
                    return (
                        <div
                            key={tier.id}
                            className={`relative bg-gradient-to-br ${tier.gradient} border-2 ${tier.borderColor} rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all flex flex-col ${
                                tier.isPopular ? 'ring-2 ring-purple-400 ring-offset-2' : ''
                            }`}
                        >
                            {/* Popular badge */}
                            {tier.isPopular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md">
                                        <Sparkles className="h-3 w-3" />
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            {/* Header */}
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className={`p-2 rounded-xl ${tier.badgeColor}`}>
                                        <TierIcon className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-xl font-extrabold text-gray-900">{tier.name}</h2>
                                </div>
                                <p className="text-sm text-gray-500">{tier.description}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-gray-900">
                                        {tier.price === 0 ? 'Free' : `$${tier.price}`}
                                    </span>
                                    {tier.price > 0 && (
                                        <span className="text-sm text-gray-400 font-medium">/month</span>
                                    )}
                                </div>
                            </div>

                            {/* Limits Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {LIMIT_ITEMS.map(({ key, label, icon: LimitIcon, color }) => (
                                    <div key={key} className="bg-white/80 rounded-xl p-3 border border-gray-100">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <LimitIcon className={`h-3 w-3 ${color}`} />
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
                                        </div>
                                        <span className="text-lg font-black text-gray-900">
                                            {tier.limits[key]}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Features */}
                            <div className="flex-1 space-y-2 mb-6">
                                {tier.features.map((feat, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                        <span className="text-sm text-gray-700">{feat}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <button
                                onClick={() => navigate('/billing')}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition ${
                                    tier.isPopular
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                                        : tier.price === 0
                                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-700'
                                }`}
                            >
                                {tier.price === 0 ? 'Current Plan' : 'Upgrade Now'}
                                {tier.price > 0 && <ArrowRight className="h-4 w-4" />}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Trust Section */}
            <div className="text-center py-8 border-t border-gray-100">
                <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Enterprise-Grade Security</span>
                </div>
                <p className="text-sm text-gray-500 max-w-lg mx-auto">
                    All plans include TLS encryption, automatic bounce handling, RFC 8058 unsubscribe headers,
                    and GDPR-compliant opt-out management.
                </p>
            </div>
        </div>
    );
};

export default MarketingPlans;
