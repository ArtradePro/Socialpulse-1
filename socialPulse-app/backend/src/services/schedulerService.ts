import Bull from 'bull';
import { ScheduleModel } from '../models/Schedule';
import { SocialAccountModel } from '../models/SocialAccount';
import { PostModel } from '../models/Post';
import { TwitterService } from './twitterService';
import { InstagramService } from './instagramService';
import { LinkedInService } from './linkedinService';
import { FacebookService } from './facebookService';

const redisOpts = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
};

export const schedulerQueue = new Bull('scheduler', redisOpts);

schedulerQueue.process('publish', async (job) => {
  const { scheduleId } = job.data;

  const schedule = await ScheduleModel.findById(scheduleId);
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  await ScheduleModel.updateStatus(scheduleId, 'processing');

  const post = await PostModel.findById(schedule.post_id);
  if (!post) throw new Error(`Post ${schedule.post_id} not found`);

  const account = await SocialAccountModel.findByUserAndPlatform(schedule.user_id, schedule.platform);
  if (!account) throw new Error(`No ${schedule.platform} account for user ${schedule.user_id}`);

  try {
    switch (schedule.platform) {
      case 'twitter':
        await TwitterService.publishPost(account, post.content, post.media_urls ?? []);
        break;
      case 'instagram':
        if (!post.media_urls?.[0]) throw new Error('Instagram requires an image');
        await InstagramService.publishPost(account, post.content, post.media_urls);
        break;
      case 'linkedin':
        await LinkedInService.publishPost(account, post.content, post.media_urls ?? []);
        break;
      case 'facebook':
        await FacebookService.publishPost(account, post.content, post.media_urls ?? []);
        break;
    }
    await ScheduleModel.updateStatus(scheduleId, 'published');
    await PostModel.update(post.id, post.user_id, { status: 'published' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ScheduleModel.updateStatus(scheduleId, 'failed', msg);
    throw err;
  }
});

export const enqueueScheduledPost = (scheduleId: string, runAt: Date) =>
  schedulerQueue.add('publish', { scheduleId }, {
    delay: Math.max(0, runAt.getTime() - Date.now()),
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
