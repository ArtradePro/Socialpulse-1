import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace, requireWorkspace } from '../middleware/workspace.middleware';
import {
    triggerScraping,
    getScrapeTasks,
    getScrapedLeads,
    getWorkflows,
    upsertWorkflow,
    toggleWorkflow,
    getActivityLogs,
    getMetrics,
    runCronTick
} from '../controllers/automationController';

const router = Router();

// Cron tick — require a shared secret so external callers cannot trigger automation runs
const cronTickAuth = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void => {
    const cronSecret = process.env.CRON_SECRET;
    const provided = (req.headers['x-cron-secret'] as string) || req.query['secret'] as string;
    if (!cronSecret || !provided || provided !== cronSecret) {
        res.status(403).json({ message: 'Forbidden' });
        return;
    }
    next();
};
router.get('/cron/tick', cronTickAuth, runCronTick);
router.post('/cron/tick', cronTickAuth, runCronTick);

// Workspace-scoped endpoints
router.use(authenticate);
router.use(resolveWorkspace);
router.use(requireWorkspace);

router.post('/scrape', triggerScraping);
router.get('/tasks', getScrapeTasks);
router.get('/leads', getScrapedLeads);
router.get('/workflows', getWorkflows);
router.post('/workflows', upsertWorkflow);
router.patch('/workflows/:id/toggle', toggleWorkflow);
router.get('/logs', getActivityLogs);
router.get('/metrics', getMetrics);

export default router;
