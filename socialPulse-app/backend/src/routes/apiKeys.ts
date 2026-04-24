import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listApiKeys, generateApiKey, revokeApiKey, deleteApiKey } from '../controllers/apiKeysController';

const router = Router();

router.use(authenticate);
router.get('/',              listApiKeys);
router.post('/',             generateApiKey);
router.patch('/:id/revoke',  revokeApiKey);
router.delete('/:id',        deleteApiKey);

export default router;
