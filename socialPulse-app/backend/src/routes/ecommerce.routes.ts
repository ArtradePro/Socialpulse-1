import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace } from '../middleware/workspace.middleware';
import { 
    getStores, 
    connectStore, 
    disconnectStore, 
    getProducts, 
    syncStore 
} from '../controllers/ecommerce.controller';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get('/stores',          getStores);
router.post('/stores',         connectStore);
router.delete('/stores/:id',   disconnectStore);
router.post('/stores/:id/sync', syncStore);

router.get('/products',        getProducts);

export default router;
