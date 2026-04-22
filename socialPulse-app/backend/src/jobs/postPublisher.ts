import Bull from 'bull';
import { db } from '../config/database';
import { TwitterService } from '../services/twitterService';
import { InstagramService } from '../services/instagramService';
import { LinkedInService } from '../services/linkedinService';
import { FacebookService } from '../services/facebookService';
import { EmailService } from '../services/email.service';
import { triggerUserSync } from './analyticsSync';

const postQueue = new Bull('post-publishing', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
    },
});

export const initScheduler = () => {
    postQueue.process('publish-post', async (job) => {
        const { postId } = job.data;

        try {
            const post = await db.query(
                `SELECT p.*, u.id as user_id
                 FROM posts p
                 JOIN users u ON p.user_id = u.id
                 WHERE p.id = $1`,
                [postId]
            );

            if (!post.rows[0]) throw new Error('Post not found');
            const postData = post.rows[0];

            const results: Record<string, { success: boolean; platformPostId?: string; error?: string }> = {};

            for (const platform of postData.platforms) {
                try {
                    const account = await db.query(
                        `SELECT * FROM social_accounts
                         WHERE user_id = $1 AND platform = $2 AND is_active = true`,
                        [postData.user_id, platform]
                    );

                    if (!account.rows[0]) {
                        results[platform] = { success: false, error: 'Account not connected' };
                        continue;
                    }

                    let platformPostId: string | undefined;

                    switch (platform) {
                        case 'twitter':
                            platformPostId = await TwitterService.publishPost(
                                account.rows[0],
                                postData.content,
                                postData.media_urls
                            );
                            break;
                        case 'instagram':
                            platformPostId = await InstagramService.publishPost(
                                account.rows[0],
                                postData.content,
                                postData.media_urls
                            );
                            break;
                        case 'linkedin':
                            platformPostId = await LinkedInService.publishPost(
                                account.rows[0],
                                postData.content,
                                postData.media_urls
                            );
                            break;
                        case 'facebook':
                            platformPostId = await FacebookService.publishPost(
                                account.rows[0],
                                postData.content,
                                postData.media_urls
                            );
                            break;
                    }

                    results[platform] = { success: true, platformPostId };

                    await db.query(
                        `INSERT INTO post_analytics (post_id, platform, platform_post_id)
                         VALUES ($1, $2, $3)`,
                        [postId, platform, platformPostId]
                    );

                } catch (platformError: any) {
                    results[platform] = { success: false, error: platformError.message };
                }
            }

            const allSuccess = Object.values(results).every(r => r.success);
            const anySuccess = Object.values(results).some(r => r.success);

            await db.query(
                `UPDATE posts
                 SET status = $1, published_at = NOW(), updated_at = NOW()
                 WHERE id = $2`,
                [allSuccess ? 'published' : anySuccess ? 'partial' : 'failed', postId]
            );

            // Notify author about any failures
            const failures = Object.entries(results)
                .filter(([, r]) => !r.success)
                .map(([platform, r]) => ({ platform, error: r.error ?? 'Unknown error' }));

            if (failures.length > 0) {
                try {
                    const authorRow = await db.query(
                        'SELECT email FROM users WHERE id = $1', [postData.user_id]
                    );
                    if (authorRow.rows[0]) {
                        EmailService.sendPostFailed(authorRow.rows[0].email, postId, failures)
                            .catch(console.error);
                    }
                } catch { /* non-critical */ }
            }

            // Queue analytics sync ~30 min after publish so metrics are populated
            if (anySuccess) {
                triggerUserSync(postData.user_id).catch(console.error);
            }

            return results;
        } catch (error: any) {
            await db.query(
                "UPDATE posts SET status = 'failed', updated_at = NOW() WHERE id = $1",
                [postId]
            );
            throw error;
        }
    });

    setInterval(async () => {
        try {
            const duePosts = await db.query(
                `SELECT id FROM posts
                 WHERE status = 'scheduled'
                 AND scheduled_at <= NOW()
                 AND scheduled_at > NOW() - INTERVAL '5 minutes'`
            );

            for (const post of duePosts.rows) {
                await postQueue.add('publish-post', { postId: post.id }, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                });
            }
        } catch (err) {
            console.error('[Scheduler] Polling error:', err);
        }
    }, 60000);

    console.log('Post scheduler initialized');
};

export const schedulePost = async (postId: string, scheduledAt: Date): Promise<void> => {
    const delay = scheduledAt.getTime() - Date.now();

    await postQueue.add('publish-post', { postId }, {
        delay: delay > 0 ? delay : 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    });
};