// backend/src/routes/hashtagSets.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listHashtagSets, createHashtagSet,
    updateHashtagSet, deleteHashtagSet,
} from '../controllers/hashtagSetsController';
import { resolveWorkspace } from '../middleware/workspace.middleware';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);
router.get('/',    listHashtagSets);
router.post('/',   createHashtagSet);
router.patch('/:id', updateHashtagSet);
router.delete('/:id', deleteHashtagSet);

export default router;
