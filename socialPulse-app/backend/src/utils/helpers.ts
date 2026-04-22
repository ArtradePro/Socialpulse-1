import crypto from 'crypto';

/** Truncate text to a max length, appending ellipsis if needed */
export const truncate = (text: string, maxLen: number): string =>
  text.length <= maxLen ? text : `${text.slice(0, maxLen - 3)}...`;

/** Format a number with K/M suffixes */
export const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

/** Generate a cryptographically secure random token */
export const generateToken = (bytes = 32): string =>
  crypto.randomBytes(bytes).toString('hex');

/** Sleep for ms milliseconds */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/** Parse platform from URL */
export const detectPlatform = (url: string): string | null => {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('facebook.com')) return 'facebook';
  return null;
};

/** Strip HTML tags from a string */
export const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '');

/** Extract hashtags from post content */
export const extractHashtags = (content: string): string[] =>
  (content.match(/#\w+/g) || []).map(h => h.slice(1).toLowerCase());

/** Calculate engagement rate */
export const engagementRate = (engagements: number, impressions: number): number =>
  impressions > 0 ? parseFloat(((engagements / impressions) * 100).toFixed(2)) : 0;
