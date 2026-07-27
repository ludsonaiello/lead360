'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Coffee,
  Flag,
  History,
  MapPin,
  Play,
  Timer,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, StatCard } from '@/components/dashboard/Card';
import { Button } from '@/components/ui/Button';
import { ShiftStatusBadge } from '@/components/time-clock/ShiftStatusBadge';
import { SessionDurationTimer } from '@/components/time-clock/SessionDurationTimer';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getMyActiveSession,
  getMySessionHistory,
  getMyShifts,
  listMyDisputes,
} from '@/lib/api/time-clock';
import type { ClockSession, TimeDispute, WorkShift } from '@/lib/types/time-clock';
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
  type DailyHourBucket,
  getPeriodRange,
  groupSessionsByDay,
  minutesToHoursLabel,
  minutesToDecimalHours,
  summarizeSessions,
} from '@/lib/utils/hours';

const ACTIVE_POLL_MS = 60_000;

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeOnly(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDateOnly(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function sessionStatusLabel(s: ClockSession): { label: string; tone: string } {
  if (s.is_flagged) return { label: 'Flagged', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
  if (s.status === 'active') return { label: 'Active', tone: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' };
  if (s.status === 'on_break') return { label: 'On Break', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
  return { label: 'Completed', tone: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
}

export function EmployeeDashboard() {
  const { user } = useAuth();

  const [period, setPeriod] = useState<DashboardPeriod>('7d');
  const range = useMemo(() => getPeriodRange(period), [period]);

  const [activeSession, setActiveSession] = useState<ClockSession | null>(null);
  const [activeLoading, setActiveLoading] = useState(true);

  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);

  const [pendingDisputes, setPendingDisputes] = useState<TimeDispute[]>([]);

  const refreshActive = useCallback(async () => {
    try {
      const data = await getMyActiveSession();
      setActiveSession(data);
    } catch {
      setActiveSession(null);
    } finally {
      setActiveLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshActive();
    const id = setInterval(refreshActive, ACTIVE_POLL_MS);
    return () => clearInterval(id);
  }, [refreshActive]);

  useEffect(() => {
    let cancelled = false;
    setSessionsLoading(true);
    setSessionsError(null);
    getMySessionHistory({
      date_from: range.dateFrom,
      date_to: range.dateTo,
      limit: 200,
      page: 1,
    })
      .then((res) => {
        if (cancelled) return;
        setSessions(res.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSessionsError('Could not load your session history.');
        setSessions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setSessionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.dateFrom, range.dateTo]);

  useEffect(() => {
    let cancelled = false;
    setShiftsLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateFrom = today.toISOString().slice(0, 10);
    getMyShifts({ date_from: dateFrom, status: 'scheduled', limit: 5, page: 1 })
      .then((res) => {
        if (cancelled) return;
        setShifts(res.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setShifts([]);
      })
      .finally(() => {
        if (cancelled) return;
        setShiftsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listMyDisputes({ status: 'pending', limit: 1, page: 1 })
      .then((res) => {
        if (cancelled) return;
        setPendingDisputes(res.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setPendingDisputes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => summarizeSessions(sessions), [sessions]);
  const dailyBuckets: DailyHourBucket[] = useMemo(
    () => groupSessionsByDay(sessions, range),
    [sessions, range],
  );

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => new Date(b.clock_in_at).getTime() - new Date(a.clock_in_at).getTime())
        .slice(0, 10),
    [sessions],
  );

  const overtimeHours = minutesToDecimalHours(totals.overtimeMinutes);
  const regularHours = minutesToDecimalHours(totals.regularMinutes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back{user?.first_name ? `, ${user.first_name}` : ''}!
        </h1>
        <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400">
          Here&apos;s your workforce summary and clock status.
        </p>
      </div>

      <ActiveSessionCard session={activeSession} loading={activeLoading} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          My hours
        </h2>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Time period">
          {DASHBOARD_PERIODS.map((p) => {
            const selected = p.value === period;
            return (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setPeriod(p.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Hours"
          value={sessionsLoading ? '—' : minutesToHoursLabel(totals.totalMinutes)}
          icon={<Clock className="h-6 w-6" />}
        />
        <StatCard
          title="Regular vs Overtime"
          value={sessionsLoading ? '—' : `${regularHours.toFixed(1)}h + ${overtimeHours.toFixed(1)}h`}
          icon={<Timer className="h-6 w-6" />}
        />
        <StatCard
          title="Sessions"
          value={
            sessionsLoading
              ? '—'
              : `${totals.completedSessions} (avg ${minutesToHoursLabel(totals.averageMinutes)})`
          }
          icon={<Activity className="h-6 w-6" />}
        />
      </div>

      <Card>
        <CardHeader title="Hours by day" description={`From ${formatDateOnly(range.dateFrom)} to ${formatDateOnly(range.dateTo)}`} />
        <CardContent>
          {sessionsLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              Loading hours…
            </div>
          ) : sessionsError ? (
            <div className="flex h-64 items-center justify-center text-sm text-red-600 dark:text-red-400">
              {sessionsError}
            </div>
          ) : dailyBuckets.every((b) => b.hours === 0) ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <History className="h-6 w-6" />
              <span>No completed sessions in this range.</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyBuckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => {
                      const num = typeof value === 'number' ? value : Number(value);
                      const label = name === 'regularHours' ? 'Regular' : 'Overtime';
                      return [`${num.toFixed(2)}h`, label];
                    }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="regularHours" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overtimeHours" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent sessions"
              action={
                <Link
                  href="/workforce/my-hours"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <CardContent className="p-0">
              {sessionsLoading ? (
                <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading sessions…
                </div>
              ) : recentSessions.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No sessions in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Project</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">In / Out</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Hours</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {recentSessions.map((s) => {
                        const status = sessionStatusLabel(s);
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDateTime(s.clock_in_at)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              {s.project?.name ?? <span className="text-gray-400">—</span>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              {formatTimeOnly(s.clock_in_at)} – {formatTimeOnly(s.clock_out_at)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {minutesToHoursLabel(s.total_worked_minutes)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>
                                {s.is_flagged && <Flag className="h-3 w-3" />}
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Upcoming shifts"
              action={
                <Link
                  href="/workforce/my-shifts"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  All shifts <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <CardContent>
              {shiftsLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading shifts…</div>
              ) : shifts.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">No upcoming shifts.</div>
              ) : (
                <ul className="space-y-3">
                  {shifts.map((shift) => (
                    <li key={shift.id} className="flex items-start gap-3">
                      <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {shift.title || shift.project?.name || 'Shift'}
                          </p>
                          <ShiftStatusBadge status={shift.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                          {formatDateTime(shift.scheduled_start)} – {formatTimeOnly(shift.scheduled_end)}
                        </p>
                        {shift.project?.name && shift.title && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{shift.project.name}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Open disputes" />
            <CardContent>
              {pendingDisputes.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  No pending disputes.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-5 w-5" />
                    {pendingDisputes.length} pending review
                  </div>
                  <Link
                    href="/workforce/my-hours"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Review disputes <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Quick links" />
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/workforce/clock"
                    className="flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <Play className="h-4 w-4" /> Clock in / out
                  </Link>
                </li>
                <li>
                  <Link
                    href="/workforce/my-hours"
                    className="flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <History className="h-4 w-4" /> My hours
                  </Link>
                </li>
                <li>
                  <Link
                    href="/workforce/my-shifts"
                    className="flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <CalendarClock className="h-4 w-4" /> My shifts
                  </Link>
                </li>
                <li>
                  <Link
                    href="/calendar"
                    className="flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <CalendarClock className="h-4 w-4" /> Calendar
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActiveSessionCard({
  session,
  loading,
}: {
  session: ClockSession | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Activity className="h-5 w-5 animate-pulse" />
            Checking your clock status…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="border-blue-200 dark:border-blue-900">
        <CardContent>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                You&apos;re not clocked in
              </p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                Ready to start your day?
              </p>
            </div>
            <Link href="/workforce/clock">
              <Button variant="primary" size="md">
                <Play className="h-4 w-4" />
                Clock In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const onBreak = session.status === 'on_break';

  return (
    <Card className="border-green-200 dark:border-green-900">
      <CardContent>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <SessionDurationTimer
              clockInAt={session.clock_in_at}
              isPaused={onBreak}
              label="Elapsed"
              className="min-w-[180px]"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Currently {onBreak ? 'on break' : 'clocked in'}
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {session.project?.name ?? 'No project tag'}
              </p>
              {session.task?.title && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{session.task.title}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Started {formatTimeOnly(session.clock_in_at)}
                {session.clockin_address?.label && (
                  <>
                    {' · '}
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {session.clockin_address.label}
                    </span>
                  </>
                )}
              </p>
              {onBreak && (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Coffee className="h-3 w-3" /> On break
                </p>
              )}
            </div>
          </div>
          <Link href="/workforce/clock">
            <Button variant="secondary" size="md">
              Manage session <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmployeeDashboard;
