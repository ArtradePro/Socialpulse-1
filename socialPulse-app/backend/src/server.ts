import 'dotenv/config';
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
import { errorHandler, notFound } from './middleware/errorHandler';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { initScheduler } from './jobs/postPublisher';
import { initMediaCleanup } from './jobs/mediaCleanup.job';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await connectRedis();
  initScheduler();
  initMediaCleanup();
  app.listen(PORT, () => console.log(`SocialPulse API running on http://localhost:${PORT}`));
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
