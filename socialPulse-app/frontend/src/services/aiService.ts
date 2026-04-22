import api from './api';

export const aiService = {
  generateContent: (topic: string, tone?: string, platform?: string, wordCount?: number) =>
    api.post<{ content: string }>('/ai/generate', { topic, tone, platform, wordCount }).then(r => r.data),

  generateHashtags: (content: string, platform?: string) =>
    api.post<{ hashtags: string[] }>('/ai/hashtags', { content, platform }).then(r => r.data),

  improveContent: (content: string, goal?: string) =>
    api.post<{ content: string }>('/ai/improve', { content, goal }).then(r => r.data),

  analyzeSentiment: (content: string) =>
    api.post<{ sentiment: string; score: number; suggestion: string }>('/ai/sentiment', { content }).then(r => r.data),
};
