// client/src/components/billing/PlanBadge.tsx
import React from 'react';
import { Zap } from 'lucide-react';

interface PlanBadgeProps {
    plan:  string;
    size?: 'sm' | 'md';
}

const STYLES: Record<string, string> = {
    free:       'bg-gray-100  text-gray-600',
    starter:    'bg-blue-100  text-blue-700',
    pro:        'bg-purple-100 text-purple-700',
    enterprise: 'bg-yellow-100 text-yellow-700',
};

const PlanBadge: React.FC<PlanBadgeProps> = ({ plan, size = 'md' }) => {
    const cls = STYLES[plan.toLowerCase()] ?? 'bg-gray-100 text-gray-600';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full font-semibold
                          capitalize ${cls}
                          ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}>
            {plan !== 'free' && <Zap className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
            {plan}
        </span>
    );
};

export default PlanBadge;
