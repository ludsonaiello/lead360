'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useRBAC } from '@/contexts/RBACContext';
import { getProjectGanttList } from '@/lib/api/projects';
import type { ProjectGanttListItem, PaginationMeta, ProjectStatus } from '@/lib/types/projects';
import { MultiProjectGantt } from '../../components/GanttChart';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];

export default function MultiProjectGanttPage() {
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();

  const [projects, setProjects] = useState<ProjectGanttListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { status?: ProjectStatus; search?: string; page?: number; limit?: number } = { page, limit: 50 };
      if (statusFilter) params.status = statusFilter as ProjectStatus;
      if (debouncedSearch) params.search = debouncedSearch;

      const result = await getProjectGanttList(params);
      setProjects(result.data);
      setMeta(result.meta);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (rbacLoading) return null;

  if (!hasPermission('projects:view')) {
    router.push('/forbidden');
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Project Timeline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Multi-project Gantt overview</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="w-44">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            placeholder="All Statuses"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner size="lg" centered />
      ) : error ? (
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load projects</h3>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No projects found matching your filters.</p>
        </Card>
      ) : (
        <>
          <MultiProjectGantt projects={projects} />

          {meta && meta.totalPages > 1 && (
            <PaginationControls
              currentPage={page}
              totalPages={meta.totalPages}
              onNext={() => setPage(p => p + 1)}
              onPrevious={() => setPage(p => p - 1)}
              onGoToPage={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
