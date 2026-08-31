import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveWorkspace, requireWorkspace } from '../middleware/workspace.middleware';
import { configureIntegration, syncContact, triggerEvent } from '../controllers/omnisendController';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);
router.use(requireWorkspace);

router.post('/config', configureIntegration);
router.post('/contacts', syncContact);
router.post('/events', triggerEvent);

export default router;
