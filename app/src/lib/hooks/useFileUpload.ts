/**
 * useFileUpload Hook
 * Handle file upload with progress tracking
 */

'use client';

import { useState, useCallback } from 'react';
import { uploadFile as apiUploadFile } from '@/lib/api/files';
import { validateFile } from '@/lib/utils/file-helpers';
import type { UploadOptions, UploadResponse } from '@/lib/types/files';

interface UseFileUploadReturn {
  uploadFile: (file: File, options: Omit<UploadOptions, 'onProgress'>) => Promise<UploadResponse | null>;
  uploadProgress: number;
  isUploading: boolean;
  error: string | null;
  resetError: () => void;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File, options: Omit<UploadOptions, 'onProgress'>): Promise<UploadResponse | null> => {
      try {
        setError(null);
        setUploadProgress(0);

        // Validate file client-side
        const validation = validateFile(file, options.category);
        if (!validation.valid) {
          setError(validation.error || 'Invalid file');
          return null;
        }

        setIsUploading(true);

        // Upload file with progress tracking
        const response = await apiUploadFile(file, {
          ...options,
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
        });

        setUploadProgress(100);
        return response;
      } catch (err: any) {
        const errorMessage = err?.response?.data?.message || err?.message || 'Failed to upload file';
        setError(errorMessage);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setUploadProgress(0);
    setError(null);
    setIsUploading(false);
  }, []);

  return {
    uploadFile,
    uploadProgress,
    isUploading,
    error,
    resetError,
    reset,
  };
}
