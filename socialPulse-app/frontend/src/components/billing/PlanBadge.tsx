import React from 'react';
import { Zap } from 'lucide-react';

interface PlanBadgeProps {
    name: string;   // Renamed from 'plan' to match Billing.tsx
    color?: string; // Added color support from Billing.tsx
    size?: 'sm' | 'md';
}

const STYLES: Record<string, string> = {
    free:       'bg-gray-100  text-gray-600',
    starter:    'bg-blue-100  text-blue-700',
    pro:        'bg-purple-100 text-purple-700',
    enterprise: 'bg-yellow-100 text-yellow-700',
};

// FIX: Using a named export to match the import in Billing.tsx
export const PlanBadge: React.FC<PlanBadgeProps> = ({ name, color, size = 'md' }) => {
    const planKey = name.toLowerCase();
    const styleClass = STYLES[planKey] ?? 'bg-gray-100 text-gray-600';

    return (
        <span 
            className={`inline-flex items-center gap-1 rounded-full font-semibold capitalize 
                        ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'} 
                        ${!color ? styleClass : ''}`}
            style={color ? { backgroundColor: `${color}20`, color: color } : {}}
        >
            {planKey !== 'free' && (
                <Zap className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            )}
            {name}
        </span>
    );
};

// Keep default export as a fallback
export default PlanBadge;