// client/src/services/media.service.ts
import api from './api';

export interface MediaFile {
    id:            string;
    originalName:  string;
    fileName:      string;
    mimeType:      string;
    sizeBytes:     number;
    width:         number | null;
    height:        number | null;
    durationSecs:  number | null;
    url:           string;
    thumbnailUrl:  string | null;
    folder:        string;
    tags:          string[];
    createdAt:     string;
}

export interface MediaListResponse {
    files:      MediaFile[];
    total:      number;
    page:       number;
    totalPages: number;
}

export interface StorageUsage {
    totalBytes:  number;
    imageBytes:  number;
    videoBytes:  number;
    totalFiles:  number;
    imageCount:  number;
    videoCount:  number;
    limitBytes:  number | null;
    usedPercent: number;
}

export type MediaSortOption = 'newest' | 'oldest' | 'name' | 'size';
export type MediaTypeFilter = 'all'    | 'image'  | 'video';

export interface MediaListParams {
    page?:   number;
    limit?:  number;
    sort?:   MediaSortOption;
    type?:   MediaTypeFilter;
    search?: string;
    folder?: string;
}

const MediaService = {
    /**
     * Map snake_case DB row to camelCase frontend interface
     */
    mapFile(f: any): MediaFile {
        if (!f) return {} as MediaFile;
        return {
            id:            f.id || '',
            originalName:  f.original_name ?? f.originalName ?? 'Untitled',
            fileName:      f.file_name     ?? f.fileName     ?? '',
            mimeType:      f.mime_type     ?? f.mimeType     ?? 'application/octet-stream',
            sizeBytes:     parseInt(String(f.size_bytes ?? f.sizeBytes ?? '0')),
            width:         f.width  ?? null,
            height:        f.height ?? null,
            durationSecs:  f.duration_secs ?? f.durationSecs ?? null,
            url:           f.url || '',
            thumbnailUrl:  f.thumbnail_url ?? f.thumbnailUrl ?? null,
            folder:        f.folder || 'uploads',
            tags:          Array.isArray(f.tags) ? f.tags : [],
            createdAt:     f.created_at   ?? f.createdAt ?? new Date().toISOString(),
        };
    },

    // Upload one or more files
    async upload(
        files:    File[],
        folder    = 'uploads',
        onProgress?: (pct: number) => void
    ): Promise<MediaFile[]> {
        const form = new FormData();
        files.forEach(f => form.append('files', f));
        form.append('folder', folder);

        const { data } = await api.post<{ files: any[] }>('/media', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: e => {
                if (onProgress && e.total) {
                    onProgress(Math.round(e.loaded / e.total * 100));
                }
            },
        });
        const uploaded = Array.isArray(data?.files) ? data.files : [];
        return uploaded.map(f => this.mapFile(f));
    },

    async list(params: MediaListParams = {}): Promise<MediaListResponse> {
        const { data } = await api.get<any>('/media', { params });
        const files = Array.isArray(data?.files) ? data.files : [];
        return {
            files:      files.map((f: any) => this.mapFile(f)),
            total:      data?.total || 0,
            page:       data?.page || 1,
            totalPages: data?.totalPages || 1,
        };
    },

    async getStorageUsage(): Promise<StorageUsage> {
        const { data } = await api.get<any>('/media/usage');
        return {
            totalBytes:  parseInt(String(data?.totalBytes ?? data?.total_bytes ?? '0')),
            imageBytes:  parseInt(String(data?.imageBytes ?? data?.image_bytes ?? '0')),
            videoBytes:  parseInt(String(data?.videoBytes ?? data?.video_bytes ?? '0')),
            totalFiles:  parseInt(String(data?.totalFiles ?? data?.total_files ?? '0')),
            imageCount:  parseInt(String(data?.imageCount ?? data?.image_count ?? '0')),
            videoCount:  parseInt(String(data?.videoCount ?? data?.video_count ?? '0')),
            limitBytes:  data?.limitBytes ?? data?.limit_bytes ?? null,
            usedPercent: data?.usedPercent ?? data?.used_percent ?? 0,
        };
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/media/${id}`);
    },

    async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
        const { data } = await api.delete('/media/bulk', { data: { ids } });
        return data;
    },

    async update(id: string, payload: { tags?: string[]; folder?: string }): Promise<MediaFile> {
        const { data } = await api.patch<{ file: any }>(`/media/${id}`, payload);
        return this.mapFile(data.file);
    },

    // Helpers
    isImage: (f: any) => {
        if (!f) return false;
        const mt = f.mimeType || f.mime_type || f.type || '';
        return typeof mt === 'string' && mt.startsWith('image/');
    },
    isVideo: (f: any) => {
        if (!f) return false;
        const mt = f.mimeType || f.mime_type || f.type || '';
        return typeof mt === 'string' && mt.startsWith('video/');
    },

    formatSize(bytes: number): string {
        if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
        if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`;
        if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(1)} KB`;
        return `${bytes} B`;
    },
};

export default MediaService;
