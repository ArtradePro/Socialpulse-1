import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import MediaService, { MediaFile } from '../services/media.service';

interface UploadState {
    uploading: boolean;
    progress:  number;         // 0-100
    uploaded:  MediaFile[];
    error:     string | null;
}

interface UseUploadReturn extends UploadState {
    upload:       (files: File | File[], folder?: string) => Promise<MediaFile[]>;
    clearUploaded: () => void;
    reset:         () => void;
}

export const useUpload = (onSuccess?: (file: MediaFile) => void): UseUploadReturn => {
    const [state, setState] = useState<UploadState>({
        uploading: false,
        progress:  0,
        uploaded:  [],
        error:     null,
    });

    const upload = useCallback(async (input: File | File[], folder = 'uploads'): Promise<MediaFile[]> => {
        const files = Array.isArray(input) ? input : [input];
        
        setState(s => ({ ...s, uploading: true, progress: 0, error: null }));
        
        try {
            const result = await MediaService.upload(files, folder, (pct) =>
                setState(s => ({ ...s, progress: pct }))
            );
            
            setState(s => ({ ...s, uploading: false, progress: 100, uploaded: result }));
            
            toast.success(`${result.length} file${result.length > 1 ? 's' : ''} uploaded!`);
            
            // If a callback was provided for single-file scenarios
            if (onSuccess && result.length > 0) {
                onSuccess(result[0]);
            }
            
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
                // Fire custom event for UpgradeModal
                window.dispatchEvent(new CustomEvent('plan:upgrade-required', {
                    detail: { reason: 'storage' },
                }));
            }
            return [];
        }
    }, [onSuccess]);

    const reset = useCallback(() => {
        setState({ uploading: false, progress: 0, uploaded: [], error: null });
    }, []);

    const clearUploaded = useCallback(() => {
        setState(s => ({ ...s, uploaded: [], progress: 0 }));
    }, []);

    return { ...state, upload, clearUploaded, reset };
};