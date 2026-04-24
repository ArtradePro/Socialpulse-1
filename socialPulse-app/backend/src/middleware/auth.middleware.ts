import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request globally so all downstream code sees req.user
declare global {
    namespace Express {
        interface Request {
            user?:     { userId: string; email: string; plan: string };
            teamRole?: string;  // set by requireTeamRole middleware
        }
    }
}

export interface AuthRequest extends Request {
    user?: { userId: string; email: string; plan: string };
}

export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];
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

export const requireRole = (_role: string) =>
    (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        next();
    };

