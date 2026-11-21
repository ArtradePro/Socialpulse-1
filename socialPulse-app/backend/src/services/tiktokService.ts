import axios from 'axios';

export class TikTokService {
    private static API_BASE = 'https://open.tiktokapis.com/v2';

    /**
     * Publishes a video to TikTok using Content Posting API v2 (FILE_UPLOAD).
     * Uses FILE_UPLOAD so Cloudinary / S3 media URLs do not require TikTok URL-prefix domain verification.
     * Automatically falls back to TikTok Inbox upload (/post/publish/inbox/video/init/) if Direct Post
     * requires private/draft mode or only video.upload scope is active.
     */
    static async publishPost(
        account: any,
        content: string,
        mediaUrls: string[],
    ): Promise<string> {
        const accessToken = account.access_token;
        const videoUrl = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null;

        if (!videoUrl) {
            throw new Error('TikTok requires a video media URL to publish.');
        }

        // 1. Download video bytes from storage URL
        const videoStreamRes = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
        });
        const videoBuffer = Buffer.from(videoStreamRes.data);
        const videoSize = videoBuffer.length;
        const contentType = videoStreamRes.headers['content-type'] || 'video/mp4';

        if (videoSize === 0) {
            throw new Error('Downloaded TikTok video file is empty.');
        }

        const caption = (content || '').slice(0, 2200);

        const sourceInfo = {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
        };

        let publishId = '';
        let uploadUrl = '';

        // 2. Try Direct Post (/post/publish/video/init/) first; fall back to Inbox (/post/publish/inbox/video/init/)
        try {
            const initRes = await axios.post(
                `${this.API_BASE}/post/publish/video/init/`,
                {
                    post_info: {
                        title: caption,
                        privacy_level: process.env.TIKTOK_DEFAULT_PRIVACY || 'PUBLIC_TO_EVERYONE',
                        disable_duet: false,
                        disable_comment: false,
                        disable_stitch: false,
                    },
                    source_info: sourceInfo,
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                },
            );
            publishId = initRes.data?.data?.publish_id;
            uploadUrl = initRes.data?.data?.upload_url;
        } catch (directErr: any) {
            const errCode = directErr?.response?.data?.error?.code || '';
            console.warn(`[TikTok] Direct Post init fell back to Inbox upload (${errCode || directErr.message})`);

            const inboxRes = await axios.post(
                `${this.API_BASE}/post/publish/inbox/video/init/`,
                { source_info: sourceInfo },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                },
            );
            publishId = inboxRes.data?.data?.publish_id;
            uploadUrl = inboxRes.data?.data?.upload_url;
        }

        if (!uploadUrl || !publishId) {
            throw new Error('Failed to initialize TikTok video upload session.');
        }

        // 3. Upload video bytes to TikTok's upload_url
        await axios.put(uploadUrl, videoBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': videoSize.toString(),
                'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 180000,
        });

        return publishId;
    }
}
