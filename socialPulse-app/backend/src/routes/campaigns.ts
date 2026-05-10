// backend/src/routes/campaigns.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listCampaigns, getCampaign,
    createCampaign, updateCampaign, deleteCampaign, generateMagicPlan
} from '../controllers/campaignsController';

const router = Router();

router.use(authenticate);
router.get('/',      listCampaigns);
router.post('/',     createCampaign);
router.get('/:id',   getCampaign);
router.post('/:id/magic-plan', generateMagicPlan);
router.patch('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

export default router;
