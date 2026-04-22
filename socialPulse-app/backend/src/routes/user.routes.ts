import { Router } from 'express';
import { getProfile, updateProfile, followUser, unfollowUser } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', authenticate, getProfile);
router.put('/me', authenticate, updateProfile);
router.get('/:id', authenticate, getProfile);
router.post('/:id/follow', authenticate, followUser);
router.delete('/:id/follow', authenticate, unfollowUser);

export default router;
