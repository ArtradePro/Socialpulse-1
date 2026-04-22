// backend/src/routes/teams.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listTeams, createTeam, getTeam, updateTeam, deleteTeam,
    inviteMember, acceptInvite, updateMemberRole, removeMember,
} from '../controllers/teamsController';

const router = Router();

router.use(authenticate);

router.get('/',                          listTeams);
router.post('/',                         createTeam);
router.get('/:id',                       getTeam);
router.patch('/:id',                     updateTeam);
router.delete('/:id',                    deleteTeam);

router.post('/:id/invite',               inviteMember);
router.get('/invite/:token/accept',      acceptInvite);

router.patch('/:id/members/:userId/role', updateMemberRole);
router.delete('/:id/members/:userId',    removeMember);

export default router;
