/**
 * ShiftFormModal — create or edit a single work shift.
 *
 * POST  /api/v1/time-clock/shifts           (create)
 * PATCH /api/v1/time-clock/shifts/:id       (update)
 * DELETE /api/v1/time-clock/shifts/:id      (only when status = "scheduled")
 *
 * The time-picker is HH:MM local time; we combine it with the date input and
 * convert to a real ISO 8601 string (UTC) at submit time. Reverse is done in
 * edit mode so the user always sees times in their local zone.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';

import { Modal, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';

import { SHIFT_STATUS_LABELS } from '@/components/time-clock/ShiftStatusBadge';

import {
  createShift,
  deleteShift,
  updateShift,
} from '@/lib/api/time-clock';
import { getProjectTaskById, getProjectTasks } from '@/lib/api/projects';

import type {
  CreateShiftRequest,
  EmployeeProfile,
  UpdateShiftRequest,
  WorkShift,
  WorkShiftStatus,
} from '@/lib/types/time-clock';
import type { Project, ProjectTask } from '@/lib/types/projects';

interface ShiftFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (shift: WorkShift) => void;
  onDeleted?: (id: string) => void;
  /**
   * Called when a request fails in a way the user cannot recover from inside
   * the form (e.g. the backend refuses to delete a shift in the current
   * status). The parent is expected to surface this via an ErrorModal.
   */
  onError?: (error: { title: string; message: string }) => void;
  employees: EmployeeProfile[];
  projects: Project[];
  /** When provided, the modal runs in edit mode pre-populated with this shift. */
  shift?: WorkShift | null;
  defaultEmployeeId?: string;
  defaultProjectId?: string;
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

interface FieldErrors {
  employee?: string;
  project?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  general?: string;
}

// ---------------------------------------------------------------------------
// Date / time helpers — we intentionally keep the shift on a single calendar
// day in the user's local timezone. If the end time is earlier than the start
// time we treat it as next-day (overnight shift).
// ---------------------------------------------------------------------------

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function composeLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatEmployeeName(e: EmployeeProfile): string {
  const name = [e.user?.first_name, e.user?.last_name].filter(Boolean).join(' ').trim();
  return name || e.user?.email || 'Employee';
}

function formatProjectLabel(p: Project): string {
  return p.project_number ? `${p.project_number} — ${p.name}` : p.name;
}

const STATUS_OPTIONS: { value: WorkShiftStatus; label: string }[] = (
  ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] as WorkShiftStatus[]
).map((v) => ({ value: v, label: SHIFT_STATUS_LABELS[v] }));

// ---------------------------------------------------------------------------

