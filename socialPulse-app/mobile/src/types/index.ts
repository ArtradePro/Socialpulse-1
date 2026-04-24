export type Plan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface User {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    plan: Plan;
    aiCredits: number;
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'partial' | 'failed';
export type Platform = 'twitter' | 'instagram' | 'linkedin' | 'facebook';

export interface Post {
    id: string;
    content: string;
    mediaUrls: string[];
    hashtags: string[];
    platforms: Platform[];
    status: PostStatus;
    scheduledAt: string | null;
    publishedAt: string | null;
    aiGenerated: boolean;
    createdAt: string;
}

export interface SocialAccount {
    id: string;
    platform: Platform;
    username: string;
    profileImage: string | null;
    isActive: boolean;
}

export interface AnalyticsSummary {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalImpressions: number;
    engagementRate: number;
    platformBreakdown: {
        platform: Platform;
        posts: number;
        likes: number;
        impressions: number;
    }[];
    recentPosts: Post[];
}
