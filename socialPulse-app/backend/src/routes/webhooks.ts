import { Router, Request, Response } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import { AutomationEngineService } from '../services/marketing/automationEngine.service';

const router = Router();

/**
 * Validates the x-webhook-secret header using a constant-time comparison to
 * prevent timing-based secret-guessing attacks.
 */
function isValidSecret(provided: string | undefined): boolean {
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected || !provided) return false;
    try {
        // Hash both sides so lengths always match (timingSafeEqual requires equal length)
        const a = createHash('sha256').update(provided).digest();
        const b = createHash('sha256').update(expected).digest();
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

/**
 * POST /api/webhooks/contract-signed
 *
 * Called by Quote2ContractPro (or any external system) when a contract is signed.
 * Fires the `contract.signed` automation event so SocialPulse can enrol the
 * contact into any matching nurture sequence automatically.
 *
 * Required header:  x-webhook-secret: <WEBHOOK_SECRET>
 * Required body:    { tenantId, contractDetails, contactInfo }
 */
router.post('/contract-signed', async (req: Request, res: Response): Promise<void> => {
    if (!isValidSecret(req.headers['x-webhook-secret'] as string | undefined)) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const { tenantId, contractDetails, contactInfo } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({ message: 'tenantId is required' });
        return;
    }

    // Build the flat payload that AutomationEngineService will use for
    // template variable resolution (e.g. {{contract_amount}}, {{client_name}})
    const payload: Record<string, any> = {
        // Contact identity — used for delivery and {{first_name}} etc.
        email:       contactInfo?.email,
        phone:       contactInfo?.phone,
        firstName:   contactInfo?.firstName || contactInfo?.first_name,
        lastName:    contactInfo?.lastName  || contactInfo?.last_name,
        // Flatten contractDetails so every key becomes a template variable
        ...(contractDetails && typeof contractDetails === 'object' ? contractDetails : {}),
        // Keep the raw objects available too for downstream inspection
        contactInfo,
        contractDetails,
    };

    try {
        await AutomationEngineService.triggerEvent('contract.signed', tenantId, payload);
        res.status(200).json({ received: true });
    } catch (err: any) {
        console.error('[Webhook] contract-signed processing error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
