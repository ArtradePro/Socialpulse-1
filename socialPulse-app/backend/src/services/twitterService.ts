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
}
