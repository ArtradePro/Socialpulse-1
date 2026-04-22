import api from './api';

export interface SocialAccount {
  id: string;
  platform: string;
  platform_username: string;
  display_name: string;
  avatar_url?: string;
  is_active: boolean;
}

export interface Schedule {
  id: string;
  post_id: string;
  platform: string;
  scheduled_at: string;
  status: 'pending' | 'processing' | 'published' | 'failed';
  content?: string;
}

export const socialService = {
  getAccounts: () =>
    api.get<SocialAccount[]>('/social/accounts').then(r => r.data),

  disconnect: (platform: string) =>
    api.delete(`/social/accounts/${platform}`),

  getSchedules: () =>
    api.get<Schedule[]>('/social/schedules').then(r => r.data),

  schedulePost: (postId: string, platform: string, scheduledAt: string) =>
    api.post<Schedule>('/social/schedules', { postId, platform, scheduledAt }).then(r => r.data),

  cancelSchedule: (id: string) =>
    api.delete(`/social/schedules/${id}`),
};
