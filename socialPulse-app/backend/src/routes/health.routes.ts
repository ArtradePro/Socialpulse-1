import { Router, Request, Response } from 'express';
import crypto from 'crypto';
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
router.get('/ready', async (req: Request, res: Response) => {
    if (LifecycleManager.getIsShuttingDown()) {
        res.status(503).json({ status: 'shutting_down', timestamp: new Date().toISOString() });
        return;
    }

    const diagnostics = EnvironmentConfig.getDiagnostics();

    // 1. Live Database Connectivity Check
    let dbConnected = false;
    let dbLatencyMs: number | undefined;
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        dbLatencyMs = Date.now() - start;
        dbConnected = true;
    } catch {
        dbConnected = false;
        diagnostics.features.database = {
            enabled: true,
            status: 'unavailable',
            reason: 'Database connectivity check failed'
        };
    }

    // 2. Determine Overall Health Status
    if (!dbConnected) {
        res.status(503).json({
            status: 'unavailable',
            coreReady: false,
            timestamp: new Date().toISOString()
        });
        return;
    }

    // Check if encryption or other services are degraded/unverified
    const hasMisconfigured = Object.values(diagnostics.features).some(f => f.status === 'misconfigured');
    const hasUnverifiedOrDisabled = Object.values(diagnostics.features).some(f => f.status === 'configured_unverified' || f.status === 'disabled');

    const overallStatus = (hasMisconfigured || hasUnverifiedOrDisabled) ? 'degraded' : 'ready';

    // 3. Access Model: Check if authenticated monitoring secret header is provided
    const clientSecret = req.headers['x-monitoring-secret'] as string | undefined;
    const internalSecret = process.env.INTERNAL_MONITORING_SECRET;

    let isAuthorizedForDetails = false;
    if (clientSecret && internalSecret) {
        try {
            const clientBuf = Buffer.from(clientSecret);
            const internalBuf = Buffer.from(internalSecret);
            if (clientBuf.length === internalBuf.length && crypto.timingSafeEqual(clientBuf, internalBuf)) {
                isAuthorizedForDetails = true;
            }
        } catch {
            isAuthorizedForDetails = false;
        }
    }

    const responsePayload: any = {
        status: overallStatus,
        coreReady: true,
        timestamp: new Date().toISOString()
    };

    if (isAuthorizedForDetails) {
        responsePayload.dbLatencyMs = dbLatencyMs;
        responsePayload.diagnostics = diagnostics;
    }

    res.status(200).json(responsePayload);
});

// Legacy /health alias
router.get('/', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
