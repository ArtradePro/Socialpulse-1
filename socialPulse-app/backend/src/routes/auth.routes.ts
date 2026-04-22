import { Router } from 'express';
import {
    register,
    login,
    getProfile,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    deleteAccount,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register',          register);
router.post('/login',             login);
router.get('/profile',            authenticate, getProfile);
router.post('/forgot-password',   forgotPassword);
router.post('/reset-password',    resetPassword);
router.put('/profile',            authenticate, updateProfile);
router.put('/change-password',    authenticate, changePassword);
router.delete('/account',         authenticate, deleteAccount);

export default router;
