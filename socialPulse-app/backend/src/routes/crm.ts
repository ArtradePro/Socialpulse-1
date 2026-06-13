import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace } from '../middleware/workspace.middleware';
import {
    listCustomers,
    getCustomerMessages,
    sendCustomerMessage,
    sendEmailReceipt
} from '../controllers/crm.controller';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get('/customers', listCustomers);
router.get('/customers/:id/messages', getCustomerMessages);
router.post('/customers/:id/messages', sendCustomerMessage);
router.post('/customers/:id/email-receipt', sendEmailReceipt);

export default router;
