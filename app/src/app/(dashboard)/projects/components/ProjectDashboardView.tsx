'use client';

import React from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  CalendarClock,
  ClipboardList,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { ProjectDashboardData } from '@/lib/types/projects';
import { formatDate } from '@/lib/api/projects';

interface ProjectDashboardViewProps {
  data: ProjectDashboardData | null;
  loading: boolean;
  error: string | null;
}

export default function ProjectDashboardView({ data, loading, error }: ProjectDashboardViewProps) {
  if (loading) {
    return <LoadingSpinner size="lg" centered />;
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load dashboard</h3>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </Card>
    );
  }

  if (!data) return null;

  const statusCards = [
    { label: 'Total Projects', count: data.total_projects, icon: FolderKanban, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
    { label: 'Active', count: data.active_projects, icon: PlayCircle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Planned', count: data.status_distribution.planned, icon: ClipboardList, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    { label: 'On Hold', count: data.status_distribution.on_hold, icon: PauseCircle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { label: 'Completed', count: data.status_distribution.completed, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Canceled', count: data.status_distribution.canceled, icon: XCircle, color: 'text-gray-500 dark:text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
  ];

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.count}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Delayed Tasks Alert Banner */}
      {(data.delayed_tasks_count > 0 || data.overdue_tasks_count > 0) && (
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Attention Required</h3>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {data.delayed_tasks_count > 0 && (
                  <p>
                    <span className="font-medium text-red-600 dark:text-red-400">{data.delayed_tasks_count}</span> delayed task{data.delayed_tasks_count !== 1 ? 's' : ''} across{' '}
                    <span className="font-medium">{data.projects_with_delays}</span> project{data.projects_with_delays !== 1 ? 's' : ''}
                  </p>
                )}
                {data.overdue_tasks_count > 0 && (
                  <p>
                    <span className="font-medium text-red-600 dark:text-red-400">{data.overdue_tasks_count}</span> overdue task{data.overdue_tasks_count !== 1 ? 's' : ''} past their estimated end date
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Upcoming Deadlines</h3>
          </div>
          {data.upcoming_deadlines.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No upcoming deadlines in the next 30 days</p>
          ) : (
            <div className="space-y-3">
              {data.upcoming_deadlines.map((deadline) => (
                <Link
                  key={deadline.project_id}
                  href={`/projects/${deadline.project_id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{deadline.project_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(deadline.target_completion_date)}</p>
                  </div>
                  <Badge
                    variant={deadline.days_remaining <= 3 ? 'danger' : deadline.days_remaining <= 7 ? 'warning' : 'info'}
                    label={`${deadline.days_remaining}d`}
                  />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
          </div>
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recent_activity.map((activity, index) => (
                <div key={`${activity.project_id}-${activity.created_at}-${index}`} className="flex items-start gap-3 p-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {activity.project_name && (
                        <Link
                          href={`/projects/${activity.project_id}`}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {activity.project_name}
                        </Link>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {activity.user_name && `${activity.user_name} \u00b7 `}
                        {formatRelativeTime(activity.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}
