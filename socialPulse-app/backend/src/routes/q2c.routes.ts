import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveWorkspace, requireWorkspace } from '../middleware/workspace.middleware';
import { handleInboundQ2CEvent, pushLead } from '../controllers/q2cController';

const router = Router();

// Inbound signed webhook (no JWT, authenticated via HMAC signature)
router.post('/events', handleInboundQ2CEvent);

// Outbound push (JWT authenticated)
router.post('/push-lead', authenticate, resolveWorkspace, requireWorkspace, pushLead);

export default router;
