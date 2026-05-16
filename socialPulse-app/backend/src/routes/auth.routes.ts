import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import {
    register,
    login,
    getProfile,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    deleteAccount,
    getNotificationPrefs,
    updateNotificationPrefs,
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
router.delete('/account',              authenticate, deleteAccount);
router.get('/notification-prefs',      authenticate, getNotificationPrefs);
router.patch('/notification-prefs',    authenticate, updateNotificationPrefs);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed` }),
    (req: any, res) => {
        const token = jwt.sign(
            { userId: req.user.id, email: req.user.email, plan: req.user.plan ?? 'free' },
            process.env.JWT_SECRET!,
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
        );
        res.redirect(`${process.env.CLIENT_URL}/login?token=${token}`);
    }
);

export default router;
