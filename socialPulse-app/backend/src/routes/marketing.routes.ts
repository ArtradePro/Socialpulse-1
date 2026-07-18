import { Router } from 'express';
import {
    createContact,
    getContacts,
    deleteContact,
    bulkImportContacts,
    createCampaign,
    getCampaigns,
    deleteCampaign,
    createAutomation,
    getAutomations,
    getAnalyticsSummary,
    handleDeliveryWebhook,
} from '../controllers/marketing.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace, requireWorkspace } from '../middleware/workspace.middleware';

const router = Router();

// Public provider delivery webhook endpoint
router.post('/webhooks/delivery', handleDeliveryWebhook);

// Protected workspace-scoped endpoints
router.get('/contacts',       authenticate, resolveWorkspace, requireWorkspace, getContacts);
router.post('/contacts',      authenticate, resolveWorkspace, requireWorkspace, createContact);
router.delete('/contacts/:id', authenticate, resolveWorkspace, requireWorkspace, deleteContact);
router.post('/contacts/bulk',  authenticate, resolveWorkspace, requireWorkspace, bulkImportContacts);

router.get('/campaigns',      authenticate, resolveWorkspace, requireWorkspace, getCampaigns);
router.post('/campaigns',     authenticate, resolveWorkspace, requireWorkspace, createCampaign);
router.delete('/campaigns/:id', authenticate, resolveWorkspace, requireWorkspace, deleteCampaign);

router.get('/automations',    authenticate, resolveWorkspace, requireWorkspace, getAutomations);
router.post('/automations',   authenticate, resolveWorkspace, requireWorkspace, createAutomation);

router.get('/analytics',      authenticate, resolveWorkspace, requireWorkspace, getAnalyticsSummary);

export default router;
