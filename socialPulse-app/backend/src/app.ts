import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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
import { LinkService } from './services/link.service';
import { errorHandler, notFound } from './middleware/errorHandler';

export const app = express();

app.use(helmet());
const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    process.env.CLIENT_URL_ALT,
].filter(Boolean) as string[];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));

// Relaxed rate limit in test environment
if (process.env.NODE_ENV !== 'test') {
    app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
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
