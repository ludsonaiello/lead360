/**
 * Custom Hook: useScheduledJobs
 * Manage scheduled jobs CRUD operations
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getScheduledJobs,
  updateScheduledJob,
  triggerScheduledJob,
  deleteScheduledJob,
} from '@/lib/api/jobs';
import type { ScheduledJob } from '@/lib/types/jobs';
import toast from 'react-hot-toast';

export function useScheduledJobs() {
  const [schedules, setSchedules] = useState<ScheduledJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getScheduledJobs();

      if (isMountedRef.current) {
        setSchedules(response.data);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load scheduled jobs');
        console.error('[useScheduledJobs] Error:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSchedules();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSchedules]);

  const enableJob = useCallback(
    async (id: string) => {
      try {
        await updateScheduledJob(id, { is_enabled: true });
        toast.success('Job enabled successfully');
        await fetchSchedules();
      } catch (err: any) {
        toast.error(err.message || 'Failed to enable job');
        throw err;
      }
    },
    [fetchSchedules]
  );

  const disableJob = useCallback(
    async (id: string) => {
      try {
        await updateScheduledJob(id, { is_enabled: false });
        toast.success('Job disabled successfully');
        await fetchSchedules();
      } catch (err: any) {
        toast.error(err.message || 'Failed to disable job');
        throw err;
      }
    },
    [fetchSchedules]
  );

  const triggerJob = useCallback(
    async (id: string) => {
      try {
        const result = await triggerScheduledJob(id);
        toast.success('Job triggered successfully');
        return result.job_id;
      } catch (err: any) {
        toast.error(err.message || 'Failed to trigger job');
        throw err;
      }
    },
    []
  );

  const updateSchedule = useCallback(
    async (id: string, data: Partial<ScheduledJob>) => {
      try {
        await updateScheduledJob(id, data);
        toast.success('Schedule updated successfully');
        await fetchSchedules();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update schedule');
        throw err;
      }
    },
    [fetchSchedules]
  );

  const deleteJob = useCallback(
    async (id: string) => {
      try {
        await deleteScheduledJob(id);
        toast.success('Scheduled job deleted');
        await fetchSchedules();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete job');
        throw err;
      }
    },
    [fetchSchedules]
  );

  const refresh = useCallback(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    isLoading,
    error,
    enableJob,
    disableJob,
    triggerJob,
    updateSchedule,
    deleteJob,
    refresh,
  };
}
