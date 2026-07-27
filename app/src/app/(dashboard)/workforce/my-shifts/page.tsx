'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  endOfDay,
  format,
  isToday,
  parseISO,
  startOfDay,
} from 'date-fns';
import {
  AlertCircle,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  Clock,
  Filter,
  ListChecks,
  RefreshCw,
  StickyNote,
  X,
} from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { PaginationControls } from '@/components/ui/PaginationControls';
import Card from '@/components/ui/Card';

import {
  ShiftStatusBadge,
  SHIFT_STATUS_LABELS,
} from '@/components/time-clock/ShiftStatusBadge';

import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { getMyShifts } from '@/lib/api/time-clock';

import type {
  ShiftFilterParams,
  WorkShift,
  WorkShiftStatus,
} from '@/lib/types/time-clock';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'scheduled', label: SHIFT_STATUS_LABELS.scheduled },
  { value: 'in_progress', label: SHIFT_STATUS_LABELS.in_progress },
  { value: 'completed', label: SHIFT_STATUS_LABELS.completed },
  { value: 'missed', label: SHIFT_STATUS_LABELS.missed },
  { value: 'cancelled', label: SHIFT_STATUS_LABELS.cancelled },
];

const STATUS_BORDER_COLORS: Record<WorkShiftStatus, string> = {
  scheduled: 'border-l-blue-500',
  in_progress: 'border-l-amber-500',
  completed: 'border-l-green-500',
  missed: 'border-l-red-500',
  cancelled: 'border-l-gray-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShiftDate(iso: string): string {
  try {
    const d = parseISO(iso);
    return isToday(d) ? 'Today' : format(d, 'EEE, MMM d');
  } catch {
    return '—';
  }
}

function formatShiftTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '—';
  }
}

function formatTimeRange(start: string, end: string): string {
  return `${formatShiftTime(start)} – ${formatShiftTime(end)}`;
}

function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
}

