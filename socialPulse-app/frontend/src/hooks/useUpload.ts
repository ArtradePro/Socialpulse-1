import { useState, useCallback } from 'react';
import mediaService, { MediaFile } from '../services/media.service';

export interface UseUploadReturn {
    uploading: boolean;
    progress: number;
    error: string | null;
    uploaded: MediaFile[];
    upload: (input: File | File[], folder?: string) => Promise<MediaFile[]>;
    clearUploaded: () => void;
    reset: () => void;
}

export const useUpload = (): UseUploadReturn => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [uploaded, setUploaded] = useState<MediaFile[]>([]);

    const clearUploaded = useCallback(() => setUploaded([]), []);

    const reset = useCallback(() => {
        setUploading(false);
        setProgress(0);
        setError(null);
        setUploaded([]);
    }, []);

    const upload = async (input: File | File[], folder: string = 'general'): Promise<MediaFile[]> => {
        setUploading(true);
        setError(null);
        setProgress(10);

        const files = Array.isArray(input) ? input : [input];
        const results: MediaFile[] = [];

        try {
            for (const file of files) {
                // FIX: Wrapped 'file' in brackets [file] to satisfy the File[] requirement of the service
                const response = await mediaService.upload([file], folder);
                
                // If the service returns an array (e.g. from [file]), take the first element
                const fileData = Array.isArray(response) ? response[0] : response;
                
                // Push the single MediaFile object into our local results array
                results.push(fileData as MediaFile);
                
                setProgress((prev) => Math.min(prev + (90 / files.length), 95));
            }
            
            setUploaded((prev) => [...prev, ...results]);
            setProgress(100);
            return results;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Upload failed';
            setError(msg);
            throw new Error(msg);
        } finally {
            setUploading(false);
        }
    };

    return { 
        uploading, 
        progress, 
        error, 
        uploaded, 
        upload, 
        clearUploaded, 
        reset 
    };
};