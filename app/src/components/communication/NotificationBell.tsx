/**
 * NotificationBell Component
 * Global notification bell with dropdown and configurable polling
 * Features:
 * - Unread count badge
 * - Dropdown with recent notifications
 * - Configurable polling interval (from admin settings or default 5 min)
 * - Mark as read on click
 * - Mark all as read button
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '@/lib/api/communication';
import type { Notification } from '@/lib/types/communication';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const DEFAULT_POLL_INTERVAL = 300000; // 5 minutes in milliseconds

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Fetch recent notifications (top 10 unread + read)
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications({
        page: 1,
        limit: 10,
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Load poll interval from admin settings (future implementation)
  // For now, use default. When admin settings API is ready:
  // const loadPollInterval = async () => {
  //   try {
  //     const settings = await getAdminSettings();
  //     setPollInterval(settings?.notification_poll_interval || DEFAULT_POLL_INTERVAL);
  //   } catch (error) {
  //     console.error('Failed to load poll interval:', error);
  //   }
  // };

  // Poll for unread count
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark notification as read and navigate
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Close dropdown if navigating
    if (notification.action_url) {
      setIsOpen(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const count = await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success(`Marked ${count} notification${count === 1 ? '' : 's'} as read`);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  // Delete notification
  const handleDeleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Decrease unread count if notification was unread
      const deletedNotif = notifications.find(n => n.id === notificationId);
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 z-20 mt-2 w-96 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-soft-lg ring-1 ring-black/5 dark:ring-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({unreadCount} unread)
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <div className="p-8 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="p-8 text-center">
                  <Bell className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No notifications yet
                  </p>
                </div>
              )}

              {!loading && notifications.length > 0 && (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className="group relative"
                    >
                      {notification.action_url ? (
                        <Link
                          href={notification.action_url}
                          onClick={() => handleNotificationClick(notification)}
                          className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                          }`}
                        >
                          <NotificationContent notification={notification} />
                        </Link>
                      ) : (
                        <div
                          onClick={() => handleNotificationClick(notification)}
                          className={`block px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                          }`}
                        >
                          <NotificationContent notification={notification} />
                        </div>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteNotification(notification.id, e)}
                        className="absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete notification"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/communications/notifications"
                onClick={() => setIsOpen(false)}
                className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper component for notification content
function NotificationContent({ notification }: { notification: Notification }) {
  return (
    <div className="flex items-start gap-3">
      {/* Unread indicator */}
      <div className="flex-shrink-0 mt-1">
        {notification.is_read ? (
          <div className="h-2 w-2 rounded-full border-2 border-gray-300 dark:border-gray-600" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {notification.title}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {notification.message}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export default NotificationBell;
