// server/src/config/plans.ts
// Canonical plan configuration — single source of truth for limits & billing

export type PlanId = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
    socialAccounts:    number | 'unlimited';
    postsPerMonth:     number | 'unlimited';
    aiCreditsPerMonth: number | 'unlimited';
    mediaFileSizeMB:   number;
    mediaStorageMB:    number | 'unlimited';
    teamMembers:       number | 'unlimited';
    workspaces:        number | 'unlimited';
    analyticsHistory:  number;
    scheduling:        boolean;
    bulkScheduling:    boolean;
    customBranding:    boolean;
    apiAccess:         boolean;
    prioritySupport:   boolean;
}

export interface Plan {
    id:           PlanId;
    name:         string;
    tagline:      string;
    badge?:       string;
    monthlyPrice: number;   // in cents
    yearlyPrice:  number;   // in cents
    stripePriceIds: {
        monthly: string;
        yearly:  string;
    };
    color?:    string;
    features?: string[];
    limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
    free: {
        id:           'free',
        name:         'Free',
        tagline:      'Get started for free',
        monthlyPrice: 0,
        yearlyPrice:  0,
        stripePriceIds: { monthly: '', yearly: '' },
        limits: {
            socialAccounts:    2,
            postsPerMonth:     10,
            aiCreditsPerMonth: 5,
            mediaFileSizeMB:   10,
            mediaStorageMB:    100,
            teamMembers:       1,
            workspaces:        1,
            analyticsHistory:  7,
            scheduling:        true,
            bulkScheduling:    false,
            customBranding:    false,
            apiAccess:         false,
            prioritySupport:   false,
        },
    },

    pro: {
        id:           'pro',
        name:         'Pro',
        tagline:      'Best for growing brands',
        badge:        'Most Popular',
        monthlyPrice: 2900,
        yearlyPrice:  27840,
        stripePriceIds: {
            monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
            yearly:  process.env.STRIPE_PRICE_PRO_YEARLY  ?? '',
        },
        limits: {
            socialAccounts:    15,
            postsPerMonth:     'unlimited',
            aiCreditsPerMonth: 200,
            mediaFileSizeMB:   200,
            mediaStorageMB:    10240,
            teamMembers:       5,
            workspaces:        10,
            analyticsHistory:  90,
            scheduling:        true,
            bulkScheduling:    true,
            customBranding:    true,
            apiAccess:         true,
            prioritySupport:   false,
        },
    },

    enterprise: {
        id:           'enterprise',
        name:         'Enterprise',
        tagline:      'For agencies & large teams',
        monthlyPrice: 9900,
        yearlyPrice:  95040,
        stripePriceIds: {
            monthly: process.env.STRIPE_PRICE_ENT_MONTHLY ?? '',
            yearly:  process.env.STRIPE_PRICE_ENT_YEARLY  ?? '',
        },
        limits: {
            socialAccounts:    'unlimited',
            postsPerMonth:     'unlimited',
            aiCreditsPerMonth: 'unlimited',
            mediaFileSizeMB:   500,
            mediaStorageMB:    'unlimited',
            teamMembers:       'unlimited',
            workspaces:        'unlimited',
            analyticsHistory:  365,
            scheduling:        true,
            bulkScheduling:    true,
            customBranding:    true,
            apiAccess:         true,
            prioritySupport:   true,
        },
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get a plan by its ID (maps legacy 'starter' to 'pro', defaults to free) */
export const getPlan = (id: PlanId | string): Plan =>
    PLANS[id as PlanId] ?? (id === 'starter' ? PLANS.pro : PLANS.free);

/** Resolve a Stripe price ID back to a plan (monthly or yearly) */
export const planByPriceId = (priceId: string): Plan | null => {
    if (!priceId) return null;
    return Object.values(PLANS).find(
        p => p.stripePriceIds.monthly === priceId ||
             p.stripePriceIds.yearly  === priceId
    ) ?? null;
};

/**
 * Returns true if the usage is within the plan limit.
 * @param limit  The plan limit (number or 'unlimited')
 * @param used   The current usage count
 */
export const withinLimit = (
    limit: number | 'unlimited',
    used:  number,
): boolean => limit === 'unlimited' || used < (limit as number);

/** Format a limit value for display */
export const fmtLimit = (v: number | 'unlimited' | boolean): string => {
    if (v === 'unlimited') return '\u221e';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return v.toLocaleString();
};

// PlanKey alias for backward compatibility
export type PlanKey = PlanId;

// Legacy alias
export type PlanConfig = Plan;


