import axios from 'axios';

const GRAPH_URL = 'https://graph.instagram.com';
const FB_URL    = 'https://graph.facebook.com/v19.0';

/** account row from social_accounts table */
interface AccountRow {
    access_token:     string;
    platform_user_id: string; // Instagram Business Account ID
}

export class InstagramService {
    static async publishPost(
        account:    AccountRow,
        content:    string,
        mediaUrls:  string[]
    ): Promise<string> {
        const { access_token, platform_user_id: igUserId } = account;
        const imageUrl = mediaUrls?.[0];

        if (!imageUrl) {
            // Text-only post via reels/caption — use FB Graph text post fallback
            throw new Error('Instagram requires at least one image or video URL');
        }

        // Step 1: Create media container
        const containerRes = await axios.post(`${FB_URL}/${igUserId}/media`, null, {
            params: {
                image_url:    imageUrl,
                caption:      content,
                access_token,
            },
        });
        const creationId = containerRes.data.id;

        // Step 2: Wait for container to be ready (poll up to 10s)
        await waitForContainer(igUserId, creationId, access_token);

        // Step 3: Publish
        const publishRes = await axios.post(`${FB_URL}/${igUserId}/media_publish`, null, {
            params: { creation_id: creationId, access_token },
        });
        return publishRes.data.id;
    }

    static async getInsights(account: AccountRow, mediaId: string) {
        const res = await axios.get(`${FB_URL}/${mediaId}/insights`, {
            params: {
                metric:       'impressions,reach,engagement,saved',
                access_token: account.access_token,
            },
        });
        return res.data;
    }
}

// Wait up to 30s for the media container status to become FINISHED
async function waitForContainer(
    igUserId:   string,
    creationId: string,
    token:      string,
    attempts  = 6,
    delayMs   = 5000
): Promise<void> {
    for (let i = 0; i < attempts; i++) {
        const res = await axios.get(`${FB_URL}/${creationId}`, {
            params: { fields: 'status_code', access_token: token },
        });
        if (res.data.status_code === 'FINISHED') return;
        if (res.data.status_code === 'ERROR') throw new Error('Instagram media container failed');
        await new Promise(r => setTimeout(r, delayMs));
    }
    throw new Error('Instagram media container timed out');
}

export const instagramService = new InstagramService();
