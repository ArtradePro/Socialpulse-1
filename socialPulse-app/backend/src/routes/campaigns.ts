// backend/src/routes/campaigns.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    listCampaigns, getCampaign,
    createCampaign, updateCampaign, deleteCampaign,
} from '../controllers/campaignsController';

const router = Router();

router.use(authenticate);
router.get('/',      listCampaigns);
router.post('/',     createCampaign);
router.get('/:id',   getCampaign);
router.patch('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

export default router;
