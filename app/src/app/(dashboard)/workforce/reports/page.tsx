'use client';

/**
 * Workforce Reports Hub — /workforce/reports (Sprint 11, time-clock)
 *
 * Five report tabs: Timesheet, Payroll, Shift Variance, Geo Violations, Activity Feed.
 * CSV export for Payroll report.
 *
 * Endpoints consumed:
 *  GET /api/v1/time-clock/reports/timesheet
 *  GET /api/v1/time-clock/reports/payroll
 *  GET /api/v1/time-clock/reports/payroll/export  (CSV blob)
 *  GET /api/v1/time-clock/reports/shift-variance
 *  GET /api/v1/time-clock/reports/geo-violations
 *  GET /api/v1/time-clock/reports/activity-feed
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ClockAlert,
  DollarSign,
  Download,
  FileText,
  Flag,
  Loader2,
  MapPin,
  PauseCircle,
  Pencil,
  PlayCircle,
  Search,
  StopCircle,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';

import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { LoadFailure } from '@/components/time-clock/LoadFailure';

import {
  getTimesheetReport,
  getPayrollReport,
  exportPayroll,
  listEmployeeProfiles,
  getShiftVarianceReport,
  getGeoViolationsReport,
  getActivityFeed,
} from '@/lib/api/time-clock';
import { getProjects } from '@/lib/api/projects';

import type {
  EmployeeProfile,
  ReportFilterParams,
  PayrollFilterParams,
  TimesheetReport,
  TimesheetEmployee,
  TimesheetDay,
  TimesheetDaySession,
  PayrollReport,
  PayrollEmployee,
  ShiftVarianceReport,
  ShiftVarianceFilterParams,
  GeoViolationsReport,
  GeoViolationsFilterParams,
  ActivityFeedEntry,
  ActivityFeedParams,
  ActivityEventType,
} from '@/lib/types/time-clock';
import type { Project } from '@/lib/types/projects';
import type { SelectOption } from '@/components/ui/Select';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Convert raw minutes to HH:MM display string */
function formatMinutesToHHMM(minutes: number): string {
  if (!minutes || minutes < 0) return '0:00';
  const totalMinutes = Math.round(minutes);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Convert decimal hours (e.g. 8.18) to HH:MM display string */
function formatDecimalHoursToHHMM(hours: number): string {
  if (!hours || hours < 0) return '0:00';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Format currency as $X,XXX.XX */
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

/** Format ISO timestamp to "h:mm a" (e.g. "8:00 AM") */
function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '—';
  }
}

/** Format ISO date to "EEE, MMM d" (e.g. "Mon, Jan 1") */
function formatDayDate(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE, MMM d');
  } catch {
    return iso;
  }
}

/** Employee display name */
function formatEmployeeName(user?: { first_name: string; last_name: string }): string {
  if (!user) return 'Unknown Employee';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unknown Employee';
}

/** Flatten API error to readable message */
function readApiMessage(err: unknown): string {
  const e = err as { message?: string | string[]; data?: { message?: string | string[] } };
  const raw = e?.message ?? e?.data?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  return typeof raw === 'string' ? raw : 'An unexpected error occurred.';
}

/** Format ISO date to "Mon, Jan 1, 2026" */
function formatFullDate(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE, MMM d, yyyy');
  } catch {
    return iso;
  }
}

/** Format ISO timestamp to "Apr 10, 2026 at 8:30 AM" */
function formatEventTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return iso;
  }
}

/** Relative time string (e.g. "2 hours ago", "Yesterday") */
function formatRelativeTime(iso: string): string {
  try {
    const date = parseISO(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) return format(date, 'MMM d, yyyy');
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
    return format(date, 'MMM d, yyyy');
  } catch {
    return '';
  }
}

/** Format lat/lng to 6 decimal places */
function formatCoordinate(val: number | null): string {
  if (val === null || val === undefined) return 'N/A';
  return val.toFixed(6);
}

/** Format variance minutes with sign and label */
function formatVarianceMinutes(minutes: number | null): { text: string; className: string } {
  if (minutes === null || minutes === undefined) return { text: 'N/A', className: 'text-gray-400 dark:text-gray-500' };
  if (minutes === 0) return { text: 'On time', className: 'text-gray-700 dark:text-gray-300' };
  if (minutes > 0) return { text: `+${minutes} min late`, className: 'text-red-600 dark:text-red-400 font-medium' };
  return { text: `${minutes} min early`, className: 'text-green-600 dark:text-green-400 font-medium' };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_TABS: TabItem[] = [
  { id: 'timesheet', label: 'Timesheet', icon: FileText },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'shift-variance', label: 'Shift Variance', icon: TrendingUp },
  { id: 'geo-violations', label: 'Geo Violations', icon: MapPin },
  { id: 'activity-feed', label: 'Activity Feed', icon: Activity },
];

/** Activity feed event type configuration */
const ACTIVITY_EVENT_CONFIG: Record<
  ActivityEventType,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  clock_in: {
    icon: PlayCircle,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    label: 'Clocked In',
  },
  clock_out: {
    icon: StopCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    label: 'Clocked Out',
  },
  break_start: {
    icon: PauseCircle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    label: 'Break Started',
  },
  break_end: {
    icon: PlayCircle,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    label: 'Break Ended',
  },
  dispute_submitted: {
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    label: 'Dispute Submitted',
  },
  dispute_approved: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    label: 'Dispute Approved',
  },
  dispute_rejected: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    label: 'Dispute Rejected',
  },
  manual_edit: {
    icon: Pencil,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    label: 'Session Edited',
  },
  shift_missed: {
    icon: ClockAlert,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    label: 'Shift Missed',
  },
};

const ACTIVITY_LIMIT_OPTIONS: SelectOption[] = [
  { value: '50', label: '50 events' },
  { value: '100', label: '100 events' },
  { value: '200', label: '200 events' },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ReportsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        <Skeleton variant="text" width={160} height={16} />
        <div className="mt-4">
          <Skeleton variant="text" width={240} height={32} />
        </div>
        <div className="mt-6">
          <Skeleton variant="rectangular" height={48} />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={80} />
          ))}
        </div>
        <div className="mt-6">
          <SkeletonTable rows={5} columns={4} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timesheet: Employee Accordion Card
// ---------------------------------------------------------------------------

interface EmployeeTimesheetCardProps {
  employee: TimesheetEmployee;
  defaultExpanded?: boolean;
}

