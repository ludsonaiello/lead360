/**
 * All Notifications Page
 * Complete list of user notifications with filtering and actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Filter, Trash2, CheckCheck, X, ExternalLink } from 'lucide-react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '@/lib/api/communication';
import type { Notification, GetNotificationsParams } from '@/lib/types/communication';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Link from 'next/link';

export default function AllNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filters
  const [filters, setFilters] = useState<GetNotificationsParams>({
    page: 1,
    limit,
  });

  const [tempFilters, setTempFilters] = useState<GetNotificationsParams>({
    page: 1,
    limit,
  });

  // Filter options
  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Notifications' },
    { value: 'true', label: 'Read' },
    { value: 'false', label: 'Unread' },
  ];

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications({
        ...filters,
        page: currentPage,
        limit,
      });
      setNotifications(response.data);
      setTotalPages(response.meta.total_pages);
      setTotalCount(response.meta.total_count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentPage, filters]);

  // Apply filters
  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    const clearedFilters: GetNotificationsParams = { page: 1, limit };
    setTempFilters(clearedFilters);
    setFilters(clearedFilters);
    setCurrentPage(1);
    setShowFilters(false);
  };

  // Mark as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      const count = await markAllNotificationsAsRead();
      toast.success(`Marked ${count} notification${count === 1 ? '' : 's'} as read`);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAllRead(false);
    }
  };

  // Delete notification
  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      toast.success('Notification deleted');
      fetchNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Active filters count
  const activeFiltersCount = Object.keys(filters).filter(
    key => key !== 'page' && key !== 'limit' && filters[key as keyof GetNotificationsParams]
  ).length;

  // Unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            View all your notifications and updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
              variant="secondary"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {markingAllRead ? 'Marking...' : `Mark All Read (${unreadCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Status"
              options={statusOptions}
              value={tempFilters.is_read !== undefined ? String(tempFilters.is_read) : ''}
              onChange={(value) => setTempFilters({ ...tempFilters, is_read: value ? value === 'true' : undefined })}
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handleClearFilters} variant="secondary">
              Clear All
            </Button>
            <Button onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!loading && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {notifications.length} of {totalCount} notification{totalCount === 1 ? '' : 's'}
          {unreadCount > 0 && ` (${unreadCount} unread)`}
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <CheckCheck className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            No notifications
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {activeFiltersCount > 0
              ? 'Try adjusting your filters to see more results'
              : 'You\'re all caught up!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={() => handleMarkAsRead(notification.id)}
              onDelete={() => setDeleteConfirm(notification.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            onPrevious={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            onGoToPage={setCurrentPage}
          />
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
          title="Delete Notification"
          message="Are you sure you want to delete this notification? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}

// Notification Item Component
function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
}) {
  const typeColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const typeColor = typeColors[notification.type] || typeColors['info'];

  return (
    <div
      className={`relative flex items-start gap-4 p-4 rounded-lg border transition-colors ${
        notification.is_read
          ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
      }`}
    >
      {/* Unread Indicator */}
      {!notification.is_read && (
        <div className="absolute top-4 left-4">
          <span className="flex h-2 w-2 rounded-full bg-blue-600" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 ml-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${notification.is_read ? 'text-gray-900 dark:text-gray-100' : 'text-blue-900 dark:text-blue-100'}`}>
              {notification.title}
            </h3>
            <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${typeColor}`}>
              {notification.type}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {format(new Date(notification.created_at), 'MMM d, h:mm a')}
          </span>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          {notification.message}
        </p>

        {/* Related Entity */}
        {notification.related_entity_type && notification.related_entity_id && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="capitalize">
              {notification.related_entity_type} #{notification.related_entity_id}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {notification.action_url && (
            <Link
              href={notification.action_url}
              onClick={() => !notification.is_read && onMarkAsRead()}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              View Details →
            </Link>
          )}
          {!notification.is_read && (
            <button
              onClick={onMarkAsRead}
              className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Mark as Read
            </button>
          )}
          <button
            onClick={onDelete}
            className="ml-auto text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
