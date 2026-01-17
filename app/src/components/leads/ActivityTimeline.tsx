/**
 * ActivityTimeline Component
 * Display lead activity timeline with pagination
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  FileText,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import type { LeadActivity } from '@/lib/types/leads';
import { getActivities } from '@/lib/api/leads';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/Button';

interface ActivityTimelineProps {
  leadId: string;
  className?: string;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: UserPlus,
  updated: Edit,
  status_changed: CheckCircle2,
  email_added: Mail,
  phone_added: Phone,
  address_added: MapPin,
  note_added: FileText,
  service_request_created: FileText,
  deleted: Trash2,
  default: Activity,
};

export function ActivityTimeline({ leadId, className = '' }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [leadId]);

  const loadActivities = async (pageNum: number = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await getActivities(leadId, { page: pageNum, limit: 10 });

      if (pageNum === 1) {
        setActivities(response.data);
      } else {
        setActivities((prev) => [...prev, ...response.data]);
      }

      setHasMore(response.meta.page < response.meta.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    loadActivities(page + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Activity className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-500 text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Timeline */}
      <div className="relative space-y-6">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

        {activities.map((activity, index) => {
          const Icon = activityIcons[activity.activity_type] || activityIcons.default;
          const isLast = index === activities.length - 1;

          return (
            <div key={activity.id} className="relative flex gap-4">
              {/* Icon */}
              <div className="relative z-10 flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-white dark:border-gray-800">
                  <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                      {activity.activity_type.replace(/_/g, ' ')}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {activity.description}
                  </p>

                  {activity.user && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <span>by</span>
                      <span className="font-semibold">{activity.user.first_name} {activity.user.last_name}</span>
                    </div>
                  )}

                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                          View details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 overflow-x-auto">
                          {JSON.stringify(activity.metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Load More
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ActivityTimeline;
