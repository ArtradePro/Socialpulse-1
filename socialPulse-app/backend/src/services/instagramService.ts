import axios from 'axios';

const FB_URL = 'https://graph.facebook.com/v19.0';

interface AccountRow {
    access_token:     string;
    platform_user_id: string;
}

export class InstagramService {
    static async publishPost(
        account:   AccountRow,
        content:   string,
        mediaUrls: string[]
    ): Promise<string> {
        const { access_token, platform_user_id: igUserId } = account;

        if (!mediaUrls || mediaUrls.length === 0) {
            throw new Error('Instagram requires at least one image or video');
        }

        if (mediaUrls.length > 1) {
            return InstagramService.publishCarousel(igUserId, access_token, content, mediaUrls);
        }

        const url     = mediaUrls[0];
        const isVideo = isVideoUrl(url);

        const containerParams: Record<string, string> = { caption: content, access_token };
        if (isVideo) {
            containerParams.video_url  = url;
            containerParams.media_type = 'REELS';
        } else {
            containerParams.image_url = url;
        }

        const containerRes = await axios.post(`${FB_URL}/${igUserId}/media`, null, {
            params: containerParams,
        });
        const creationId = containerRes.data.id;
        await waitForContainer(igUserId, creationId, access_token, isVideo ? 12 : 6);

        const publishRes = await axios.post(`${FB_URL}/${igUserId}/media_publish`, null, {
            params: { creation_id: creationId, access_token },
        });
        return publishRes.data.id;
    }

    private static async publishCarousel(
        igUserId:     string,
        access_token: string,
        caption:      string,
        mediaUrls:    string[]
    ): Promise<string> {
        const childIds: string[] = [];
        for (const url of mediaUrls.slice(0, 10)) {
            const isVideo = isVideoUrl(url);
            const params: Record<string, string> = { is_carousel_item: 'true', access_token };
            if (isVideo) {
                params.video_url  = url;
                params.media_type = 'VIDEO';
            } else {
                params.image_url = url;
            }
            const res = await axios.post(`${FB_URL}/${igUserId}/media`, null, { params });
            childIds.push(res.data.id);
        }

        await Promise.all(childIds.map(id =>
            waitForContainer(igUserId, id, access_token)
        ));

        const carouselRes = await axios.post(`${FB_URL}/${igUserId}/media`, null, {
            params: {
                media_type: 'CAROUSEL_ALBUM',
                children:   childIds.join(','),
                caption,
                access_token,
            },
        });
        await waitForContainer(igUserId, carouselRes.data.id, access_token);

        const publishRes = await axios.post(`${FB_URL}/${igUserId}/media_publish`, null, {
            params: { creation_id: carouselRes.data.id, access_token },
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

function isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url);
}

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
        if (res.data.status_code === 'ERROR') {
            throw new Error(`Instagram media container error: ${JSON.stringify(res.data)}`);
        }
        await new Promise(r => setTimeout(r, delayMs));
    }
    throw new Error('Instagram media container timed out');
}

export const instagramService = new InstagramService();
