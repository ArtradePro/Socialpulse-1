import Bull from 'bull';
import { redis } from '../config/redis';
import { openai, AI_MODEL } from '../config/openai';

const redisOptions = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
};

export const aiQueue = new Bull('ai-jobs', redisOptions);
export const notificationQueue = new Bull('notification-jobs', redisOptions);
export const emailQueue = new Bull('email-jobs', redisOptions);

// AI job processor
aiQueue.process('moderate-post', async (job) => {
  const { postId, content } = job.data;
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a content moderation assistant. Flag content that violates community guidelines.',
      },
      { role: 'user', content },
    ],
    max_tokens: 100,
  });
  const result = response.choices[0]?.message?.content;
  await redis.setex(`moderation:${postId}`, 3600, result || '');
  return result;
});

aiQueue.process('generate-caption', async (job) => {
  const { imageDescription } = job.data;
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Generate an engaging social media caption for the provided image description.',
      },
      { role: 'user', content: imageDescription },
    ],
    max_tokens: 150,
  });
  return response.choices[0]?.message?.content;
});

export const addAIJob = (type: string, data: Record<string, unknown>) =>
  aiQueue.add(type, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });

export const addNotificationJob = (data: Record<string, unknown>) =>
  notificationQueue.add(data, { attempts: 3 });
