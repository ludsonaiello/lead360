/**
 * View Analytics Modal Component
 * Dashboard showing quote view analytics with charts and statistics
 */

'use client';

import React, { useEffect, useState } from 'react';
import { X, Eye, Users, Clock, TrendingUp, Calendar, Smartphone, Monitor, Tablet, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import type { ViewAnalytics } from '@/lib/types/quotes';
import { getViewAnalytics } from '@/lib/api/quote-public-access';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ViewAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  onViewHistory?: () => void;
}

export function ViewAnalyticsModal({
  isOpen,
  onClose,
  quoteId,
  onViewHistory,
}: ViewAnalyticsModalProps) {
  const [analytics, setAnalytics] = useState<ViewAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen, quoteId]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await getViewAnalytics(quoteId);
      setAnalytics(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load analytics');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEngagementLabel = (score: number) => {
    if (score >= 80) return { text: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (score >= 60) return { text: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 40) return { text: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
    return { text: 'Low', color: 'text-red-600 dark:text-red-400' };
  };

  const totalDeviceViews = analytics
    ? analytics.views_by_device.desktop +
      analytics.views_by_device.mobile +
      analytics.views_by_device.tablet +
      analytics.views_by_device.unknown
    : 0;

  const totalDeviceDownloads = analytics
    ? analytics.downloads_by_device.desktop +
      analytics.downloads_by_device.mobile +
      analytics.downloads_by_device.tablet +
      analytics.downloads_by_device.unknown
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              View Analytics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track how customers interact with your quote
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
          ) : analytics ? (
            <>
              {/* View Summary Cards */}
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  View Statistics
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Views */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                      <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">Total Views</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {analytics.total_views}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Unique Viewers */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Unique Visitors
                      </p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {analytics.unique_viewers}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Avg Duration */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Avg. Duration
                      </p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {formatDuration(analytics.average_duration_seconds)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Engagement Score */}
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        Engagement
                      </p>
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {analytics.engagement_score}
                        <span
                          className={`text-sm ml-2 ${
                            getEngagementLabel(analytics.engagement_score).color
                          }`}
                        >
                          {getEngagementLabel(analytics.engagement_score).text}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Download Summary Cards */}
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Download Statistics
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Downloads */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center">
                      <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300">Total Downloads</p>
                      <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                        {analytics.total_downloads}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Download Rate */}
                <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm text-cyan-700 dark:text-cyan-300">
                        Download Rate
                      </p>
                      <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                        {analytics.total_views > 0
                          ? `${Math.round((analytics.total_downloads / analytics.total_views) * 100)}%`
                          : '0%'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* First Downloaded */}
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/40 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm text-teal-700 dark:text-teal-300">
                        First Download
                      </p>
                      <p className="text-lg font-bold text-teal-900 dark:text-teal-100">
                        {analytics.first_downloaded_at
                          ? new Date(analytics.first_downloaded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Last Downloaded */}
                <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/40 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div>
                      <p className="text-sm text-sky-700 dark:text-sky-300">
                        Last Download
                      </p>
                      <p className="text-lg font-bold text-sky-900 dark:text-sky-100">
                        {analytics.last_downloaded_at
                          ? new Date(analytics.last_downloaded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Views Chart */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Views Over Time
                  </h3>
                </div>

                {analytics.views_by_date.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.views_by_date}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                      <XAxis
                        dataKey="date"
                        className="text-gray-600 dark:text-gray-400"
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis className="text-gray-600 dark:text-gray-400" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgb(31 41 55)',
                          border: '1px solid rgb(75 85 99)',
                          borderRadius: '0.5rem',
                        }}
                        labelStyle={{ color: 'rgb(209 213 219)' }}
                        itemStyle={{ color: 'rgb(96 165 250)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="rgb(59 130 246)"
                        strokeWidth={2}
                        dot={{ fill: 'rgb(59 130 246)', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No view data available yet
                  </div>
                )}
              </div>

              {/* Downloads Chart */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Downloads Over Time
                  </h3>
                </div>

                {analytics.downloads_by_date.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.downloads_by_date}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                      <XAxis
                        dataKey="date"
                        className="text-gray-600 dark:text-gray-400"
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis className="text-gray-600 dark:text-gray-400" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgb(31 41 55)',
                          border: '1px solid rgb(75 85 99)',
                          borderRadius: '0.5rem',
                        }}
                        labelStyle={{ color: 'rgb(209 213 219)' }}
                        itemStyle={{ color: 'rgb(99 102 241)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="rgb(99 102 241)"
                        strokeWidth={2}
                        dot={{ fill: 'rgb(99 102 241)', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No download data available yet
                  </div>
                )}
              </div>

              {/* Device Breakdown */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Views by Device
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <Monitor className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analytics.views_by_device.desktop}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Desktop</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {totalDeviceViews > 0
                        ? `${Math.round((analytics.views_by_device.desktop / totalDeviceViews) * 100)}%`
                        : '0%'}
                    </p>
                  </div>

                  <div className="text-center">
                    <Smartphone className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analytics.views_by_device.mobile}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Mobile</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {totalDeviceViews > 0
                        ? `${Math.round((analytics.views_by_device.mobile / totalDeviceViews) * 100)}%`
                        : '0%'}
                    </p>
                  </div>

                  <div className="text-center">
                    <Tablet className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analytics.views_by_device.tablet}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tablet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {totalDeviceViews > 0
                        ? `${Math.round((analytics.views_by_device.tablet / totalDeviceViews) * 100)}%`
                        : '0%'}
                    </p>
                  </div>

                  <div className="text-center">
                    <Eye className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analytics.views_by_device.unknown}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Unknown</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {totalDeviceViews > 0
                        ? `${Math.round((analytics.views_by_device.unknown / totalDeviceViews) * 100)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Activity Summary */}
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Activity Summary
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">First Viewed</p>
                    <p className="text-gray-900 dark:text-white font-semibold">
                      {formatDate(analytics.first_viewed_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Last Viewed</p>
                    <p className="text-gray-900 dark:text-white font-semibold">
                      {formatDate(analytics.last_viewed_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {onViewHistory && (
                <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="secondary" onClick={onViewHistory} className="flex-1">
                    View Detailed History
                  </Button>
                  <Button variant="primary" onClick={onClose}>
                    Close
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ViewAnalyticsModal;
