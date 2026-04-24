import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getMyReferral } from '../controllers/referralsController';

const router = Router();

router.use(authenticate);
router.get('/me', getMyReferral);

export default router;
