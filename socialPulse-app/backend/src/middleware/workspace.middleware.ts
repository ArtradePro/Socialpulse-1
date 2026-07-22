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
    let workspaceId = req.headers['x-workspace-id'] as string | undefined;

    if (!req.user) {
        if (workspaceId) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }
        next();
        return;
    }

    try {
        if (!workspaceId) {
            // Auto-fallback to user's first active workspace if no header sent
            const { rows: defaultWs } = await db.query(
                `SELECT workspace_id, role FROM workspace_members
                 WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
                [req.user.userId]
            );
            if (defaultWs.length > 0) {
                req.workspaceId   = defaultWs[0].workspace_id;
                req.workspaceRole = defaultWs[0].role;
            }
            next();
            return;
        }

        const { rows } = await db.query(
            `SELECT role FROM workspace_members
             WHERE workspace_id = $1 AND user_id = $2`,
            [workspaceId, req.user.userId]
        );
        
        if (rows.length === 0) {
            console.warn(`[Workspace] User ${req.user.userId} attempted to access workspace ${workspaceId} but is not a member.`);
            req.workspaceId = undefined;
            next();
            return;
        }
        
        req.workspaceId   = workspaceId;
        req.workspaceRole = rows[0].role;
        next();
    } catch (err) {
        console.error('[workspace.middleware] Error resolving workspace:', err);
        // Fallback to personal context on error to keep the app running
        next();
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
