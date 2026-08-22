import { Router } from 'express';
import {
  getConnectedAccounts, disconnectAccount,
  getScheduledPosts, schedulePost, cancelSchedule,
} from '../controllers/socialController';
import { authenticate } from '../middleware/auth.middleware';
import { checkSocialAccountLimit } from '../middleware/planEnforcement.middleware';

import { TokenHealthService } from '../services/tokenHealth.service';

const router = Router();

router.get('/health', authenticate, async (req: any, res) => {
    try {
        const userId = req.user.userId;
        const health = await TokenHealthService.checkUserTokens(userId);
        res.json({ accounts: health });
    } catch (err: any) {
        res.status(500).json({ message: err.message || 'Failed to check token health' });
    }
});

router.get('/accounts', authenticate, getConnectedAccounts);
router.post('/accounts/connect', authenticate, checkSocialAccountLimit);
router.delete('/accounts/:platform', authenticate, disconnectAccount);
router.get('/schedules', authenticate, getScheduledPosts);
router.post('/schedules', authenticate, schedulePost);
router.delete('/schedules/:id', authenticate, cancelSchedule);

export default router;
