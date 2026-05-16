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
    ): Promise<any> {
        const client = new TwitterApi(accessToken);
        const results = await client.v2.search(query, {
            max_results:    Math.min(maxResults, 100) as any,
            'tweet.fields': ['created_at', 'public_metrics', 'author_id'] as any,
            expansions:     ['author_id'] as any,
            'user.fields':  ['name', 'username', 'profile_image_url'] as any,
        });

        const tweets = results.data.data ?? [];
        const users  = results.data.includes?.users ?? [];

        // Map users for quick lookup
        const userMap = new Map(users.map((u: any) => [u.id, u]));

        return tweets.map((t: any) => {
            const user = userMap.get(t.author_id);
            return {
                ...t,
                author_name:   user?.name,
                author_handle: user?.username,
                author_avatar: user?.profile_image_url,
            };
        });
    }

    static async getMentions(
        accessToken: string,
        userId: string,
        sinceId?: string
    ): Promise<any> {
        const client = new TwitterApi(accessToken);
        const params: any = {
            max_results:    20,
            'tweet.fields': ['created_at', 'author_id'] as any,
            expansions:     ['author_id'] as any,
            'user.fields':  ['name', 'username', 'profile_image_url'] as any,
        };
        if (sinceId) params.since_id = sinceId;

        const results = await client.v2.userMentionTimeline(userId, params);
        
        const tweets = results.data.data ?? [];
        const users  = results.data.includes?.users ?? [];
        const userMap = new Map(users.map((u: any) => [u.id, u]));

        return tweets.map((t: any) => {
            const user = userMap.get(t.author_id);
            return {
                ...t,
                author_name:   user?.name,
                author_handle: user?.username,
                author_avatar: user?.profile_image_url,
            };
        });
    }
}
