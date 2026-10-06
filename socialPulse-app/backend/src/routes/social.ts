import { Router } from 'express';
import {
  getConnectedAccounts, disconnectAccount,
  getScheduledPosts, schedulePost, cancelSchedule,
} from '../controllers/socialController';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace } from '../middleware/workspace.middleware';
import { checkSocialAccountLimit } from '../middleware/planEnforcement.middleware';

import { TokenHealthService } from '../services/tokenHealth.service';

const router = Router();

router.use(authenticate, resolveWorkspace);

router.get('/health', async (req: any, res) => {
    try {
        const userId = req.user.userId;
        const health = await TokenHealthService.checkUserTokens(userId);
        res.json({ accounts: health });
    } catch (err: any) {
        res.status(500).json({ message: err.message || 'Failed to check token health' });
    }
});

router.get('/accounts', getConnectedAccounts);
router.post('/accounts/connect', checkSocialAccountLimit);
router.delete('/accounts/:platform', disconnectAccount);
router.get('/schedules', getScheduledPosts);
router.post('/schedules', schedulePost);
router.delete('/schedules/:id', cancelSchedule);

export default router;
