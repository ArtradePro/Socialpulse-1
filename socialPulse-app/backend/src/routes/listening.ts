import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listRules, createRule, deleteRule, toggleRule,
    getResults, fetchRuleNow, getCrisisSummary, generateCrisisResponse,
} from '../controllers/listeningController';
import { resolveWorkspace } from '../middleware/workspace.middleware';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);
router.get('/rules',                 listRules);
router.post('/rules',                createRule);
router.delete('/rules/:id',          deleteRule);
router.patch('/rules/:id/toggle',    toggleRule);
router.get('/results',               getResults);
router.post('/rules/:id/fetch',      fetchRuleNow);
router.get('/crisis-summary',        getCrisisSummary);
router.post('/crisis-response',      generateCrisisResponse);

export default router;