function EmployeeTimesheetCard({ employee, defaultExpanded = false }: EmployeeTimesheetCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card className="overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left
          hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-t-lg"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full
            bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {formatEmployeeName(employee.user)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {employee.total_sessions} session{employee.total_sessions !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Desktop hours summary */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Regular</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatMinutesToHHMM(employee.total_regular_minutes)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Overtime</p>
              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                {formatMinutesToHHMM(employee.total_overtime_minutes)}
              </p>
            </div>
          </div>

          {expanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400 transition-transform" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400 transition-transform" />
          )}
        </div>
      </button>

      {/* Mobile hours summary — visible below header when collapsed */}
      <div className="flex sm:hidden items-center gap-4 px-4 pb-3 -mt-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Reg: <span className="font-semibold text-gray-900 dark:text-white">{formatMinutesToHHMM(employee.total_regular_minutes)}</span>
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          OT: <span className="font-semibold text-orange-600 dark:text-orange-400">{formatMinutesToHHMM(employee.total_overtime_minutes)}</span>
        </span>
      </div>

      {/* Expanded body — days + sessions */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {employee.days.map((day) => (
            <DayRow key={day.date} day={day} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Timesheet: Day Row
// ---------------------------------------------------------------------------

function DayRow({ day }: { day: TimesheetDay }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
      {/* Day header */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {formatDayDate(day.date)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Reg: <span className="font-semibold text-gray-700 dark:text-gray-200">{formatMinutesToHHMM(day.day_regular_minutes)}</span></span>
          <span>OT: <span className="font-semibold text-orange-600 dark:text-orange-400">{formatMinutesToHHMM(day.day_overtime_minutes)}</span></span>
        </div>
      </div>

      {/* Sessions */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
        {day.sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timesheet: Session Row
// ---------------------------------------------------------------------------

function SessionRow({ session }: { session: TimesheetDaySession }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-6 text-sm">
      {/* Time range */}
      <div className="flex items-center gap-1.5 min-w-[140px]">
        <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-gray-900 dark:text-white font-medium">
          {formatTime(session.clock_in_at)}
        </span>
        <span className="text-gray-400">—</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {session.clock_out_at ? formatTime(session.clock_out_at) : 'Active'}
        </span>
      </div>

      {/* Duration */}
      <div className="min-w-[60px]">
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatMinutesToHHMM(session.total_worked_minutes)}
        </span>
      </div>

      {/* Project */}
      {session.project && (
        <Badge variant="blue" label={session.project.name} />
      )}

      {/* Task */}
      {session.task && (
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
          {session.task.title}
        </span>
      )}

      {/* Flags */}
      <div className="flex items-center gap-1.5 ml-auto">
        {session.is_flagged && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
            title="Flagged"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Flagged</span>
          </span>
        )}
        {session.is_manual_edit && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"
            title="Manual edit"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Edited</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payroll: Summary Cards
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: 'default' | 'accent';
}

function SummaryCard({ label, value, icon, variant = 'default' }: SummaryCardProps) {
  return (
    <Card className="px-4 py-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
            variant === 'accent'
              ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Payroll: Employee Table (Desktop)
// ---------------------------------------------------------------------------

function PayrollTable({ employees }: { employees: PayrollEmployee[] }) {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <Card className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {[
                'Employee',
                'Rate',
                'Regular',
                'OT Hours',
                'OT x',
                'Regular Pay',
                'OT Pay',
                'Total Pay',
                'Sessions',
                'Flagged',
                'Edits',
              ].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {employees.map((emp) => (
              <tr key={emp.employee_profile_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatEmployeeName(emp.user)}
                    </p>
                    {emp.user.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{emp.user.email}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {formatCurrency(emp.hourly_rate)}
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                  {formatDecimalHoursToHHMM(emp.regular_hours)}
                </td>
                <td className="px-3 py-3 text-sm text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap">
                  {formatDecimalHoursToHHMM(emp.overtime_hours)}
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {emp.overtime_multiplier}x
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                  {formatCurrency(emp.regular_pay)}
                </td>
                <td className="px-3 py-3 text-sm text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap">
                  {formatCurrency(emp.overtime_pay)}
                </td>
                <td className="px-3 py-3 text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                  {formatCurrency(emp.total_pay)}
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 text-center">
                  {emp.sessions_count}
                </td>
                <td className="px-3 py-3 text-center">
                  {emp.flagged_sessions > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                      <Flag className="h-3.5 w-3.5" />
                      {emp.flagged_sessions}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {emp.manual_edits > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Pencil className="h-3.5 w-3.5" />
                      {emp.manual_edits}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payroll: Employee Cards (Mobile)
// ---------------------------------------------------------------------------

function PayrollMobileCards({ employees }: { employees: PayrollEmployee[] }) {
  return (
    <div className="lg:hidden space-y-3">
      {employees.map((emp) => (
        <Card key={emp.employee_profile_id} className="p-4">
          {/* Name + email */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {formatEmployeeName(emp.user)}
              </p>
              {emp.user.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{emp.user.email}</p>
              )}
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white flex-shrink-0">
              {formatCurrency(emp.total_pay)}
            </p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Rate</span>
              <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(emp.hourly_rate)}/hr</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">OT Multiplier</span>
              <p className="font-medium text-gray-900 dark:text-white">{emp.overtime_multiplier}x</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Regular</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDecimalHoursToHHMM(emp.regular_hours)} ({formatCurrency(emp.regular_pay)})
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Overtime</span>
              <p className="font-medium text-orange-600 dark:text-orange-400">
                {formatDecimalHoursToHHMM(emp.overtime_hours)} ({formatCurrency(emp.overtime_pay)})
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Sessions</span>
              <p className="font-medium text-gray-900 dark:text-white">{emp.sessions_count}</p>
            </div>
            <div className="flex items-center gap-3">
              {emp.flagged_sessions > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  <Flag className="h-3.5 w-3.5" /> {emp.flagged_sessions}
                </span>
              )}
              {emp.manual_edits > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Pencil className="h-3.5 w-3.5" /> {emp.manual_edits}
                </span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ===========================================================================
// MAIN PAGE COMPONENT
// ===========================================================================

export default function WorkforceReportsPage() {
  usePageTitle('Reports — Time Clock');
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { hasPermission, hasRole, loading: rbacLoading } = useRBAC();

  // Permission gate
  const canViewReports = hasPermission('timeclock:view_reports');

  // Active tab
  const [activeTab, setActiveTab] = useState('timesheet');

  // Reference data for filters
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // -------------------------------------------------------------------------
  // Timesheet state
  // -------------------------------------------------------------------------
  const [tsDateFrom, setTsDateFrom] = useState('');
  const [tsDateTo, setTsDateTo] = useState('');
  const [tsEmployee, setTsEmployee] = useState('');
  const [tsProject, setTsProject] = useState('');
  const [tsReport, setTsReport] = useState<TimesheetReport | null>(null);
  const [tsLoading, setTsLoading] = useState(false);
  const [tsError, setTsError] = useState<string | null>(null);
  const [tsGenerated, setTsGenerated] = useState(false);

  // -------------------------------------------------------------------------
  // Payroll state
  // -------------------------------------------------------------------------
  const [prDateFrom, setPrDateFrom] = useState('');
  const [prDateTo, setPrDateTo] = useState('');
  const [prEmployee, setPrEmployee] = useState('');
  const [prReport, setPrReport] = useState<PayrollReport | null>(null);
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [prGenerated, setPrGenerated] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);

  // -------------------------------------------------------------------------
  // Shift Variance state
  // -------------------------------------------------------------------------
  const [svDateFrom, setSvDateFrom] = useState('');
  const [svDateTo, setSvDateTo] = useState('');
  const [svEmployee, setSvEmployee] = useState('');
  const [svProject, setSvProject] = useState('');
  const [svReport, setSvReport] = useState<ShiftVarianceReport | null>(null);
  const [svLoading, setSvLoading] = useState(false);
  const [svError, setSvError] = useState<string | null>(null);
  const [svGenerated, setSvGenerated] = useState(false);

  // -------------------------------------------------------------------------
  // Geo Violations state
  // -------------------------------------------------------------------------
  const [gvDateFrom, setGvDateFrom] = useState('');
  const [gvDateTo, setGvDateTo] = useState('');
  const [gvEmployee, setGvEmployee] = useState('');
  const [gvReport, setGvReport] = useState<GeoViolationsReport | null>(null);
  const [gvLoading, setGvLoading] = useState(false);
  const [gvError, setGvError] = useState<string | null>(null);
  const [gvGenerated, setGvGenerated] = useState(false);
  const [gvPage, setGvPage] = useState(1);

  // -------------------------------------------------------------------------
  // Activity Feed state
  // -------------------------------------------------------------------------
  const [afEmployee, setAfEmployee] = useState('');
  const [afLimit, setAfLimit] = useState('50');
  const [afData, setAfData] = useState<ActivityFeedEntry[]>([]);
  const [afLoading, setAfLoading] = useState(false);
  const [afLoadingMore, setAfLoadingMore] = useState(false);
  const [afError, setAfError] = useState<string | null>(null);
  const [afGenerated, setAfGenerated] = useState(false);
  const [afHasMore, setAfHasMore] = useState(false);

  // -------------------------------------------------------------------------
  // RBAC gate
  // -------------------------------------------------------------------------
  const canViewGeoViolations = hasRole(['Owner', 'Admin']);

  useEffect(() => {
    if (!rbacLoading && !canViewReports) {
      router.replace('/forbidden');
    }
  }, [rbacLoading, canViewReports, router]);

  // -------------------------------------------------------------------------
  // Load reference data (employees + projects) for filter dropdowns
  // -------------------------------------------------------------------------
  const loadReferences = useCallback(async () => {
    try {
      const [empRes, projRes] = await Promise.all([
        listEmployeeProfiles({ limit: 100, is_active: true }).catch(() => null),
        getProjects({ limit: 100 }).catch(() => null),
      ]);
      setEmployees(empRes?.data ?? []);
      setProjects(projRes?.data ?? []);
    } catch (err) {
      console.error('[ReportsPage] Failed to load references', err);
    }
  }, []);

  useEffect(() => {
    if (rbacLoading || !canViewReports) return;
    loadReferences();
  }, [rbacLoading, canViewReports, loadReferences]);

  // -------------------------------------------------------------------------
  // Filter option lists
  // -------------------------------------------------------------------------
  const employeeOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...employees
        .map((e) => ({
          value: e.id,
          label: formatEmployeeName(e.user),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [employees],
  );

  const projectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All projects' },
      ...projects
        .map((p) => ({
          value: p.id,
          label: p.project_number ? `${p.project_number} — ${p.name}` : p.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [projects],
  );

  // -------------------------------------------------------------------------
  // Timesheet: Generate Report
  // -------------------------------------------------------------------------
  const generateTimesheetReport = useCallback(async () => {
    if (!tsDateFrom || !tsDateTo) {
      toast.error('Please select both a start and end date.');
      return;
    }
    if (tsDateFrom > tsDateTo) {
      toast.error('Start date must be on or before end date.');
      return;
    }

    setTsLoading(true);
    setTsError(null);
    setTsGenerated(false);

    try {
      const params: ReportFilterParams = {
        date_from: tsDateFrom,
        date_to: tsDateTo,
      };
      if (tsEmployee) params.employee_profile_id = tsEmployee;
      if (tsProject) params.project_id = tsProject;

      const data = await getTimesheetReport(params);
      setTsReport(data);
      setTsGenerated(true);
    } catch (err) {
      const msg = readApiMessage(err);
      setTsError(msg);
      toast.error(msg);
    } finally {
      setTsLoading(false);
    }
  }, [tsDateFrom, tsDateTo, tsEmployee, tsProject]);

  // -------------------------------------------------------------------------
  // Payroll: Generate Report
  // -------------------------------------------------------------------------
  const generatePayrollReport = useCallback(async () => {
    if (!prDateFrom || !prDateTo) {
      toast.error('Please select both a start and end date.');
      return;
    }
    if (prDateFrom > prDateTo) {
      toast.error('Start date must be on or before end date.');
      return;
    }

    setPrLoading(true);
    setPrError(null);
    setPrGenerated(false);

    try {
      const params: PayrollFilterParams = {
        date_from: prDateFrom,
        date_to: prDateTo,
      };
      if (prEmployee) params.employee_profile_id = prEmployee;

      const data = await getPayrollReport(params);
      setPrReport(data);
      setPrGenerated(true);
    } catch (err) {
      const msg = readApiMessage(err);
      setPrError(msg);
      toast.error(msg);
    } finally {
      setPrLoading(false);
    }
  }, [prDateFrom, prDateTo, prEmployee]);

  // -------------------------------------------------------------------------
  // Payroll: Export CSV
  // -------------------------------------------------------------------------
  const handleExportCSV = useCallback(async () => {
    if (!prDateFrom || !prDateTo) return;

    setCsvExporting(true);
    try {
      const params: PayrollFilterParams = {
        date_from: prDateFrom,
        date_to: prDateTo,
      };
      if (prEmployee) params.employee_profile_id = prEmployee;

      const blob = await exportPayroll(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll_${prDateFrom}_${prDateTo}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Payroll CSV exported successfully.');
    } catch (err) {
      toast.error('Failed to export payroll CSV.');
      console.error('[ReportsPage] CSV export error', err);
    } finally {
      setCsvExporting(false);
    }
  }, [prDateFrom, prDateTo, prEmployee]);

  // -------------------------------------------------------------------------
  // Shift Variance: Generate Report
  // -------------------------------------------------------------------------
  const generateShiftVarianceReport = useCallback(async () => {
    if (!svDateFrom || !svDateTo) {
      toast.error('Please select both a start and end date.');
      return;
    }
    if (svDateFrom > svDateTo) {
      toast.error('Start date must be on or before end date.');
      return;
    }

    setSvLoading(true);
    setSvError(null);
    setSvGenerated(false);

    try {
      const params: ShiftVarianceFilterParams = {
        date_from: svDateFrom,
        date_to: svDateTo,
      };
      if (svEmployee) params.employee_profile_id = svEmployee;
      if (svProject) params.project_id = svProject;

      const data = await getShiftVarianceReport(params);
      setSvReport(data);
      setSvGenerated(true);
    } catch (err) {
      const msg = readApiMessage(err);
      setSvError(msg);
      toast.error(msg);
    } finally {
      setSvLoading(false);
    }
  }, [svDateFrom, svDateTo, svEmployee, svProject]);

  // -------------------------------------------------------------------------
  // Geo Violations: Generate Report
  // -------------------------------------------------------------------------
  const generateGeoViolationsReport = useCallback(async (page = 1) => {
    if (!gvDateFrom || !gvDateTo) {
      toast.error('Please select both a start and end date.');
      return;
    }
    if (gvDateFrom > gvDateTo) {
      toast.error('Start date must be on or before end date.');
      return;
    }

    setGvLoading(true);
    setGvError(null);
    if (page === 1) setGvGenerated(false);

    try {
      const params: GeoViolationsFilterParams = {
        date_from: gvDateFrom,
        date_to: gvDateTo,
        page,
        limit: 20,
      };
      if (gvEmployee) params.employee_profile_id = gvEmployee;

      const data = await getGeoViolationsReport(params);
      setGvReport(data);
      setGvPage(page);
      setGvGenerated(true);
    } catch (err) {
      const msg = readApiMessage(err);
      setGvError(msg);
      toast.error(msg);
    } finally {
      setGvLoading(false);
    }
  }, [gvDateFrom, gvDateTo, gvEmployee]);

  // -------------------------------------------------------------------------
  // Activity Feed: Load
  // -------------------------------------------------------------------------
  const loadActivityFeed = useCallback(async (append = false, afterCursor?: string) => {
    if (append) {
      setAfLoadingMore(true);
    } else {
      setAfLoading(true);
      setAfError(null);
      setAfGenerated(false);
    }

    try {
      const params: ActivityFeedParams = {
        limit: parseInt(afLimit, 10),
      };
      if (afEmployee) params.employee_profile_id = afEmployee;
      if (afterCursor) params.after = afterCursor;

      const data = await getActivityFeed(params);
      const limitNum = parseInt(afLimit, 10);

      if (append) {
        setAfData((prev) => [...prev, ...data.data]);
      } else {
        setAfData(data.data);
      }

      setAfHasMore(data.data.length >= limitNum);
      setAfGenerated(true);
    } catch (err) {
      const msg = readApiMessage(err);
      setAfError(msg);
      toast.error(msg);
    } finally {
      setAfLoading(false);
      setAfLoadingMore(false);
    }
  }, [afEmployee, afLimit]);

  const handleLoadMoreActivity = useCallback(() => {
    if (afData.length === 0 || afLoadingMore) return;
    const lastTimestamp = afData[afData.length - 1].timestamp;
    loadActivityFeed(true, lastTimestamp);
  }, [afData, afLoadingMore, loadActivityFeed]);

  // -------------------------------------------------------------------------
  // Timesheet: grand totals
  // -------------------------------------------------------------------------
  const timesheetTotals = useMemo(() => {
    if (!tsReport?.employees?.length) return { regular: 0, overtime: 0 };
    return tsReport.employees.reduce(
      (acc, emp) => ({
        regular: acc.regular + emp.total_regular_minutes,
        overtime: acc.overtime + emp.total_overtime_minutes,
      }),
      { regular: 0, overtime: 0 },
    );
  }, [tsReport]);

  // -------------------------------------------------------------------------
  // Loading gate
  // -------------------------------------------------------------------------
  if (authLoading || rbacLoading) return <ReportsPageSkeleton />;
  if (!canViewReports) return null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Workforce', href: '/workforce/clock' },
            { label: 'Reports' },
          ]}
        />

        {/* Page header */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Timesheet, payroll, and workforce analytics</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <Tabs
            tabs={canViewGeoViolations ? REPORT_TABS : REPORT_TABS.filter((t) => t.id !== 'geo-violations')}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {/* ============================================================= */}
          {/* TIMESHEET TAB                                                  */}
          {/* ============================================================= */}
          {activeTab === 'timesheet' && (
            <div>
              {/* Filters */}
              <Card className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <DatePicker
                    label="Start Date"
                    required
                    value={tsDateFrom}
                    onChange={(e) => setTsDateFrom(e.target.value)}
                    max={tsDateTo || undefined}
                    aria-required="true"
                  />
                  <DatePicker
                    label="End Date"
                    required
                    value={tsDateTo}
                    onChange={(e) => setTsDateTo(e.target.value)}
                    min={tsDateFrom || undefined}
                    aria-required="true"
                  />
                  <Select
                    label="Employee"
                    options={employeeOptions}
                    value={tsEmployee}
                    onChange={setTsEmployee}
                    searchable={employeeOptions.length > 6}
                    placeholder="All employees"
                  />
                  <Select
                    label="Project"
                    options={projectOptions}
                    value={tsProject}
                    onChange={setTsProject}
                    searchable={projectOptions.length > 6}
                    placeholder="All projects"
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={generateTimesheetReport}
                      loading={tsLoading}
                      disabled={!tsDateFrom || !tsDateTo || tsLoading}
                      fullWidth
                      size="md"
                    >
                      <Search className="h-4 w-4" />
                      Generate Report
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Loading state */}
              {tsLoading && (
                <div className="mt-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={120} />
                  ))}
                </div>
              )}

              {/* Error state */}
              {tsError && !tsLoading && (
                <LoadFailure
                  title="Failed to generate timesheet report"
                  message={tsError}
                  onRetry={() => void generateTimesheetReport()}
                  retrying={tsLoading}
                  className="mt-6"
                />
              )}

              {/* Empty state — report generated but no data */}
              {tsGenerated && !tsLoading && !tsError && tsReport && tsReport.employees.length === 0 && (
                <Card className="mt-6 p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                      <FileText className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No timesheet data for the selected period
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Try adjusting the date range or filters.
                    </p>
                  </div>
                </Card>
              )}

              {/* Report data */}
              {tsGenerated && !tsLoading && !tsError && tsReport && tsReport.employees.length > 0 && (
                <div className="mt-6 space-y-4">
                  {/* Report period banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Period:</span>{' '}
                      {formatDayDate(tsReport.date_from)} — {formatDayDate(tsReport.date_to)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {tsReport.employees.length} employee{tsReport.employees.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Employee accordion cards */}
                  {tsReport.employees.map((emp, idx) => (
                    <EmployeeTimesheetCard
                      key={emp.employee_profile_id}
                      employee={emp}
                      defaultExpanded={idx === 0}
                    />
                  ))}

                  {/* Grand totals */}
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Grand Totals
                      </h3>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Regular</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatMinutesToHHMM(timesheetTotals.regular)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Overtime</p>
                          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                            {formatMinutesToHHMM(timesheetTotals.overtime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Initial state — no report generated yet */}
              {!tsGenerated && !tsLoading && !tsError && (
                <div className="mt-8 flex flex-col items-center text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                    <FileText className="h-8 w-8 text-blue-400 dark:text-blue-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Select a date range to generate a timesheet report
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                    Choose start and end dates, then click &quot;Generate Report&quot; to view employee timesheets grouped by day.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* PAYROLL TAB                                                    */}
          {/* ============================================================= */}
          {activeTab === 'payroll' && (
            <div>
              {/* Filters */}
              <Card className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <DatePicker
                    label="Start Date"
                    required
                    value={prDateFrom}
                    onChange={(e) => setPrDateFrom(e.target.value)}
                    max={prDateTo || undefined}
                    aria-required="true"
                  />
                  <DatePicker
                    label="End Date"
                    required
                    value={prDateTo}
                    onChange={(e) => setPrDateTo(e.target.value)}
                    min={prDateFrom || undefined}
                    aria-required="true"
                  />
                  <Select
                    label="Employee"
                    options={employeeOptions}
                    value={prEmployee}
                    onChange={setPrEmployee}
                    searchable={employeeOptions.length > 6}
                    placeholder="All employees"
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={generatePayrollReport}
                      loading={prLoading}
                      disabled={!prDateFrom || !prDateTo || prLoading}
                      fullWidth
                      size="md"
                    >
                      <Search className="h-4 w-4" />
                      Generate Report
                    </Button>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={handleExportCSV}
                      loading={csvExporting}
                      disabled={!prGenerated || csvExporting || prLoading}
                      fullWidth
                      size="md"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Loading state */}
              {prLoading && (
                <div className="mt-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} variant="rectangular" height={80} />
                    ))}
                  </div>
                  <SkeletonTable rows={4} columns={6} />
                </div>
              )}

              {/* Error state */}
              {prError && !prLoading && (
                <LoadFailure
                  title="Failed to generate payroll report"
                  message={prError}
                  onRetry={() => void generatePayrollReport()}
                  retrying={prLoading}
                  className="mt-6"
                />
              )}

              {/* Empty state */}
              {prGenerated && !prLoading && !prError && prReport && prReport.employees.length === 0 && (
                <Card className="mt-6 p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                      <DollarSign className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No payroll data for the selected period
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Try adjusting the date range or employee filter.
                    </p>
                  </div>
                </Card>
              )}

              {/* Report data */}
              {prGenerated && !prLoading && !prError && prReport && prReport.employees.length > 0 && (
                <div className="mt-6 space-y-6">
                  {/* Report period banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Period:</span>{' '}
                      {formatDayDate(prReport.date_from)} — {formatDayDate(prReport.date_to)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {prReport.employees.length} employee{prReport.employees.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <SummaryCard
                      label="Employees"
                      value={String(prReport.summary.total_employees)}
                      icon={<Users className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="Regular Hours"
                      value={formatDecimalHoursToHHMM(prReport.summary.total_regular_hours)}
                      icon={<Clock className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="OT Hours"
                      value={formatDecimalHoursToHHMM(prReport.summary.total_overtime_hours)}
                      icon={<TrendingUp className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="Regular Pay"
                      value={formatCurrency(prReport.summary.total_regular_pay)}
                      icon={<DollarSign className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="OT Pay"
                      value={formatCurrency(prReport.summary.total_overtime_pay)}
                      icon={<DollarSign className="h-5 w-5" />}
                    />
                    <SummaryCard
                      label="Total Pay"
                      value={formatCurrency(prReport.summary.total_pay)}
                      icon={<DollarSign className="h-5 w-5" />}
                      variant="accent"
                    />
                  </div>

                  {/* Desktop table */}
                  <PayrollTable employees={prReport.employees} />

                  {/* Mobile cards */}
                  <PayrollMobileCards employees={prReport.employees} />
                </div>
              )}

              {/* Initial state */}
              {!prGenerated && !prLoading && !prError && (
                <div className="mt-8 flex flex-col items-center text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20 mb-4">
                    <DollarSign className="h-8 w-8 text-green-400 dark:text-green-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Select a date range to generate a payroll report
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                    Choose start and end dates, then click &quot;Generate Report&quot; to view payroll summaries with export option.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* SHIFT VARIANCE TAB                                             */}
          {/* ============================================================= */}
          {activeTab === 'shift-variance' && (
            <div>
              {/* Filters */}
              <Card className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <DatePicker
                    label="Start Date"
                    required
                    value={svDateFrom}
                    onChange={(e) => setSvDateFrom(e.target.value)}
                    max={svDateTo || undefined}
                    aria-required="true"
                  />
                  <DatePicker
                    label="End Date"
                    required
                    value={svDateTo}
                    onChange={(e) => setSvDateTo(e.target.value)}
                    min={svDateFrom || undefined}
                    aria-required="true"
                  />
                  <Select
                    label="Employee"
                    options={employeeOptions}
                    value={svEmployee}
                    onChange={setSvEmployee}
                    searchable={employeeOptions.length > 6}
                    placeholder="All employees"
                  />
                  <Select
                    label="Project"
                    options={projectOptions}
                    value={svProject}
                    onChange={setSvProject}
                    searchable={projectOptions.length > 6}
                    placeholder="All projects"
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={generateShiftVarianceReport}
                      loading={svLoading}
                      disabled={!svDateFrom || !svDateTo || svLoading}
                      fullWidth
                      size="md"
                    >
                      <Search className="h-4 w-4" />
                      Generate Report
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Loading state */}
              {svLoading && (
                <div className="mt-6">
                  <SkeletonTable rows={5} columns={6} />
                </div>
              )}

              {/* Error state */}
              {svError && !svLoading && (
                <LoadFailure
                  title="Failed to generate shift variance report"
                  message={svError}
                  onRetry={() => void generateShiftVarianceReport()}
                  retrying={svLoading}
                  className="mt-6"
                />
              )}

              {/* Empty state */}
              {svGenerated && !svLoading && !svError && svReport && svReport.data.length === 0 && (
                <Card className="mt-6 p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                      <TrendingUp className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No shift variance data for the selected period
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Try adjusting the date range or filters.
                    </p>
                  </div>
                </Card>
              )}

              {/* Report data */}
              {svGenerated && !svLoading && !svError && svReport && svReport.data.length > 0 && (
                <div className="mt-6 space-y-4">
                  {/* Period banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Period:</span>{' '}
                      {formatDayDate(svReport.date_from)} — {formatDayDate(svReport.date_to)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {svReport.meta.total} shift{svReport.meta.total !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Card className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            {['Employee', 'Project', 'Date', 'Sched. Start', 'Sched. End', 'Actual In', 'Actual Out', 'Start Var.', 'Total Var.', 'Status'].map((h) => (
                              <th key={h} scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {svReport.data.map((entry) => {
                            const isMissed = entry.shift_status === 'missed';
                            const startVar = formatVarianceMinutes(entry.variance_start_minutes);
                            const totalVar = formatVarianceMinutes(entry.variance_total_minutes);

                            return (
                              <tr
                                key={entry.work_shift_id}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${isMissed ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}
                              >
                                <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                  {formatEmployeeName(entry.user)}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                  {entry.project?.name ?? '—'}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                  {formatDayDate(entry.scheduled_start)}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                  {formatTime(entry.scheduled_start)}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                  {formatTime(entry.scheduled_end)}
                                </td>
                                <td className="px-3 py-3 text-sm whitespace-nowrap">
                                  {isMissed || !entry.actual_clock_in_at ? (
                                    <span className="text-gray-400 dark:text-gray-500">N/A</span>
                                  ) : (
                                    <span className="text-gray-900 dark:text-white">{formatTime(entry.actual_clock_in_at)}</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm whitespace-nowrap">
                                  {isMissed || !entry.actual_clock_out_at ? (
                                    <span className="text-gray-400 dark:text-gray-500">N/A</span>
                                  ) : (
                                    <span className="text-gray-900 dark:text-white">{formatTime(entry.actual_clock_out_at)}</span>
                                  )}
                                </td>
                                <td className={`px-3 py-3 text-sm whitespace-nowrap ${startVar.className}`}>
                                  {startVar.text}
                                </td>
                                <td className={`px-3 py-3 text-sm whitespace-nowrap ${totalVar.className}`}>
                                  {totalVar.text}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {isMissed ? (
                                    <Badge variant="danger" label="MISSED" />
                                  ) : entry.variance_start_minutes !== null && entry.variance_start_minutes > 0 ? (
                                    <Badge variant="warning" label="Late" />
                                  ) : (
                                    <Badge
                                      variant={entry.shift_status === 'cancelled' ? 'neutral' : 'success'}
                                      label={entry.shift_status === 'completed' ? 'Completed' : entry.shift_status === 'scheduled' ? 'Scheduled' : entry.shift_status === 'cancelled' ? 'Cancelled' : 'In Progress'}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </Card>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden space-y-3">
                    {svReport.data.map((entry) => {
                      const isMissed = entry.shift_status === 'missed';
                      const startVar = formatVarianceMinutes(entry.variance_start_minutes);
                      const totalVar = formatVarianceMinutes(entry.variance_total_minutes);

                      return (
                        <Card
                          key={entry.work_shift_id}
                          className={`p-4 ${isMissed ? 'border-red-200 dark:border-red-800/50 bg-red-50/60 dark:bg-red-900/10' : ''}`}
                        >
                          {/* Header: name + status */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                {formatEmployeeName(entry.user)}
                              </p>
                              <div className="flex items-center gap-2">
                                {entry.project && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.project.name}</span>
                                )}
                                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDayDate(entry.scheduled_start)}</span>
                              </div>
                            </div>
                            {isMissed ? (
                              <Badge variant="danger" label="MISSED" />
                            ) : entry.variance_start_minutes !== null && entry.variance_start_minutes > 0 ? (
                              <Badge variant="warning" label="Late" />
                            ) : (
                              <Badge
                                variant={entry.shift_status === 'cancelled' ? 'neutral' : 'success'}
                                label={entry.shift_status === 'completed' ? 'Completed' : entry.shift_status === 'scheduled' ? 'Scheduled' : entry.shift_status === 'cancelled' ? 'Cancelled' : 'In Progress'}
                              />
                            )}
                          </div>

                          {/* Details grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Scheduled</span>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {formatTime(entry.scheduled_start)} — {formatTime(entry.scheduled_end)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Actual</span>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {isMissed || !entry.actual_clock_in_at ? 'N/A' : formatTime(entry.actual_clock_in_at)}
                                {' — '}
                                {isMissed || !entry.actual_clock_out_at ? 'N/A' : formatTime(entry.actual_clock_out_at)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Start Variance</span>
                              <p className={`font-medium ${startVar.className}`}>{startVar.text}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Total Variance</span>
                              <p className={`font-medium ${totalVar.className}`}>{totalVar.text}</p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Pagination for shift variance */}
                  {svReport.meta.totalPages > 1 && (
                    <PaginationControls
                      currentPage={svReport.meta.page}
                      totalPages={svReport.meta.totalPages}
                      onPrevious={() => {
                        const prev = svReport.meta.page - 1;
                        if (prev >= 1) {
                          setSvLoading(true);
                          getShiftVarianceReport({
                            date_from: svDateFrom,
                            date_to: svDateTo,
                            ...(svEmployee && { employee_profile_id: svEmployee }),
                            ...(svProject && { project_id: svProject }),
                            page: prev,
                          }).then((data) => {
                            setSvReport(data);
                            setSvLoading(false);
                          }).catch((err) => {
                            toast.error(readApiMessage(err));
                            setSvLoading(false);
                          });
                        }
                      }}
                      onNext={() => {
                        const next = svReport.meta.page + 1;
                        if (next <= svReport.meta.totalPages) {
                          setSvLoading(true);
                          getShiftVarianceReport({
                            date_from: svDateFrom,
                            date_to: svDateTo,
                            ...(svEmployee && { employee_profile_id: svEmployee }),
                            ...(svProject && { project_id: svProject }),
                            page: next,
                          }).then((data) => {
                            setSvReport(data);
                            setSvLoading(false);
                          }).catch((err) => {
                            toast.error(readApiMessage(err));
                            setSvLoading(false);
                          });
                        }
                      }}
                      className="mt-4"
                    />
                  )}
                </div>
              )}

              {/* Initial state */}
              {!svGenerated && !svLoading && !svError && (
                <div className="mt-8 flex flex-col items-center text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 mb-4">
                    <TrendingUp className="h-8 w-8 text-indigo-400 dark:text-indigo-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Select a date range to generate a shift variance report
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                    Compare scheduled shifts against actual clock times. See who was late, early, or missed their shift.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* GEO VIOLATIONS TAB                                             */}
          {/* ============================================================= */}
          {activeTab === 'geo-violations' && canViewGeoViolations && (
            <div>
              {/* Filters */}
              <Card className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DatePicker
                    label="Start Date"
                    required
                    value={gvDateFrom}
                    onChange={(e) => setGvDateFrom(e.target.value)}
                    max={gvDateTo || undefined}
                    aria-required="true"
                  />
                  <DatePicker
                    label="End Date"
                    required
                    value={gvDateTo}
                    onChange={(e) => setGvDateTo(e.target.value)}
                    min={gvDateFrom || undefined}
                    aria-required="true"
                  />
                  <Select
                    label="Employee"
                    options={employeeOptions}
                    value={gvEmployee}
                    onChange={setGvEmployee}
                    searchable={employeeOptions.length > 6}
                    placeholder="All employees"
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={() => generateGeoViolationsReport(1)}
                      loading={gvLoading}
                      disabled={!gvDateFrom || !gvDateTo || gvLoading}
                      fullWidth
                      size="md"
                    >
                      <Search className="h-4 w-4" />
                      Generate Report
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Loading state */}
              {gvLoading && (
                <div className="mt-6">
                  <SkeletonTable rows={5} columns={6} />
                </div>
              )}

              {/* Error state */}
              {gvError && !gvLoading && (
                <LoadFailure
                  title="Failed to generate geo-violations report"
                  message={gvError}
                  onRetry={() => void generateGeoViolationsReport(1)}
                  retrying={gvLoading}
                  className="mt-6"
                />
              )}

              {/* Empty state */}
              {gvGenerated && !gvLoading && !gvError && gvReport && gvReport.data.length === 0 && (
                <Card className="mt-6 p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                      <MapPin className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No geofence violations found for the selected period
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Try adjusting the date range or employee filter.
                    </p>
                  </div>
                </Card>
              )}

              {/* Report data */}
              {gvGenerated && !gvLoading && !gvError && gvReport && gvReport.data.length > 0 && (
                <div className="mt-6 space-y-4">
                  {/* Period banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">{gvReport.meta.total}</span> violation{gvReport.meta.total !== 1 ? 's' : ''} found
                    </p>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Card className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            {['Employee', 'Date', 'Clock-In Location', 'Geofence', 'Flag Reason', 'Nearest Address', 'Project', 'Status'].map((h) => (
                              <th key={h} scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {gvReport.data.map((entry) => (
                            <tr
                              key={entry.session_id}
                              onClick={() => router.push(`/workforce/timesheets?session=${entry.session_id}`)}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors"
                              role="link"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  router.push(`/workforce/timesheets?session=${entry.session_id}`);
                                }
                              }}
                            >
                              <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                {formatEmployeeName(entry.user)}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatFullDate(entry.clock_in_at)}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                                {entry.clock_in_latitude !== null && entry.clock_in_longitude !== null
                                  ? `${formatCoordinate(entry.clock_in_latitude)}, ${formatCoordinate(entry.clock_in_longitude)}`
                                  : 'Unavailable'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {entry.clock_in_geofence_status === 'outside' ? (
                                  <Badge variant="danger" label="Outside" />
                                ) : (
                                  <Badge variant="amber" label="Unavailable" />
                                )}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={entry.flag_reason ?? ''}>
                                {entry.flag_reason ?? '—'}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {entry.nearest_address
                                  ? `${entry.nearest_address.label} — ${entry.nearest_address.distance_meters.toLocaleString()}m`
                                  : '—'}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {entry.project?.name ?? '—'}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {entry.status === 'active' ? (
                                  <Badge variant="blue" label="Active" />
                                ) : entry.status === 'completed' ? (
                                  <Badge variant="green" label="Completed" />
                                ) : (
                                  <Badge variant="amber" label="On Break" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden space-y-3">
                    {gvReport.data.map((entry) => (
                      <div
                        key={entry.session_id}
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(`/workforce/timesheets?session=${entry.session_id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/workforce/timesheets?session=${entry.session_id}`);
                          }
                        }}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm
                          p-4 cursor-pointer hover:ring-2 hover:ring-blue-500/30 transition-all active:scale-[0.99]
                          focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {/* Header: name + geofence status */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                              {formatEmployeeName(entry.user)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFullDate(entry.clock_in_at)}
                            </p>
                          </div>
                          {entry.clock_in_geofence_status === 'outside' ? (
                            <Badge variant="danger" label="Outside" />
                          ) : (
                            <Badge variant="amber" label="Unavailable" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Location: </span>
                            <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                              {entry.clock_in_latitude !== null && entry.clock_in_longitude !== null
                                ? `${formatCoordinate(entry.clock_in_latitude)}, ${formatCoordinate(entry.clock_in_longitude)}`
                                : 'Unavailable'}
                            </span>
                          </div>
                          {entry.nearest_address && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Nearest: </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {entry.nearest_address.label} — {entry.nearest_address.distance_meters.toLocaleString()}m
                              </span>
                            </div>
                          )}
                          {entry.flag_reason && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{entry.flag_reason}</p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            {entry.project && <Badge variant="blue" label={entry.project.name} />}
                            {entry.status === 'active' ? (
                              <Badge variant="info" label="Active" />
                            ) : entry.status === 'completed' ? (
                              <Badge variant="green" label="Completed" />
                            ) : (
                              <Badge variant="amber" label="On Break" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {gvReport.meta.totalPages > 1 && (
                    <PaginationControls
                      currentPage={gvPage}
                      totalPages={gvReport.meta.totalPages}
                      onPrevious={() => generateGeoViolationsReport(gvPage - 1)}
                      onNext={() => generateGeoViolationsReport(gvPage + 1)}
                      className="mt-4"
                    />
                  )}
                </div>
              )}

              {/* Initial state */}
              {!gvGenerated && !gvLoading && !gvError && (
                <div className="mt-8 flex flex-col items-center text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
                    <MapPin className="h-8 w-8 text-red-400 dark:text-red-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Select a date range to view geofence violations
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                    Find sessions where employees clocked in outside of configured geofence areas or with GPS unavailable.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* ACTIVITY FEED TAB                                              */}
          {/* ============================================================= */}
          {activeTab === 'activity-feed' && (
            <div>
              {/* Filters */}
              <Card className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Select
                    label="Employee"
                    options={employeeOptions}
                    value={afEmployee}
                    onChange={(val) => {
                      setAfEmployee(val);
                      setAfGenerated(false);
                      setAfData([]);
                    }}
                    searchable={employeeOptions.length > 6}
                    placeholder="All employees"
                  />
                  <Select
                    label="Limit"
                    options={ACTIVITY_LIMIT_OPTIONS}
                    value={afLimit}
                    onChange={(val) => {
                      setAfLimit(val);
                      setAfGenerated(false);
                      setAfData([]);
                    }}
                    placeholder="50 events"
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={() => loadActivityFeed(false)}
                      loading={afLoading}
                      disabled={afLoading}
                      fullWidth
                      size="md"
                    >
                      <Activity className="h-4 w-4" />
                      Load Activity
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Loading state */}
              {afLoading && (
                <div className="mt-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton variant="circular" width={44} height={44} />
                      <div className="flex-1 space-y-2">
                        <Skeleton variant="text" width="60%" height={16} />
                        <Skeleton variant="text" width="40%" height={14} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error state */}
              {afError && !afLoading && (
                <LoadFailure
                  title="Failed to load activity feed"
                  message={afError}
                  onRetry={() => void loadActivityFeed(false)}
                  retrying={afLoading}
                  className="mt-6"
                />
              )}

              {/* Empty state */}
              {afGenerated && !afLoading && !afError && afData.length === 0 && (
                <Card className="mt-6 p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                      <Activity className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No activity recorded yet
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Clock events, disputes, and edits will appear here.
                    </p>
                  </div>
                </Card>
              )}

              {/* Activity timeline */}
              {afGenerated && !afLoading && !afError && afData.length > 0 && (
                <div className="mt-6">
                  {/* Timeline */}
                  <div className="relative">
                    {/* Vertical line */}
                    <div
                      className="absolute left-[21px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 sm:left-[21px]"
                      aria-hidden="true"
                    />

                    <div className="space-y-1">
                      {afData.map((event, idx) => {
                        const config = ACTIVITY_EVENT_CONFIG[event.event_type] ?? ACTIVITY_EVENT_CONFIG.clock_in;
                        const IconComp = config.icon;
                        const details = event.details as Record<string, unknown>;

                        // Build detail text based on event type
                        let detailText = '';
                        switch (event.event_type) {
                          case 'clock_in':
                            if (details.notes) detailText = String(details.notes);
                            break;
                          case 'clock_out':
                            if (typeof details.total_worked_minutes === 'number') {
                              detailText = `Worked ${formatMinutesToHHMM(details.total_worked_minutes as number)}`;
                              if (typeof details.overtime_minutes === 'number' && (details.overtime_minutes as number) > 0) {
                                detailText += ` (${formatMinutesToHHMM(details.overtime_minutes as number)} OT)`;
                              }
                            }
                            break;
                          case 'break_start':
                            if (details.break_label) detailText = String(details.break_label);
                            else if (details.break_type) detailText = String(details.break_type) + ' break';
                            break;
                          case 'break_end': {
                            const parts: string[] = [];
                            if (details.break_label) parts.push(String(details.break_label));
                            if (typeof details.duration_minutes === 'number') parts.push(`${details.duration_minutes} min`);
                            detailText = parts.join(' — ');
                            break;
                          }
                          case 'dispute_submitted':
                            if (details.dispute_type) detailText = `Type: ${String(details.dispute_type).replace('_', ' ')}`;
                            break;
                          case 'dispute_approved':
                            if (details.review_notes) detailText = String(details.review_notes);
                            break;
                          case 'dispute_rejected':
                            if (details.review_notes) detailText = String(details.review_notes);
                            break;
                          case 'manual_edit':
                            if (details.field_changed) {
                              detailText = `${String(details.field_changed).replace(/_/g, ' ')}`;
                              if (details.reason) detailText += ` — ${String(details.reason)}`;
                            }
                            break;
                          case 'shift_missed':
                            if (details.scheduled_start) {
                              detailText = `Scheduled: ${formatTime(String(details.scheduled_start))} — ${formatTime(String(details.scheduled_end))}`;
                            }
                            break;
                        }

                        return (
                          <div
                            key={`${event.event_type}-${event.timestamp}-${event.session_id ?? idx}`}
                            className="relative flex gap-4 py-3 px-1"
                          >
                            {/* Icon */}
                            <div
                              className={`relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
                            >
                              <IconComp className={`h-5 w-5 ${config.color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {formatEmployeeName(event.user)}
                                  </p>
                                  <p className={`text-sm font-medium ${config.color}`}>
                                    {config.label}
                                  </p>
                                  {event.project && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      {event.project.name}
                                    </p>
                                  )}
                                  {detailText && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                      {detailText}
                                    </p>
                                  )}
                                </div>

                                <div className="flex-shrink-0 text-right">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {formatRelativeTime(event.timestamp)}
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">
                                    {formatEventTimestamp(event.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Load More button */}
                  {afHasMore && (
                    <div className="mt-6 flex justify-center">
                      <Button
                        variant="secondary"
                        onClick={handleLoadMoreActivity}
                        loading={afLoadingMore}
                        disabled={afLoadingMore}
                        size="md"
                      >
                        {afLoadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load More'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Initial state */}
              {!afGenerated && !afLoading && !afError && (
                <div className="mt-8 flex flex-col items-center text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/20 mb-4">
                    <Activity className="h-8 w-8 text-purple-400 dark:text-purple-500" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    View the latest time clock activity
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                    Clock-ins, breaks, disputes, and edits in a single timeline. Click &quot;Load Activity&quot; to get started.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
