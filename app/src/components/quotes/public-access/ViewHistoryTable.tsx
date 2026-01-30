/**
 * View History Table Component
 * Paginated table showing detailed quote view history
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  Eye,
  Calendar,
  Globe,
  Clock,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import type { ViewHistoryEntry } from '@/lib/types/quotes';
import { getViewHistory } from '@/lib/api/quote-public-access';

interface ViewHistoryTableProps {
  quoteId: string;
  className?: string;
}

export function ViewHistoryTable({ quoteId, className = '' }: ViewHistoryTableProps) {
  const [history, setHistory] = useState<ViewHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    loadHistory();
  }, [quoteId, currentPage]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const response = await getViewHistory(quoteId, currentPage, itemsPerPage);
      setHistory(response.data);
      setTotalPages(response.pagination.total_pages);
      setTotalItems(response.pagination.total);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load view history');
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const parseDeviceType = (userAgent: string | null | undefined): string => {
    if (!userAgent) {
      return 'desktop'; // Default to desktop if user agent is not available
    }
    const ua = userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  };

  const getDeviceIcon = (userAgent: string | null | undefined) => {
    const deviceType = parseDeviceType(userAgent);
    switch (deviceType) {
      case 'desktop':
        return <Monitor className="w-4 h-4" />;
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            View History
          </h3>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {totalItems} total {totalItems === 1 ? 'view' : 'views'}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <Eye className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 font-semibold">
              No views recorded yet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              View history will appear here once customers access the public quote link
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date & Time
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    IP Address
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Device
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Referrer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Duration
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  {/* Date & Time */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {formatDate(item.viewed_at)}
                    </div>
                  </td>

                  {/* IP Address */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                      {item.ip_address || 'Unknown'}
                    </div>
                  </td>

                  {/* Device */}
                  <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      {getDeviceIcon(item.user_agent)}
                      <span className="capitalize">{parseDeviceType(item.user_agent)}</span>
                    </div>
                  </td>

                  {/* Referrer */}
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <div className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                      {item.referrer_url ? (
                        <a
                          href={item.referrer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {item.referrer_url}
                        </a>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-500 italic">
                          Direct
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {formatDuration(item.duration_seconds)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Page <span className="font-semibold">{currentPage}</span> of{' '}
              <span className="font-semibold">{totalPages}</span>
            </p>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing{' '}
              <span className="font-semibold">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold">
                {Math.min(currentPage * itemsPerPage, totalItems)}
              </span>{' '}
              of <span className="font-semibold">{totalItems}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || isLoading}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewHistoryTable;
