import { Request, Response, NextFunction, RequestHandler } from 'express';
import { db } from '../config/database';

type TeamRole = 'viewer' | 'member' | 'admin' | 'owner';

const RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/**
 * Middleware factory — verifies the authenticated user is a member of the team
 * identified by req.params.id with at least `minRole`. Attaches req.teamRole on success.
 *
 * Usage: router.patch('/:id', requireTeamRole('admin'), controller)
 */
export const requireTeamRole = (minRole: TeamRole): RequestHandler =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const teamId = req.params.id;
        const userId = req.user!.userId;

        try {
            const { rows } = await db.query(
                `SELECT role FROM team_members
                 WHERE team_id = $1 AND user_id = $2 AND accepted = true`,
                [teamId, userId]
            );

            if (!rows[0]) {
                res.status(403).json({ message: 'Not a team member' });
                return;
            }

            if (RANK[rows[0].role] < RANK[minRole]) {
                res.status(403).json({ message: 'Insufficient team permissions' });
                return;
            }

            req.teamRole = rows[0].role;
            next();
        } catch (err) {
            console.error('[RBAC] team role check error:', err);
            res.status(500).json({ message: 'Authorization check failed' });
        }
    };
