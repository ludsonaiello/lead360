'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import type { ProjectGanttListItem, PaginationMeta } from '@/lib/types/projects';
import {
  formatProjectStatus,
  getStatusBadgeVariant,
  formatCurrency,
  formatDate,
  formatPMName,
} from '@/lib/api/projects';

interface ProjectListViewProps {
  projects: ProjectGanttListItem[];
  meta: PaginationMeta | null;
  loading: boolean;
  error: string | null;
  page: number;
  onPageChange: (page: number) => void;
}

export default function ProjectListView({
  projects,
  meta,
  loading,
  error,
  page,
  onPageChange,
}: ProjectListViewProps) {
  if (loading) {
    return <LoadingSpinner size="lg" centered />;
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load projects</h3>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No projects found</h3>
        <p className="text-gray-500 dark:text-gray-400">Create your first project to get started.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Project #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PM</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${project.id}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        {project.project_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/projects/${project.id}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
                        {project.name}
                      </Link>
                      {project.customer && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {project.customer.first_name} {project.customer.last_name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(project.status)} label={formatProjectStatus(project.status)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatPMName(project.assigned_pm)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(project.start_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(project.target_completion_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              project.progress_percent >= 100 ? 'bg-green-500' :
                              project.progress_percent >= 50 ? 'bg-blue-500' :
                              'bg-blue-400'
                            }`}
                            style={{ width: `${Math.min(project.progress_percent, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">
                          {project.progress_percent.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {project.completed_task_count}/{project.task_count}
                      </span>
                      {project.delayed_task_count > 0 && (
                        <span className="ml-1 text-xs text-red-600 dark:text-red-400 font-medium">
                          ({project.delayed_task_count} delayed)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{project.project_number}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{project.name}</p>
                </div>
                <Badge variant={getStatusBadgeVariant(project.status)} label={formatProjectStatus(project.status)} />
              </div>

              {project.customer && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {project.customer.first_name} {project.customer.last_name}
                </p>
              )}

              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      project.progress_percent >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(project.progress_percent, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {project.progress_percent.toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatPMName(project.assigned_pm)}</span>
                <span>{project.completed_task_count}/{project.task_count} tasks</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <PaginationControls
          currentPage={page}
          totalPages={meta.totalPages}
          onNext={() => onPageChange(page + 1)}
          onPrevious={() => onPageChange(page - 1)}
          onGoToPage={onPageChange}
        />
      )}
    </div>
  );
}
