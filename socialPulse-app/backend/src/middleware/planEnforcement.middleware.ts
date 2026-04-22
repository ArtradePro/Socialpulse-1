// server/src/middleware/planEnforcement.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { getPlan, withinLimit, PlanId, PLANS } from '../config/plans';
import { AuthRequest } from './auth.middleware';

// Alias for legacy code in this file
type PlanKey = PlanId;

// ─── Current-month usage helper ───────────────────────────────────────────────

const monthlyCount = async (
    userId:    string,
    eventType: string
): Promise<number> => {
    const result = await db.query(
        `SELECT COALESCE(SUM(quantity), 0) AS total
         FROM usage_events
         WHERE user_id    = $1
           AND event_type = $2
           AND DATE_TRUNC('month', recorded_at) = DATE_TRUNC('month', NOW())`,
        [userId, eventType]
    );
    return parseInt(result.rows[0].total);
};

/** Record a usage event (call from controllers after the action succeeds) */
export const recordUsage = async (
    userId:    string,
    eventType: string,
    quantity   = 1
): Promise<void> => {
    await db.query(
        `INSERT INTO usage_events (user_id, event_type, quantity) VALUES ($1, $2, $3)`,
        [userId, eventType, quantity]
    );
};

// ─── Middleware factories ──────────────────────────────────────────────────────

/**
 * Enforce monthly post limit before creating a post.
 * Usage: router.post('/posts', enforcePostLimit, createPost)
 */
export const enforcePostLimit = async (
    req:  Request,
    res:  Response,
    next: NextFunction
): Promise<void> => {
    try {
        const plan  = getPlan((req.user!.plan ?? 'free') as PlanId);
        const limit = plan.limits.postsPerMonth;

        if (limit === 'unlimited') { next(); return; }

        const used = await monthlyCount(req.user!.userId, 'post_published');

        if (!withinLimit(limit, used)) {
            res.status(403).json({
                message: `You've reached your ${limit} posts/month limit on the ${plan.name} plan.`,
                code:    'POST_LIMIT_REACHED',
                upgrade: true,
                used,
                limit,
            });
            return;
        }
        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Enforce AI credit limit before calling AI endpoints.
 * Usage: router.post('/ai/generate', enforceAILimit, generateContent)
 */
export const enforceAILimit = async (
    req:  Request,
    res:  Response,
    next: NextFunction
): Promise<void> => {
    try {
        const plan  = getPlan((req.user!.plan ?? 'free') as PlanId);
        const limit = plan.limits.aiCreditsPerMonth;

        if (limit === 'unlimited') { next(); return; }

        const used = await monthlyCount(req.user!.userId, 'ai_credit_used');

        if (!withinLimit(limit, used)) {
            res.status(403).json({
                message: `You've used all ${limit} AI credits this month on the ${plan.name} plan.`,
                code:    'AI_LIMIT_REACHED',
                upgrade: true,
                used,
                limit,
            });
            return;
        }
        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Enforce connected social account limit.
 * Usage: router.post('/social/connect', enforceSocialAccountLimit, connectAccount)
 */
export const enforceSocialAccountLimit = async (
    req:  Request,
    res:  Response,
    next: NextFunction
): Promise<void> => {
    try {
        const plan  = getPlan((req.user!.plan ?? 'free') as PlanId);
        const limit = plan.limits.socialAccounts;

        if (limit === 'unlimited') { next(); return; }

        const { rows } = await db.query(
            `SELECT COUNT(*) FROM social_accounts WHERE user_id = $1 AND is_active = true`,
            [req.user!.userId]
        );
        const current = parseInt(rows[0].count);

        if (!withinLimit(limit, current)) {
            res.status(403).json({
                message: `Your ${plan.name} plan supports up to ${limit} connected accounts.`,
                code:    'ACCOUNT_LIMIT_REACHED',
                upgrade: true,
                current,
                limit,
            });
            return;
        }
        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Enforce feature flags (boolean capabilities).
 * Usage: router.post('/posts/bulk', enforceFeature('bulkScheduling'), bulkSchedule)
 */
export const enforceFeature = (feature: string) =>
    (req: Request, res: Response, next: NextFunction): void => {
        const plan  = getPlan((req.user!.plan ?? 'free') as PlanId);
        const allowed = (plan.limits as any)[feature];

        if (!allowed) {
            res.status(403).json({
                message: `"${feature}" is not available on the ${plan.name} plan.`,
                code:    'FEATURE_NOT_AVAILABLE',
                upgrade: true,
                feature,
                requiredPlan: Object.values({ pro: 'pro', enterprise: 'enterprise' }),
            });
            return;
        }
        next();
    };

/**
 * Attaches current usage snapshot to req for controller use.
 * Usage: router.get('/usage', attachUsage, getUsage)
 */
export const attachUsage = async (
    req:  Request,
    res:  Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const [posts, ai, accounts, storageRes] = await Promise.all([
            monthlyCount(userId, 'post_published'),
            monthlyCount(userId, 'ai_credit_used'),
            db.query(
                `SELECT COUNT(*) FROM social_accounts WHERE user_id = $1 AND is_active = true`,
                [userId]
            ),
            db.query(
                `SELECT COALESCE(SUM(size_bytes), 0) AS used FROM media_files
                 WHERE user_id = $1 AND is_deleted = false`,
                [userId]
            ),
        ]);

        (req as any).usage = {
            postsThisMonth:   posts,
            aiCreditsUsed:    ai,
            socialAccounts:   parseInt(accounts.rows[0].count),
            storageBytesUsed: parseInt(storageRes.rows[0].used),
        };
        next();
    } catch (err) {
        next(err);
    }
};

// ── Attach plan key to request ────────────────────────────────────────────────

export const attachPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { rows } = await db.query('SELECT plan FROM users WHERE id = $1', [req.user!.userId]);
    (req as any).planKey = (rows[0]?.plan ?? 'free') as PlanKey;
    next();
  } catch {
    (req as any).planKey = 'free';
    next();
  }
};

// ── Enforce media storage quota ───────────────────────────────────────────────

export const enforceMediaQuota = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const planKey = (req as any).planKey ?? 'free';
    const plan    = getPlan(planKey);
    const limit   = plan.limits.mediaStorageMB;

    if (limit === 'unlimited') { next(); return; } // unlimited

    const { rows } = await db.query(
      'SELECT COALESCE(SUM(size_bytes), 0)::bigint AS total FROM media_files WHERE user_id = $1',
      [req.user!.userId],
    );
    const usedMb = parseInt(rows[0]?.total ?? '0') / (1024 * 1024);

    if (usedMb >= (limit as number)) {
      res.status(403).json({
        message: 'Media storage limit reached',
        usedMb:  Math.round(usedMb),
        limitMb: limit,
        upgrade: true,
      });
      return;
    }
    next();
  } catch {
    next();
  }
};

// ── Generic feature gate ──────────────────────────────────────────────────────

export const requireFeature = (
  feature: 'customBranding' | 'apiAccess' | 'whiteLabel' | 'prioritySupport',
) => async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const planKey = (req as any).planKey ?? 'free';
  const plan    = getPlan(planKey);
  if (!(plan.limits as any)[feature]) {
    res.status(403).json({
      message: `${feature} is not available on the ${plan.name} plan`,
      upgrade: true,
    });
    return;
  }
  next();
};

