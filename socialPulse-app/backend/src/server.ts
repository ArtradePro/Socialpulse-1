// import geminiTestRoute from "./routes/geminiTest";
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { app, allowedOrigins } from './app';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { initScheduler } from './jobs/postPublisher';
import { initMediaCleanup } from './jobs/mediaCleanup.job';
import { initAnalyticsSync } from './jobs/analyticsSync';
import { initRssJob } from './jobs/rssJob';
import { initListeningJob } from './jobs/listeningJob';
import { initInboxJob } from './jobs/inboxJob';
import { initAdPerformanceJob } from './jobs/adPerformance.job';
import { initMarketingWorkers } from './jobs/marketing/workers';
import { processQueue, processPendingScrapeTasks, checkScheduledTasks } from './services/automationService';

import { EnvironmentConfig } from './config/environment';
import { LifecycleManager } from './lifecycle';

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
    // 1. Startup environment validation
    const envCheck = EnvironmentConfig.validateStartup();
    if (!envCheck.valid) {
        console.error('❌ Startup configuration validation failed:');
        envCheck.errors.forEach(err => console.error(` - ${err}`));
        process.exit(1);
    }

    await connectDB();
    try {
        await connectRedis();
        initScheduler();
        initMediaCleanup();
        initAnalyticsSync();
        initRssJob();
        initListeningJob();
        initInboxJob();
        initAdPerformanceJob();
        initMarketingWorkers();
    } catch (err) {
        console.warn('Redis unavailable — continuing startup without queue features:', err);
    }

    if (process.env.NODE_ENV !== 'test') {
        startAutomationSafetyNet();
    }

    const server = createServer(app);
    LifecycleManager.registerServer(server);
    LifecycleManager.initProcessSignals();

    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        socket.on('join-workspace', (workspaceId: string) => {
            socket.join(`workspace:${workspaceId}`);
        });

        socket.on('mouse-move', (data: { workspaceId: string; x: number; y: number; fullName: string; color: string; avatar?: string }) => {
            socket.to(`workspace:${data.workspaceId}`).emit('cursor-update', {
                socketId: socket.id,
                x: data.x,
                y: data.y,
                fullName: data.fullName,
                color: data.color,
                avatar: data.avatar
            });
        });

        socket.on('disconnect', () => {
            io.emit('cursor-remove', socket.id);
        });
    });

    server.listen(PORT, () => console.log(`SocialPulse API running on http://localhost:${PORT}`));
};

start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
