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
import { LinkService } from './services/link.service';
import { errorHandler, notFound } from './middleware/errorHandler';

export const app = express();

configurePassport();
app.use(passport.initialize());

app.use(helmet());
// Trust one proxy layer (nginx → node). Prevents X-Forwarded-For spoofing.
// If behind Cloudflare, change to: app.set('trust proxy', 2)
app.set('trust proxy', 1);

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://usesocialpulse.com',
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

app.use(express.json({ limit: '10mb' }));
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

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

app.use(notFound);
app.use(errorHandler);
