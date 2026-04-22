// backend/src/routes/templates.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listTemplates, createTemplate,
    updateTemplate, deleteTemplate,
} from '../controllers/templatesController';

const router = Router();

router.use(authenticate);
router.get('/',      listTemplates);
router.post('/',     createTemplate);
router.patch('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
