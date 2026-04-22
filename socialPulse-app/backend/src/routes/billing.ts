// server/src/routes/billing.ts
import { Router } from 'express';
import express    from 'express';
import { authenticate } from '../middleware/auth';
import {
    createCheckoutSession,
    createPortalSession,
    getSubscription,
    getUsageSummary,
    handleStripeWebhook,
    getBillingInfo,
    upgradePlan,
} from '../controllers/billing.controller';

const router = Router();

// ── Stripe webhook — raw body required BEFORE json() parses it ────────────────
router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook
);

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(authenticate);

router.post('/checkout',     createCheckoutSession);
router.post('/portal',       createPortalSession);
router.get ('/subscription', getSubscription);
router.get ('/usage',        getUsageSummary);
router.get ('/',             getBillingInfo);
router.post('/plan',         upgradePlan);

export default router;
