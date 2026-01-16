/**
 * Admin Dashboard Hook
 * Manages dashboard metrics, charts, and activity feed with auto-refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDashboardMetrics,
  getRecentActivity,
  getChartData,
} from '../api/admin-dashboard';
import type {
  DashboardMetrics,
  ActivityItem,
  ChartType,
  ChartData,
} from '../types/admin';

interface UseDashboardMetricsReturn {
  metrics: DashboardMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseRecentActivityReturn {
  activity: ActivityItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseChartDataReturn {
  data: ChartData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for dashboard metrics
 * Fetches metrics on mount and optionally auto-refreshes
 *
 * @param autoRefresh Enable auto-refresh (default: false)
 * @param refreshInterval Refresh interval in ms (default: 30000 = 30 seconds)
 */
export function useDashboardMetrics(
  autoRefresh: boolean = false,
  refreshInterval: number = 30000
): UseDashboardMetricsReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMetrics, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchMetrics, autoRefresh, refreshInterval]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refresh };
}

/**
 * Hook for recent activity feed
 * Fetches activity on mount and optionally auto-refreshes
 *
 * @param limit Number of activity items to fetch (default: 10)
 * @param autoRefresh Enable auto-refresh (default: false)
 * @param refreshInterval Refresh interval in ms (default: 30000 = 30 seconds)
 */
export function useRecentActivity(
  limit: number = 10,
  autoRefresh: boolean = false,
  refreshInterval: number = 30000
): UseRecentActivityReturn {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      setError(null);
      const data = await getRecentActivity(limit);
      setActivity(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity feed');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivity();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchActivity, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchActivity, autoRefresh, refreshInterval]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchActivity();
  }, [fetchActivity]);

  return { activity, loading, error, refresh };
}

/**
 * Hook for chart data
 * Fetches chart data on mount or when chartType changes
 *
 * @param chartType Type of chart to fetch
 */
export function useChartData(chartType: ChartType): UseChartDataReturn {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const chartData = await getChartData(chartType);
      setData(chartData);
    } catch (err: any) {
      setError(err.message || `Failed to load ${chartType} chart data`);
    } finally {
      setLoading(false);
    }
  }, [chartType]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const refresh = useCallback(async () => {
    await fetchChartData();
  }, [fetchChartData]);

  return { data, loading, error, refresh };
}
