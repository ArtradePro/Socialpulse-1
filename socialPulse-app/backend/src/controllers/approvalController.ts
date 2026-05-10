import { Request, Response } from 'express';
import { db } from '../config/database';
import crypto from 'crypto';

export const createApprovalLink = async (req: any, res: Response): Promise<void> => {
    try {
        const { postId } = req.body;
        const token = crypto.randomBytes(32).toString('hex');
        
        await db.query(
            'UPDATE posts SET approval_token = $1 WHERE id = $2 AND user_id = $3',
            [token, postId, req.user.userId]
        );
        
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create approval link' });
    }
};

export const getPublicPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.params;
        const { rows } = await db.query(
            `SELECT p.*, u.full_name as owner_name, w.name as workspace_name, w.logo_url as workspace_logo
             FROM posts p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN workspaces w ON w.id = p.workspace_id
             WHERE p.approval_token = $1`,
            [token]
        );
        
        if (!rows[0]) { res.status(404).json({ message: 'Post not found or link expired' }); return; }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const submitApproval = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.params;
        const { status, feedback } = req.body; // 'approved' | 'rejected'
        
        if (status === 'approved') {
            await db.query(
                `UPDATE posts SET status = 'scheduled', approved_at = NOW(), approval_feedback = $1 WHERE approval_token = $2`,
                [feedback || null, token]
            );
        } else {
            await db.query(
                `UPDATE posts SET status = 'draft', approval_feedback = $1 WHERE approval_token = $2`,
                [feedback || null, token]
            );
        }
        
        res.json({ message: `Post ${status}` });
    } catch (err) {
        res.status(500).json({ message: 'Failed to submit approval' });
    }
};
