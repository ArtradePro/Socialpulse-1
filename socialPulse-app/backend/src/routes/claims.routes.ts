import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveWorkspace, requireWorkspace } from '../middleware/workspace.middleware';
import { listClaims, createClaim, deleteClaim, validateContent } from '../controllers/claimsController';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get('/', requireWorkspace, listClaims);
router.post('/', requireWorkspace, createClaim);
router.delete('/:id', requireWorkspace, deleteClaim);
router.post('/validate', requireWorkspace, validateContent);

export default router;
