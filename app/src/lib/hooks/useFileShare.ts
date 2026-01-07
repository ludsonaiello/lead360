/**
 * useFileShare Hook
 * Handle share link creation and management
 */

'use client';

import { useState, useCallback } from 'react';
import { createShareLink as apiCreateShareLink, revokeShareLink as apiRevokeShareLink } from '@/lib/api/files';
import type { ShareLink, CreateShareLinkRequest } from '@/lib/types/files';

interface UseFileShareReturn {
  createShareLink: (data: CreateShareLinkRequest) => Promise<ShareLink | null>;
  revokeShareLink: (id: string) => Promise<boolean>;
  shareLink: ShareLink | null;
  isCreating: boolean;
  isRevoking: boolean;
  error: string | null;
  resetError: () => void;
  reset: () => void;
}

export function useFileShare(): UseFileShareReturn {
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createShareLink = useCallback(async (data: CreateShareLinkRequest): Promise<ShareLink | null> => {
    try {
      setError(null);
      setIsCreating(true);

      const response = await apiCreateShareLink(data);
      setShareLink(response.share_link);

      return response.share_link;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to create share link';
      setError(errorMessage);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const revokeShareLink = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      setIsRevoking(true);

      await apiRevokeShareLink(id);

      // Clear share link if it's the one being revoked
      if (shareLink?.id === id) {
        setShareLink(null);
      }

      return true;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to revoke share link';
      setError(errorMessage);
      return false;
    } finally {
      setIsRevoking(false);
    }
  }, [shareLink]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setShareLink(null);
    setError(null);
    setIsCreating(false);
    setIsRevoking(false);
  }, []);

  return {
    createShareLink,
    revokeShareLink,
    shareLink,
    isCreating,
    isRevoking,
    error,
    resetError,
    reset,
  };
}
