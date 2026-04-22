import axios from 'axios';

const API_URL = 'https://api.linkedin.com/v2';

/** account row from social_accounts table */
interface AccountRow {
    access_token:     string;
    platform_user_id: string; // LinkedIn person sub (from OpenID)
}

export class LinkedInService {
    static async publishPost(
        account:   AccountRow,
        content:   string,
        mediaUrls: string[]
    ): Promise<string> {
        const { access_token, platform_user_id: personId } = account;
        const imageUrl = mediaUrls?.[0];

        const body: Record<string, unknown> = {
            author:           `urn:li:person:${personId}`,
            lifecycleState:   'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary:    { text: content },
                    shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
                    ...(imageUrl && {
                        media: [{ status: 'READY', originalUrl: imageUrl }],
                    }),
                },
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        };

        const res = await axios.post(`${API_URL}/ugcPosts`, body, {
            headers: {
                Authorization:                `Bearer ${access_token}`,
                'Content-Type':               'application/json',
                'X-Restli-Protocol-Version':  '2.0.0',
            },
        });

        // LinkedIn returns the post URN in the Location header
        const location = res.headers['x-restli-id'] ?? res.headers['location'] ?? '';
        return location.toString();
    }

    static async getPostStats(account: AccountRow, postUrn: string) {
        const res = await axios.get(
            `${API_URL}/socialMetadata/${encodeURIComponent(postUrn)}`,
            { headers: { Authorization: `Bearer ${account.access_token}` } }
        );
        return res.data;
    }
}

export const linkedinService = new LinkedInService();
