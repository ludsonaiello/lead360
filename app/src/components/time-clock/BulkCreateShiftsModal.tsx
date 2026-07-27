/**
 * BulkCreateShiftsModal — POST /api/v1/time-clock/shifts/bulk
 *
 * Two ergonomic modes:
 *
 *   1. Manual   — one row per shift (up to 50). Each row: employee, date,
 *                 start, end, title.
 *   2. Pattern  — multi-select dates × multi-select employees × single
 *                 shared start/end. Generates the cartesian product on the
 *                 fly, with a live preview count.
 *
 * The backend creates atomically — if any row fails, the whole call fails —
 * so we surface a single error that describes what was rejected.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CalendarRange,
  ChevronRight,
  LayoutList,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { Modal, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';

import { bulkCreateShifts } from '@/lib/api/time-clock';
import type {
  BulkCreateShiftsRequest,
  CreateShiftRequest,
  EmployeeProfile,
} from '@/lib/types/time-clock';
import type { Project } from '@/lib/types/projects';

const MAX_SHIFTS = 50;

type Mode = 'manual' | 'pattern';

interface BulkCreateShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdCount: number) => void;
  employees: EmployeeProfile[];
  projects: Project[];
}

interface ManualRow {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
}

// The axios interceptor rewrites errors to a flat shape — read status and
// message from the top level. See src/lib/api/axios.ts response interceptor.
interface ApiErrorShape {
  status?: number;
  message?: string | string[];
  error?: string;
  data?: { message?: string | string[]; error?: string };
}

function readStatus(err: unknown): number | undefined {
  return (err as ApiErrorShape)?.status;
}

function readMessage(err: unknown): string | undefined {
  const e = err as ApiErrorShape;
  const raw = e?.message ?? e?.data?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  return typeof raw === 'string' ? raw : undefined;
}

// ---------------------------------------------------------------------------
// Helpers (shared with ShiftFormModal semantics)
// ---------------------------------------------------------------------------

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function composeLocal(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function formatEmployeeName(e: EmployeeProfile): string {
  const name = [e.user?.first_name, e.user?.last_name].filter(Boolean).join(' ').trim();
  return name || e.user?.email || 'Employee';
}

function formatProjectLabel(p: Project): string {
  return p.project_number ? `${p.project_number} — ${p.name}` : p.name;
}

function composeShiftDateTime(
  dateStr: string,
  startTime: string,
  endTime: string,
): { start: Date; end: Date } | null {
  const start = composeLocal(dateStr, startTime);
  let end = composeLocal(dateStr, endTime);
  if (!start || !end) return null;
  if (end.getTime() <= start.getTime()) {
    // Overnight shift — push end to next day
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}

// ---------------------------------------------------------------------------

export function BulkCreateShiftsModal({
  isOpen,
  onClose,
  onSuccess,
  employees,
  projects,
}: BulkCreateShiftsModalProps) {
  const [mode, setMode] = useState<Mode>('pattern');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');

  // Manual mode
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);

  // Pattern mode
  const [patternDates, setPatternDates] = useState<string[]>([]);
  const [patternDateDraft, setPatternDateDraft] = useState<string>('');
  const [patternEmployeeIds, setPatternEmployeeIds] = useState<string[]>([]);
  const [patternStart, setPatternStart] = useState('08:00');
  const [patternEnd, setPatternEnd] = useState('17:00');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Option lists
  // ---------------------------------------------------------------------------
  const employeeOptions = useMemo(
    () =>
      employees
        .filter((e) => e.is_active)
        .map((e) => ({ value: e.id, label: formatEmployeeName(e) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'No project' },
      ...projects
        .map((p) => ({ value: p.id, label: formatProjectLabel(p) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [projects],
  );

  // ---------------------------------------------------------------------------
  // Reset on open
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    setMode('pattern');
    setProjectId('');
    setTitle('');
    setFormError(null);
    setManualRows([
      {
        id: rid(),
        employeeId: '',
        date: toDateInput(new Date()),
        startTime: '08:00',
        endTime: '17:00',
        title: '',
      },
    ]);
    setPatternDates([toDateInput(new Date())]);
    setPatternDateDraft('');
    setPatternEmployeeIds([]);
    setPatternStart('08:00');
    setPatternEnd('17:00');
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Manual row helpers
  // ---------------------------------------------------------------------------
  const addManualRow = () => {
    if (manualRows.length >= MAX_SHIFTS) return;
    const last = manualRows[manualRows.length - 1];
    setManualRows((rows) => [
      ...rows,
      {
        id: rid(),
        employeeId: last?.employeeId ?? '',
        date: last?.date ?? toDateInput(new Date()),
        startTime: last?.startTime ?? '08:00',
        endTime: last?.endTime ?? '17:00',
        title: last?.title ?? '',
      },
    ]);
  };

  const removeManualRow = (id: string) => {
    setManualRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  };

  const updateManualRow = (id: string, patch: Partial<ManualRow>) => {
    setManualRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  // ---------------------------------------------------------------------------
  // Pattern date helpers
  // ---------------------------------------------------------------------------
  const addPatternDate = () => {
    if (!patternDateDraft) return;
    if (patternDates.includes(patternDateDraft)) {
      setPatternDateDraft('');
      return;
    }
    setPatternDates((d) => [...d, patternDateDraft].sort());
    setPatternDateDraft('');
  };

  const removePatternDate = (d: string) => {
    setPatternDates((dates) => dates.filter((x) => x !== d));
  };

  // ---------------------------------------------------------------------------
  // Preview count
  // ---------------------------------------------------------------------------
  const manualCount = manualRows.length;
  const patternCount = patternDates.length * patternEmployeeIds.length;
  const totalCount = mode === 'manual' ? manualCount : patternCount;
  const overLimit = totalCount > MAX_SHIFTS;

  // ---------------------------------------------------------------------------
  // Build payload
  // ---------------------------------------------------------------------------
  const buildPayload = useCallback((): CreateShiftRequest[] | { error: string } => {
    if (mode === 'manual') {
      if (manualRows.length === 0) return { error: 'Add at least one shift.' };
      const payload: CreateShiftRequest[] = [];
      for (let i = 0; i < manualRows.length; i += 1) {
        const row = manualRows[i];
        if (!row.employeeId) return { error: `Row ${i + 1}: pick an employee.` };
        if (!row.date) return { error: `Row ${i + 1}: pick a date.` };
        const window = composeShiftDateTime(row.date, row.startTime, row.endTime);
        if (!window) return { error: `Row ${i + 1}: end time must be after start time.` };
        const dto: CreateShiftRequest = {
          employee_profile_id: row.employeeId,
          scheduled_start: window.start.toISOString(),
          scheduled_end: window.end.toISOString(),
        };
        if (projectId) dto.project_id = projectId;
        const rowTitle = row.title.trim() || title.trim();
        if (rowTitle) dto.title = rowTitle;
        payload.push(dto);
      }
      return payload;
    }

    // pattern
    if (patternDates.length === 0) return { error: 'Pick at least one date.' };
    if (patternEmployeeIds.length === 0) return { error: 'Pick at least one employee.' };
    const payload: CreateShiftRequest[] = [];
    for (const date of patternDates) {
      const window = composeShiftDateTime(date, patternStart, patternEnd);
      if (!window) return { error: 'End time must be after start time.' };
      for (const empId of patternEmployeeIds) {
        const dto: CreateShiftRequest = {
          employee_profile_id: empId,
          scheduled_start: window.start.toISOString(),
          scheduled_end: window.end.toISOString(),
        };
        if (projectId) dto.project_id = projectId;
        if (title.trim()) dto.title = title.trim();
        payload.push(dto);
      }
    }
    return payload;
  }, [
    mode,
    manualRows,
    patternDates,
    patternEmployeeIds,
    patternStart,
    patternEnd,
    projectId,
    title,
  ]);

  const handleSubmit = async () => {
    setFormError(null);
    if (overLimit) {
      setFormError(`Too many shifts — maximum is ${MAX_SHIFTS} per bulk create.`);
      return;
    }
    const built = buildPayload();
    if ('error' in built) {
      setFormError(built.error);
      return;
    }
    if (built.length === 0) {
      setFormError('Nothing to create. Add at least one shift.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: BulkCreateShiftsRequest = { shifts: built };
      const res = await bulkCreateShifts(payload);
      onSuccess(res.created ?? built.length);
    } catch (err) {
      const s = readStatus(err);
      const message = readMessage(err);
      if (s === 409) {
        setFormError(
          message ||
            'The backend rejected the batch as a conflict. None of the shifts were created.',
        );
      } else if (s === 400) {
        setFormError(
          message ||
            'The request was rejected. Review the rows and try again — nothing was created.',
        );
      } else if (s === 404) {
        setFormError(message || 'A referenced employee or project was not found.');
      } else {
        setFormError(message || 'Could not bulk-create shifts. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            <CalendarRange className="h-5 w-5" aria-hidden="true" />
          </span>
          Bulk Create Shifts
        </span>
      }
    >
      <div className="space-y-5">
        {/* Mode switch */}
        <div
          role="tablist"
          aria-label="Bulk create mode"
          className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'pattern'}
            onClick={() => setMode('pattern')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === 'pattern'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-700 dark:text-blue-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            Pattern
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            onClick={() => setMode('manual')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === 'manual'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-700 dark:text-blue-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <LayoutList className="h-4 w-4" aria-hidden="true" />
            Manual
          </button>
        </div>

        {/* Shared project + title */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Project (applies to all)"
            options={projectOptions}
            value={projectId}
            onChange={setProjectId}
            searchable={projectOptions.length > 6}
            disabled={submitting}
          />
          <Input
            label="Default title"
            placeholder="Optional"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            disabled={submitting}
            helperText={
              mode === 'manual'
                ? 'Used when a row has no title of its own.'
                : 'Shared across every generated shift.'
            }
          />
        </div>

        {mode === 'pattern' ? (
          <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TimePicker
                label="Start time"
                required
                value={patternStart}
                onChange={(e) => setPatternStart(e.target.value)}
                disabled={submitting}
              />
              <TimePicker
                label="End time"
                required
                value={patternEnd}
                onChange={(e) => setPatternEnd(e.target.value)}
                disabled={submitting}
                helperText="Earlier than start = overnight shift"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                Dates <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <DatePicker
                    value={patternDateDraft}
                    onChange={(e) => setPatternDateDraft(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addPatternDate}
                  disabled={submitting || !patternDateDraft}
                  type="button"
                  className="sm:w-auto"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add date
                </Button>
              </div>

              {patternDates.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {patternDates.map((d) => (
                    <li
                      key={d}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                    >
                      <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {d}
                      <button
                        type="button"
                        onClick={() => removePatternDate(d)}
                        className="rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                        aria-label={`Remove ${d}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  No dates yet — add one above.
                </p>
              )}
            </div>

            <MultiSelect
              label="Employees"
              required
              placeholder="Pick one or more employees"
              options={employeeOptions}
              value={patternEmployeeIds}
              onChange={setPatternEmployeeIds}
              searchable={employeeOptions.length > 5}
              disabled={submitting}
            />

            <div className="flex flex-col gap-2 rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                {patternCount === 0
                  ? 'Pick dates and employees to preview…'
                  : `Will generate ${patternCount} shift${patternCount === 1 ? '' : 's'}`}
              </div>
              <div className="text-xs font-medium opacity-80">
                {patternDates.length} date{patternDates.length === 1 ? '' : 's'} ×{' '}
                {patternEmployeeIds.length} employee
                {patternEmployeeIds.length === 1 ? '' : 's'}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            {manualRows.map((row, index) => (
              <div
                key={row.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Shift {index + 1}
                  </h4>
                  {manualRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeManualRow(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      disabled={submitting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <Select
                    label="Employee"
                    required
                    placeholder="Pick an employee"
                    options={employeeOptions}
                    value={row.employeeId}
                    onChange={(v) => updateManualRow(row.id, { employeeId: v })}
                    searchable={employeeOptions.length > 5}
                    disabled={submitting}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <DatePicker
                      label="Date"
                      required
                      value={row.date}
                      onChange={(e) => updateManualRow(row.id, { date: e.target.value })}
                      disabled={submitting}
                    />
                    <TimePicker
                      label="Start"
                      required
                      value={row.startTime}
                      onChange={(e) => updateManualRow(row.id, { startTime: e.target.value })}
                      disabled={submitting}
                    />
                    <TimePicker
                      label="End"
                      required
                      value={row.endTime}
                      onChange={(e) => updateManualRow(row.id, { endTime: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                  <Input
                    label="Title"
                    placeholder="Optional"
                    value={row.title}
                    onChange={(e) => updateManualRow(row.id, { title: e.target.value })}
                    maxLength={100}
                    disabled={submitting}
                  />
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={addManualRow}
              disabled={submitting || manualRows.length >= MAX_SHIFTS}
              type="button"
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add another shift
            </Button>

            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {manualCount} shift{manualCount === 1 ? '' : 's'} ready
            </div>
          </section>
        )}

        {overLimit && (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          >
            Over the {MAX_SHIFTS}-shift limit. Reduce the selection and try again.
          </div>
        )}

        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          >
            {formError}
          </div>
        )}
      </div>

      <ModalActions className="flex-col gap-2 sm:flex-row sm:gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting || overLimit || totalCount === 0}
        >
          {submitting
            ? 'Creating…'
            : totalCount > 0
            ? `Create ${totalCount} Shift${totalCount === 1 ? '' : 's'}`
            : 'Create Shifts'}
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default BulkCreateShiftsModal;
