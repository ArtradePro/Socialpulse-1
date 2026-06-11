import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace, requireWorkspace } from '../middleware/workspace.middleware';
import {
    listTemplates,
    useTemplate,
    generateCustomAvatar,
    listPersonas,
    deletePersona,
    togglePersonaActive,
    getBrandVoice,
    upsertBrandVoice,
    writeTargetedCopy
} from '../controllers/avatarController';

const router = Router();

// Apply auth and workspace requirement guards
router.use(authenticate);
router.use(resolveWorkspace);
router.use(requireWorkspace);

router.get('/templates', listTemplates);
router.post('/templates/use', useTemplate);
router.post('/generate', generateCustomAvatar);
router.get('/', listPersonas);
router.delete('/:id', deletePersona);
router.patch('/:id/toggle', togglePersonaActive);
router.get('/voice', getBrandVoice);
router.post('/voice', upsertBrandVoice);
router.post('/:id/write-copy', writeTargetedCopy);

export default router;
