/**
 * Voice AI Admin — Usage Dashboard Page
 * Sprint FSA05: Platform-wide aggregate usage report with month navigation
 *
 * Route: /admin/voice-ai/usage
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Phone,
  Clock,
  DollarSign,
  Building2,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { getAdminUsageReport } from '@/lib/api/voice-ai-admin';
import type { AdminUsageReport } from '@/lib/types/voice-ai-admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Convert STT seconds to display minutes (rounded to 1 decimal) */
function secondsToMinutes(seconds: number): string {
  return (seconds / 60).toFixed(1);
}

/** Format cost as $X.XX */
function formatCost(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Extract tenant display name from a by_tenant record */
function getTenantName(t: AdminUsageReport['by_tenant'][number]): string {
  return t.tenant_name ?? t.company_name ?? t.tenant_id.slice(0, 8);
}

// ─── Month/Year Picker ────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthYearPickerProps {
  year: number;
  month: number; // 1-based
  onChange: (year: number, month: number) => void;
}

function MonthYearPicker({ year, month, onChange }: MonthYearPickerProps) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;

  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  // Sync picker year when external year changes
  useEffect(() => { setPickerYear(year); }, [year]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isFuture = (y: number, m: number) =>
    y > nowYear || (y === nowYear && m > nowMonth);

  const handleMonthClick = (m: number) => {
    if (isFuture(pickerYear, m)) return;
    onChange(pickerYear, m);
    setOpen(false);
  };

  const canGoNextYear = pickerYear < nowYear;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button — shows current selection, opens picker */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
          'border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-800',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'text-gray-900 dark:text-white',
          open ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900' : '',
        ].join(' ')}
        aria-label="Open month/year picker"
      >
        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-base font-bold">{MONTH_NAMES[month - 1]} {year}</span>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Picker popover */}
      {open && (
        <div
          className={[
            'absolute z-50 mt-2 left-1/2 -translate-x-1/2',
            'w-72 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700',
            'bg-white dark:bg-gray-800 p-4',
          ].join(' ')}
        >
          {/* Year row */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setPickerYear((y) => y - 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Previous year"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {pickerYear}
            </span>
            <button
              onClick={() => canGoNextYear && setPickerYear((y) => y + 1)}
              disabled={!canGoNextYear}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next year"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_ABBR.map((abbr, idx) => {
              const m = idx + 1;
              const isSelected = pickerYear === year && m === month;
              const isToday = pickerYear === nowYear && m === nowMonth;
              const disabled = isFuture(pickerYear, m);
              return (
                <button
                  key={abbr}
                  onClick={() => handleMonthClick(m)}
                  disabled={disabled}
                  className={[
                    'py-2 rounded-lg text-sm font-medium transition-colors',
                    disabled
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isToday
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-700'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                  ].join(' ')}
                >
                  {abbr}
                </button>
              );
            })}
          </div>

          {/* Go to current month shortcut */}
          {!(year === nowYear && month === nowMonth) && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
              <button
                onClick={() => { onChange(nowYear, nowMonth); setOpen(false); }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Go to current month
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color: string;
}

function SummaryCard({ icon, label, value, subtext, color }: SummaryCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${color} flex-shrink-0`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtext}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function VoiceAiUsagePage() {
  // ── Month/year navigation
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based

  // ── Data state
  const [report, setReport] = useState<AdminUsageReport | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Error modal
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '' });
  const showError = (title: string, message: string) =>
    setErrorModal({ open: true, title, message });

  // ── Navigation helpers
  const navigateMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    // Don't navigate into the future
    const target = new Date(newYear, newMonth - 1, 1);
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    if (target > current) return;
    setYear(newYear);
    setMonth(newMonth);
  };

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  // ── Load report
  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminUsageReport(year, month);
      setReport(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load usage report';
      showError('Load Failed', msg);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Voice AI — Usage Report
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Platform-wide Voice AI usage aggregated by month
            </p>
          </div>
        </div>
      </div>

      {/* Month Selector */}
      <Card className="p-4">
        <div className="flex items-center justify-center gap-2">
          {/* Prev arrow */}
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Month/year picker (click to open grid) */}
          <MonthYearPicker
            year={year}
            month={month}
            onChange={(y, m) => { setYear(y); setMonth(m); }}
          />

          {/* Next arrow */}
          <button
            onClick={() => navigateMonth(1)}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {isCurrentMonth && (
          <p className="text-center text-xs text-blue-600 dark:text-blue-400 font-medium mt-2">
            Current Month
          </p>
        )}
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SummaryCard
              icon={<Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              label="Total Calls"
              value={report.total_calls.toLocaleString()}
              subtext="Voice AI calls this month"
              color="bg-blue-100 dark:bg-blue-900/30"
            />
            <SummaryCard
              icon={<Clock className="w-5 h-5 text-green-600 dark:text-green-400" />}
              label="Total Minutes Used"
              value={secondsToMinutes(report.total_stt_seconds)}
              subtext={`${report.total_stt_seconds.toLocaleString()} STT seconds`}
              color="bg-green-100 dark:bg-green-900/30"
            />
            <SummaryCard
              icon={<DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
              label="Estimated Cost"
              value={formatCost(report.total_estimated_cost)}
              subtext="Across all tenants"
              color="bg-purple-100 dark:bg-purple-900/30"
            />
          </div>

          {/* Per-Tenant Breakdown */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Per-Tenant Breakdown
              </h2>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                Sorted by cost (highest first)
              </span>
            </div>

            {report.by_tenant.length === 0 ? (
              <div className="text-center py-16">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No usage data</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  No Voice AI calls were made in {MONTH_NAMES[month - 1]} {year}.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        {[
                          'Tenant',
                          'Calls',
                          'Minutes Used',
                          'STT Seconds',
                          'Estimated Cost',
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                      {report.by_tenant.map((t) => (
                        <tr
                          key={t.tenant_id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          {/* Tenant */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {getTenantName(t)}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                  {t.tenant_id.slice(0, 8)}…
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Calls */}
                          <td className="px-5 py-4">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {t.total_calls.toLocaleString()}
                            </span>
                          </td>

                          {/* Minutes Used (converted from STT seconds) */}
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {secondsToMinutes(t.total_stt_seconds)} min
                            </span>
                          </td>

                          {/* STT Seconds */}
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {t.total_stt_seconds.toLocaleString()}s
                            </span>
                          </td>

                          {/* Estimated Cost */}
                          <td className="px-5 py-4">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {formatCost(t.estimated_cost)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Total row */}
                    {report.by_tenant.length > 1 && (
                      <tfoot className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        <tr>
                          <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                            Total
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">
                            {report.total_calls.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">
                            {secondsToMinutes(report.total_stt_seconds)} min
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">
                            {report.total_stt_seconds.toLocaleString()}s
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white">
                            {formatCost(report.total_estimated_cost)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Mobile card view */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {report.by_tenant.map((t) => (
                    <div key={t.tenant_id} className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {getTenantName(t)}
                          </p>
                          <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                            {t.tenant_id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Calls</p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">
                            {t.total_calls.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Minutes</p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">
                            {secondsToMinutes(t.total_stt_seconds)}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Cost</p>
                          <p className="text-base font-bold text-purple-600 dark:text-purple-400">
                            {formatCost(t.estimated_cost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      ) : null}

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal((s) => ({ ...s, open: false }))}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
}
