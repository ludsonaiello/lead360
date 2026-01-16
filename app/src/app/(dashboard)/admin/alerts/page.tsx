/**
 * Admin Alerts Page
 * Full list of platform notifications with filters
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import { getAllAlerts, markAlertAsRead, markAllAlertsAsRead, deleteAlert } from '@/lib/api/admin-alerts';
import type { Alert, AlertFilters } from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<AlertFilters>({
    unread_only: false,
  });

  useEffect(() => {
    loadAlerts();
  }, [page, filters]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await getAllAlerts(filters, { page, limit: 20 });
      setAlerts(response.alerts || []);
      setUnreadCount(response.unreadCount || 0);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load alerts');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await markAlertAsRead(alertId);
      toast.success('Marked as read');
      loadAlerts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsAsRead();
      toast.success('All alerts marked as read');
      loadAlerts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark all as read');
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;
    try {
      await deleteAlert(alertId);
      toast.success('Alert deleted');
      loadAlerts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete alert');
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'new_tenant':
        return '🏢';
      case 'storage_warning':
        return '⚠️';
      case 'job_spike':
        return '📈';
      case 'system_downtime':
        return '🔴';
      case 'suspicious_activity':
        return '🔍';
      default:
        return '📢';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-l-4 border-red-500 bg-red-50/50 dark:bg-red-900/10';
      case 'warning':
        return 'border-l-4 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10';
      default:
        return 'border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <CheckCheck className="w-5 h-5" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.unread_only}
              onChange={(e) => {
                setFilters({ ...filters, unread_only: e.target.checked });
                setPage(1);
              }}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Unread only</span>
          </label>
        </div>
      </Card>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="p-12">
            <div className="flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          </Card>
        ) : alerts.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <Bell className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No notifications</p>
            </div>
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-4 ${getSeverityColor(alert.severity)} ${
                !alert.is_read ? 'shadow-md' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl">{getAlertIcon(alert.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {alert.title}
                        {!alert.is_read && (
                          <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!alert.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(alert.id)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
