import axios from 'axios';

const API_URL = 'https://api.linkedin.com/v2';

interface AccountRow {
    access_token:     string;
    platform_user_id: string;
}

export class LinkedInService {
    static async publishPost(
        account:   AccountRow,
        content:   string,
        mediaUrls: string[]
    ): Promise<string> {
        const { access_token, platform_user_id: personId } = account;

        // LinkedIn does not support video via originalUrl — filter to images only
        const images   = (mediaUrls ?? []).filter(u => !isVideoUrl(u));
        const hasMedia = images.length > 0;

        const body: Record<string, unknown> = {
            author:          `urn:li:person:${personId}`,
            lifecycleState:  'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary:    { text: content },
                    shareMediaCategory: hasMedia ? 'IMAGE' : 'NONE',
                    ...(hasMedia && {
                        media: images.slice(0, 9).map(url => ({
                            status:      'READY',
                            originalUrl: url,
                        })),
                    }),
                },
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        };

        const res = await axios.post(`${API_URL}/ugcPosts`, body, {
            headers: {
                Authorization:               `Bearer ${access_token}`,
                'Content-Type':              'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
        });

        return (
            res.headers['x-restli-id'] ??
            res.headers['location'] ??
            (res.data as any)?.id ??
            ''
        ).toString();
    }

    static async getPostStats(account: AccountRow, postUrn: string) {
        const res = await axios.get(
            `${API_URL}/socialMetadata/${encodeURIComponent(postUrn)}`,
            { headers: { Authorization: `Bearer ${account.access_token}` } }
        );
        return res.data;
    }
}

function isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url);
}

export const linkedinService = new LinkedInService();
