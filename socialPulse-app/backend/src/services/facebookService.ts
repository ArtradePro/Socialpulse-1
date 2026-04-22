import axios from 'axios';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

/** account row from social_accounts table */
interface AccountRow {
    access_token:     string;
    platform_user_id: string; // Facebook Page ID
}

export class FacebookService {
    static async publishPost(
        account:   AccountRow,
        content:   string,
        mediaUrls: string[]
    ): Promise<string> {
        const { access_token, platform_user_id: pageId } = account;
        const imageUrl = mediaUrls?.[0];

        const endpoint = imageUrl
            ? `${GRAPH_URL}/${pageId}/photos`
            : `${GRAPH_URL}/${pageId}/feed`;

        const body = imageUrl
            ? { url: imageUrl, caption: content, access_token }
            : { message: content, access_token };

        const res = await axios.post(endpoint, body);
        return res.data.id ?? res.data.post_id ?? '';
    }

    static async getPostInsights(account: AccountRow, postId: string) {
        const res = await axios.get(`${GRAPH_URL}/${postId}/insights`, {
            params: {
                metric:       'post_impressions,post_engagements,post_clicks',
                access_token: account.access_token,
            },
        });
        return res.data;
    }
}

export const facebookService = new FacebookService();
