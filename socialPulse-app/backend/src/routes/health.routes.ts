import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { EnvironmentConfig } from '../config/environment';
import { LifecycleManager } from '../lifecycle';

const router = Router();

// Liveness Probe
router.get('/live', (_req: Request, res: Response) => {
    if (LifecycleManager.getIsShuttingDown()) {
        res.status(503).json({ status: 'shutting_down', timestamp: new Date().toISOString() });
        return;
    }
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptimeSecs: Math.floor(process.uptime())
    });
});

// Readiness Probe
router.get('/ready', async (_req: Request, res: Response) => {
    if (LifecycleManager.getIsShuttingDown()) {
        res.status(503).json({ status: 'shutting_down', timestamp: new Date().toISOString() });
        return;
    }

    const diagnostics = EnvironmentConfig.getDiagnostics();

    // 1. Live Database Ping Check
    let dbStatus: 'ready' | 'unavailable' = 'ready';
    let dbLatencyMs: number | undefined;
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        dbLatencyMs = Date.now() - start;
    } catch (err: any) {
        dbStatus = 'unavailable';
        diagnostics.features.database = {
            enabled: true,
            status: 'unavailable',
            reason: 'Database connectivity check failed'
        };
    }

    const isCoreReady = dbStatus === 'ready';

    if (!isCoreReady) {
        res.status(503).json({
            status: 'unavailable',
            coreReady: false,
            timestamp: new Date().toISOString(),
            diagnostics
        });
        return;
    }

    res.json({
        status: 'ready',
        coreReady: true,
        dbLatencyMs,
        timestamp: new Date().toISOString(),
        diagnostics
    });
});

// Legacy /health alias
router.get('/', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
