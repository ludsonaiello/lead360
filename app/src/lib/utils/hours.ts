import type { ClockSession } from '@/lib/types/time-clock';

export type DashboardPeriod = '7d' | '14d' | '30d' | '3mo' | '6mo' | '1y';

export const DASHBOARD_PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: '3mo', label: '3 months' },
  { value: '6mo', label: '6 months' },
  { value: '1y', label: '1 year' },
];

export interface PeriodRange {
  dateFrom: string;
  dateTo: string;
  days: number;
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPeriodRange(period: DashboardPeriod, now: Date = new Date()): PeriodRange {
  const end = new Date(now);
  const start = new Date(now);

  switch (period) {
    case '7d':
      start.setDate(end.getDate() - 6);
      break;
    case '14d':
      start.setDate(end.getDate() - 13);
      break;
    case '30d':
      start.setDate(end.getDate() - 29);
      break;
    case '3mo':
      start.setMonth(end.getMonth() - 3);
      start.setDate(start.getDate() + 1);
      break;
    case '6mo':
      start.setMonth(end.getMonth() - 6);
      start.setDate(start.getDate() + 1);
      break;
    case '1y':
      start.setFullYear(end.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      break;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return {
    dateFrom: toIsoDate(start),
    dateTo: toIsoDate(end),
    days,
  };
}

export function minutesToDecimalHours(minutes: number | null | undefined): number {
  if (!minutes || minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

export function minutesToHoursLabel(minutes: number | null | undefined): string {
  const safe = !minutes || minutes < 0 ? 0 : minutes;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface SessionTotals {
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  completedSessions: number;
  flaggedSessions: number;
  averageMinutes: number;
}

export function summarizeSessions(sessions: ClockSession[]): SessionTotals {
  let totalMinutes = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let completedSessions = 0;
  let flaggedSessions = 0;

  for (const s of sessions) {
    if (s.is_flagged) flaggedSessions += 1;
    if (s.status !== 'completed') continue;
    totalMinutes += s.total_worked_minutes ?? 0;
    regularMinutes += s.regular_minutes ?? 0;
    overtimeMinutes += s.overtime_minutes ?? 0;
    completedSessions += 1;
  }

  return {
    totalMinutes,
    regularMinutes,
    overtimeMinutes,
    completedSessions,
    flaggedSessions,
    averageMinutes: completedSessions > 0 ? Math.round(totalMinutes / completedSessions) : 0,
  };
}

export interface DailyHourBucket {
  date: string;
  label: string;
  hours: number;
  regularHours: number;
  overtimeHours: number;
}

export function groupSessionsByDay(
  sessions: ClockSession[],
  range: PeriodRange,
): DailyHourBucket[] {
  const buckets = new Map<string, DailyHourBucket>();

  const start = new Date(`${range.dateFrom}T00:00:00`);
  const end = new Date(`${range.dateTo}T00:00:00`);
  const dayMs = 1000 * 60 * 60 * 24;
  const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;

  const compress = totalDays > 60;

  for (let i = 0; i < totalDays; i += 1) {
    const d = new Date(start.getTime() + i * dayMs);
    const key = toIsoDate(d);
    if (compress) {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = toIsoDate(weekStart);
      if (!buckets.has(weekKey)) {
        buckets.set(weekKey, {
          date: weekKey,
          label: `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
          hours: 0,
          regularHours: 0,
          overtimeHours: 0,
        });
      }
    } else {
      buckets.set(key, {
        date: key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        hours: 0,
        regularHours: 0,
        overtimeHours: 0,
      });
    }
  }

  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const dt = new Date(s.clock_in_at);
    if (Number.isNaN(dt.getTime())) continue;
    let key: string;
    if (compress) {
      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay());
      weekStart.setHours(0, 0, 0, 0);
      key = toIsoDate(weekStart);
    } else {
      key = toIsoDate(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    }
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const total = minutesToDecimalHours(s.total_worked_minutes);
    const reg = minutesToDecimalHours(s.regular_minutes);
    const ot = minutesToDecimalHours(s.overtime_minutes);
    bucket.hours = Math.round((bucket.hours + total) * 100) / 100;
    bucket.regularHours = Math.round((bucket.regularHours + reg) * 100) / 100;
    bucket.overtimeHours = Math.round((bucket.overtimeHours + ot) * 100) / 100;
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}
