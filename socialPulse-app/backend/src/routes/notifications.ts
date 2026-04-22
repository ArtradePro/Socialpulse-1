// backend/src/routes/notifications.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listNotifications, markRead,
    markAllRead, deleteNotification,
} from '../controllers/notificationsController';

const router = Router();

router.use(authenticate);
router.get('/',              listNotifications);
router.patch('/read-all',    markAllRead);
router.patch('/:id/read',    markRead);
router.delete('/:id',        deleteNotification);

export default router;
