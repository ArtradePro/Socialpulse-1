import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database';

const REFERRAL_CREDITS = 20;

function generateCode(): string {
    return crypto.randomBytes(5).toString('hex').toUpperCase();
}

export const getMyReferral = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;

        // Ensure user has a referral code
        let { rows } = await db.query(
            'SELECT referral_code FROM users WHERE id = $1', [userId]
        );
        let code = rows[0]?.referral_code;

        if (!code) {
            code = generateCode();
            await db.query(
                'UPDATE users SET referral_code = $1 WHERE id = $2',
                [code, userId]
            );
        }

        const { rows: referrals } = await db.query(
            `SELECT r.*, u.email AS referred_email, u.full_name AS referred_name
             FROM referrals r
             LEFT JOIN users u ON u.id = r.referred_id
             WHERE r.referrer_id = $1
             ORDER BY r.created_at DESC`,
            [userId]
        );

        const totalCredits = referrals
            .filter((r: any) => r.status === 'completed')
            .reduce((sum: number, r: any) => sum + r.reward_credits, 0);

        res.json({ code, referrals, totalCreditsEarned: totalCredits });
    } catch (err) {
        console.error('[Referrals] getMyReferral error:', err);
        res.status(500).json({ message: 'Failed to load referral data' });
    }
};

/** Called from auth.controller register when referral_code is supplied */
export async function applyReferralCode(
    referredUserId: string,
    code: string
): Promise<void> {
    try {
        const { rows } = await db.query(
            'SELECT id FROM users WHERE referral_code = $1', [code.toUpperCase()]
        );
        if (!rows[0]) return;
        const referrerId = rows[0].id;
        if (referrerId === referredUserId) return;

        await db.query(
            `INSERT INTO referrals (referrer_id, referred_id, code, status, reward_credits, completed_at)
             VALUES ($1, $2, $3, 'completed', $4, NOW())
             ON CONFLICT DO NOTHING`,
            [referrerId, referredUserId, code.toUpperCase(), REFERRAL_CREDITS]
        );

        // Credit the referrer
        await db.query(
            'UPDATE users SET ai_credits = ai_credits + $1 WHERE id = $2',
            [REFERRAL_CREDITS, referrerId]
        );
    } catch (err) {
        console.error('[Referrals] applyReferralCode error:', err);
    }
}
