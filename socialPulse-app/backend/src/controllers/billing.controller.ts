// server/src/controllers/billing.controller.ts
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { db }             from '../config/database';
import { PLANS, planByPriceId, getPlan, PlanId, PlanKey } from '../config/plans';
import { AuthRequest } from '../middleware/auth.middleware';
import { EmailService } from '../services/email.service';
import { NotificationService } from '../services/notification.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as any,
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ensureStripeCustomer = async (userId: string, email: string): Promise<string> => {
    const existing = await db.query(
        `SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1`,
        [userId]
    );
    if (existing.rows[0]) return existing.rows[0].stripe_customer_id;

    const customer = await stripe.customers.create({ email, metadata: { userId } });

    await db.query(
        `INSERT INTO stripe_customers (user_id, stripe_customer_id) VALUES ($1, $2)`,
        [userId, customer.id]
    );
    return customer.id;
};

// ─── Create checkout session ──────────────────────────────────────────────────

export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { priceId, interval = 'monthly' } = req.body;
        const userId = req.user!.userId;
        const email  = req.user!.email;

        if (!priceId) { res.status(400).json({ message: 'priceId required' }); return; }

        const customerId = await ensureStripeCustomer(userId, email);

        const session = await stripe.checkout.sessions.create({
            customer:    customerId,
            mode:        'subscription',
            line_items:  [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.CLIENT_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${process.env.CLIENT_URL}/billing?canceled=true`,
            metadata:    { userId },
            subscription_data: {
                metadata: { userId },
                trial_period_days: 14,     // 14-day free trial on paid plans
            },
            allow_promotion_codes: true,
        });

        res.json({ url: session.url });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// ─── Create billing portal session ───────────────────────────────────────────

export const createPortalSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            `SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1`,
            [req.user!.userId]
        );

        if (!rows[0]) {
            res.status(404).json({ message: 'No billing account found. Subscribe first.' });
            return;
        }

        const session = await stripe.billingPortal.sessions.create({
            customer:   rows[0].stripe_customer_id,
            return_url: `${process.env.CLIENT_URL}/billing`,
        });

        res.json({ url: session.url });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// ─── Get current subscription ─────────────────────────────────────────────────

export const getSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId  = req.user!.userId;
        const { rows } = await db.query(
            `SELECT sc.*, u.plan
             FROM stripe_customers sc
             JOIN users u ON u.id = sc.user_id
             WHERE sc.user_id = $1`,
            [userId]
        );

        const plan = getPlan((req.user!.plan ?? 'free') as PlanId);

        if (!rows[0]) {
            res.json({ plan, subscription: null });
            return;
        }

        const sc = rows[0];

        // Fetch live from Stripe if subscription exists
        let subscription: any = null;
        if (sc.stripe_subscription_id) {
            subscription = await stripe.subscriptions.retrieve(sc.stripe_subscription_id);
        }

        res.json({ plan, subscription });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// ─── Get usage summary ────────────────────────────────────────────────────────

export const getUsageSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const plan   = getPlan((req.user!.plan ?? 'free') as PlanId);

        const [postsRes, aiRes, accountsRes, storageRes] = await Promise.all([
            db.query(
                `SELECT COALESCE(SUM(quantity),0) AS used FROM usage_events
                 WHERE user_id=$1 AND event_type='post_published'
                   AND DATE_TRUNC('month',recorded_at)=DATE_TRUNC('month',NOW())`,
                [userId]
            ),
            db.query(
                `SELECT COALESCE(SUM(quantity),0) AS used FROM usage_events
                 WHERE user_id=$1 AND event_type='ai_credit_used'
                   AND DATE_TRUNC('month',recorded_at)=DATE_TRUNC('month',NOW())`,
                [userId]
            ),
            db.query(
                `SELECT COUNT(*) AS used FROM social_accounts WHERE user_id=$1 AND is_active=true`,
                [userId]
            ),
            db.query(
                `SELECT COALESCE(SUM(size_bytes),0) AS used FROM media_files
                 WHERE user_id=$1 AND is_deleted=false`,
                [userId]
            ),
        ]);

        res.json({
            plan,
            usage: {
                posts: {
                    used:  parseInt(postsRes.rows[0].used),
                    limit: plan.limits.postsPerMonth,
                },
                aiCredits: {
                    used:  parseInt(aiRes.rows[0].used),
                    limit: plan.limits.aiCreditsPerMonth,
                },
                socialAccounts: {
                    used:  parseInt(accountsRes.rows[0].used),
                    limit: plan.limits.socialAccounts,
                },
                storage: {
                    usedBytes:  parseInt(storageRes.rows[0].used),
                    limitMB:    plan.limits.mediaStorageMB,
                },
            },
        });
    } catch (err: any) {
        res.status(500).json({ message: 'Failed to fetch usage' });
    }
};

// ─── Stripe webhook ───────────────────────────────────────────────────────────

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'] as string;
    let event: any;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err: any) {
        res.status(400).json({ message: `Webhook signature failed: ${err.message}` });
        return;
    }

    try {
        switch (event.type) {

            // ── Subscription created / updated ─────────────────────────────
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const sub = event.data.object as any;
                const priceId = sub.items.data[0]?.price.id ?? '';
                const plan    = planByPriceId(priceId);
                const userId  = sub.metadata.userId;

                if (!userId || !plan) break;

                await db.query(
                    `UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2`,
                    [plan.id, userId]
                );
                await db.query(
                    `UPDATE stripe_customers
                     SET stripe_subscription_id  = $1,
                         stripe_price_id          = $2,
                         status                   = $3,
                         current_period_end       = TO_TIMESTAMP($4),
                         cancel_at_period_end     = $5,
                         updated_at               = NOW()
                     WHERE user_id = $6`,
                    [
                        sub.id,
                        priceId,
                        sub.status,
                        sub.current_period_end,
                        sub.cancel_at_period_end,
                        userId,
                    ]
                );
                break;
            }

            // ── Subscription deleted / cancelled ───────────────────────────
            case 'customer.subscription.deleted': {
                const sub    = event.data.object as any;
                const userId = sub.metadata.userId;
                if (!userId) break;

                await db.query(
                    `UPDATE users SET plan = 'free', updated_at = NOW() WHERE id = $1`,
                    [userId]
                );
                await db.query(
                    `UPDATE stripe_customers
                     SET status = 'canceled', updated_at = NOW() WHERE user_id = $1`,
                    [userId]
                );
                break;
            }

            // ── Payment succeeded ──────────────────────────────────────────
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as any;
                const subId   = invoice.subscription as string;
                if (!subId) break;

                const sub    = await stripe.subscriptions.retrieve(subId);
                const userId = sub.metadata.userId;
                if (!userId) break;

                // Refresh AI credits for the new billing period
                const priceId = sub.items.data[0]?.price.id ?? '';
                const plan    = planByPriceId(priceId);
                if (plan && plan.limits.aiCreditsPerMonth !== 'unlimited') {
                    await db.query(
                        `UPDATE users SET ai_credits = $1 WHERE id = $2`,
                        [plan.limits.aiCreditsPerMonth, userId]
                    );
                }
                break;
            }

            // ── Payment failed ─────────────────────────────────────────────
            case 'invoice.payment_failed': {
                const invoice = event.data.object as any;
                const subId   = invoice.subscription as string;
                if (!subId) break;

                const sub    = await stripe.subscriptions.retrieve(subId);
                const userId = sub.metadata.userId;
                if (!userId) break;

                await db.query(
                    `UPDATE stripe_customers SET status='past_due' WHERE user_id=$1`,
                    [userId]
                );

                // In-app notification + email (non-critical)
                NotificationService.create({
                    userId,
                    type:    'payment_failed',
                    title:   'Payment failed',
                    message: 'Your subscription payment could not be processed. Please update your billing details.',
                    link:    '/billing',
                }).catch(console.error);

                const userRow = await db.query(
                    'SELECT email, full_name FROM users WHERE id = $1', [userId]
                );
                if (userRow.rows[0]) {
                    const nextRetryTs = (event.data.object as any).next_payment_attempt as number | null;
                    EmailService.sendPaymentFailed(
                        userRow.rows[0].email,
                        userRow.rows[0].full_name,
                        nextRetryTs ? new Date(nextRetryTs * 1000) : undefined
                    ).catch(console.error);
                }
                break;
            }

            default:
                break;
        }

        res.json({ received: true });
    } catch (err: any) {
        console.error('[Stripe webhook] handler error:', err);
        res.status(500).json({ message: 'Webhook handler failed' });
    }
};

// ── Get current plan + usage ──────────────────────────────────────────────────

export const getBillingInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [userRow, usageRows] = await Promise.all([
      db.query('SELECT plan, created_at FROM users WHERE id = $1', [userId]),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM social_accounts WHERE user_id = $1 AND is_active = true)::int AS social_accounts,
           (SELECT COUNT(*) FROM posts WHERE user_id = $1 AND created_at >= date_trunc('month', NOW()))::int AS posts_this_month,
           (SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM media_files WHERE user_id = $1) AS media_bytes,
           (SELECT ai_credits FROM users WHERE id = $1) AS ai_credits`,
        [userId],
      ),
    ]);

    const planKey  = (userRow.rows[0]?.plan ?? 'free') as PlanId;
    const plan     = getPlan(planKey as PlanId);
    const usage    = usageRows.rows[0];

    res.json({
      plan: {
        key:         planKey,
        name:        plan.name,
        monthlyPrice: plan.monthlyPrice,
        badge:       plan.badge,
        color:       plan.color,
      },
      limits: plan.limits,
      usage: {
        socialAccounts: parseInt(usage.social_accounts),
        postsThisMonth: parseInt(usage.posts_this_month),
        mediaBytes:     parseInt(usage.media_bytes),
        mediaMb:        Math.round(parseInt(usage.media_bytes) / (1024 * 1024)),
        aiCredits:      parseInt(usage.ai_credits ?? '0'),
      },
      allPlans: Object.entries(PLANS).map(([key, cfg]) => ({
        key,
        name:     cfg.name,
        monthlyPrice: cfg.monthlyPrice,
        color:        cfg.color,
        badge:        cfg.badge,
        features:     cfg.features,
        limits:   cfg.limits,
        current:  key === planKey,
      })),
    });
  } catch (err) {
    console.error('[Billing] getBillingInfo error:', err);
    res.status(500).json({ message: 'Failed to load billing info' });
  }
};

// ── Simulate plan upgrade (real Stripe integration wired in later) ─────────────

export const upgradePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId  = req.user!.userId;
    const { plan } = req.body as { plan: string };

    if (!PLANS[plan as PlanId]) {
      res.status(400).json({ message: 'Invalid plan' });
      return;
    }

    await db.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);

    res.json({
      message: `Plan updated to ${PLANS[plan as PlanId].name}`,
      plan,
    });
  } catch (err) {
    console.error('[Billing] upgradePlan error:', err);
    res.status(500).json({ message: 'Failed to update plan' });
  }
};
