import { Router } from 'express';
import { generateContent, generateHashtags, improveContent, generateImageCaption, generateImage } from '../controllers/aiController';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/generate', authenticate, generateContent);
router.post('/hashtags', authenticate, generateHashtags);
router.post('/improve', authenticate, improveContent);
router.post('/caption', authenticate, generateImageCaption);
router.post('/image',   authenticate, generateImage);

export default router;
