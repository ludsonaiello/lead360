/**
 * Custom Hook: useEmailSettings
 * Manage platform SMTP email settings
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getEmailSettings, updateEmailSettings, sendTestEmail } from '@/lib/api/jobs';
import type { EmailSettings, UpdateEmailSettingsDto, TestEmailDto } from '@/lib/types/jobs';
import toast from 'react-hot-toast';

export function useEmailSettings() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const fetchSettings = useCallback(async () => {
    try {
      console.log('[useEmailSettings] Fetching email settings...');
      setIsLoading(true);
      setError(null);

      const data = await getEmailSettings();
      console.log('[useEmailSettings] Received data:', data);

      if (isMountedRef.current) {
        setSettings(data);
      }
    } catch (err: any) {
      console.error('[useEmailSettings] Error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load email settings');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchSettings();

    return () => {
      isMountedRef.current = false;
    };
  }, []); // ← Empty dependency array - only run once on mount

  const updateSettings = useCallback(
    async (data: UpdateEmailSettingsDto) => {
      try {
        setIsSaving(true);
        setError(null);

        const updated = await updateEmailSettings(data);

        if (isMountedRef.current) {
          setSettings(updated);
          toast.success('Email settings updated successfully');
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to update email settings';
        setError(errorMsg);
        toast.error(errorMsg);
        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    []
  );

  const testEmail = useCallback(
    async (data: TestEmailDto) => {
      try {
        setIsTesting(true);
        setError(null);

        const result = await sendTestEmail(data);

        toast.success(`Test email sent successfully to ${data.to_email}`);

        // Mark settings as verified
        if (isMountedRef.current && settings) {
          setSettings({ ...settings, is_verified: true });
        }

        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to send test email';
        setError(errorMsg);
        toast.error(errorMsg);
        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsTesting(false);
        }
      }
    },
    [settings]
  );

  const refresh = useCallback(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    isTesting,
    error,
    updateSettings,
    testEmail,
    refresh,
  };
}
