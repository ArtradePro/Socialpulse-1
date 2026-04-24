import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listMessages, markRead, markAllRead, syncInbox } from '../controllers/inboxController';

const router = Router();

router.use(authenticate);
router.get('/',             listMessages);
router.post('/sync',        syncInbox);
router.patch('/:id/read',   markRead);
router.patch('/read-all',   markAllRead);

export default router;
