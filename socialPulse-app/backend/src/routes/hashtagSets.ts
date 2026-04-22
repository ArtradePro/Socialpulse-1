// backend/src/routes/hashtagSets.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listHashtagSets, createHashtagSet,
    updateHashtagSet, deleteHashtagSet,
} from '../controllers/hashtagSetsController';

const router = Router();

router.use(authenticate);
router.get('/',    listHashtagSets);
router.post('/',   createHashtagSet);
router.patch('/:id', updateHashtagSet);
router.delete('/:id', deleteHashtagSet);

export default router;
