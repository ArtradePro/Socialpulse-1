import { Router, Request, Response } from 'express';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { AutomationEngineService } from '../services/marketing/automationEngine.service';

const router = Router();

/**
 * Validates incoming webhooks using either `x-webhook-secret` raw header or
 * `X-Webhook-Signature` (HMAC SHA-256 over raw JSON payload).
 */
function isValidWebhookAuth(req: Request): boolean {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) return false;

    // 1. Check raw secret header
    const providedSecret = (req.headers['x-webhook-secret'] || req.headers['authorization']) as string | undefined;
    if (providedSecret) {
        const token = providedSecret.replace(/^Bearer\s+/i, '');
        try {
            const a = createHash('sha256').update(token).digest();
            const b = createHash('sha256').update(secret).digest();
            if (timingSafeEqual(a, b)) return true;
        } catch {}
    }

    // 2. Check X-Webhook-Signature (HMAC SHA-256) header from Quote2ContractPro
    const providedSig = req.headers['x-webhook-signature'] as string | undefined;
    if (providedSig && req.body) {
        try {
            const payloadStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            const expectedSig = createHmac('sha256', secret).update(payloadStr).digest('hex');
            const a = Buffer.from(providedSig);
            const b = Buffer.from(expectedSig);
            if (a.length === b.length && timingSafeEqual(a, b)) return true;
        } catch {}
    }

    if (process.env.ALLOW_UNAUTHENTICATED_WEBHOOKS === 'true' && !providedSecret && !providedSig) {
        console.warn('[Webhook] ALLOW_UNAUTHENTICATED_WEBHOOKS=true: Accepting unauthenticated webhook (dev only)');
        return true;
    }

    return false;
}

/**
 * POST /api/webhooks/contract-signed
 *
 * Handles contract signature webhooks from Quote2ContractPro.
 * Fires `contract.signed` automation event in SocialPulse.
 */
router.post('/contract-signed', async (req: Request, res: Response): Promise<void> => {
    if (!isValidWebhookAuth(req)) {
        res.status(401).json({ message: 'Unauthorized webhook request' });
        return;
    }

    // Support both direct payloads and Q2C nested payload structure ({ event, timestamp, data })
    const body = req.body || {};
    const data = body.data || body;

    const tenantId = data.tenantId || data.organizationId || body.tenantId || body.organizationId;

    if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({ message: 'tenantId is required' });
        return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
        res.status(400).json({ message: 'Invalid tenantId format' });
        return;
    }

    const contactInfo = data.contactInfo || data.user || {
        email: data.email || data.user?.email,
        phone: data.phone || data.user?.phone,
        firstName: data.firstName || data.user?.firstName || data.user?.name,
        lastName: data.lastName || data.user?.lastName,
    };

    const contractDetails = data.contractDetails || data;

    const payload: Record<string, any> = {
        email: contactInfo?.email,
        phone: contactInfo?.phone,
        firstName: contactInfo?.firstName || contactInfo?.first_name,
        lastName: contactInfo?.lastName || contactInfo?.last_name,
        ...(contractDetails && typeof contractDetails === 'object' ? contractDetails : {}),
        contactInfo,
        contractDetails,
    };

    try {
        await AutomationEngineService.triggerEvent('contract.signed', tenantId, payload);
        res.status(200).json({ received: true, event: 'contract.signed' });
    } catch (err: any) {
        console.error('[Webhook] contract-signed processing error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * GET/POST /api/webhooks/tiktok
 * Handles TikTok event subscriptions & webhook challenge verification.
 */
router.all('/tiktok', (req: Request, res: Response): void => {
    console.log('[TikTok Webhook] Event received:', req.body);
    const challenge = req.query.challenge || req.body?.challenge;
    if (challenge) {
        res.status(200).send(challenge);
        return;
    }
    res.status(200).json({ received: true, timestamp: new Date().toISOString() });
});

export default router;
