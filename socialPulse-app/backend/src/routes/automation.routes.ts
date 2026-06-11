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

// Cron tick route is accessible globally for background queue processing
router.get('/cron/tick', runCronTick);
router.post('/cron/tick', runCronTick);

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
