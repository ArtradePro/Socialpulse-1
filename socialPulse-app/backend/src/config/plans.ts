// server/src/config/plans.ts
// Canonical plan configuration — single source of truth for limits & billing

export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanLimits {
    socialAccounts:    number | 'unlimited';
    postsPerMonth:     number | 'unlimited';
    aiCreditsPerMonth: number | 'unlimited';
    mediaFileSizeMB:   number;
    mediaStorageMB:    number | 'unlimited';
    teamMembers:       number | 'unlimited';
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
            analyticsHistory:  7,
            scheduling:        true,
            bulkScheduling:    false,
            customBranding:    false,
            apiAccess:         false,
            prioritySupport:   false,
        },
    },

    starter: {
        id:           'starter',
        name:         'Starter',
        tagline:      'For creators & solopreneurs',
        monthlyPrice: 1900,
        yearlyPrice:  18240,
        stripePriceIds: {
            monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
            yearly:  process.env.STRIPE_PRICE_STARTER_YEARLY  ?? '',
        },
        limits: {
            socialAccounts:    5,
            postsPerMonth:     100,
            aiCreditsPerMonth: 50,
            mediaFileSizeMB:   50,
            mediaStorageMB:    1024,
            teamMembers:       1,
            analyticsHistory:  30,
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
        tagline:      'For growing teams',
        badge:        'Most Popular',
        monthlyPrice: 4900,
        yearlyPrice:  47040,
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
        monthlyPrice: 14900,
        yearlyPrice:  143040,
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

/** Get a plan by its ID (defaults to free for unknown IDs) */
export const getPlan = (id: PlanId): Plan => PLANS[id] ?? PLANS.free;

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


