'use client';

/**
 * Workforce Dashboard — Who's In (/workforce/dashboard, Sprint 9)
 * Real-time view of currently clocked-in employees with live-updating
 * elapsed timers, summary cards, and 30-second auto-refresh.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInSeconds, parseISO, format } from 'date-fns';
import {
  AlertTriangle,
  Briefcase,
  Clock,
  Coffee,
  Hammer,
  MapPin,
  RefreshCw,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { LoadFailure } from '@/components/time-clock/LoadFailure';

import { useRBAC } from '@/contexts/RBACContext';

import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { getWhosIn } from '@/lib/api/time-clock';
import type { WhosInResponse, WhosInEmployee } from '@/lib/types/time-clock';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const TIMER_TICK_MS = 1_000; // 1 second

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  return 'An unexpected error occurred';
}

function formatClockInTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '\u2014';
  }
}

function formatBreakStart(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '\u2014';
  }
}

function formatElapsed(totalSeconds: number): string {
  if (totalSeconds < 0) return '0h 00m 00s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatBreakDuration(startedAt: string, now: Date): string {
  const seconds = Math.max(0, differenceInSeconds(now, parseISO(startedAt)));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}

function secondsSinceLastRefresh(timestamp: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

// ---------------------------------------------------------------------------
// Elapsed timer hook — re-renders every second
// ---------------------------------------------------------------------------

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  count,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
      </div>
    </Card>
  );
}

function EmployeeRow({
  employee,
  now,
}: {
  employee: WhosInEmployee;
  now: Date;
}) {
  const isOnBreak = employee.session.status === 'on_break';
  const totalSeconds = Math.max(0, differenceInSeconds(now, parseISO(employee.session.clock_in_at)));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-3">
        {/* Row 1: Name + status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isOnBreak
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-green-100 dark:bg-green-900/30'
            }`}>
              <span className={`text-sm font-bold ${
                isOnBreak ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'
              }`}>
                {employee.user.first_name[0]}{employee.user.last_name[0]}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {employee.user.first_name} {employee.user.last_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Clocked in at {formatClockInTime(employee.session.clock_in_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {employee.session.is_flagged && (
              <div className="relative group">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 max-w-xs">
                  Flagged session
                </div>
              </div>
            )}
            <Badge
              variant={isOnBreak ? 'amber' : 'success'}
              label={isOnBreak ? 'On Break' : 'Working'}
              icon={isOnBreak ? Coffee : Hammer}
            />
          </div>
        </div>

        {/* Row 2: Timer + meta info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Live elapsed timer */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white tabular-nums">
              {formatElapsed(totalSeconds)}
            </span>
          </div>

          {/* Project */}
          {employee.session.project && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{employee.session.project.name}</span>
            </div>
          )}

          {/* Task */}
          {employee.session.task && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <Hammer className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{employee.session.task.title}</span>
            </div>
          )}

          {/* Location */}
          {employee.session.clockin_address && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{employee.session.clockin_address.label}</span>
            </div>
          )}
        </div>

        {/* Break banner */}
        {isOnBreak && employee.session.current_break && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm">
            <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-amber-800 dark:text-amber-300">
              {employee.session.current_break.break_label || employee.session.current_break.break_type} break
              since {formatBreakStart(employee.session.current_break.started_at)}
              {' '}({formatBreakDuration(employee.session.current_break.started_at, now)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function WorkforceDashboardPage() {
  usePageTitle('Dashboard — Time Clock');
  const router = useRouter();
  const { hasPermission, hasRole, loading: rbacLoading } = useRBAC();

  // Data
  const [data, setData] = useState<WhosInResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Live timer — ticks every second for elapsed time display
  const now = useNow(TIMER_TICK_MS);

  // RBAC gate
  const canViewDashboard = hasPermission('timeclock:view_all') || hasRole(['Owner', 'Admin', 'Project Manager']);

  // Fetch data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getWhosIn();
      setData(res);
      setLoadError(null);
      setLastRefresh(new Date());
    } catch (err) {
      const message = extractApiErrorMessage(err);
      if (!silent) {
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 30-second auto-refresh
  useEffect(() => {
    const id = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // RBAC guard
  if (!rbacLoading && !canViewDashboard) {
    router.replace('/forbidden');
    return null;
  }

  const allEmployees = data?.employees ?? [];

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Workforce', href: '/workforce/clock' },
          { label: 'Dashboard' },
        ]}
        showHome
        className="mb-6"
      />

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Who&apos;s In
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time view of clocked-in employees
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {secondsSinceLastRefresh(lastRefresh)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchData()}
            disabled={loading}
            aria-label="Refresh dashboard"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <SummaryCard
          icon={Users}
          label="Total Clocked In"
          count={data?.total_clocked_in ?? 0}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <SummaryCard
          icon={Coffee}
          label="On Break"
          count={data?.total_on_break ?? 0}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Content */}
      {loadError && !data ? (
        <LoadFailure
          message={loadError}
          onRetry={() => fetchData()}
          retrying={loading}
        />
      ) : loading && !data ? (
        <SkeletonTable rows={4} columns={5} />
      ) : allEmployees.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5">
            <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No one is currently clocked in
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            When employees clock in, they will appear here in real time.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table view */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Employee</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Clock In</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Elapsed</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Project</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Task</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Location</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allEmployees.map((emp) => {
                    const isOnBreak = emp.session.status === 'on_break';
                    const totalSeconds = Math.max(0, differenceInSeconds(now, parseISO(emp.session.clock_in_at)));

                    return (
                      <tr key={emp.session.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isOnBreak
                                ? 'bg-amber-100 dark:bg-amber-900/30'
                                : 'bg-green-100 dark:bg-green-900/30'
                            }`}>
                              <span className={`text-xs font-bold ${
                                isOnBreak ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'
                              }`}>
                                {emp.user.first_name[0]}{emp.user.last_name[0]}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {emp.user.first_name} {emp.user.last_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={isOnBreak ? 'amber' : 'success'}
                            label={isOnBreak ? 'On Break' : 'Working'}
                            icon={isOnBreak ? Coffee : Hammer}
                          />
                          {isOnBreak && emp.session.current_break && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              {emp.session.current_break.break_label || emp.session.current_break.break_type}{' '}
                              ({formatBreakDuration(emp.session.current_break.started_at, now)})
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatClockInTime(emp.session.clock_in_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-gray-900 dark:text-white tabular-nums">
                            {formatElapsed(totalSeconds)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {emp.session.project ? (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[140px]">{emp.session.project.name}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {emp.session.task ? (
                            <span className="truncate max-w-[120px] block">{emp.session.task.title}</span>
                          ) : (
                            <span className="text-gray-400">{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {emp.session.clockin_address ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{emp.session.clockin_address.label}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">{'\u2014'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {emp.session.is_flagged ? (
                            <div className="relative group inline-flex">
                              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                Flagged session
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">\u2014</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet: card view */}
          <div className="lg:hidden space-y-3">
            {allEmployees.map((emp) => (
              <EmployeeRow key={emp.session.id} employee={emp} now={now} />
            ))}
          </div>
        </>
      )}

      {/* Last updated indicator (bottom) */}
      {data && allEmployees.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-6 py-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Auto-refreshes every 30 seconds &middot; Last updated {secondsSinceLastRefresh(lastRefresh)}
          </span>
        </div>
      )}
    </div>
  );
}
