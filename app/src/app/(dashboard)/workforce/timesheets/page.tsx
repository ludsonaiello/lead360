'use client';

/**
 * Timesheets Page — /workforce/timesheets (Sprint 10, time-clock)
 * Admin/manager view for browsing all clock sessions with filtering,
 * detail view, and manual edit capability.
 *
 * Roles: Owner, Admin, Project Manager, Bookkeeper
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Briefcase,
  Filter,
  Flag,
  Inbox,
  Pencil,
  RefreshCw,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select, type SelectOption } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { SkeletonTable } from '@/components/ui/Skeleton';

import { TimesheetSessionDetail } from '@/components/time-clock/TimesheetSessionDetail';

import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

import { listSessions, listEmployeeProfiles } from '@/lib/api/time-clock';
import { getProjects } from '@/lib/api/projects';
import type {
  ClockSession,
  ClockSessionStatus,
  PaginationMeta,
  SessionFilterParams,
} from '@/lib/types/time-clock';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'on_break', label: 'On Break' },
  { value: 'completed', label: 'Completed' },
];

const BREADCRUMB_ITEMS = [
  { label: 'Workforce', href: '/workforce/dashboard' },
  { label: 'Timesheets' },
];

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

function formatMinutesToHHMM(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '\u2014';
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}

function getEmployeeName(session: ClockSession): string {
  const u = session.employee_profile?.user;
  if (!u) return 'Unknown';
  return `${u.first_name} ${u.last_name}`.trim();
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function TimesheetsPage() {
  usePageTitle('Timesheets — Time Clock');
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();

  // RBAC gate
  const canView = hasPermission('timeclock:view_all');

  // Filter state
  const [employeeId, setEmployeeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [page, setPage] = useState(1);

  // Data state
  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter options
  const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<SelectOption[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  // Detail modal
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Load filter options on mount
  useEffect(() => {
    if (rbacLoading) return;
    if (!canView) return;

    let cancelled = false;
    const loadFilters = async () => {
      setLoadingFilters(true);
      try {
        const [empRes, projRes] = await Promise.all([
          listEmployeeProfiles({ page: 1, limit: 100, is_active: true }),
          getProjects({ page: 1, limit: 100 }),
        ]);

        if (!cancelled) {
          const empOpts: SelectOption[] = [
            { value: '', label: 'All Employees' },
            ...empRes.data.map((e) => ({
              value: e.id,
              label: e.user
                ? `${e.user.first_name} ${e.user.last_name}`.trim()
                : e.id.substring(0, 8),
            })),
          ];
          setEmployeeOptions(empOpts);

          const projOpts: SelectOption[] = [
            { value: '', label: 'All Projects' },
            ...projRes.data.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.project_number})`,
            })),
          ];
          setProjectOptions(projOpts);
        }
      } catch (err) {
        console.error('[Timesheets] Failed to load filter options', err);
      } finally {
        if (!cancelled) setLoadingFilters(false);
      }
    };
    loadFilters();
    return () => { cancelled = true; };
  }, [canView, rbacLoading]);

  // Build filter params
  const filterParams = useMemo((): SessionFilterParams => {
    const params: SessionFilterParams = { page, limit: PAGE_SIZE };
    if (employeeId) params.employee_profile_id = employeeId;
    if (projectId) params.project_id = projectId;
    if (status) params.status = status as ClockSessionStatus;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (isFlagged) params.is_flagged = true;
    if (isManualEdit) params.is_manual_edit = true;
    return params;
  }, [page, employeeId, projectId, status, dateFrom, dateTo, isFlagged, isManualEdit]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listSessions(filterParams);
      setSessions(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('[Timesheets] Failed to load sessions', err);
      const e = err as { message?: string };
      setLoadError(e?.message || 'Failed to load timesheet data.');
      toast.error('Failed to load timesheets.');
    } finally {
      setLoading(false);
    }
  }, [filterParams]);

  useEffect(() => {
    if (rbacLoading) return;
    if (!canView) return;
    fetchSessions();
  }, [fetchSessions, canView, rbacLoading]);

  // Reset page on filter change
  const handleFilterChange = useCallback((setter: (val: string) => void, val: string) => {
    setter(val);
    setPage(1);
  }, []);

  const handleToggleFlagged = useCallback((val: boolean) => {
    setIsFlagged(val);
    setPage(1);
  }, []);

  const handleToggleManualEdit = useCallback((val: boolean) => {
    setIsManualEdit(val);
    setPage(1);
  }, []);

  // Open detail
  const openDetail = useCallback((id: string) => {
    setSelectedSessionId(id);
    setDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedSessionId(null);
  }, []);

  // Redirect if unauthorized
  useEffect(() => {
    if (!rbacLoading && !canView) {
      router.push('/forbidden');
    }
  }, [rbacLoading, canView, router]);

  if (rbacLoading || !canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading">
        <SkeletonTable rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={BREADCRUMB_ITEMS} showHome />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timesheets</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              View and manage employee clock sessions across all projects.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
            aria-label="Refresh timesheet"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filters
        </div>

        {/* Row 1 — Selects */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Employee"
            options={employeeOptions}
            value={employeeId}
            onChange={(val) => handleFilterChange(setEmployeeId, val)}
            placeholder={loadingFilters ? 'Loading...' : 'All Employees'}
            searchable
            disabled={loadingFilters}
          />
          <Select
            label="Project"
            options={projectOptions}
            value={projectId}
            onChange={(val) => handleFilterChange(setProjectId, val)}
            placeholder={loadingFilters ? 'Loading...' : 'All Projects'}
            searchable
            disabled={loadingFilters}
          />
          <DatePicker
            label="Date From"
            value={dateFrom}
            onChange={(e) => handleFilterChange(setDateFrom, e.target.value)}
          />
          <DatePicker
            label="Date To"
            value={dateTo}
            onChange={(e) => handleFilterChange(setDateTo, e.target.value)}
          />
        </div>

        {/* Row 2 — Status + Toggles */}
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(val) => handleFilterChange(setStatus, val)}
              placeholder="All Statuses"
            />
          </div>
          <div className="flex items-center gap-6 pb-1">
            <ToggleSwitch
              enabled={isFlagged}
              onChange={handleToggleFlagged}
              label="Flagged"
            />
            <ToggleSwitch
              enabled={isManualEdit}
              onChange={handleToggleManualEdit}
              label="Manual edits"
            />
          </div>
        </div>
      </div>

      {/* Sessions Table / Cards */}
      {loading && sessions.length === 0 ? (
        <SkeletonTable rows={8} columns={6} />
      ) : loadError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Failed to load timesheets</p>
            <p className="mt-1 text-xs">{loadError}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={fetchSessions}>
              Try again
            </Button>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 dark:border-gray-700 dark:bg-gray-800">
          <Inbox className="h-12 w-12 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            No timesheet entries found
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Try adjusting your filters or date range.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`hidden overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:block transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Employee
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Clock In
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Clock Out
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Total
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Regular
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      OT
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Project
                    </th>
                    <th scope="col" className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Flags
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => openDetail(s.id)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetail(s.id);
                        }
                      }}
                      aria-label={`View session for ${getEmployeeName(s)} on ${formatDate(s.clock_in_at)}`}
                    >
                      {/* Employee */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <User className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {getEmployeeName(s)}
                          </span>
                        </div>
                      </td>
                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(s.clock_in_at)}
                      </td>
                      {/* Clock In */}
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-gray-700 dark:text-gray-300">
                        {formatTime(s.clock_in_at)}
                      </td>
                      {/* Clock Out */}
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-gray-700 dark:text-gray-300">
                        {s.clock_out_at ? formatTime(s.clock_out_at) : '\u2014'}
                      </td>
                      {/* Total */}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                        {formatMinutesToHHMM(s.total_worked_minutes)}
                      </td>
                      {/* Regular */}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums text-gray-600 dark:text-gray-400">
                        {formatMinutesToHHMM(s.regular_minutes)}
                      </td>
                      {/* OT */}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums text-gray-600 dark:text-gray-400">
                        {formatMinutesToHHMM(s.overtime_minutes)}
                      </td>
                      {/* Project */}
                      <td className="max-w-[160px] truncate px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {s.project?.name || '\u2014'}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <SessionStatusBadge status={s.status} />
                      </td>
                      {/* Flags */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {s.is_flagged && (
                            <span
                              title={s.flag_reason || 'Flagged'}
                              aria-label={s.flag_reason ? `Flagged: ${s.flag_reason}` : 'Flagged'}
                              className="inline-flex"
                            >
                              <Badge variant="danger">
                                <Flag className="h-3 w-3" aria-hidden="true" />
                                <span className="sr-only">Flagged</span>
                              </Badge>
                            </span>
                          )}
                          {s.is_manual_edit && (
                            <span
                              title="Manually edited"
                              aria-label="Manually edited"
                              className="inline-flex"
                            >
                              <Pencil className="h-4 w-4 text-blue-500 dark:text-blue-400" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className={`space-y-3 lg:hidden transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openDetail(s.id)}
                className="block w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/30 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800 dark:hover:bg-blue-900/10"
                aria-label={`View session for ${getEmployeeName(s)} on ${formatDate(s.clock_in_at)}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <User className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {getEmployeeName(s)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(s.clock_in_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <SessionStatusBadge status={s.status} />
                    {s.is_flagged && (
                      <span
                        title={s.flag_reason || 'Flagged'}
                        aria-label={s.flag_reason ? `Flagged: ${s.flag_reason}` : 'Flagged'}
                      >
                        <Badge variant="danger">
                          <Flag className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">Flagged</span>
                        </Badge>
                      </span>
                    )}
                    {s.is_manual_edit && (
                      <span aria-label="Manually edited" title="Manually edited">
                        <Pencil
                          className="h-4 w-4 text-blue-500 dark:text-blue-400"
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/50">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      In
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatTime(s.clock_in_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Out
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {s.clock_out_at ? formatTime(s.clock_out_at) : '\u2014'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Total
                    </p>
                    <p className="font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                      {formatMinutesToHHMM(s.total_worked_minutes)}
                    </p>
                  </div>
                </div>

                {/* Project row */}
                {s.project && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Briefcase className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{s.project.name}</span>
                  </div>
                )}

                {/* Hours breakdown */}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>
                    Reg: <span className="font-mono font-semibold tabular-nums">{formatMinutesToHHMM(s.regular_minutes)}</span>
                  </span>
                  <span>
                    OT: <span className="font-mono font-semibold tabular-nums">{formatMinutesToHHMM(s.overtime_minutes)}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <PaginationControls
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onNext={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
              onPrevious={() => setPage((p) => Math.max(p - 1, 1))}
              onGoToPage={(p) => setPage(p)}
            />
          )}

          {/* Total count */}
          {meta && (
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              Showing {sessions.length} of {meta.total} session{meta.total !== 1 ? 's' : ''}
            </p>
          )}
        </>
      )}

      {/* Session detail modal */}
      <TimesheetSessionDetail
        isOpen={detailOpen}
        sessionId={selectedSessionId}
        onClose={closeDetail}
        onSessionUpdated={fetchSessions}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SessionStatusBadge({ status }: { status: ClockSession['status'] }) {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>;
  if (status === 'active') return <Badge variant="info">Active</Badge>;
  return <Badge variant="amber">On Break</Badge>;
}
