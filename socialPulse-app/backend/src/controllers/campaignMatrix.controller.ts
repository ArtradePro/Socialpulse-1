import { Request, Response } from 'express';
import { CampaignMatrixService } from '../services/marketing/campaignMatrix.service';

export const getMatrixStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const status = await CampaignMatrixService.getMatrixStatus(workspaceId);
        res.json(status);
    } catch (err: any) {
        console.error('[CampaignMatrix] getMatrixStatus error:', err);
        res.status(500).json({ message: 'Failed to retrieve campaign matrix status' });
    }
};

export const triggerMatrix = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        if (!workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }

        const batch = await CampaignMatrixService.generateMatrixBatch(workspaceId);
        res.status(201).json(batch);
    } catch (err: any) {
        console.error('[CampaignMatrix] triggerMatrix error:', err);
        res.status(500).json({ message: 'Failed to trigger campaign matrix generation' });
    }
};

export const queueMatrix = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const userId = req.user?.id;

        if (!workspaceId || !userId) {
            res.status(400).json({ message: 'Workspace context and user authentication are required' });
            return;
        }

        const result = await CampaignMatrixService.queueMatrixBatch(workspaceId, userId);
        res.status(201).json({
            message: `Successfully queued ${result.count} posts across all active channels`,
            ...result
        });
    } catch (err: any) {
        console.error('[CampaignMatrix] queueMatrix error:', err);
        res.status(500).json({ message: err.message || 'Failed to queue campaign matrix batch' });
    }
};
