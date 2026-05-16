import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listFeeds, createFeed, updateFeed, deleteFeed, fetchFeedNow } from '../controllers/rssController';
import { resolveWorkspace } from '../middleware/workspace.middleware';

const router = Router();

router.use(authenticate);
router.use(resolveWorkspace);
router.get('/',           listFeeds);
router.post('/',          createFeed);
router.patch('/:id',      updateFeed);
router.delete('/:id',     deleteFeed);
router.post('/:id/fetch', fetchFeedNow);

export default router;