/**
 * Checks that the user has not exceeded their plan's monthly post limit.
 */
export const checkPostLimit = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.userId;

        const userResult = await db.query('SELECT plan FROM users WHERE id = $1', [userId]);
        if (!userResult.rows[0]) { res.status(401).json({ message: 'User not found' }); return; }

        const planKey = (userResult.rows[0].plan as PlanKey) || 'free';
        const limit   = PLANS[planKey]?.limits?.postsPerMonth;

        if (limit === 'unlimited' || limit === undefined) { next(); return; }

        const countResult = await db.query(
            `SELECT COUNT(*) FROM posts WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
            [userId]
        );

        const used = parseInt(countResult.rows[0].count, 10);
        if (used >= Number(limit)) {
            res.status(403).json({
                message: `Monthly post limit reached (${limit} posts on the ${PLANS[planKey].name} plan). Upgrade to post more.`,
                code: 'POST_LIMIT_REACHED',
                limit,
                used,
            });
            return;
        }
        next();
    } catch { next(); }
};

/**
 * Checks that the user has not exceeded their plan's connected social accounts limit.
 */
export const checkSocialAccountLimit = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user!.userId;

        const userResult = await db.query('SELECT plan FROM users WHERE id = $1', [userId]);
        if (!userResult.rows[0]) { res.status(401).json({ message: 'User not found' }); return; }

        const planKey = (userResult.rows[0].plan as PlanKey) || 'free';
        const limit   = PLANS[planKey]?.limits?.socialAccounts;

        if (limit === 'unlimited' || limit === undefined) { next(); return; }

        const countResult = await db.query(
            'SELECT COUNT(*) FROM social_accounts WHERE user_id = $1 AND is_active = true',
            [userId]
        );

        const used = parseInt(countResult.rows[0].count, 10);
        if (used >= Number(limit)) {
            res.status(403).json({
                message: `Social account limit reached (${limit} accounts on the ${PLANS[planKey].name} plan). Upgrade to connect more.`,
                code: 'SOCIAL_ACCOUNT_LIMIT_REACHED',
                limit,
                used,
            });
            return;
        }
        next();
    } catch { next(); }
};
