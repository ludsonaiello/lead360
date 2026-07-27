'use client';

/**
 * Shifts Admin — /workforce/shifts (Sprint 7, time-clock)
 *
 * Tenant-wide scheduled shift management for Owners, Admins, and Project
 * Managers. Filters by employee, project, date range, and status. Supports
 * create, bulk-create, edit (inline modal) and delete (scheduled only).
 *
 * Endpoints:
 *  • GET    /api/v1/time-clock/shifts
 *  • POST   /api/v1/time-clock/shifts
 *  • POST   /api/v1/time-clock/shifts/bulk
 *  • PATCH  /api/v1/time-clock/shifts/:id
 *  • DELETE /api/v1/time-clock/shifts/:id
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  endOfDay,
  format,
  parseISO,
  startOfDay,
} from 'date-fns';
import {
  AlertCircle,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  Clock,
  Filter,
  Layers,
  Pencil,
  RefreshCw,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';

import {
  ShiftStatusBadge,
  SHIFT_STATUS_LABELS,
} from '@/components/time-clock/ShiftStatusBadge';
import { ShiftFormModal } from '@/components/time-clock/ShiftFormModal';
import { BulkCreateShiftsModal } from '@/components/time-clock/BulkCreateShiftsModal';

import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

import {
  deleteShift,
  listEmployeeProfiles,
  listShifts,
} from '@/lib/api/time-clock';
import { getProjects } from '@/lib/api/projects';

import type {
  EmployeeProfile,
  ShiftFilterParams,
  WorkShift,
  WorkShiftStatus,
} from '@/lib/types/time-clock';
import type { Project } from '@/lib/types/projects';

const PAGE_SIZE = 20;

// Axios interceptor flattens errors — read status/message from the top level.
interface ApiErrorShape {
  status?: number;
  message?: string | string[];
  error?: string;
  data?: { message?: string | string[] };
}

function readApiMessage(err: unknown): string | undefined {
  const e = err as ApiErrorShape;
  const raw = e?.message ?? e?.data?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  return typeof raw === 'string' ? raw : undefined;
}

const STATUS_FILTER_OPTIONS: { value: '' | WorkShiftStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'scheduled', label: SHIFT_STATUS_LABELS.scheduled },
  { value: 'in_progress', label: SHIFT_STATUS_LABELS.in_progress },
  { value: 'completed', label: SHIFT_STATUS_LABELS.completed },
  { value: 'missed', label: SHIFT_STATUS_LABELS.missed },
  { value: 'cancelled', label: SHIFT_STATUS_LABELS.cancelled },
];

function formatEmployeeName(e?: EmployeeProfile): string {
  if (!e?.user) return 'Unknown Employee';
  const name = [e.user.first_name, e.user.last_name].filter(Boolean).join(' ').trim();
  return name || e.user.email || 'Unknown Employee';
}

function formatShiftDate(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE, MMM d');
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

function ShiftsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 h-10 w-48 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  usePageTitle('Shift Scheduling — Time Clock');
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { canPerform, loading: rbacLoading } = useRBAC();
  const canManage = canPerform('timeclock', 'manage_shifts');

  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [page, setPage] = useState(1);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | WorkShiftStatus>('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkShift | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successState, setSuccessState] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [errorState, setErrorState] = useState<{ title: string; message: string } | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // RBAC gate
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rbacLoading && !canManage) {
      router.replace('/forbidden');
    }
  }, [rbacLoading, canManage, router]);

  // ---------------------------------------------------------------------------
  // References (employees + projects) — used for filters and modals
  // ---------------------------------------------------------------------------
  const loadReferences = useCallback(async () => {
    try {
      const [empRes, projRes] = await Promise.all([
        listEmployeeProfiles({ limit: 100, is_active: true }).catch(() => null),
        getProjects({ limit: 100 }).catch(() => null),
      ]);
      setEmployees(empRes?.data ?? []);
      setProjects(projRes?.data ?? []);
    } catch (err) {
      console.error('[ShiftsPage] Failed to load references', err);
    }
  }, []);

  useEffect(() => {
    if (rbacLoading || !canManage) return;
    loadReferences();
  }, [rbacLoading, canManage, loadReferences]);

  // ---------------------------------------------------------------------------
  // Shifts loader
  // ---------------------------------------------------------------------------
  const loadShifts = useCallback(async () => {
    if (rbacLoading || !canManage) return;
    setLoading(true);
    setListError(null);
    try {
      const params: ShiftFilterParams = { page, limit: PAGE_SIZE };
      if (employeeFilter) params.employee_profile_id = employeeFilter;
      if (projectFilter) params.project_id = projectFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = startOfDay(dateFrom).toISOString();
      if (dateTo) params.date_to = endOfDay(dateTo).toISOString();
      const res = await listShifts(params);
      setShifts(res.data || []);
      setTotalPages(Math.max(1, res.meta?.totalPages ?? 1));
      setTotalRows(res.meta?.total ?? 0);
    } catch (err) {
      console.error('[ShiftsPage] Failed to load shifts', err);
      setListError(readApiMessage(err) || 'Could not load shifts.');
    } finally {
      setLoading(false);
    }
  }, [
    rbacLoading,
    canManage,
    page,
    employeeFilter,
    projectFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const resetFilters = useCallback(() => {
    setEmployeeFilter('');
    setProjectFilter('');
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

  const handleShiftSaved = useCallback(
    async (saved: WorkShift) => {
      const wasEdit = editingShift !== null;
      setCreateOpen(false);
      setEditingShift(null);
      setSuccessState({
        title: wasEdit ? 'Shift updated' : 'Shift created',
        message: wasEdit
          ? 'Your changes have been saved.'
          : `The shift "${saved.title ?? 'Untitled'}" was added to the schedule.`,
      });
      if (!wasEdit) setPage(1);
      await loadShifts();
      return saved;
    },
    [editingShift, loadShifts],
  );

  const handleShiftDeleted = useCallback(async () => {
    setEditingShift(null);
    setSuccessState({
      title: 'Shift deleted',
      message: 'The shift has been removed from the schedule.',
    });
    await loadShifts();
  }, [loadShifts]);

  const handleConfirmDeleteFromCard = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteShift(pendingDelete.id);
      const label = pendingDelete.title || formatEmployeeName(pendingDelete.employee_profile);
      setPendingDelete(null);
      setSuccessState({
        title: 'Shift deleted',
        message: `The shift "${label}" has been removed from the schedule.`,
      });
      await loadShifts();
    } catch (err) {
      console.error('[ShiftsPage] Failed to delete shift', err);
      const message = readApiMessage(err);
      const s = (err as ApiErrorShape)?.status;
      setPendingDelete(null);
      setErrorState({
        title: s === 400 ? 'Cannot delete this shift' : 'Could not delete shift',
        message:
          s === 400
            ? message ||
              `This shift is in "${pendingDelete.status}" status and cannot be hard-deleted. Change its status to cancelled first.`
            : message || 'Please try again in a moment.',
      });
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, loadShifts]);

  const handleBulkSuccess = useCallback(
    async (count: number) => {
      setBulkOpen(false);
      setSuccessState({
        title: `${count} shift${count === 1 ? '' : 's'} created`,
        message:
          count === 1
            ? 'The shift was added to your schedule.'
            : `${count} shifts have been added to your schedule.`,
      });
      setPage(1);
      await loadShifts();
    },
    [loadShifts],
  );

  // ---------------------------------------------------------------------------
  // Filter options
  // ---------------------------------------------------------------------------
  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...employees
        .map((e) => ({ value: e.id, label: formatEmployeeName(e) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [employees],
  );

  const projectOptions = useMemo(
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

  const activeFilterCount = [
    employeeFilter,
    projectFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  const isInitialLoad = loading && shifts.length === 0 && !listError;

  // ---------------------------------------------------------------------------
  // Gates
  // ---------------------------------------------------------------------------
  if (authLoading || rbacLoading) return <ShiftsPageSkeleton />;
  if (!canManage) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <Breadcrumb
          items={[
            { label: 'Workforce', href: '/workforce/clock' },
            { label: 'Shifts' },
          ]}
        />

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
            onClick={() => {
              loadReferences();
              loadShifts();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
            aria-label="Refresh shifts"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>

        <header className="mt-4 mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Shifts
            </h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Schedule and manage work shifts for your team.
            </p>
          </div>
        </header>

        {/* Primary actions — stacked on mobile */}
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto]">
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={employees.length === 0}
            className="justify-center"
          >
            <CalendarPlus className="h-5 w-5" aria-hidden="true" />
            Create Shift
          </Button>
          <Button
            variant="secondary"
            onClick={() => setBulkOpen(true)}
            disabled={employees.length === 0}
            className="justify-center"
          >
            <Layers className="h-5 w-5" aria-hidden="true" />
            Bulk Create
          </Button>
        </div>

        {/* Filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 sm:cursor-default"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="shifts-filters"
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
            id="shifts-filters"
            className={`${filtersOpen ? 'mt-4' : 'mt-0 hidden'} sm:mt-4 sm:block`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Employee"
                options={employeeOptions}
                value={employeeFilter}
                onChange={(v) => {
                  setEmployeeFilter(v);
                  setPage(1);
                }}
                searchable={employeeOptions.length > 6}
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
                options={
                  STATUS_FILTER_OPTIONS as unknown as { value: string; label: string }[]
                }
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v as '' | WorkShiftStatus);
                  setPage(1);
                }}
                className="sm:col-span-2 lg:col-span-1"
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
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Could not load shifts</p>
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
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
                />
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                {activeFilterCount > 0 ? 'No shifts match' : 'No shifts yet'}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {activeFilterCount > 0
                  ? 'Try clearing filters to see more results.'
                  : 'Create your first shift to start scheduling the team.'}
              </p>
              <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                {activeFilterCount > 0 ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                    Create Shift
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {totalRows} shift{totalRows === 1 ? '' : 's'}
              </p>
              <ul className="space-y-3">
                {shifts.map((s) => (
                  <ShiftRowCard
                    key={s.id}
                    shift={s}
                    onEdit={() => setEditingShift(s)}
                    onDelete={() => setPendingDelete(s)}
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

      {/* Create */}
      <ShiftFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={handleShiftSaved}
        onError={setErrorState}
        employees={employees}
        projects={projects}
        shift={null}
      />

      {/* Edit */}
      <ShiftFormModal
        isOpen={editingShift !== null}
        onClose={() => setEditingShift(null)}
        onSaved={handleShiftSaved}
        onDeleted={handleShiftDeleted}
        onError={setErrorState}
        employees={employees}
        projects={projects}
        shift={editingShift}
      />

      {/* Bulk */}
      <BulkCreateShiftsModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={handleBulkSuccess}
        employees={employees}
        projects={projects}
      />

      {/* Inline delete confirmation from a row card */}
      <DeleteConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        onConfirm={handleConfirmDeleteFromCard}
        title="Delete this shift?"
        message={
          pendingDelete
            ? `This permanently removes the shift for ${formatEmployeeName(
                pendingDelete.employee_profile,
              )} on ${formatShiftDate(
                pendingDelete.scheduled_start,
              )}. This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        isDeleting={deleting}
      />

      {/* Success feedback (create / edit / delete / bulk) */}
      <SuccessModal
        isOpen={successState !== null}
        onClose={() => setSuccessState(null)}
        title={successState?.title ?? ''}
        message={successState?.message ?? ''}
      />

      {/* Unrecoverable errors surfaced from child modals */}
      <ErrorModal
        isOpen={errorState !== null}
        onClose={() => setErrorState(null)}
        title={errorState?.title ?? ''}
        message={errorState?.message ?? ''}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card row
// ---------------------------------------------------------------------------

interface ShiftRowCardProps {
  shift: WorkShift;
  onEdit: () => void;
  onDelete: () => void;
}

function ShiftRowCard({ shift, onEdit, onDelete }: ShiftRowCardProps) {
  const dateLabel = formatShiftDate(shift.scheduled_start);
  const startLabel = formatShiftTime(shift.scheduled_start);
  const endLabel = formatShiftTime(shift.scheduled_end);
  const employeeName = formatEmployeeName(shift.employee_profile);
  const projectName = shift.project?.name ?? 'No project';
  // Live API rule: only scheduled and cancelled shifts can be hard-deleted.
  // Any other status gets a 400 from the backend, so we hide the button.
  const canDelete = shift.status === 'scheduled' || shift.status === 'cancelled';

  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ShiftStatusBadge status={shift.status} />
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
              {dateLabel}
            </span>
          </div>

          {shift.title && (
            <p className="text-base font-bold text-gray-900 dark:text-white">
              {shift.title}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span className="font-medium">{employeeName}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
              {startLabel} – {endLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span className="truncate">{projectName}</span>
            </span>
          </div>

          {shift.notes && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-400">
              {shift.notes}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={onEdit}
            aria-label={`Edit shift for ${employeeName} on ${dateLabel}`}
            className="min-h-[44px] min-w-[44px] justify-center"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label={`Delete shift for ${employeeName} on ${dateLabel}`}
              className="min-h-[44px] min-w-[44px] justify-center text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
