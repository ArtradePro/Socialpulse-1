import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import MediaService, { MediaFile } from '../services/media.service';

interface UploadState {
    uploading:  boolean;
    progress:   number;         // 0-100
    uploaded:   MediaFile[];
    error:      string | null;
}

interface UseUploadReturn extends UploadState {
    upload:      (files: File[], folder?: string) => Promise<MediaFile[]>;
    clearUploaded: () => void;
}

export const useUpload = (): UseUploadReturn => {
    const [state, setState] = useState<UploadState>({
        uploading: false,
        progress:  0,
        uploaded:  [],
        error:     null,
    });

    const upload = useCallback(async (files: File[], folder = 'uploads'): Promise<MediaFile[]> => {
        setState(s => ({ ...s, uploading: true, progress: 0, error: null }));
        try {
            const result = await MediaService.upload(files, folder, pct =>
                setState(s => ({ ...s, progress: pct }))
            );
            setState(s => ({ ...s, uploading: false, progress: 100, uploaded: result }));
            toast.success(`${result.length} file${result.length > 1 ? 's' : ''} uploaded!`);
            return result;
        } catch (err: any) {
            const message =
                err.response?.data?.message ??
                err.message ??
                'Upload failed';

            const isQuota = err.response?.data?.code === 'STORAGE_QUOTA_EXCEEDED';
            const isPlan  = err.response?.data?.upgrade;

            setState(s => ({ ...s, uploading: false, error: message }));

            if (isPlan) {
                toast.error(message, { duration: 6000 });
            } else {
                toast.error(message);
            }

            if (isQuota) {
                // Fire a custom event so UpgradeModal can intercept
                window.dispatchEvent(new CustomEvent('plan:upgrade-required', {
                    detail: { reason: 'storage' },
                }));
            }
            return [];
        }
    }, []);

    const clearUploaded = useCallback(() => {
        setState(s => ({ ...s, uploaded: [], progress: 0 }));
    }, []);

    return { ...state, upload, clearUploaded };
};
