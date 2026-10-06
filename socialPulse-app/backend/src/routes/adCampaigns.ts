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
    generateAdBanner,
    generateUGCScript,
    renderUGCVideo,
    urlToCampaign,
    generateAdBannerBatch,
    getAutoPilotStatus,
    updateAutoPilotConfig,
    triggerAutoPilotEvaluation
} from '../controllers/adCampaigns.controller';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get('/',      listAdCampaigns);
router.post('/',     createAdCampaign);
router.get('/autopilot/status', getAutoPilotStatus);
router.post('/autopilot/config', updateAutoPilotConfig);
router.post('/autopilot/run', triggerAutoPilotEvaluation);
router.post('/video', generateAvatarVideo);
router.get('/video',  listGeneratedVideos);
router.post('/ugc-script', generateUGCScript);
router.post('/ugc-video', renderUGCVideo);
router.post('/banner', generateAdBanner);
router.post('/banner-batch', generateAdBannerBatch);
router.post('/url-to-campaign', urlToCampaign);
router.get('/:id',   getAdCampaign);
router.patch('/:id', updateAdCampaign);
router.delete('/:id', deleteAdCampaign);

export default router;
