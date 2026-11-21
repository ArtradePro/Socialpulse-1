import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listMessages, markRead, markAllRead, syncInbox, convertMessageToLead } from '../controllers/inboxController';
import { resolveWorkspace } from '../middleware/workspace.middleware';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);
router.get('/',                 listMessages);
router.post('/sync',            syncInbox);
router.patch('/:id/read',       markRead);
router.patch('/read-all',       markAllRead);
router.post('/:id/convert-lead', convertMessageToLead);

export default router;