export function ShiftFormModal({
  isOpen,
  onClose,
  onSaved,
  onDeleted,
  onError,
  employees,
  projects,
  shift,
  defaultEmployeeId,
  defaultProjectId,
}: ShiftFormModalProps) {
  const isEdit = !!shift;

  const [employeeId, setEmployeeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<WorkShiftStatus>('scheduled');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Reset / prefill when the modal opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});

    if (shift) {
      const s = new Date(shift.scheduled_start);
      const e = new Date(shift.scheduled_end);
      setEmployeeId(shift.employee_profile_id);
      setProjectId(shift.project_id ?? '');
      setTaskId(shift.task_id ?? '');
      setDateStr(toDateInputValue(s));
      setStartTime(toTimeInputValue(s));
      setEndTime(toTimeInputValue(e));
      setTitle(shift.title ?? '');
      setNotes(shift.notes ?? '');
      setStatus(shift.status);
    } else {
      const today = new Date();
      setEmployeeId(defaultEmployeeId ?? '');
      setProjectId(defaultProjectId ?? '');
      setTaskId('');
      setDateStr(toDateInputValue(today));
      setStartTime('08:00');
      setEndTime('17:00');
      setTitle('');
      setNotes('');
      setStatus('scheduled');
    }
  }, [isOpen, shift, defaultEmployeeId, defaultProjectId]);

  // ---------------------------------------------------------------------------
  // Load tasks for the selected project. In edit mode, if the current task is
  // not in the freshly loaded list (e.g. because it's been archived), we still
  // fetch it by id and merge it in so the user sees what's currently on the
  // shift instead of a blank select.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    if (!projectId) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setTasksLoading(true);
      try {
        const res = await getProjectTasks(projectId, { limit: 100 });
        let items: ProjectTask[] = res.data ?? [];

        if (shift?.task_id && shift.project_id === projectId) {
          const present = items.some((t) => t.id === shift.task_id);
          if (!present) {
            try {
              const extra = await getProjectTaskById(projectId, shift.task_id);
              if (extra) items = [extra, ...items];
            } catch {
              // Task is gone — keep the raw id so the user can pick a replacement.
            }
          }
        }

        if (!cancelled) setTasks(items);
      } catch (err) {
        console.error('[ShiftFormModal] Failed to load tasks', err);
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, shift?.task_id, shift?.project_id]);

  // ---------------------------------------------------------------------------
  // Options
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

  const taskOptions = useMemo(
    () => [
      { value: '', label: 'No task' },
      ...tasks.map((t) => ({ value: t.id, label: t.title })),
    ],
    [tasks],
  );

  // ---------------------------------------------------------------------------
  // Validation — inline, fires on submit
  // ---------------------------------------------------------------------------
  const validate = useCallback((): {
    ok: boolean;
    start: Date | null;
    end: Date | null;
  } => {
    const next: FieldErrors = {};
    let ok = true;
    if (!employeeId) {
      next.employee = 'Select an employee';
      ok = false;
    }
    if (!dateStr) {
      next.date = 'Pick a date';
      ok = false;
    }
    if (!startTime) {
      next.startTime = 'Pick a start time';
      ok = false;
    }
    if (!endTime) {
      next.endTime = 'Pick an end time';
      ok = false;
    }
    const start = composeLocalDateTime(dateStr, startTime);
    let end = composeLocalDateTime(dateStr, endTime);
    // Allow overnight — if end <= start, assume next day.
    if (start && end && end.getTime() <= start.getTime()) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    if (start && end && end.getTime() <= start.getTime()) {
      next.endTime = 'End time must be after start time';
      ok = false;
    }
    setErrors(next);
    return { ok, start, end };
  }, [employeeId, dateStr, startTime, endTime]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    const { ok, start, end } = validate();
    if (!ok || !start || !end) return;
    setSubmitting(true);
    try {
      if (isEdit && shift) {
        const patch: UpdateShiftRequest = {
          employee_profile_id: employeeId,
          project_id: projectId || null,
          task_id: taskId || null,
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
          title: title.trim() ? title.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
          status,
        };
        const saved = await updateShift(shift.id, patch);
        onSaved(saved);
      } else {
        const dto: CreateShiftRequest = {
          employee_profile_id: employeeId,
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
        };
        if (projectId) dto.project_id = projectId;
        if (taskId) dto.task_id = taskId;
        if (title.trim()) dto.title = title.trim();
        if (notes.trim()) dto.notes = notes.trim();
        const saved = await createShift(dto);
        onSaved(saved);
      }
    } catch (err) {
      const s = readStatus(err);
      const message = readMessage(err);
      if (s === 409) {
        setErrors({
          general:
            message ||
            'The backend rejected this shift as a conflict. Review the details and try again.',
        });
      } else if (s === 404) {
        setErrors({ general: message || 'Employee, project, or task not found.' });
      } else if (s === 400) {
        setErrors({
          general: message || 'The request was rejected. Please review the fields.',
        });
      } else {
        setErrors({ general: message || 'Could not save the shift. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    validate,
    isEdit,
    shift,
    employeeId,
    projectId,
    taskId,
    title,
    notes,
    status,
    onSaved,
  ]);

  const handleDelete = useCallback(async () => {
    if (!shift) return;
    setDeleting(true);
    try {
      await deleteShift(shift.id);
      onDeleted?.(shift.id);
      setConfirmDelete(false);
    } catch (err) {
      const s = readStatus(err);
      const message = readMessage(err);
      setConfirmDelete(false);
      // Delete failure is rarely recoverable inside this form — the backend
      // only allows hard-delete on scheduled/cancelled shifts, so once a shift
      // has advanced to in_progress/completed/missed there is nothing the user
      // can do but cancel it via PATCH. Surface via ErrorModal on the parent.
      if (onError) {
        onError({
          title: s === 400 ? 'Cannot delete this shift' : 'Could not delete shift',
          message:
            s === 400
              ? message ||
                `This shift is in "${shift.status}" status and cannot be hard-deleted. Change its status to cancelled first, or leave it as-is.`
              : message ||
                'An unexpected error happened while deleting the shift. Please try again.',
        });
      } else {
        setErrors({
          general: message || 'Could not delete the shift. Please try again.',
        });
      }
    } finally {
      setDeleting(false);
    }
  }, [shift, onDeleted, onError]);

  // Live API rule (verified against /api/v1/time-clock/shifts/:id DELETE):
  // only `scheduled` and `cancelled` shifts can be hard-deleted. Every other
  // status returns 400 "Cannot delete shift with status …". This matches the
  // sprint spec (Task 6) and overrides the narrower wording in the API docs.
  const canDelete = isEdit && (shift?.status === 'scheduled' || shift?.status === 'cancelled');

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={submitting || deleting ? () => undefined : onClose}
        size="xl"
        title={
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              {isEdit ? (
                <Pencil className="h-5 w-5" aria-hidden="true" />
              ) : (
                <CalendarPlus className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            {isEdit ? 'Edit Shift' : 'Create Shift'}
          </span>
        }
      >
        <div className="space-y-5">
          <Select
            label="Employee"
            required
            placeholder="Pick an employee"
            options={employeeOptions}
            value={employeeId}
            onChange={(v) => {
              setEmployeeId(v);
              if (errors.employee) setErrors((e) => ({ ...e, employee: undefined }));
            }}
            searchable={employeeOptions.length > 5}
            error={errors.employee}
            disabled={submitting}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Project"
              options={projectOptions}
              value={projectId}
              onChange={(v) => {
                setProjectId(v);
                setTaskId('');
              }}
              searchable={projectOptions.length > 6}
              disabled={submitting}
            />
            <Select
              label="Task"
              options={taskOptions}
              value={taskId}
              onChange={setTaskId}
              searchable={taskOptions.length > 6}
              disabled={submitting || !projectId || tasksLoading}
              helperText={
                !projectId
                  ? 'Pick a project first'
                  : tasksLoading
                  ? 'Loading tasks…'
                  : tasks.length === 0
                  ? 'This project has no tasks'
                  : undefined
              }
            />
          </div>

          <DatePicker
            label="Date"
            required
            value={dateStr}
            onChange={(e) => {
              setDateStr(e.target.value);
              if (errors.date) setErrors((er) => ({ ...er, date: undefined }));
            }}
            error={errors.date}
            disabled={submitting}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TimePicker
              label="Start time"
              required
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                if (errors.startTime) setErrors((er) => ({ ...er, startTime: undefined }));
              }}
              error={errors.startTime}
              disabled={submitting}
            />
            <TimePicker
              label="End time"
              required
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                if (errors.endTime) setErrors((er) => ({ ...er, endTime: undefined }));
              }}
              error={errors.endTime}
              helperText={!errors.endTime ? 'Earlier than start = overnight shift' : undefined}
              disabled={submitting}
            />
          </div>

          <Input
            label="Title"
            placeholder="Morning shift, Weekend coverage…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            disabled={submitting}
          />

          <Textarea
            label="Notes"
            placeholder="Anything the employee should know?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={submitting}
          />

          {isEdit && (
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v as WorkShiftStatus)}
              disabled={submitting}
              helperText="Use Cancelled instead of delete for non-scheduled shifts."
            />
          )}

          {errors.general && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              {errors.general}
            </div>
          )}
        </div>

        <ModalActions className="flex-col gap-2 sm:flex-row sm:gap-3">
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting || deleting}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 sm:mr-auto"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete Shift
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting || deleting}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={submitting} disabled={deleting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Shift'}
          </Button>
        </ModalActions>
      </Modal>

      <DeleteConfirmationModal
        isOpen={confirmDelete}
        onClose={() => (deleting ? undefined : setConfirmDelete(false))}
        onConfirm={handleDelete}
        title="Delete this shift?"
        message={
          shift
            ? `This permanently removes the shift "${
                shift.title ?? 'Untitled'
              }". This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        isDeleting={deleting}
      />
    </>
  );
}

export default ShiftFormModal;
