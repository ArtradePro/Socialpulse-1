import { Router } from 'express';
import {
  getConnectedAccounts, disconnectAccount,
  getScheduledPosts, schedulePost, cancelSchedule,
} from '../controllers/socialController';
import { authenticate } from '../middleware/auth.middleware';
import { checkSocialAccountLimit } from '../middleware/planEnforcement.middleware';

const router = Router();

router.get('/accounts', authenticate, getConnectedAccounts);
router.post('/accounts/connect', authenticate, checkSocialAccountLimit);
router.delete('/accounts/:platform', authenticate, disconnectAccount);
router.get('/schedules', authenticate, getScheduledPosts);
router.post('/schedules', authenticate, schedulePost);
router.delete('/schedules/:id', authenticate, cancelSchedule);

export default router;
