import { Router, Request, Response } from 'express';
import { EvergreenIntegrationService } from '../services/integrations/evergreen.service';

const router = Router();

/**
 * POST /api/integrations/evergreen/events
 * Ingests signed HMAC SHA-256 events from Evergreen OS.
 */
router.post('/evergreen/events', async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['x-evergreen-signature'] as string | undefined;
    const timestamp = req.headers['x-evergreen-timestamp'] as string | undefined;
    const eventId = req.headers['x-evergreen-event-id'] as string | undefined;

    // Use rawBody string or stringified req.body
    const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    const result = await EvergreenIntegrationService.ingestEvent(
        rawBody,
        signature,
        timestamp,
        eventId
    );

    if (result.status === 'REJECTED') {
        res.status(401).json({
            received: false,
            message: result.message
        });
        return;
    }

    if (result.status === 'DUPLICATE') {
        res.status(200).json({
            received: true,
            status: 'DUPLICATE',
            message: result.message,
            eventId: result.eventId
        });
        return;
    }

    res.status(200).json({
        received: true,
        status: 'PROCESSED',
        message: result.message,
        eventId: result.eventId
    });
});

export default router;
