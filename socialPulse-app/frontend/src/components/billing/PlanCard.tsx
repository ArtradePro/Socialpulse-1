// client/src/components/billing/PlanCard.tsx
import React from 'react';
import { Check, Zap, Loader2 } from 'lucide-react';

export type LimitValue = number | 'unlimited' | boolean;

export interface Plan {
    id:           string;
    name:         string;
    tagline:      string;
    badge?:       string;
    monthlyPrice: number;
    yearlyPrice:  number;
    stripePriceIds: { monthly: string; yearly: string };
    limits: {
        socialAccounts:    LimitValue;
        postsPerMonth:     LimitValue;
        aiCreditsPerMonth: LimitValue;
        mediaStorageMB:    LimitValue;
        teamMembers:       LimitValue;
        analyticsHistory:  LimitValue;
        scheduling:        LimitValue;
        bulkScheduling:    LimitValue;
        customBranding:    LimitValue;
        apiAccess:         LimitValue;
        prioritySupport:   LimitValue;
        [key: string]:     LimitValue;
    };
}

export const fmtLimit = (v: LimitValue): string =>
    v === 'unlimited' ? '∞' : String(v);

interface PlanCardProps {
    plan:        Plan;
    currentPlan: string;
    interval:    'monthly' | 'yearly';
    onSelect:    (priceId: string) => void;
    loading:     boolean;
}

const FEATURE_LABELS: { key: string; label: string }[] = [
    { key: 'socialAccounts',    label: 'Social accounts'   },
    { key: 'postsPerMonth',     label: 'Posts / month'      },
    { key: 'aiCreditsPerMonth', label: 'AI credits / month' },
    { key: 'mediaStorageMB',    label: 'Media storage (MB)' },
    { key: 'teamMembers',       label: 'Team members'       },
    { key: 'analyticsHistory',  label: 'Analytics history (days)' },
    { key: 'scheduling',        label: 'Smart scheduling'   },
    { key: 'bulkScheduling',    label: 'Bulk scheduling'    },
    { key: 'customBranding',    label: 'Custom branding'    },
    { key: 'apiAccess',         label: 'API access'         },
    { key: 'prioritySupport',   label: 'Priority support'   },
];

const PlanCard: React.FC<PlanCardProps> = ({
    plan, currentPlan, interval, onSelect, loading,
}) => {
    const isCurrent = plan.id === currentPlan;
    const isPro     = plan.id === 'pro';
    const price     = interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    const priceId   = plan.stripePriceIds[interval];

    const displayPrice =
        plan.monthlyPrice === 0
            ? 'Free'
            : interval === 'monthly'
                ? `$${(price / 100).toFixed(0)}/mo`
                : `$${(price / 100 / 12).toFixed(0)}/mo`;

    return (
        <div className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col
                         transition-all duration-200 ${
            isPro
                ? 'border-purple-500 shadow-xl shadow-purple-100'
                : isCurrent
                    ? 'border-green-400'
                    : 'border-gray-200 hover:border-purple-200 hover:shadow-md'
        }`}>
            {/* Badge */}
            {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-linear-to-r from-purple-600 to-blue-600 text-white
                                     text-xs font-bold px-4 py-1 rounded-full shadow-md">
                        {plan.badge}
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="mb-5">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{plan.tagline}</p>
            </div>

            {/* Price */}
            <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">{displayPrice}</span>
                {interval === 'yearly' && plan.monthlyPrice > 0 && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5
                                     rounded-full font-semibold">
                        Save 20%
                    </span>
                )}
                {interval === 'yearly' && plan.monthlyPrice > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                        billed ${(plan.yearlyPrice / 100).toFixed(0)}/year
                    </p>
                )}
            </div>

            {/* Features */}
            <ul className="space-y-2.5 flex-1 mb-6">
                {FEATURE_LABELS.map(({ key, label }) => {
                    const val = plan.limits[key];
                    const isBoolean = typeof val === 'boolean';
                    if (isBoolean && !val) return null;

                    return (
                        <li key={key} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <span className="text-gray-700">
                                {isBoolean ? label : `${fmtLimit(val)} ${label}`}
                            </span>
                        </li>
                    );
                })}
            </ul>

            {/* CTA */}
            {isCurrent ? (
                <button disabled
                    className="w-full py-2.5 rounded-xl border-2 border-green-400
                                text-green-700 font-semibold text-sm bg-green-50">
                    ✓ Current Plan
                </button>
            ) : plan.monthlyPrice === 0 ? (
                <button disabled
                    className="w-full py-2.5 rounded-xl border border-gray-200
                                text-gray-400 text-sm cursor-default">
                    Free forever
                </button>
            ) : (
                <button
                    onClick={() => onSelect(priceId)}
                    disabled={loading}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm
                                transition-all flex items-center justify-center gap-2 ${
                        isPro
                            ? 'bg-linear-to-r from-purple-600 to-blue-600 text-white hover:opacity-90'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                    } disabled:opacity-60`}
                >
                    {loading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Zap className="w-4 h-4" />}
                    {currentPlan === 'free' ? 'Start free trial' : 'Switch plan'}
                </button>
            )}
        </div>
    );
};


export default PlanCard;