import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace } from '../middleware/workspace.middleware';
import {
    listAdCampaigns,
    getAdCampaign,
    createAdCampaign,
    updateAdCampaign,
    deleteAdCampaign,
    generateAvatarVideo,
    listGeneratedVideos,
    generateAdBanner
} from '../controllers/adCampaigns.controller';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get('/',      listAdCampaigns);
router.post('/',     createAdCampaign);
router.post('/video', generateAvatarVideo);
router.get('/video',  listGeneratedVideos);
router.post('/banner', generateAdBanner);
router.get('/:id',   getAdCampaign);
router.patch('/:id', updateAdCampaign);
router.delete('/:id', deleteAdCampaign);

export default router;
