import { Router } from 'express';
import { createPost, getPosts, getPost, updatePost, deletePost, publishNow, bulkCreatePosts } from '../controllers/post.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { checkPostLimit } from '../middleware/planEnforcement.middleware';

const router = Router();

router.get('/',              authenticate, getPosts);
router.post('/bulk',         authenticate, bulkCreatePosts);
router.post('/',             authenticate, checkPostLimit, upload.array('media', 10), createPost);
router.get('/:id',           authenticate, getPost);
router.patch('/:id',         authenticate, updatePost);
router.delete('/:id',        authenticate, deletePost);
router.post('/:id/publish',  authenticate, publishNow);

export default router;
