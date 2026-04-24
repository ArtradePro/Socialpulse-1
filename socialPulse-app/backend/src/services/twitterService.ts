import { TwitterApi } from 'twitter-api-v2';

export class TwitterService {
    static async publishPost(
        account: any,
        content: string,
        mediaUrls: string[]
    ): Promise<string> {
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY!,
            appSecret: process.env.TWITTER_API_SECRET!,
            accessToken: account.access_token,
            accessSecret: account.access_secret,
        });

        let mediaIds: string[] = [];

        if (mediaUrls.length > 0) {
            for (const url of mediaUrls.slice(0, 4)) {
                const mediaId = await client.v1.uploadMedia(url);
                mediaIds.push(mediaId);
            }
        }

        const tweet = await client.v2.tweet({
            text: content,
            ...(mediaIds.length > 0 && { media: { media_ids: mediaIds as any } }),
        });

        return tweet.data.id;
    }

    static async getAnalytics(account: any, tweetId: string) {
        const client = new TwitterApi(account.access_token);
        const tweet = await client.v2.singleTweet(tweetId, {
            'tweet.fields': ['public_metrics'],
        });

        return tweet.data.public_metrics;
    }

    static async searchRecent(
        accessToken: string,
        query: string,
        maxResults = 20
    ): Promise<{
        id: string;
        text: string;
        author_id: string;
        public_metrics: { like_count: number; retweet_count: number };
        created_at: string;
    }[]> {
        const client = new TwitterApi(accessToken);
        const results = await client.v2.search(query, {
            max_results:   Math.min(maxResults, 100) as any,
            'tweet.fields': ['created_at', 'public_metrics', 'author_id'] as any,
        });
        return (results.data.data ?? []) as any;
    }

    static async getMentions(
        accessToken: string,
        userId: string,
        sinceId?: string
    ): Promise<{
        id: string;
        text: string;
        author_id: string;
        created_at: string;
    }[]> {
        const client = new TwitterApi(accessToken);
        const params: Record<string, unknown> = {
            max_results:    20,
            'tweet.fields': 'created_at,author_id',
        };
        if (sinceId) params.since_id = sinceId;

        const results = await client.v2.userMentionTimeline(userId, params as any);
        return (results.data.data ?? []) as any;
    }
}
