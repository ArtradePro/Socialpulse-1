import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: string;
            email: string;
            plan:   string;
        };
        req.user = { userId: decoded.userId, email: decoded.email, plan: decoded.plan ?? 'free' };
        next();
    } catch {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

const PLAN_ORDER: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };

/**
 * Require the user to be on a minimum plan tier.
 * Usage: router.post('/bulk', requireRole('pro'), bulkCreatePosts)
 */
export const requireRole = (minPlan: string) =>
    (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        const userLevel = PLAN_ORDER[req.user.plan ?? 'free'] ?? 0;
        const minLevel  = PLAN_ORDER[minPlan] ?? 0;
        if (userLevel < minLevel) {
            res.status(403).json({
                message: `This feature requires the ${minPlan} plan or higher.`,
                upgrade: true,
            });
            return;
        }
        next();
    };

