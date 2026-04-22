// server/src/routes/analytics.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboard } from '../controllers/analyticsController';

const router = Router();

router.use(authenticate);

// GET /api/analytics/dashboard?range=30d&platform=all
router.get('/dashboard', getDashboard);

export default router;
