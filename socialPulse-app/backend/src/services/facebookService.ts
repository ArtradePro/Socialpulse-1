import axios from 'axios';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

interface AccountRow {
    access_token:     string;
    platform_user_id: string;
}

export class FacebookService {
    static async publishPost(
        account:   AccountRow,
        content:   string,
        mediaUrls: string[]
    ): Promise<string> {
        const { access_token, platform_user_id: pageId } = account;
        const urls = mediaUrls ?? [];

        // Video takes priority over images
        const videoUrl = urls.find(u => isVideoUrl(u));
        if (videoUrl) {
            return FacebookService.publishVideo(pageId, access_token, content, videoUrl);
        }

        // Multiple images — upload each unpublished then attach to a single feed post
        if (urls.length > 1) {
            return FacebookService.publishMultiImage(pageId, access_token, content, urls);
        }

        // Single image
        if (urls.length === 1) {
            const res = await axios.post(`${GRAPH_URL}/${pageId}/photos`, {
                url:         urls[0],
                caption:     content,
                access_token,
            });
            return (res.data.post_id ?? res.data.id ?? '') as string;
        }

        // Text-only
        const res = await axios.post(`${GRAPH_URL}/${pageId}/feed`, {
            message: content,
            access_token,
        });
        return (res.data.id ?? '') as string;
    }

    private static async publishVideo(
        pageId:       string,
        access_token: string,
        description:  string,
        videoUrl:     string
    ): Promise<string> {
        const res = await axios.post(`${GRAPH_URL}/${pageId}/videos`, {
            file_url:    videoUrl,
            description,
            access_token,
        });
        return (res.data.id ?? '') as string;
    }

    private static async publishMultiImage(
        pageId:       string,
        access_token: string,
        message:      string,
        imageUrls:    string[]
    ): Promise<string> {
        // Step 1: Upload each image as a staged (unpublished) photo
        const photoIds = await Promise.all(
            imageUrls.slice(0, 10).map(async (url) => {
                const res = await axios.post(`${GRAPH_URL}/${pageId}/photos`, {
                    url,
                    published:   false,
                    access_token,
                });
                return res.data.id as string;
            })
        );

        // Step 2: Create feed post with all photos attached
        const res = await axios.post(`${GRAPH_URL}/${pageId}/feed`, {
            message,
            attached_media: photoIds.map(id => ({ media_fbid: id })),
            access_token,
        });
        return (res.data.id ?? '') as string;
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

function isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url);
}

export const facebookService = new FacebookService();
