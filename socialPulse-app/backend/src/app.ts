import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { configurePassport } from './config/passport';

import authRoutes         from './routes/auth.routes';
import postRoutes         from './routes/post.routes';
import aiRoutes           from './routes/ai';
import analyticsRoutes    from './routes/analytics';
import socialRoutes       from './routes/social';
import mediaRoutes        from './routes/media';
import billingRoutes      from './routes/billing';
import oauthRoutes        from './routes/oauth';
import hashtagSetsRoutes  from './routes/hashtagSets';
import templatesRoutes    from './routes/templates';
import campaignsRoutes    from './routes/campaigns';
import teamsRoutes        from './routes/teams';
import notificationsRoutes from './routes/notifications';
import workspacesRoutes   from './routes/workspaces';
import rssRoutes          from './routes/rss';
import apiKeysRoutes      from './routes/apiKeys';
import listeningRoutes    from './routes/listening';
import inboxRoutes        from './routes/inbox';
import referralsRoutes    from './routes/referrals';
import approvalRoutes     from './routes/approval';
import ecommerceRoutes    from './routes/ecommerce.routes';
import automationRoutes   from './routes/automation.routes';
import avatarRoutes       from './routes/avatar.routes';
import salesPagesRoutes   from './routes/salesPages';
import marketingRoutes    from './routes/marketing.routes';
import adCampaignsRoutes  from './routes/adCampaigns';
import crmRoutes          from './routes/crm';
import webhookRoutes      from './routes/webhooks';
import integrationsRoutes from './routes/integrations.routes';
import claimsRoutes       from './routes/claims.routes';
import omnisendRoutes    from './routes/omnisend.routes';
import q2cRoutes          from './routes/q2c.routes';
import { LinkService } from './services/link.service';
import { errorHandler, notFound } from './middleware/errorHandler';

export const app = express();

configurePassport();
app.use(passport.initialize());

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: [
                "'self'", 
                "https://api.usesocialpulse.com", 
                "https://usesocialpulse.com",
                "wss://api.usesocialpulse.com",
                "wss://usesocialpulse.com",
                "http://localhost:5000",
                "ws://localhost:5000"
            ],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
        }
    }
}));
// Trust one proxy layer (nginx → node). Prevents X-Forwarded-For spoofing.
// If behind Cloudflare, change to: app.set('trust proxy', 2)
app.set('trust proxy', 1);

export const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
    'https://usesocialpulse.com',
    'https://www.usesocialpulse.com',
    'https://silver-opossum-812035.hostingersite.com',
    process.env.CLIENT_URL,
    process.env.CLIENT_URL_ALT,
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.some(o => origin === o || origin.startsWith(o))) {
            return callback(null, true);
        }
        
        console.warn(`CORS blocked for origin: ${origin}`);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));

// Rate limit: 3000 requests per 15 minutes per IP (~200/min — generous for SPAs).
// Auth endpoints get a tighter limit via nginx (30r/m) on top of this.
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 3000,
        standardHeaders: true,   // sends RateLimit-* headers so clients know their status
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
    }));
}

app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',          authRoutes);
app.use('/api/posts',         postRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/social',        socialRoutes);
app.use('/api/media',         mediaRoutes);
app.use('/api/billing',       billingRoutes);
app.use('/api/oauth',         oauthRoutes);
app.use('/api/hashtag-sets',  hashtagSetsRoutes);
app.use('/api/templates',     templatesRoutes);
app.use('/api/campaigns',     campaignsRoutes);
app.use('/api/teams',         teamsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/workspaces',    workspacesRoutes);
app.use('/api/rss',           rssRoutes);
app.use('/api/api-keys',      apiKeysRoutes);
app.use('/api/listening',     listeningRoutes);
app.use('/api/inbox',         inboxRoutes);
app.use('/api/referrals',     referralsRoutes);
app.use('/api/approvals',     approvalRoutes);
app.use('/api/ecommerce',     ecommerceRoutes);
app.use('/api/automations',    automationRoutes);
app.use('/api/avatars',        avatarRoutes);
app.use('/api/marketing',      marketingRoutes);
app.use('/api/storefront',     salesPagesRoutes);
app.use('/api/ads',            adCampaignsRoutes);
app.use('/api/crm',            crmRoutes);
app.use('/api/webhooks',       webhookRoutes);
app.use('/api/integrations',   integrationsRoutes);
app.use('/api/claims',         claimsRoutes);
app.use('/api/marketing/omnisend', omnisendRoutes);
app.use('/api/integrations/q2c', q2cRoutes);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend dist bundle if available
import path from 'path';
const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
app.use(express.static(frontendDist));

app.get('/l/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const longUrl = await LinkService.resolve(code);
        if (!longUrl) return res.status(404).send('Link not found');
        res.redirect(longUrl);
    } catch (err) {
        console.error('[Shortener] Redirect error:', err);
        res.status(500).send('Server error');
    }
});

// TikTok Domain Signature Verification Endpoint
app.get(['/tiktokSPeuDMslyQzrG2do18LFBXIooga5xWGk.txt', '/tiktokSPeuDMsIyQzrG2do18LFBXIooga5xWGk.txt'], (_req, res) => {
    res.type('text/plain').send('tiktok-developers-site-verification=SPeuDMsIyQzrG2do18LFBXIooga5xWGk');
});

app.get('/tiktok:token.txt', (_req, res) => {
    res.type('text/plain').send('tiktok-developers-site-verification=SPeuDMsIyQzrG2do18LFBXIooga5xWGk');
});

// Public legal pages for TikTok / Meta / Google Ads verification & crawlers
app.get(['/terms', '/terms/'], (_req, res) => {
    res.sendFile(path.join(frontendDist, 'terms.html'), (err) => {
        if (err) res.sendFile(path.join(frontendDist, 'index.html'));
    });
});

app.get(['/privacy', '/privacy/'], (_req, res) => {
    res.sendFile(path.join(frontendDist, 'privacy.html'), (err) => {
        if (err) res.sendFile(path.join(frontendDist, 'index.html'));
    });
});

// SPA catch-all fallback
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
        if (err) next();
    });
});

app.use(notFound);
app.use(errorHandler);
