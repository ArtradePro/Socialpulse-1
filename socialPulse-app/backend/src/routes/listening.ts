import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listRules, createRule, deleteRule, toggleRule,
    getResults, fetchRuleNow,
} from '../controllers/listeningController';

const router = Router();

router.use(authenticate);
router.get('/rules',           listRules);
router.post('/rules',          createRule);
router.delete('/rules/:id',    deleteRule);
router.patch('/rules/:id/toggle', toggleRule);
router.get('/results',         getResults);
router.post('/rules/:id/fetch', fetchRuleNow);

export default router;
