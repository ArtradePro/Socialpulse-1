import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace } from '../middleware/workspace.middleware';
import {
    listSalesPages,
    getSalesPage,
    createSalesPage,
    updateSalesPage,
    deleteSalesPage,
    getSalesPageBySlug,
    createCheckoutOrder,
    listSalesOrders
} from '../controllers/salesPages.controller';

const router = Router();

// Public storefront checkout funnels (no authentication or workspace checks)
router.get('/public/:slug', getSalesPageBySlug);
router.post('/public/checkout', createCheckoutOrder);

// Private workspace-level builder routes
router.use(authenticate);
router.use(resolveWorkspace);

router.get('/',       listSalesPages);
router.post('/',      createSalesPage);
router.get('/orders', listSalesOrders);
router.get('/:id',    getSalesPage);
router.patch('/:id',  updateSalesPage);
router.delete('/:id', deleteSalesPage);

export default router;
