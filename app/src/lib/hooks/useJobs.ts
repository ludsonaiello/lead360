/**
 * Custom Hook: useJobs
 * Manage job list with filters, pagination, and auto-refresh
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getJobs, getFailedJobs } from '@/lib/api/jobs';
import type { Job, JobFilters, JobListResponse } from '@/lib/types/jobs';

interface UseJobsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  initialFilters?: JobFilters;
  failedOnly?: boolean;
}

export function useJobs(options: UseJobsOptions = {}) {
  const {
    autoRefresh = false,
    refreshInterval = 5000,
    initialFilters = {},
    failedOnly = false,
  } = options;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    limit: 50,
  });
  const [filters, setFilters] = useState<JobFilters>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchJobs = useCallback(async () => {
    try {
      console.log('[useJobs] Fetching jobs with filters:', filters);
      setIsLoading(true);
      setError(null);

      const fetchFn = failedOnly ? getFailedJobs : getJobs;
      const response: JobListResponse = await fetchFn(filters);

      console.log('[useJobs] API Response:', {
        jobsCount: response.data.length,
        pagination: response.pagination,
        firstJob: response.data[0],
      });

      if (isMountedRef.current) {
        setJobs(response.data);
        setPagination(response.pagination);
      }
    } catch (err: any) {
      console.error('[useJobs] Error fetching jobs:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load jobs');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [filters, failedOnly]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    console.log('[useJobs] Effect triggered - fetching jobs');
    fetchJobs();

    if (autoRefresh) {
      console.log('[useJobs] Setting up auto-refresh with interval:', refreshInterval);
      intervalRef.current = setInterval(() => {
        console.log('[useJobs] Auto-refresh triggered');
        fetchJobs();
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        console.log('[useJobs] Cleaning up interval');
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchJobs, autoRefresh, refreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const nextPage = useCallback(() => {
    if (pagination.current_page < pagination.total_pages) {
      setFilters((prev) => ({
        ...prev,
        page: (prev.page || 1) + 1,
      }));
    }
  }, [pagination]);

  const previousPage = useCallback(() => {
    if (pagination.current_page > 1) {
      setFilters((prev) => ({
        ...prev,
        page: Math.max((prev.page || 1) - 1, 1),
      }));
    }
  }, [pagination]);

  const goToPage = useCallback((page: number) => {
    setFilters((prev) => ({
      ...prev,
      page: Math.max(1, Math.min(page, pagination.total_pages)),
    }));
  }, [pagination.total_pages]);

  const refresh = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  const updateFilters = useCallback((newFilters: Partial<JobFilters>) => {
    console.log('[useJobs] updateFilters called with:', newFilters);
    setFilters((prev) => {
      const updated = {
        ...prev,
        ...newFilters,
        page: 1, // Reset to first page when filters change
      };
      console.log('[useJobs] Previous filters:', prev);
      console.log('[useJobs] Updated filters:', updated);
      return updated;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  return {
    jobs,
    pagination,
    filters,
    isLoading,
    error,
    setFilters: updateFilters,
    resetFilters,
    nextPage,
    previousPage,
    goToPage,
    refresh,
  };
}
