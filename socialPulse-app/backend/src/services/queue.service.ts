import Bull from 'bull';
import { redis } from '../config/redis';
import { GoogleGenAI } from '@google/genai';

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

const getGemini = () => {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

// AI job processor
aiQueue.process('moderate-post', async (job) => {
  const { postId, content } = job.data;
  const response = await getGemini().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { role: 'user', parts: [{ text: content }] }
    ],
    config: {
        systemInstruction: 'You are a content moderation assistant. Flag content that violates community guidelines. Respond with your moderation decision.',
    }
  });
  const result = response.text;
  await redis.setex(`moderation:${postId}`, 3600, result || '');
  return result;
});

aiQueue.process('generate-caption', async (job) => {
  const { imageDescription } = job.data;
  const response = await getGemini().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { role: 'user', parts: [{ text: imageDescription }] }
    ],
    config: {
        systemInstruction: 'Generate an engaging social media caption for the provided image description.',
    }
  });
  return response.text;
});

export const addAIJob = (type: string, data: Record<string, unknown>) =>
  aiQueue.add(type, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });

export const addNotificationJob = (data: Record<string, unknown>) =>
  notificationQueue.add(data, { attempts: 3 });
