// server/src/routes/analytics.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveWorkspace } from '../middleware/workspace.middleware';
import { 
    getDashboard, 
    getAiInsights, 
    exportReport, 
    getCompetitiveBenchmarking, 
    saveCompetitor, 
    deleteCompetitor 
} from '../controllers/analyticsController';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);

// GET /api/analytics/dashboard?range=30d&platform=all
router.get('/dashboard',                  getDashboard);
router.get('/insights',                   getAiInsights);
router.get('/export',                     exportReport);
router.get('/benchmarking',               getCompetitiveBenchmarking);
router.post('/benchmarking/competitors',  saveCompetitor);
router.delete('/benchmarking/competitors/:id', deleteCompetitor);

export default router;
