// backend/src/routes/teams.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireTeamRole } from '../middleware/teamRole.middleware';
import {
    listTeams, createTeam, getTeam, updateTeam, deleteTeam,
    inviteMember, acceptInvite, cancelInvite, updateMemberRole, removeMember,
} from '../controllers/teamsController';

const router = Router();

// Public — no JWT required
router.get('/invite/:token/accept',      acceptInvite);

// All remaining routes require authentication
router.use(authenticate);

router.get('/',   listTeams);
router.post('/',  createTeam);

// /:id routes — access is controlled per-route by requireTeamRole
router.get(   '/:id',                        requireTeamRole('viewer'), getTeam);
router.patch( '/:id',                        requireTeamRole('admin'),  updateTeam);
router.delete('/:id',                        requireTeamRole('owner'),  deleteTeam);

router.post(  '/:id/invite',                 requireTeamRole('admin'),  inviteMember);
router.delete('/:id/invites/:inviteId',       requireTeamRole('admin'),  cancelInvite);

router.patch( '/:id/members/:userId/role',   requireTeamRole('admin'),  updateMemberRole);
router.delete('/:id/members/:userId',        requireTeamRole('admin'),  removeMember);

export default router;
