import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace } from '../middleware/workspace.middleware';
import {
    listWorkspaces,
    createWorkspace,
    getWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMember,
    acceptWorkspaceInvite,
    removeMember,
    updateMemberRole,
    cancelInvite,
    updateBranding,
    getBrandingByDomain,
} from '../controllers/workspacesController';

const router = Router();

// Fully public — brand lookup by domain (used by white-label clients)
router.get('/brand/:domain', getBrandingByDomain);

// Public — accept invite (user must still be logged in)
router.get('/invite/:token/accept', authenticate, acceptWorkspaceInvite);

// Authenticated routes — no workspace context needed
router.use(authenticate);
router.get('/',  listWorkspaces);
router.post('/', createWorkspace);

// Workspace-scoped routes — require X-Workspace-Id header
router.use(resolveWorkspace);
router.get('/:id',                           getWorkspace);
router.patch('/:id',                         updateWorkspace);
router.patch('/:id/branding',                updateBranding);
router.delete('/:id',                        deleteWorkspace);
router.post('/:id/invite',                   inviteMember);
router.delete('/:id/invites/:inviteId',      cancelInvite);
router.delete('/:id/members/:userId',        removeMember);
router.patch('/:id/members/:userId/role',    updateMemberRole);

export default router;