function parseDateInputValue(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface GroupedShifts {
  today: WorkShift[];
  upcoming: WorkShift[];
  past: WorkShift[];
}

function groupShifts(shifts: WorkShift[]): GroupedShifts {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const today: WorkShift[] = [];
  const upcoming: WorkShift[] = [];
  const past: WorkShift[] = [];

  for (const shift of shifts) {
    const start = parseISO(shift.scheduled_start);
    if (start >= todayStart && start < tomorrowStart) {
      today.push(shift);
    } else if (start >= tomorrowStart) {
      upcoming.push(shift);
    } else {
      past.push(shift);
    }
  }

  upcoming.sort(
    (a, b) =>
      parseISO(a.scheduled_start).getTime() -
      parseISO(b.scheduled_start).getTime(),
  );
  past.sort(
    (a, b) =>
      parseISO(b.scheduled_start).getTime() -
      parseISO(a.scheduled_start).getTime(),
  );

  return { today, upcoming, past };
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function MyShiftsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 h-10 w-48 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shift card (mobile)
// ---------------------------------------------------------------------------

interface ShiftCardProps {
  shift: WorkShift;
}

function ShiftCard({ shift }: ShiftCardProps) {
  const borderColor = STATUS_BORDER_COLORS[shift.status] ?? 'border-l-gray-400';
  const dateLabel = formatShiftDate(shift.scheduled_start);
  const projectName = shift.project?.name ?? 'No Project Assigned';

  return (
    <Card
      className={`border-l-4 ${borderColor} p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Date + Project — primary identifier line */}
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
            <CalendarDays className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
            <span className="truncate">
              {dateLabel}
              <span className="mx-1 text-gray-400 dark:text-gray-500">—</span>
              {projectName}
            </span>
          </div>

          {shift.title && (
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight pl-[22px]">
              {shift.title}
            </p>
          )}

          {shift.task && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 pl-[22px]">
              <ListChecks className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{shift.task.title}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
            <span>{formatTimeRange(shift.scheduled_start, shift.scheduled_end)}</span>
          </div>

          {shift.notes && (
            <div className="flex items-start gap-1.5 pt-1">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {shift.notes}
              </p>
            </div>
          )}
        </div>

        <ShiftStatusBadge status={shift.status} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  label: string;
  count: number;
}

function SectionHeader({ label, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-1">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </h2>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row (desktop)
// ---------------------------------------------------------------------------

function ShiftTableRow({ shift }: ShiftCardProps) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0 transition-colors hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-800/50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
          {formatShiftDate(shift.scheduled_start)}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
          {formatTimeRange(shift.scheduled_start, shift.scheduled_end)}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
          <span className="truncate max-w-[180px]">
            {shift.project?.name ?? 'No Project Assigned'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {shift.task ? (
          <div className="flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
            <span className="truncate max-w-[140px]">{shift.task.title}</span>
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {shift.title ?? <span className="text-gray-400 dark:text-gray-600">—</span>}
      </td>
      <td className="px-4 py-3">
        <ShiftStatusBadge status={shift.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[160px]">
        {shift.notes ? (
          <span className="truncate block" title={shift.notes}>
            {shift.notes}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-600">—</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MyShiftsPage() {
  usePageTitle('My Shifts — Time Clock');
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const canView = hasPermission('timeclock:view_own');

  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // RBAC gate
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rbacLoading && !canView) {
      router.replace('/forbidden');
    }
  }, [rbacLoading, canView, router]);

  // ---------------------------------------------------------------------------
  // Shifts loader
  // ---------------------------------------------------------------------------
  const loadShifts = useCallback(async () => {
    if (rbacLoading || !canView) return;
    setLoading(true);
    setListError(null);
    try {
      const params: ShiftFilterParams = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter as WorkShiftStatus;
      if (dateFrom) params.date_from = startOfDay(dateFrom).toISOString();
      if (dateTo) params.date_to = endOfDay(dateTo).toISOString();
      const res = await getMyShifts(params);
      setShifts(res.data || []);
      setTotalPages(Math.max(1, res.meta?.totalPages ?? 1));
      setTotalRows(res.meta?.total ?? 0);
    } catch (err) {
      console.error('[MyShiftsPage] Failed to load shifts', err);
      const e = err as { message?: string | string[] };
      const raw = e?.message;
      setListError(
        Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : 'Could not load your shifts.',
      );
    } finally {
      setLoading(false);
    }
  }, [rbacLoading, canView, page, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // ---------------------------------------------------------------------------
  // Filter helpers
  // ---------------------------------------------------------------------------
  const resetFilters = useCallback(() => {
    setStatusFilter('');
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const activeFilterCount = [statusFilter, dateFrom, dateTo].filter(Boolean).length;
  const isInitialLoad = loading && shifts.length === 0 && !listError;

  const grouped = useMemo(() => groupShifts(shifts), [shifts]);
  const hasAnyShifts = shifts.length > 0;
  const hasTodayShifts = grouped.today.length > 0;
  const hasUpcomingShifts = grouped.upcoming.length > 0;
  const hasPastShifts = grouped.past.length > 0;

  // ---------------------------------------------------------------------------
  // Gates
  // ---------------------------------------------------------------------------
  if (authLoading || rbacLoading) return <MyShiftsSkeleton />;
  if (!canView) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Workforce', href: '/workforce/clock' },
            { label: 'My Shifts' },
          ]}
        />

        {/* Back link + Refresh */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href="/workforce/clock"
            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to Workforce
          </Link>
          <button
            type="button"
            onClick={loadShifts}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
            aria-label="Refresh shifts"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>

        {/* Page header */}
        <header className="mt-4 mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              My Shifts
            </h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Your upcoming and past scheduled shifts.
            </p>
          </div>
        </header>

        {/* Filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 sm:cursor-default"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="my-shifts-filters"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Filters
              </h2>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {activeFilterCount} active
                </span>
              )}
            </div>
          </button>

          <div
            id="my-shifts-filters"
            className={`${filtersOpen ? 'mt-4' : 'mt-0 hidden'} sm:mt-4 sm:block`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DatePicker
                label="From"
                value={toDateInputValue(dateFrom)}
                onChange={(e) => {
                  setDateFrom(parseDateInputValue(e.target.value));
                  setPage(1);
                }}
              />
              <DatePicker
                label="To"
                value={toDateInputValue(dateTo)}
                onChange={(e) => {
                  setDateTo(parseDateInputValue(e.target.value));
                  setPage(1);
                }}
              />
              <Select
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters} type="button">
                  <X className="h-4 w-4" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Shift list */}
        <section className="mt-5" aria-live="polite">
          {listError ? (
            /* Error state */
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Could not load your shifts</p>
                <p className="mt-0.5 text-xs">{listError}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadShifts}
                  className="mt-3"
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            </div>
          ) : isInitialLoad ? (
            /* Loading skeleton */
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
                />
              ))}
            </div>
          ) : !hasAnyShifts ? (
            /* Empty state */
            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                {activeFilterCount > 0 ? 'No shifts match' : 'No shifts scheduled'}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {activeFilterCount > 0
                  ? 'Try clearing filters to see more results.'
                  : 'Shifts assigned to you will appear here.'}
              </p>
              {activeFilterCount > 0 && (
                <div className="mt-4">
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {totalRows} shift{totalRows === 1 ? '' : 's'}
              </p>

              {/* ============ MOBILE CARD LAYOUT ============ */}
              <div className="space-y-5 md:hidden">
                {hasTodayShifts && (
                  <div>
                    <SectionHeader label="Today" count={grouped.today.length} />
                    <div className="space-y-3 rounded-2xl bg-blue-50 p-3 dark:bg-blue-900/20">
                      {grouped.today.map((s) => (
                        <ShiftCard key={s.id} shift={s} />
                      ))}
                    </div>
                  </div>
                )}

                {hasUpcomingShifts && (
                  <div>
                    <SectionHeader label="Upcoming" count={grouped.upcoming.length} />
                    <div className="space-y-3">
                      {grouped.upcoming.map((s) => (
                        <ShiftCard key={s.id} shift={s} />
                      ))}
                    </div>
                  </div>
                )}

                {hasPastShifts && (
                  <div>
                    <SectionHeader label="Past" count={grouped.past.length} />
                    <div className="space-y-3">
                      {grouped.past.map((s) => (
                        <ShiftCard key={s.id} shift={s} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ============ DESKTOP TABLE LAYOUT ============ */}
              <div className="hidden md:block">
                {hasTodayShifts && (
                  <div className="mb-5">
                    <SectionHeader label="Today" count={grouped.today.length} />
                    <div className="overflow-hidden rounded-2xl bg-blue-50 dark:bg-blue-900/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-blue-100 dark:border-blue-800/40">
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Task</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grouped.today.map((s) => (
                              <ShiftTableRow key={s.id} shift={s} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {hasUpcomingShifts && (
                  <div className="mb-5">
                    <SectionHeader label="Upcoming" count={grouped.upcoming.length} />
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Task</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grouped.upcoming.map((s) => (
                              <ShiftTableRow key={s.id} shift={s} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {hasPastShifts && (
                  <div className="mb-5">
                    <SectionHeader label="Past" count={grouped.past.length} />
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Project</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Task</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grouped.past.map((s) => (
                              <ShiftTableRow key={s.id} shift={s} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <PaginationControls
                  className="mt-6"
                  currentPage={page}
                  totalPages={totalPages}
                  onPrevious={() => handlePageChange(Math.max(1, page - 1))}
                  onNext={() => handlePageChange(Math.min(totalPages, page + 1))}
                  onGoToPage={handlePageChange}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
