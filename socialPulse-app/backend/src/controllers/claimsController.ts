import { Request, Response } from 'express';
import { ClaimsGuardService } from '../services/marketing/claimsGuard.service';

export const listClaims = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId || req.params.workspaceId;
        if (!workspaceId) {
            res.status(400).json({ message: 'Workspace ID is required' });
            return;
        }

        const claims = await ClaimsGuardService.getApprovedClaims(workspaceId);
        res.json(claims);
    } catch (err) {
        console.error('[ClaimsController] listClaims error:', err);
        res.status(500).json({ message: 'Failed to load claims' });
    }
};

export const createClaim = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId || req.params.workspaceId;
        const { claim_text, claim_category, disclaimer_required, disclaimer_text } = req.body;

        if (!workspaceId || !claim_text?.trim()) {
            res.status(400).json({ message: 'claim_text and workspaceId are required' });
            return;
        }

        const userId = (req as any).user?.userId;
        const claim = await ClaimsGuardService.addClaim(
            workspaceId,
            claim_text,
            claim_category || 'GENERAL',
            Boolean(disclaimer_required),
            disclaimer_text || null,
            userId || null
        );

        res.status(201).json(claim);
    } catch (err) {
        console.error('[ClaimsController] createClaim error:', err);
        res.status(500).json({ message: 'Failed to create claim' });
    }
};

export const deleteClaim = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId || req.params.workspaceId;
        const { id } = req.params;

        const deleted = await ClaimsGuardService.deleteClaim(workspaceId, id);
        if (!deleted) {
            res.status(404).json({ message: 'Claim not found' });
            return;
        }

        res.json({ success: true, message: 'Claim deleted' });
    } catch (err) {
        console.error('[ClaimsController] deleteClaim error:', err);
        res.status(500).json({ message: 'Failed to delete claim' });
    }
};

export const validateContent = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req as any).workspaceId || req.params.workspaceId || req.body.workspaceId;
        const { content } = req.body;

        if (!workspaceId || typeof content !== 'string') {
            res.status(400).json({ message: 'content and workspaceId are required' });
            return;
        }

        const result = await ClaimsGuardService.validateContent(workspaceId, content);
        res.json(result);
    } catch (err) {
        console.error('[ClaimsController] validateContent error:', err);
        res.status(500).json({ message: 'Validation failed' });
    }
};
