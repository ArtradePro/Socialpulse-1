// server/src/routes/analytics.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboard, getAiInsights, exportReport } from '../controllers/analyticsController';

const router = Router();

router.use(authenticate);

// GET /api/analytics/dashboard?range=30d&platform=all
router.get('/dashboard', getDashboard);
router.get('/insights',  getAiInsights);
router.get('/export',    exportReport);

export default router;
