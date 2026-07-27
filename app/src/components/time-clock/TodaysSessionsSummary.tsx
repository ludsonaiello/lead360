'use client';

import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Clock,
  Flag,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import type { ClockSession } from '@/lib/types/time-clock';

interface TodaysSessionsSummaryProps {
  sessions: ClockSession[];
  className?: string;
  loading?: boolean;
}

function safeFormat(iso: string | null, pattern: string): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return '—';
  }
}

function formatDurationFromMinutes(mins: number | null): string {
  if (mins == null) return '—';
  const total = Math.max(0, Math.round(mins));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function statusBadge(session: ClockSession) {
  switch (session.status) {
    case 'active':
      return <Badge variant="info">Active</Badge>;
    case 'on_break':
      return <Badge variant="warning">On Break</Badge>;
    case 'completed':
      return <Badge variant="success">Completed</Badge>;
    default:
      return <Badge variant="neutral">{session.status}</Badge>;
  }
}

export function TodaysSessionsSummary({
  sessions,
  className = '',
  loading = false,
}: TodaysSessionsSummaryProps) {
  const totalMinutes = useMemo(
    () =>
      sessions.reduce(
        (sum, s) => (s.total_worked_minutes != null ? sum + s.total_worked_minutes : sum),
        0,
      ),
    [sessions],
  );

  return (
    <section
      aria-labelledby="todays-sessions-heading"
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2
            id="todays-sessions-heading"
            className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg"
          >
            Today&apos;s Sessions
          </h2>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Total
          </div>
          <div className="font-mono text-lg font-bold tabular-nums text-gray-900 dark:text-white">
            {formatDurationFromMinutes(totalMinutes)}
          </div>
        </div>
      </header>

      <div className="px-3 py-3 sm:px-5 sm:py-4">
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/50"
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">Loading sessions…</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
              <Clock className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              No sessions today
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Clock in above to start tracking your time.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Briefcase
                        className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {s.project?.name || 'No Project'}
                      </p>
                    </div>
                    <p className="mt-1 font-mono text-xs tabular-nums text-gray-600 dark:text-gray-400">
                      {safeFormat(s.clock_in_at, 'h:mm a')}
                      <span className="mx-1.5 text-gray-400">→</span>
                      {s.clock_out_at ? safeFormat(s.clock_out_at, 'h:mm a') : (
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Active
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                      {formatDurationFromMinutes(s.total_worked_minutes)}
                    </span>
                    {statusBadge(s)}
                  </div>
                </div>

                {s.is_flagged && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                      <span className="inline-flex items-center gap-1">
                        <Flag className="h-3 w-3" aria-hidden="true" />
                        Flagged
                      </span>
                      {s.flag_reason ? ` — ${s.flag_reason}` : ''}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default TodaysSessionsSummary;
