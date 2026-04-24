import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { EmailService } from '../services/email.service';
import { applyReferralCode } from './referralsController';

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, fullName, referralCode } = req.body;

        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name, ai_credits)
             VALUES ($1, $2, $3, 10) RETURNING id, email, full_name, plan, ai_credits`,
            [email, passwordHash, fullName]
        );

        const user = result.rows[0];

        const token = jwt.sign(
            { userId: user.id, email: user.email, plan: user.plan ?? 'free' },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                plan: user.plan,
                aiCredits: user.ai_credits,
            },
        });

        // Fire-and-forget welcome email and referral credit
        EmailService.sendWelcome(user.email, user.full_name).catch(console.error);
        if (referralCode) applyReferralCode(user.id, referralCode).catch(console.error);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, plan: user.plan ?? 'free' },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                plan: user.plan,
                aiCredits: user.ai_credits,
                avatar: user.avatar_url,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Password Reset ──────────────────────────────────────────────────────────

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email) { res.status(400).json({ message: 'Email is required' }); return; }

    try {
        const { rows } = await db.query(
            'SELECT id, full_name FROM users WHERE email = $1', [email]
        );

        // Always respond OK to prevent user enumeration
        if (rows.length === 0) {
            res.json({ message: 'If that email exists, a reset link has been sent.' });
            return;
        }

        const user = rows[0];
        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Invalidate any previous tokens for this user
        await db.query(
            `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
            [user.id]
        );

        await db.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, tokenHash, expiresAt]
        );

        await EmailService.sendPasswordReset(email, rawToken);

        res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
        console.error('[forgotPassword]', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body;
    if (!token || !password) {
        res.status(400).json({ message: 'Token and new password are required' });
        return;
    }
    if (password.length < 8) {
        res.status(400).json({ message: 'Password must be at least 8 characters' });
        return;
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const { rows } = await db.query(
            `SELECT prt.id, prt.user_id, prt.expires_at
             FROM password_reset_tokens prt
             WHERE prt.token_hash = $1 AND prt.used = false AND prt.expires_at > NOW()`,
            [tokenHash]
        );

        if (rows.length === 0) {
            res.status(400).json({ message: 'Invalid or expired reset token' });
            return;
        }

        const { id: tokenId, user_id: userId } = rows[0];
        const passwordHash = await bcrypt.hash(password, 12);

        await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, userId]);
        await db.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [tokenId]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('[resetPassword]', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Profile & Password (authenticated) ─────────────────────────────────────

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user.userId;
    const { fullName, avatarUrl } = req.body;
    try {
        const { rows } = await db.query(
            `UPDATE users
             SET full_name  = COALESCE($1, full_name),
                 avatar_url = COALESCE($2, avatar_url),
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, email, full_name, avatar_url, plan, ai_credits`,
            [fullName ?? null, avatarUrl ?? null, userId]
        );
        const u = rows[0];
        res.json({ id: u.id, email: u.email, fullName: u.full_name,
                   avatar: u.avatar_url, plan: u.plan, aiCredits: u.ai_credits });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res.status(400).json({ message: 'Both current and new password are required' });
        return;
    }
    if (newPassword.length < 8) {
        res.status(400).json({ message: 'New password must be at least 8 characters' });
        return;
    }
    try {
        const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) { res.status(401).json({ message: 'Current password is incorrect' }); return; }

        const hash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hash, userId]);
        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await db.query(
            `SELECT id, email, full_name, avatar_url, plan, ai_credits, created_at
             FROM users WHERE id = $1`,
            [(req as any).user.userId]
        );

        const user = result.rows[0];
        if (!user) { res.status(404).json({ message: 'User not found' }); return; }

        const accounts = await db.query(
            `SELECT id, platform, username, profile_image, followers_count, is_active
             FROM social_accounts WHERE user_id = $1`,
            [(req as any).user.userId]
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                avatar: user.avatar_url,
                plan: user.plan,
                aiCredits: user.ai_credits,
                memberSince: user.created_at,
            },
            socialAccounts: accounts.rows,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user.userId;
    // Cascade delete is handled by DB FK constraints; just delete the user row.
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    res.status(204).send();
};

// ─── Notification Preferences ────────────────────────────────────────────────

const NOTIF_KEYS = ['postFailed', 'paymentFailed', 'trialEnding', 'weeklyDigest'] as const;
type NotifPrefs  = Record<typeof NOTIF_KEYS[number], boolean>;

const defaultPrefs = (): NotifPrefs => ({
    postFailed: true, paymentFailed: true, trialEnding: true, weeklyDigest: false,
});

export const getNotificationPrefs = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rows } = await db.query(
            'SELECT notification_prefs FROM users WHERE id = $1',
            [(req as any).user.userId]
        );
        res.json(rows[0]?.notification_prefs ?? defaultPrefs());
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateNotificationPrefs = async (req: Request, res: Response): Promise<void> => {
    const patch: Partial<NotifPrefs> = {};
    for (const key of NOTIF_KEYS) {
        if (typeof req.body[key] === 'boolean') patch[key] = req.body[key];
    }
    try {
        const { rows } = await db.query(
            `UPDATE users
             SET notification_prefs = notification_prefs || $1::jsonb, updated_at = NOW()
             WHERE id = $2
             RETURNING notification_prefs`,
            [JSON.stringify(patch), (req as any).user.userId]
        );
        res.json(rows[0].notification_prefs);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};