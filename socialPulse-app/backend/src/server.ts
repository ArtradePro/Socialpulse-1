// import geminiTestRoute from "./routes/geminiTest";
import 'dotenv/config';
import { app } from './app';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { initScheduler } from './jobs/postPublisher';
import { initMediaCleanup } from './jobs/mediaCleanup.job';
import { initAnalyticsSync } from './jobs/analyticsSync';
import { initRssJob } from './jobs/rssJob';
import { initListeningJob } from './jobs/listeningJob';
import { initInboxJob } from './jobs/inboxJob';
import { processQueue, processPendingScrapeTasks, checkScheduledTasks } from './services/automationService';

const PORT = process.env.PORT || 5000;

const startAutomationSafetyNet = () => {
    console.log('🤖 Starting Automation Safety-Net Ticking loop (every 60s)...');
    setInterval(async () => {
        try {
            await checkScheduledTasks();
            await processPendingScrapeTasks();
            await processQueue();
        } catch (err) {
            console.error('❌ Error in background automation safety-net tick:', err);
        }
    }, 60 * 1000);
};

const start = async (): Promise<void> => {
    await connectDB();
    try {
        await connectRedis();
        initScheduler();
        initMediaCleanup();
        initAnalyticsSync();
        initRssJob();
        initListeningJob();
        initInboxJob();
    } catch (err) {
        console.warn('Redis unavailable — continuing startup without queue features:', err);
    }

    if (process.env.NODE_ENV !== 'test') {
        startAutomationSafetyNet();
    }

    // Register Gemini test route
    // app.use("/api", geminiTestRoute);

    app.listen(PORT, () => console.log(`SocialPulse API running on http://localhost:${PORT}`));
};

start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
