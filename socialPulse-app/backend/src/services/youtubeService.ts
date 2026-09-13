import axios from 'axios';

export class YouTubeService {
    private static API_BASE = 'https://www.googleapis.com/youtube/v3';

    /**
     * Publishes a video / YouTube Short.
     * YouTube Data API v3 requires a video media URL.
     */
    static async publishPost(
        account: any,
        content: string,
        mediaUrls: string[],
        title?: string
    ): Promise<string> {
        const accessToken = account.access_token;
        const videoUrl = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null;

        if (!videoUrl) {
            throw new Error('YouTube requires a video media URL to publish.');
        }

        const videoTitle = title || content.slice(0, 95).split('\n')[0] || 'SocialPulse Video';
        const videoDescription = content;

        // 1. Download/Fetch the video buffer
        const videoStreamRes = await axios.get(videoUrl, { responseType: 'arraybuffer' });
        const videoBuffer = Buffer.from(videoStreamRes.data);
        const contentType = videoStreamRes.headers['content-type'] || 'video/mp4';

        // 2. Initiate Resumable Upload Session
        const initRes = await axios.post(
            'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
            {
                snippet: {
                    title: videoTitle,
                    description: videoDescription,
                    categoryId: '22', // People & Blogs
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Upload-Content-Type': contentType,
                    'X-Upload-Content-Length': videoBuffer.length.toString(),
                },
            }
        );

        const uploadUrl = initRes.headers.location;
        if (!uploadUrl) {
            throw new Error('Failed to initiate YouTube resumable video upload session.');
        }

        // 3. Upload the Video Content
        const uploadRes = await axios.put(uploadUrl, videoBuffer, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
                'Content-Length': videoBuffer.length.toString(),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        return uploadRes.data.id;
    }

    /**
     * Fetch video statistics (views, likes, comments)
     */
    static async getAnalytics(account: any, videoId: string) {
        try {
            const res = await axios.get(`${this.API_BASE}/videos`, {
                headers: { Authorization: `Bearer ${account.access_token}` },
                params: {
                    part: 'statistics',
                    id: videoId,
                },
            });
            const stats = res.data?.items?.[0]?.statistics;
            return stats ? {
                views: parseInt(stats.viewCount || '0'),
                likes: parseInt(stats.likeCount || '0'),
                comments: parseInt(stats.commentCount || '0'),
            } : null;
        } catch (err: any) {
            console.warn('[YouTube] Analytics fetch warning:', err?.response?.data || err.message);
            return null;
        }
    }
}
