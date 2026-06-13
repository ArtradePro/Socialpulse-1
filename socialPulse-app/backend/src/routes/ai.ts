import { Router } from 'express';
import { generateContent, generateHashtags, generateMagicPlan, generateReply, draftFromTrend, reviewContent, improveContent, generateImageCaption, generateImage, generateProductPost, generateAdCreative } from '../controllers/aiController';
import { authenticate } from '../middleware/auth.middleware';
import { resolveWorkspace } from '../middleware/workspace.middleware';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.post('/generate', generateContent);
router.post('/hashtags', generateHashtags);
router.post('/reply',    generateReply);
router.post('/magic-plan', generateMagicPlan);
router.post('/draft-from-trend', draftFromTrend);
router.post('/review',   reviewContent);
router.post('/improve',  improveContent);
router.post('/caption',  generateImageCaption);
router.post('/image',    generateImage);
router.post('/product-post', generateProductPost);
router.post('/generate-ad-creative', generateAdCreative);

export default router;
