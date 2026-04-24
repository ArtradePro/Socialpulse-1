import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';

declare global {
    namespace Express {
        interface Request {
            workspaceId?:   string;
            workspaceRole?: string;
        }
    }
}

/**
 * Reads the X-Workspace-Id request header, validates that the authenticated
 * user is a member of that workspace, and sets req.workspaceId + req.workspaceRole.
 *
 * Attach after `authenticate`. Routes that don't need workspace context
 * can skip this middleware — req.workspaceId will simply be undefined.
 */
export const resolveWorkspace = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    if (!workspaceId) { next(); return; }

    if (!req.user) { res.status(401).json({ message: 'Authentication required' }); return; }

    try {
        const { rows } = await db.query(
            `SELECT role FROM workspace_members
             WHERE workspace_id = $1 AND user_id = $2`,
            [workspaceId, req.user.userId]
        );
        if (rows.length === 0) {
            res.status(403).json({ message: 'Not a member of this workspace' });
            return;
        }
        req.workspaceId   = workspaceId;
        req.workspaceRole = rows[0].role;
        next();
    } catch (err) {
        console.error('[workspace.middleware]', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Guard that requires an active workspace (X-Workspace-Id header must be present
 * and the user must be a verified member). Use after resolveWorkspace.
 */
export const requireWorkspace = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (!req.workspaceId) {
        res.status(400).json({ message: 'X-Workspace-Id header is required for this route' });
        return;
    }
    next();
};
