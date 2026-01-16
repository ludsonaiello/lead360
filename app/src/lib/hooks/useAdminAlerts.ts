/**
 * Admin Alerts Hook
 * Manages platform admin notifications with auto-refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUnreadAlertsCount,
  getRecentAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
} from '../api/admin-alerts';
import type { Alert } from '../types/admin';

interface UseAlertsReturn {
  unreadCount: number;
  recentAlerts: Alert[];
  loading: boolean;
  error: string | null;
  markAsRead: (alertId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteAlertById: (alertId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for admin alerts with auto-refresh
 * Manages unread count and recent alerts for the header bell icon
 *
 * @param autoRefresh Enable auto-refresh (default: true)
 * @param refreshInterval Refresh interval in ms (default: 30000 = 30 seconds)
 */
export function useAdminAlerts(
  autoRefresh: boolean = true,
  refreshInterval: number = 30000
): UseAlertsReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setError(null);
      const [countData, alertsData] = await Promise.all([
        getUnreadAlertsCount(),
        getRecentAlerts(10),
      ]);
      setUnreadCount(countData.count);
      setRecentAlerts(alertsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAlerts, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchAlerts, autoRefresh, refreshInterval]);

  const markAsRead = useCallback(async (alertId: string) => {
    await markAlertAsRead(alertId);
    await fetchAlerts(); // Refresh
  }, [fetchAlerts]);

  const markAllRead = useCallback(async () => {
    await markAllAlertsAsRead();
    await fetchAlerts(); // Refresh
  }, [fetchAlerts]);

  const deleteAlertById = useCallback(async (alertId: string) => {
    await deleteAlert(alertId);
    await fetchAlerts(); // Refresh
  }, [fetchAlerts]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchAlerts();
  }, [fetchAlerts]);

  return {
    unreadCount,
    recentAlerts,
    loading,
    error,
    markAsRead,
    markAllRead,
    deleteAlertById,
    refresh,
  };
}
