// server/src/routes/media.ts
import { Router } from 'express';
import { authenticate }   from '../middleware/auth';
import {
    uploadMultiple, uploadSingle,
    validateUpload, handleUploadError,
} from '../middleware/upload.middleware';
import {
    uploadMedia, listMedia, deleteMedia,
    bulkDeleteMedia, getStorageUsage, updateMedia,
} from '../controllers/media.controller';

const router = Router();
router.use(authenticate);

router.post  ('/',           uploadMultiple, handleUploadError, validateUpload, uploadMedia);
router.post  ('/single',     uploadSingle,   handleUploadError, validateUpload, uploadMedia);
router.get   ('/',           listMedia);
router.get   ('/usage',      getStorageUsage);
router.patch ('/:id',        updateMedia);
router.delete('/bulk',       bulkDeleteMedia);
router.delete('/:id',        deleteMedia);

export default router;
