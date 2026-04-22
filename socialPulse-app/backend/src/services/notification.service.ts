// backend/src/services/notification.service.ts
// Creates in-app notifications. Call from anywhere (jobs, controllers, webhooks).

import { db } from '../config/database';

export type NotificationType =
    | 'post_published'
    | 'post_failed'
    | 'ai_credits_low'
    | 'storage_near_limit'
    | 'trial_ending'
    | 'team_invite'
    | 'payment_failed';

export interface CreateNotificationInput {
    userId:   string;
    type:     NotificationType;
    title:    string;
    message?: string;
    link?:    string;
    metadata?: Record<string, unknown>;
}

export const NotificationService = {
    async create(input: CreateNotificationInput): Promise<void> {
        await db.query(
            `INSERT INTO notifications (user_id, type, title, message, link, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                input.userId,
                input.type,
                input.title,
                input.message ?? null,
                input.link    ?? null,
                JSON.stringify(input.metadata ?? {}),
            ]
        );
    },

    async unreadCount(userId: string): Promise<number> {
        const { rows } = await db.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
            [userId]
        );
        return parseInt(rows[0].count);
    },
};
