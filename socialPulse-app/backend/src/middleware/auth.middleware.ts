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
    } else if (req.query.token) {
        token = req.query.token as string;
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

export const requireRole = (_role: string) =>
    (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        next();
    };

