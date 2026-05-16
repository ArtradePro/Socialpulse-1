// backend/src/routes/templates.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listTemplates, createTemplate,
    updateTemplate, deleteTemplate,
} from '../controllers/templatesController';
import { resolveWorkspace } from '../middleware/workspace.middleware';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);
router.get('/',      listTemplates);
router.post('/',     createTemplate);
router.patch('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
