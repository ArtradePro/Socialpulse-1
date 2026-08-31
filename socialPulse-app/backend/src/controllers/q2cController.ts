import { Request, Response } from 'express';
import { Q2CSyncService } from '../services/integrations/q2cSync.service';

export const handleInboundQ2CEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const signature = req.headers['x-q2c-signature'] as string | undefined;
        const timestamp = req.headers['x-q2c-timestamp'] as string | undefined;
        const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

        const result = await Q2CSyncService.processInboundEvent(rawBody, signature, timestamp);

        if (result.status === 'REJECTED') {
            res.status(401).json({ success: false, message: result.message });
            return;
        }

        res.status(200).json({
            success: true,
            status: result.status,
            message: result.message,
            eventId: result.eventId
        });
    } catch (err: any) {
        console.error('[Q2CController] handleInboundQ2CEvent error:', err);
        res.status(500).json({ success: false, message: 'Inbound processing error' });
    }
};

export const pushLead = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId || req.body.workspaceId;
        const { email, name, phone, source, value } = req.body;

        if (!workspaceId || !email) {
            res.status(400).json({ success: false, message: 'workspaceId and email are required' });
            return;
        }

        const result = await Q2CSyncService.pushLeadToQ2C(workspaceId, { email, name, phone, source, value });
        res.json(result);
    } catch (err: any) {
        console.error('[Q2CController] pushLead error:', err);
        res.status(500).json({ success: false, message: 'Failed to push lead' });
    }
};
