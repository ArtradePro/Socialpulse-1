// backend/src/routes/oauth.ts
// Mounts OAuth initiation + callback routes for all 4 platforms.
// Initiation routes require authentication. Because the browser redirects to these
// endpoints (no custom headers), the JWT can be passed as ?token=<jwt> for the
// /connect routes specifically.

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.middleware';
import {
    twitterConnect,   twitterCallback,
    instagramConnect, instagramCallback,
    linkedinConnect,  linkedinCallback,
    facebookConnect,  facebookCallback,
} from '../controllers/oauth.controller';

const router = Router();

// Allow JWT via query param for browser-redirect OAuth initiations
function authenticateQuery(req: Request, res: Response, next: NextFunction): void {
    const tokenInQuery = req.query.token as string | undefined;
    if (tokenInQuery) {
        // Inject it as a Bearer header so the standard authenticate middleware works
        req.headers.authorization = `Bearer ${tokenInQuery}`;
    }
    authenticate(req, res, next);
}

// Twitter
router.get('/twitter/connect',   authenticateQuery, twitterConnect);
router.get('/twitter/callback',  twitterCallback);

// Instagram
router.get('/instagram/connect', authenticateQuery, instagramConnect);
router.get('/instagram/callback', instagramCallback);

// LinkedIn
router.get('/linkedin/connect',  authenticateQuery, linkedinConnect);
router.get('/linkedin/callback', linkedinCallback);

// Facebook
router.get('/facebook/connect',  authenticateQuery, facebookConnect);
router.get('/facebook/callback', facebookCallback);

export default router;
