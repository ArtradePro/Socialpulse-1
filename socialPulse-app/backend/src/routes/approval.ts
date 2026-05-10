import { Router } from 'express';
import { createApprovalLink, getPublicPost, submitApproval } from '../controllers/approvalController';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Private: Generate link
router.post('/generate-link', authenticate, createApprovalLink);

// Public: View and Approve (no authentication needed, token-based)
router.get('/public/:token', getPublicPost);
router.post('/public/:token/submit', submitApproval);

export default router;
