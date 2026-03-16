'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  List,
  Plus,
  Search,
  GanttChart,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useRBAC } from '@/contexts/RBACContext';
import { getProjectDashboard, getProjectGanttList } from '@/lib/api/projects';
import type {
  ProjectDashboardData,
  ProjectGanttListItem,
  PaginationMeta,
  ProjectStatus,
  DashboardFilters,
  ProjectGanttListParams,
} from '@/lib/types/projects';
import ProjectDashboardView from './components/ProjectDashboardView';
import ProjectListView from './components/ProjectListView';
import CreateProjectModal from './components/CreateProjectModal';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];

export default function ProjectsPage() {
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const router = useRouter();

  // View toggle: 'dashboard' | 'list'
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Data
  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectGanttListItem[]>([]);
  const [listMeta, setListMeta] = useState<PaginationMeta | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const filters: DashboardFilters = {};
      if (statusFilter) filters.status = statusFilter as ProjectStatus;
      const data = await getProjectDashboard(filters);
      setDashboardData(data);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setDashboardError(error.message || 'Failed to load dashboard');
    } finally {
      setDashboardLoading(false);
    }
  }, [statusFilter]);

  // Load list data
  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params: ProjectGanttListParams = {
        page,
        limit: 20,
      };
      if (statusFilter) params.status = statusFilter as ProjectStatus;
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await getProjectGanttList(params);
      setProjects(data.data);
      setListMeta(data.meta);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setListError(error.message || 'Failed to load projects');
    } finally {
      setListLoading(false);
    }
  }, [statusFilter, debouncedSearch, page]);

  // Load data on mount and filter change
  useEffect(() => {
    if (view === 'dashboard') {
      loadDashboard();
    }
  }, [view, loadDashboard]);

  useEffect(() => {
    if (view === 'list') {
      loadList();
    }
  }, [view, loadList]);

  // Permission check
  if (rbacLoading) {
    return null;
  }

  if (!hasPermission('projects:view')) {
    router.push('/forbidden');
    return null;
  }

  const canCreate = hasPermission('projects:create');

  const handleRefresh = () => {
    if (view === 'dashboard') {
      loadDashboard();
    } else {
      loadList();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your project portfolio</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects/dashboard/gantt">
            <Button variant="ghost" size="sm">
              <GanttChart className="w-4 h-4" />
              <span className="hidden sm:inline">Gantt View</span>
            </Button>
          </Link>
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'dashboard'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'list'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-1 items-center gap-3">
          {view === 'list' && (
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
          )}
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
      </div>

      {/* Content */}
      {view === 'dashboard' ? (
        <ProjectDashboardView
          data={dashboardData}
          loading={dashboardLoading}
          error={dashboardError}
        />
      ) : (
        <ProjectListView
          projects={projects}
          meta={listMeta}
          loading={listLoading}
          error={listError}
          page={page}
          onPageChange={setPage}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
