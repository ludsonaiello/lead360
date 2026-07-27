'use client';

/**
 * My Hours Page — /workforce/my-hours (Sprint 6, time-clock)
 * Paginated history of the authenticated user's own clock sessions.
 * Shows totals for the current week and pay period, with filters and a
 * detail/dispute flow.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  addDays,
  differenceInDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileX,
  Filter,
  Flag,
  History,
  RefreshCw,
  Timer,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { PaginationControls } from '@/components/ui/PaginationControls';

import { SessionDetailModal } from '@/components/time-clock/SessionDetailModal';

import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

import {
  getMyAvailableProjects,
  getMySessionHistory,
  getTimeClockSettings,
} from '@/lib/api/time-clock';
import type {
  AvailableProject,
  ClockSession,
  ClockSessionStatus,
  PayPeriodType,
  SessionFilterParams,
  TimeClockSettings,
} from '@/lib/types/time-clock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function toWeekStartsOn(day: number | null | undefined): WeekStartsOn {
  if (day == null) return 0;
  const normalized = ((day % 7) + 7) % 7;
  return normalized as WeekStartsOn;
}

function formatDurationFromMinutes(mins: number | null | undefined): string {
  if (mins == null) return '0h 00m';
  const total = Math.max(0, Math.round(mins));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatDurationVerbose(mins: number): string {
  const safe = Math.max(0, Math.round(mins));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatSessionTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '—';
  }
}

function formatSessionDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'EEE, MMM d');
  } catch {
    return '—';
  }
}

function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  try {
    return format(date, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function parseDateInputValue(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface DateRange {
  start: Date;
  end: Date;
}

function computeWeekRange(today: Date, weekStartsOn: WeekStartsOn): DateRange {
  return {
    start: startOfWeek(today, { weekStartsOn }),
    end: endOfWeek(today, { weekStartsOn }),
  };
}

function computePayPeriodRange(
  today: Date,
  type: PayPeriodType | undefined,
  weekStartsOn: WeekStartsOn,
  anchorDateIso: string | null | undefined,
): DateRange {
  const now = today;
  switch (type) {
    case 'weekly':
      return computeWeekRange(now, weekStartsOn);
    case 'biweekly': {
      const anchor = anchorDateIso ? parseISO(anchorDateIso) : null;
      if (anchor && !Number.isNaN(anchor.getTime())) {
        const days = differenceInDays(startOfDay(now), startOfDay(anchor));
        const periodIndex = Math.floor(days / 14);
        const start = startOfDay(addDays(anchor, periodIndex * 14));
        const end = endOfDay(addDays(start, 13));
        return { start, end };
      }
      const start = startOfWeek(now, { weekStartsOn });
      return { start, end: endOfDay(addDays(start, 13)) };
    }
    case 'semimonthly': {
      const day = now.getDate();
      const monthStart = startOfMonth(now);
      if (day <= 15) {
        return { start: monthStart, end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 15)) };
      }
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 16)),
        end: endOfMonth(now),
      };
    }
    case 'monthly':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    default:
      return computeWeekRange(now, weekStartsOn);
  }
}

function payPeriodLabel(type: PayPeriodType | undefined): string {
  switch (type) {
    case 'biweekly':
      return 'Pay Period (Biweekly)';
    case 'semimonthly':
      return 'Pay Period (Semimonthly)';
    case 'monthly':
      return 'Pay Period (Monthly)';
    case 'weekly':
    default:
      return 'Pay Period (Weekly)';
  }
}

function statusBadge(status: ClockSessionStatus): React.ReactNode {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>;
  if (status === 'active') return <Badge variant="info">Active</Badge>;
  return <Badge variant="warning">On Break</Badge>;
}

interface StatusOption {
  value: '' | ClockSessionStatus;
  label: string;
}
const STATUS_OPTIONS: StatusOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'active', label: 'Active' },
  { value: 'on_break', label: 'On break' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyHoursPage() {
  usePageTitle('My Hours — Time Clock');
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { canPerform, loading: rbacLoading } = useRBAC();
  const canViewOwn = canPerform('timeclock', 'view_own');

  // Settings — used for pay period calculation
  const [settings, setSettings] = useState<TimeClockSettings | null>(null);

  // Session list state
  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Pagination + filters
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'' | ClockSessionStatus>('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Projects for filter
  const [projects, setProjects] = useState<AvailableProject[]>([]);

  // Summary (this week / pay period)
  const [weekMinutes, setWeekMinutes] = useState<number | null>(null);
  const [payPeriodMinutes, setPayPeriodMinutes] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Detail modal
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // RBAC gate
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!rbacLoading && !canViewOwn) {
      router.replace('/forbidden');
    }
  }, [rbacLoading, canViewOwn, router]);

  // -------------------------------------------------------------------------
  // Derived — pay period + week ranges
  // -------------------------------------------------------------------------
  const weekStartsOn = toWeekStartsOn(settings?.pay_period_start_day ?? 0);
  const weekRange = useMemo(
    () => computeWeekRange(new Date(), weekStartsOn),
    [weekStartsOn],
  );
  const payPeriodRange = useMemo(
    () =>
      computePayPeriodRange(
        new Date(),
        settings?.pay_period_type,
        weekStartsOn,
        settings?.pay_period_anchor_date,
      ),
    [settings?.pay_period_type, settings?.pay_period_anchor_date, weekStartsOn],
  );

  // -------------------------------------------------------------------------
  // Load boot data (settings + projects)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (rbacLoading || !canViewOwn) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [settingsRes, projectsRes] = await Promise.all([
          getTimeClockSettings().catch(() => null),
          getMyAvailableProjects().catch(() => [] as AvailableProject[]),
        ]);
        if (cancelled) return;
        setSettings(settingsRes);
        setProjects(projectsRes || []);
      } catch (err) {
        console.error('[MyHoursPage] Boot failed', err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [rbacLoading, canViewOwn]);

  // -------------------------------------------------------------------------
  // Session list loader
  // -------------------------------------------------------------------------
  const loadSessions = useCallback(async () => {
    if (rbacLoading || !canViewOwn) return;
    try {
      setLoading(true);
      setListError(null);
      const params: SessionFilterParams = {
        page,
        limit: PAGE_SIZE,
      };
      if (dateFrom) params.date_from = startOfDay(dateFrom).toISOString();
      if (dateTo) params.date_to = endOfDay(dateTo).toISOString();
      if (projectFilter) params.project_id = projectFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await getMySessionHistory(params);
      setSessions(res.data || []);
      setTotalPages(Math.max(1, res.meta?.totalPages ?? 1));
      setTotalRows(res.meta?.total ?? 0);
    } catch (err) {
      console.error('[MyHoursPage] Failed to load sessions', err);
      const e = err as { response?: { data?: { message?: string } } };
      setListError(e?.response?.data?.message || 'Could not load your sessions.');
      toast.error('Could not load your sessions.');
    } finally {
      setLoading(false);
    }
  }, [rbacLoading, canViewOwn, page, dateFrom, dateTo, projectFilter, statusFilter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // -------------------------------------------------------------------------
  // Summary loader (week + pay period)
  // -------------------------------------------------------------------------
  const loadSummary = useCallback(async () => {
    if (rbacLoading || !canViewOwn) return;
    try {
      setSummaryLoading(true);
      const summaryRangeStart = new Date(
        Math.min(weekRange.start.getTime(), payPeriodRange.start.getTime()),
      );
      const summaryRangeEnd = new Date(
        Math.max(weekRange.end.getTime(), payPeriodRange.end.getTime()),
      );
      const res = await getMySessionHistory({
        date_from: summaryRangeStart.toISOString(),
        date_to: summaryRangeEnd.toISOString(),
        page: 1,
        limit: 100,
      });
      const rows = res.data || [];
      const weekStartMs = weekRange.start.getTime();
      const weekEndMs = weekRange.end.getTime();
      const payStartMs = payPeriodRange.start.getTime();
      const payEndMs = payPeriodRange.end.getTime();
      let week = 0;
      let pay = 0;
      for (const s of rows) {
        const worked = s.total_worked_minutes ?? 0;
        if (!s.clock_in_at) continue;
        const startMs = new Date(s.clock_in_at).getTime();
        if (startMs >= weekStartMs && startMs <= weekEndMs) week += worked;
        if (startMs >= payStartMs && startMs <= payEndMs) pay += worked;
      }
      setWeekMinutes(week);
      setPayPeriodMinutes(pay);
    } catch (err) {
      console.error('[MyHoursPage] Failed to load summary', err);
      setWeekMinutes(null);
      setPayPeriodMinutes(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [
    rbacLoading,
    canViewOwn,
    weekRange.start,
    weekRange.end,
    payPeriodRange.start,
    payPeriodRange.end,
  ]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const resetFilters = useCallback(() => {
    setDateFrom(null);
    setDateTo(null);
    setProjectFilter('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'All projects' },
      ...projects.map((p) => ({
        value: p.id,
        label: p.project_number ? `${p.project_number} — ${p.name}` : p.name,
      })),
    ],
    [projects],
  );

  const activeFilterCount = [
    dateFrom,
    dateTo,
    projectFilter,
    statusFilter,
  ].filter(Boolean).length;

  const isInitialLoad = loading && sessions.length === 0 && !listError;

  // -------------------------------------------------------------------------
  // Gates
  // -------------------------------------------------------------------------
  if (authLoading || rbacLoading) {
    return <PageSkeleton />;
  }

  if (!canViewOwn) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6 sm:pt-6">
        <Breadcrumb
          items={[
            { label: 'Workforce', href: '/workforce/clock' },
            { label: 'My Hours' },
          ]}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href="/workforce/clock"
            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to Clock
          </Link>
          <button
            type="button"
            onClick={() => {
              loadSessions();
              loadSummary();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>

        <header className="mt-4 mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            <Timer className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              My Hours
            </h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Review your sessions, totals, and submit disputes if something looks wrong.
            </p>
          </div>
        </header>

        {/* Summary */}
        <SummaryCard
          weekLabel={`This Week (${format(weekRange.start, 'MMM d')} – ${format(weekRange.end, 'MMM d')})`}
          weekMinutes={weekMinutes}
          payPeriodLabel={`${payPeriodLabel(settings?.pay_period_type)} (${format(payPeriodRange.start, 'MMM d')} – ${format(payPeriodRange.end, 'MMM d')})`}
          payPeriodMinutes={payPeriodMinutes}
          loading={summaryLoading}
        />

        {/* Filters */}
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 sm:cursor-default"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="my-hours-filters"
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
            <ChevronRight
              className={`h-4 w-4 text-gray-500 transition-transform sm:hidden ${
                filtersOpen ? 'rotate-90' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          <div
            id="my-hours-filters"
            className={`${filtersOpen ? 'mt-4' : 'mt-0 hidden'} sm:mt-4 sm:block`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DatePicker
                id="date-from"
                label="From"
                value={toDateInputValue(dateFrom)}
                onChange={(e) => {
                  setDateFrom(parseDateInputValue(e.target.value));
                  setPage(1);
                }}
              />
              <DatePicker
                id="date-to"
                label="To"
                value={toDateInputValue(dateTo)}
                onChange={(e) => {
                  setDateTo(parseDateInputValue(e.target.value));
                  setPage(1);
                }}
              />
              <Select
                label="Project"
                options={projectOptions}
                value={projectFilter}
                onChange={(v) => {
                  setProjectFilter(v);
                  setPage(1);
                }}
                searchable={projectOptions.length > 6}
              />
              <Select
                label="Status"
                options={STATUS_OPTIONS as unknown as { value: string; label: string }[]}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v as '' | ClockSessionStatus);
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

        {/* Session list */}
        <section className="mt-5" aria-live="polite">
          {listError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Could not load your sessions</p>
                <p className="mt-0.5 text-xs">{listError}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadSessions}
                  className="mt-3"
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            </div>
          ) : isInitialLoad ? (
            <SessionListSkeleton />
          ) : sessions.length === 0 ? (
            <EmptyState hasFilters={activeFilterCount > 0} onClear={resetFilters} />
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {totalRows} session{totalRows === 1 ? '' : 's'}
              </p>
              <ul className="space-y-3">
                {sessions.map((session) => (
                  <SessionRowCard
                    key={session.id}
                    session={session}
                    onOpen={() => setSelectedSessionId(session.id)}
                  />
                ))}
              </ul>

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

      <SessionDetailModal
        isOpen={selectedSessionId !== null}
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
        onDisputeSubmitted={async () => {
          await loadSessions();
          await loadSummary();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  weekLabel: string;
  weekMinutes: number | null;
  payPeriodLabel: string;
  payPeriodMinutes: number | null;
  loading: boolean;
}

function SummaryCard({
  weekLabel,
  weekMinutes,
  payPeriodLabel: payLabel,
  payPeriodMinutes,
  loading,
}: SummaryCardProps) {
  return (
    <section
      aria-label="Hours summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <SummaryPill
        icon={<Clock className="h-5 w-5" aria-hidden="true" />}
        tone="blue"
        label={weekLabel}
        valueMinutes={weekMinutes}
        loading={loading}
      />
      <SummaryPill
        icon={<History className="h-5 w-5" aria-hidden="true" />}
        tone="indigo"
        label={payLabel}
        valueMinutes={payPeriodMinutes}
        loading={loading}
      />
    </section>
  );
}

interface SummaryPillProps {
  icon: React.ReactNode;
  tone: 'blue' | 'indigo';
  label: string;
  valueMinutes: number | null;
  loading: boolean;
}

function SummaryPill({ icon, tone, label, valueMinutes, loading }: SummaryPillProps) {
  const toneStyles = tone === 'blue'
    ? 'border-blue-200 bg-gradient-to-br from-white to-blue-50 text-blue-900 dark:border-blue-900/40 dark:from-gray-800 dark:to-blue-950/30 dark:text-blue-100'
    : 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50 text-indigo-900 dark:border-indigo-900/40 dark:from-gray-800 dark:to-indigo-950/30 dark:text-indigo-100';
  const iconBg = tone === 'blue'
    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
    : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300';

  return (
    <div className={`rounded-2xl border-2 p-4 shadow-sm ${toneStyles}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
            {label}
          </p>
          {loading ? (
            <div className="mt-1 h-7 w-24 animate-pulse rounded bg-current opacity-10" />
          ) : (
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums">
              {valueMinutes == null ? '—' : formatDurationVerbose(valueMinutes)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session row card
// ---------------------------------------------------------------------------

interface SessionRowCardProps {
  session: ClockSession;
  onOpen: () => void;
}

function SessionRowCard({ session, onOpen }: SessionRowCardProps) {
  const dateLabel = formatSessionDate(session.clock_in_at);
  const inLabel = formatSessionTime(session.clock_in_at);
  const outLabel = session.clock_out_at
    ? formatSessionTime(session.clock_out_at)
    : 'Active';
  const duration =
    session.status === 'completed'
      ? formatDurationFromMinutes(session.total_worked_minutes)
      : session.status === 'on_break'
        ? 'On break'
        : 'In progress';

  const hasPendingDispute =
    (session.disputes ?? []).some((d) => d.status === 'pending') ?? false;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group relative w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-700 dark:focus:ring-offset-gray-900 sm:p-5"
        aria-label={`Open session ${dateLabel} ${inLabel} to ${outLabel}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-gray-900 dark:text-white sm:text-base">
                {dateLabel}
              </p>
              {statusBadge(session.status)}
              {session.is_flagged && (
                <Badge variant="warning">
                  <Flag className="mr-1 h-3 w-3" aria-hidden="true" />
                  Flagged
                </Badge>
              )}
              {hasPendingDispute && (
                <Badge variant="info">
                  <History className="mr-1 h-3 w-3" aria-hidden="true" />
                  Dispute pending
                </Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Clock className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                {inLabel} — {outLabel}
              </span>
            </div>

            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <Briefcase className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
              <span className="truncate">
                {session.project?.name || 'No project'}
                {session.project?.project_number && (
                  <span className="ml-1 font-mono text-gray-500">
                    · {session.project.project_number}
                  </span>
                )}
                {session.task?.title && <span className="ml-1">· {session.task.title}</span>}
              </span>
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total
            </p>
            <p className="font-mono text-xl font-bold tabular-nums text-gray-900 dark:text-white">
              {duration}
            </p>
            <ChevronRight
              className="mt-1 h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500"
              aria-hidden="true"
            />
          </div>
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  hasFilters: boolean;
  onClear: () => void;
}

function EmptyState({ hasFilters, onClear }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <FileX className="h-7 w-7" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          {hasFilters ? 'No sessions match your filters' : 'No sessions yet'}
        </p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {hasFilters
            ? 'Try clearing a filter or widening your date range.'
            : 'Your clocked sessions will show up here once you clock in.'}
        </p>
      </div>
      {hasFilters ? (
        <Button variant="secondary" size="sm" onClick={onClear} type="button">
          <X className="h-4 w-4" aria-hidden="true" />
          Clear filters
        </Button>
      ) : (
        <Link
          href="/workforce/clock"
          className="mt-1 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Clock className="h-4 w-4" aria-hidden="true" />
          Go to Clock
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-12 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
          <div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
        </div>
        <div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
        <SessionListSkeleton />
      </div>
    </div>
  );
}

function SessionListSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
        />
      ))}
    </ul>
  );
}
