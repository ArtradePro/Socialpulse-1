import { Request, Response } from 'express';
import { OmnisendService } from '../services/marketing/omnisend.service';

export const configureIntegration = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId;
        const { apiKey, brandName } = req.body;

        if (!workspaceId || !apiKey) {
            res.status(400).json({ message: 'apiKey and workspaceId are required' });
            return;
        }

        await OmnisendService.saveIntegration(workspaceId, apiKey, brandName);
        res.json({ success: true, message: 'Omnisend integration saved successfully' });
    } catch (err) {
        console.error('[OmnisendController] configureIntegration error:', err);
        res.status(500).json({ message: 'Failed to configure Omnisend' });
    }
};

export const syncContact = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId;
        const { email, phone, firstName, lastName, tags, customProperties } = req.body;

        if (!workspaceId || !email) {
            res.status(400).json({ message: 'email and workspaceId are required' });
            return;
        }

        const result = await OmnisendService.createOrUpdateContact(workspaceId, {
            email,
            phone,
            firstName,
            lastName,
            tags,
            customProperties
        });

        res.json(result);
    } catch (err: any) {
        console.error('[OmnisendController] syncContact error:', err.message);
        res.status(500).json({ message: err.message || 'Failed to sync contact' });
    }
};

export const triggerEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId;
        const { eventName, email, fields } = req.body;

        if (!workspaceId || !eventName || !email) {
            res.status(400).json({ message: 'workspaceId, eventName, and email are required' });
            return;
        }

        const result = await OmnisendService.triggerEvent(workspaceId, eventName, email, fields);
        res.json(result);
    } catch (err: any) {
        console.error('[OmnisendController] triggerEvent error:', err.message);
        res.status(500).json({ message: err.message || 'Failed to trigger event' });
    }
};
