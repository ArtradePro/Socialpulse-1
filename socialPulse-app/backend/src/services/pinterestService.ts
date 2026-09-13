import axios from 'axios';

export class PinterestService {
    private static API_BASE = 'https://api.pinterest.com/v5';

    /**
     * Publishes a Pin to Pinterest.
     * Pinterest v5 API requires an image URL and a board_id.
     * Automatically retrieves an existing board or creates a default one.
     */
    static async publishPost(
        account: any,
        content: string,
        mediaUrls: string[],
        link?: string,
        title?: string
    ): Promise<string> {
        const accessToken = account.access_token;
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        // Pinterest requires an image for a pin
        const imageUrl = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null;
        if (!imageUrl) {
            throw new Error('Pinterest requires at least one image URL to create a Pin.');
        }

        // 1. Get or create a board for the user
        const boardId = await this.getOrCreateBoard(headers);

        // 2. Derive title and description from content
        const pinTitle = title || content.slice(0, 100).split('\n')[0] || 'Higiene Update';
        const pinDescription = content;
        const pinLink = link || 'https://fungusnomore.com';

        // 3. Create the pin via Pinterest API v5
        const pinRes = await axios.post(
            `${this.API_BASE}/pins`,
            {
                board_id: boardId,
                title: pinTitle,
                description: pinDescription,
                link: pinLink,
                media_source: {
                    source_type: 'image_url',
                    url: imageUrl,
                },
            },
            { headers }
        );

        return pinRes.data.id;
    }

    /**
     * Helper to find an existing board or create a default "Higiene Pins" board
     */
    private static async getOrCreateBoard(headers: any): Promise<string> {
        try {
            const boardsRes = await axios.get(`${this.API_BASE}/boards`, {
                headers,
                params: { page_size: 10 },
            });

            const items = boardsRes.data?.items || [];
            if (items.length > 0) {
                return items[0].id;
            }

            // If no boards exist, create a default board
            const createBoardRes = await axios.post(
                `${this.API_BASE}/boards`,
                {
                    name: 'Higiene Pins',
                    description: 'Published via SocialPulse',
                    privacy: 'PUBLIC',
                },
                { headers }
            );

            return createBoardRes.data.id;
        } catch (err: any) {
            console.error('[Pinterest] Error getting/creating board:', err?.response?.data || err.message);
            throw new Error(`Failed to locate or create Pinterest board: ${JSON.stringify(err?.response?.data || err.message)}`);
        }
    }

    /**
     * Fetch pin analytics
     */
    static async getAnalytics(account: any, pinId: string) {
        try {
            const headers = { Authorization: `Bearer ${account.access_token}` };
            const res = await axios.get(`${this.API_BASE}/pins/${pinId}/analytics`, {
                headers,
                params: {
                    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    end_date: new Date().toISOString().slice(0, 10),
                    metric_types: 'IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE',
                },
            });
            return res.data;
        } catch (err: any) {
            console.warn('[Pinterest] Analytics fetch warning:', err?.response?.data || err.message);
            return null;
        }
    }
}
