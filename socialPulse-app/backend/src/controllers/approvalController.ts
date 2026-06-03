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
        const { status, feedback } = req.body;

        // Validate status strictly — any unexpected value falls through as rejected
        if (status !== 'approved' && status !== 'rejected') {
            res.status(400).json({ message: 'status must be "approved" or "rejected"' });
            return;
        }

        const newPostStatus = status === 'approved' ? 'scheduled' : 'draft';

        // Clear the token after use so it becomes single-use
        const { rowCount } = await db.query(
            `UPDATE posts
             SET status = $1, approved_at = CASE WHEN $2 THEN NOW() ELSE approved_at END,
                 approval_feedback = $3, approval_token = NULL
             WHERE approval_token = $4`,
            [newPostStatus, status === 'approved', feedback || null, token]
        );

        if (!rowCount) {
            res.status(404).json({ message: 'Approval link not found or already used' });
            return;
        }

        res.json({ message: `Post ${status}` });
    } catch (err) {
        res.status(500).json({ message: 'Failed to submit approval' });
    }
};
